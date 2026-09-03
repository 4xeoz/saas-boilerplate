import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { Client } from "pg";
import request, { type Response } from "supertest";
import type { StandingContinuationEventEnvelope, StandingPublicBinding } from "../standing.protocol";

function requireDisposableDatabase(): string {
  const value = process.env.STANDING_MIGRATION_TEST_DATABASE_URL;
  if (process.env.NODE_ENV !== "test" || !value) {
    throw new Error("Standing Event concurrency requires NODE_ENV=test and an explicit disposable database URL");
  }
  const parsed = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    parsed.hostname !== "127.0.0.1" || parsed.port !== "55432" ||
    parsed.pathname !== "/reentry_baseline" || parsed.search !== "" || parsed.hash !== ""
  ) {
    throw new Error("Standing Event concurrency is restricted to the task-owned loopback baseline database");
  }
  return value;
}

const databaseUrl = requireDisposableDatabase();
process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = databaseUrl;
process.env.CLOUD_RECEIVER_RUNTIME_DATABASE_URL = "";

// Jest setup can preload config. Fail before a query if it selected anything
// other than the explicitly supplied task-owned database.
const { appConfig }: typeof import("../../../config/config") = require("../../../config/config");
if (appConfig.databaseUrl !== databaseUrl) {
  throw new Error("Standing Event concurrency runtime database does not match the disposable database");
}
const { prisma }: typeof import("../../../db") = require("../../../db");
const { createApp }: typeof import("../../../app") = require("../../../app");
const {
  createStandingContinuationEventEnvelope,
  createStandingReentryManifest,
}: typeof import("../standing.protocol") = require("../standing.protocol");
const {
  createStandingConsentSession,
  decideStandingConsent,
  revokeStandingGrant,
}: typeof import("../standing.service") = require("../standing.service");

const runId = `standing-event-concurrency-${randomUUID()}`;
const keys = generateKeyPairSync("ed25519");
const publicKeyPem = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
const realNow = Date.now.bind(Date);
const app = createApp();
let fixtureNumber = 0;
let observer: Client;

const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
const token = (): string => randomBytes(32).toString("base64url");

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function createFixture() {
  const prefix = `${runId}-${++fixtureNumber}`;
  const ids = {
    account: `${prefix}-account`, developer: `${prefix}-developer`, organization: `${prefix}-org`,
    pairing: `${prefix}-pairing`, connector: `${prefix}-connector`, target: `${prefix}-target`,
    host: `${prefix}-host`, hostKey: `${prefix}-host-key`, key: `${prefix}-key`,
    workflow: `${prefix}-workflow`, correlation: `${prefix}-correlation`,
  };
  const origin = `https://${randomUUID()}.standing.example`;
  const canonicalUrl = `${origin}/work`;
  const connectorToken = token();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60_000);
  // These are prerequisite identities only. All standing authority is created
  // by the production Consent and approval services below.
  await prisma.$transaction(async (transaction) => {
    await transaction.userAccount.create({ data: {
      id: ids.account, email: `${prefix}@user.example.invalid`,
      passwordHash: `!disabled-${randomBytes(32).toString("hex")}`,
    } });
    await transaction.developerAccount.create({ data: {
      id: ids.developer, email: `${prefix}@developer.example.invalid`,
      passwordHash: `!disabled-${randomBytes(32).toString("hex")}`,
    } });
    await transaction.organization.create({ data: {
      id: ids.organization, developerId: ids.developer, name: prefix,
    } });
    await transaction.pairingSession.create({ data: {
      id: ids.pairing, accountId: ids.account, pairingCodeDigest: digest(token()),
      expiresAt, consumedAt: now,
    } });
    await transaction.connector.create({ data: {
      id: ids.connector, accountId: ids.account, pairingSessionId: ids.pairing,
      deliveryTargetId: ids.target, tokenDigest: digest(connectorToken),
      deviceName: prefix, expiresAt,
    } });
    await transaction.hostKey.create({ data: {
      id: ids.hostKey, organizationId: ids.organization, hostId: ids.host,
      issuerOrigin: origin, keyId: ids.key, publicKeyPem,
    } });
  });
  expect(await prisma.standingGrant.count({ where: { organizationId: ids.organization } })).toBe(0);
  const manifest = createStandingReentryManifest({
    type: "webmcp.reentry_manifest", protocol_version: "0.2",
    manifest_id: `${prefix}-manifest`, correlation_id: ids.correlation,
    issuer_origin: origin, issued_at: now.toISOString(),
    offer_expires_at: new Date(now.getTime() + 5 * 60_000).toISOString(),
    workflow: { id: ids.workflow, type: "event_concurrency", state_version: 0, canonical_url: canonicalUrl },
    display: { title: "Standing Event concurrency", reason: "Read current state before the next safe step" },
    grant_request: {
      authorization_mode: "standing", event_type: "workflow.ready",
      grant_expires_at: expiresAt.toISOString(), max_active_activations: 1,
      human_boundary: "confirm_irreversible_action",
    },
  }, { privateKey: keys.privateKey, keyId: ids.key });
  const enrollment = await createStandingConsentSession({
    organizationId: ids.organization, hostSubjectRef: `${prefix}-subject`, expectedOrigin: origin,
    manifest, maximumGrantLifetimeMs: 60 * 60_000,
  });
  const approval = await decideStandingConsent({
    challengeId: enrollment.challenge.challenge_id, accountId: ids.account,
    connectorId: ids.connector, action: "approve", decisionId: `${prefix}-decision`,
    decidedAt: new Date().toISOString(),
  });
  expect(approval).toMatchObject({ status: "approved", duplicate: false });
  const binding = approval.binding as StandingPublicBinding;
  const grant = await prisma.standingGrant.findFirstOrThrow({ where: {
    organizationId: ids.organization, accountId: ids.account, bindingId: binding.binding_id,
  } });
  return { prefix, ids, origin, canonicalUrl, connectorToken, binding, grantId: grant.id };
}

function envelope(fixture: Fixture, sequence: number, discriminator: string): StandingContinuationEventEnvelope {
  const now = new Date();
  return createStandingContinuationEventEnvelope({
    type: "webmcp.continuation_event", protocol_version: "0.2",
    event_id: `${fixture.prefix}-event-${sequence}-${discriminator}`,
    binding_id: fixture.binding.binding_id, correlation_id: fixture.ids.correlation,
    issuer_origin: fixture.origin, workflow_id: fixture.ids.workflow,
    event_type: "workflow.ready", event_sequence: sequence, state_version: sequence,
    occurred_at: now.toISOString(), canonical_url: fixture.canonicalUrl,
  }, {
    privateKey: keys.privateKey, keyId: fixture.ids.key,
    timestamp: String(Math.floor(now.getTime() / 1_000)),
  });
}

function sendEvent(value: StandingContinuationEventEnvelope): Promise<Response> {
  // Calling .then starts the request immediately; retaining a bare SuperTest
  // object would defer it and invalidate the lock-queue barrier.
  return request(app).post("/v0.2/events").send(value).then(response => response);
}

function claim(fixture: Fixture, claimToken: string): Promise<Response> {
  return request(app).post("/v0.2/delivery-claims").send({
    connector_token: fixture.connectorToken, claim_token: claimToken,
  }).then(response => response);
}

async function snapshot(fixture: Fixture) {
  return prisma.$transaction([
    prisma.standingGrant.findUniqueOrThrow({ where: { id: fixture.grantId } }),
    prisma.standingEvent.findMany({ where: { grantId: fixture.grantId }, orderBy: { eventId: "asc" } }),
    prisma.standingDelivery.findMany({ where: { grantId: fixture.grantId }, orderBy: { deliveryId: "asc" } }),
    prisma.standingDeliveryAttempt.findMany({
      where: { delivery: { grantId: fixture.grantId } }, orderBy: { attemptId: "asc" },
    }),
  ]);
}

async function waitForBlocked(holderPid: number, minimum: number): Promise<void> {
  const deadline = realNow() + 3_000;
  while (realNow() < deadline) {
    const result = await observer.query<{ blocked: string }>(
      `WITH RECURSIVE blocked(pid) AS (
         SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))
         UNION
         SELECT activity.pid FROM pg_stat_activity AS activity
         JOIN blocked ON blocked.pid = ANY(pg_blocking_pids(activity.pid))
       ) SELECT count(*)::text AS blocked FROM blocked`,
      [holderPid],
    );
    if (Number(result.rows[0].blocked) >= minimum) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Expected ${minimum} service operations to reach the PostgreSQL lock barrier`);
}

async function holdGrant(fixture: Fixture) {
  const holder = new Client({ connectionString: databaseUrl });
  await holder.connect();
  await holder.query("BEGIN");
  const pid = Number((await holder.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0].pid);
  await holder.query("SELECT grant_id FROM cr2_standing_grants WHERE grant_id = $1 FOR UPDATE", [fixture.grantId]);
  let released = false;
  return {
    pid,
    async release() {
      if (released) return;
      released = true;
      // The holder performs no writes. ROLLBACK releases only its row lock.
      await holder.query("ROLLBACK");
      await holder.end();
    },
  };
}

async function twoOperationsBehindBarrier<First, Second>(
  fixture: Fixture,
  startFirst: () => Promise<First>,
  startSecond: () => Promise<Second>,
): Promise<[First, Second]> {
  const holder = await holdGrant(fixture);
  let firstRequest: Promise<First> | undefined;
  let secondRequest: Promise<Second> | undefined;
  try {
    firstRequest = startFirst();
    // Observe failures immediately while preserving the original rejected promise
    // for the final await. Barrier failures must not leave unhandled rejections.
    void firstRequest.catch(() => undefined);
    await waitForBlocked(holder.pid, 1);
    secondRequest = startSecond();
    void secondRequest.catch(() => undefined);
    await waitForBlocked(holder.pid, 2);
  } finally {
    await holder.release();
    // Even if the barrier assertion fails, finish all launched work before the
    // next fixture or Prisma teardown. No data rollback or cleanup is performed.
    await Promise.allSettled([firstRequest, secondRequest].filter(value => value !== undefined));
  }
  if (!firstRequest || !secondRequest) throw new Error("Service operations did not reach the lock barrier");
  return Promise.all([firstRequest, secondRequest]);
}

afterAll(async () => {
  await observer?.end();
  await prisma.$disconnect();
  console.info(`Retained standing Event concurrency fixture namespace: ${runId}`);
});

beforeAll(async () => {
  observer = new Client({ connectionString: databaseUrl });
  await observer.connect();
});

describe("standing active-v2 Event concurrency over HTTP and PostgreSQL", () => {
  jest.setTimeout(30_000);

  it("serializes different Event IDs at the same next sequence without a loser mutation", async () => {
    const fixture = await createFixture();
    const left = envelope(fixture, 1, "left");
    const right = envelope(fixture, 1, "right");
    const responses = await twoOperationsBehindBarrier(fixture, () => sendEvent(left), () => sendEvent(right));
    expect(responses.map(response => response.status).sort()).toEqual([202, 409]);
    const winner = responses.find(response => response.status === 202)!;
    const loser = responses.find(response => response.status === 409)!;
    expect(loser.body).toEqual({ error: { code: "event_sequence_conflict", retryable: false } });
    expect(winner.body).toMatchObject({ accepted: true, duplicate: false });
    const persisted = await snapshot(fixture);
    expect(persisted[0].lastEventSequence).toBe(1n);
    expect(persisted[1]).toHaveLength(1);
    expect(persisted[2]).toEqual([expect.objectContaining({
      eventId: persisted[1][0].eventId, grantId: fixture.grantId, status: "pending", currentAttempt: 0,
    })]);
    expect(persisted[3]).toEqual([]);
    expect(persisted[1][0].eventId).toBe(winner.body.event_id);
    const winningEnvelope = winner.body.event_id === JSON.parse(left.body).event_id ? left : right;
    const replay = await sendEvent(winningEnvelope);
    expect(replay.status).toBe(202);
    expect(replay.body).toEqual({ ...winner.body, duplicate: true });
    expect(await snapshot(fixture)).toEqual(persisted);
  });

  it("converges concurrent copies of one envelope on one durable acceptance", async () => {
    const fixture = await createFixture();
    const value = envelope(fixture, 1, "same");
    const responses = await twoOperationsBehindBarrier(fixture, () => sendEvent(value), () => sendEvent(value));
    expect(responses.map(response => response.status)).toEqual([202, 202]);
    expect(responses.map(response => response.body.duplicate).sort()).toEqual([false, true]);
    expect(new Set(responses.map(response => response.body.event_id))).toEqual(new Set([JSON.parse(value.body).event_id]));
    const persisted = await snapshot(fixture);
    expect(persisted[0].lastEventSequence).toBe(1n);
    expect(persisted[1]).toHaveLength(1);
    expect(persisted[2]).toHaveLength(1);
    expect(persisted[2][0]).toMatchObject({ status: "pending", currentAttempt: 0 });
    expect(persisted[3]).toEqual([]);
  });

  it("rejects Event without Event/Delivery mutation when revoke is first in the lock queue", async () => {
    const fixture = await createFixture();
    const value = envelope(fixture, 1, "revoke-first");
    const [revoked, rejected] = await twoOperationsBehindBarrier(
      fixture,
      () => revokeStandingGrant({ accountId: fixture.ids.account, bindingId: fixture.binding.binding_id }),
      () => sendEvent(value),
    );
    const afterRevoke = await snapshot(fixture);
    expect(revoked).toMatchObject({ status: "revoked", duplicate: false });
    expect(rejected.status).toBe(410);
    expect(rejected.body).toEqual({ error: { code: "grant_revoked", retryable: false } });
    expect(afterRevoke[0]).toMatchObject({ lastEventSequence: 0n });
    expect(afterRevoke[0].revokedAt).not.toBeNull();
    expect(afterRevoke.slice(1)).toEqual([[], [], []]);
    expect(await snapshot(fixture)).toEqual(afterRevoke);
  });

  it("accepts Event first, then revokes while preserving replay and fencing future work", async () => {
    const fixture = await createFixture();
    const acceptedEnvelope = envelope(fixture, 1, "event-first");
    const [accepted, revoked] = await twoOperationsBehindBarrier(
      fixture,
      () => sendEvent(acceptedEnvelope),
      () => revokeStandingGrant({ accountId: fixture.ids.account, bindingId: fixture.binding.binding_id }),
    );
    expect(accepted.status).toBe(202);
    expect(accepted.body).toMatchObject({ accepted: true, duplicate: false });
    expect(revoked).toMatchObject({ status: "revoked", duplicate: false });
    const afterRevoke = await snapshot(fixture);
    expect(afterRevoke[0].lastEventSequence).toBe(1n);
    expect(afterRevoke[0].revokedAt).not.toBeNull();
    expect(afterRevoke[1]).toHaveLength(1);
    expect(afterRevoke[2]).toEqual([expect.objectContaining({ status: "pending", currentAttempt: 0 })]);

    const historicalReplay = await sendEvent(acceptedEnvelope);
    expect(historicalReplay.status).toBe(202);
    expect(historicalReplay.body).toEqual({ ...accepted.body, duplicate: true });
    expect(await snapshot(fixture)).toEqual(afterRevoke);
    const future = await sendEvent(envelope(fixture, 2, "future"));
    expect(future.status).toBe(410);
    expect(future.body).toEqual({ error: { code: "grant_revoked", retryable: false } });
    expect(await snapshot(fixture)).toEqual(afterRevoke);

    const noWork = await claim(fixture, token());
    expect(noWork.status).toBe(204);
    expect(noWork.text).toBe("");
    const fenced = await snapshot(fixture);
    expect(fenced[0]).toEqual(afterRevoke[0]);
    expect(fenced[1]).toEqual(afterRevoke[1]);
    expect(fenced[2]).toEqual([expect.objectContaining({
      deliveryId: afterRevoke[2][0].deliveryId, status: "cancelled",
      terminalReason: "grant_revoked", currentAttempt: 0,
    })]);
    expect(fenced[3]).toEqual([]);
  });
});
