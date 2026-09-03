import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Client } from "pg";
import { appConfig } from "../../../config/config";
import { prisma } from "../../../db";
import { createStandingReentryManifest } from "../standing.protocol";
import {
  acknowledgeStandingDelivery,
  claimStandingDelivery,
  createStandingConsentSession,
  decideStandingConsent,
} from "../standing.service";

const RUN_ID = `standing-consent-race-${randomUUID()}`;
// Run without another Grant-writing process against this disposable database:
// the short SHARE-table barriers deliberately pause INSERTs until the exact
// approval -> unique-index waiting chain has been observed via pg_blocking_pids.
const realNow = Date.now.bind(Date);
const keys = generateKeyPairSync("ed25519");
const publicKeyPem = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
let fixtureNumber = 0;
let databaseUrl: string;
let observer: Client;
let baseTime: number;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function disposableDatabaseUrl(): string {
  const value = process.env.STANDING_CONSENT_CONCURRENCY_TEST_DATABASE_URL;
  if (process.env.NODE_ENV !== "test" || !value || value !== appConfig.databaseUrl) {
    throw new Error("Consent concurrency tests require an explicit matching disposable database URL");
  }
  const parsed = new URL(value);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || parsed.hostname !== "127.0.0.1" ||
    parsed.port !== "55432" || parsed.pathname !== "/reentry_baseline" ||
    parsed.search !== "" || parsed.hash !== "") {
    throw new Error("Consent concurrency tests are restricted to the task-owned loopback baseline database");
  }
  return value;
}

// Atomic INSERT-only setup, fresh UUID namespace for every probe, no existing
// subject binding. Only each probe's own Connector/HostKey may be changed.
// Fixtures remain in the disposable database; no cleanup is performed.
async function seedFixture() {
  const prefix = `${RUN_ID}-${++fixtureNumber}`;
  const createdAt = new Date(baseTime - 60_000);
  const expiresAt = new Date(baseTime + 300_000);
  const connectorTokens = [randomBytes(32).toString("base64url"), randomBytes(32).toString("base64url")];
  const fixture = {
    prefix,
    origin: "https://standing-consent-races.example",
    subject: `${prefix}-subject-ref`,
    accountId: `${prefix}-account`,
    organizationId: `${prefix}-org`,
    hostKeyId: `${prefix}-host-key`,
    keyId: `${prefix}-key`,
    connectorIds: [`${prefix}-connector-1`, `${prefix}-connector-2`],
    targetIds: [`${prefix}-target-1`, `${prefix}-target-2`],
    connectorTokens,
  };
  await prisma.$transaction(async transaction => {
    await transaction.userAccount.create({ data: {
      id: fixture.accountId, email: `${prefix}@account.example.invalid`, passwordHash: "test-only",
      createdAt, updatedAt: createdAt,
    } });
    await transaction.developerAccount.create({ data: {
      id: `${prefix}-developer`, email: `${prefix}@developer.example.invalid`, passwordHash: "test-only",
      createdAt, updatedAt: createdAt,
    } });
    await transaction.organization.create({ data: {
      id: fixture.organizationId, developerId: `${prefix}-developer`, name: "Owned consent concurrency fixture",
      createdAt, updatedAt: createdAt,
    } });
    await transaction.hostKey.create({ data: {
      id: fixture.hostKeyId, organizationId: fixture.organizationId, hostId: `${prefix}-host`,
      issuerOrigin: fixture.origin, keyId: fixture.keyId, publicKeyPem, createdAt,
    } });
    for (const index of [0, 1]) {
      await transaction.pairingSession.create({ data: {
        id: `${prefix}-pairing-${index + 1}`, accountId: fixture.accountId,
        pairingCodeDigest: digest(`${prefix}-pairing-${index + 1}`), createdAt, expiresAt,
      } });
      await transaction.connector.create({ data: {
        id: fixture.connectorIds[index], accountId: fixture.accountId,
        pairingSessionId: `${prefix}-pairing-${index + 1}`, deliveryTargetId: fixture.targetIds[index],
        tokenDigest: digest(connectorTokens[index]), deviceName: `Owned target ${index + 1}`,
        createdAt, expiresAt,
      } });
    }
  });
  return fixture;
}

type Fixture = Awaited<ReturnType<typeof seedFixture>>;

function manifest(fixture: Fixture, ordinal: number, lifetime = 300_000) {
  return createStandingReentryManifest({
    type: "webmcp.reentry_manifest", protocol_version: "0.2",
    manifest_id: `${fixture.prefix}-manifest-${ordinal}`,
    correlation_id: `${fixture.prefix}-correlation-${ordinal}`,
    issuer_origin: fixture.origin, issued_at: new Date(baseTime).toISOString(),
    offer_expires_at: new Date(baseTime + lifetime).toISOString(),
    workflow: { id: `${fixture.prefix}-workflow-${ordinal}`, type: "race_fixture", state_version: 0,
      canonical_url: `${fixture.origin}/work/${ordinal}` },
    display: { title: "Owned consent race", reason: "Read the current workflow state" },
    grant_request: { authorization_mode: "standing", event_type: "worker.ready",
      grant_expires_at: new Date(baseTime + lifetime + 60_000).toISOString(), max_active_activations: 1,
      human_boundary: "human_review" },
  }, { privateKey: keys.privateKey, keyId: fixture.keyId });
}

async function enroll(fixture: Fixture, ordinal: number, lifetime = 300_000) {
  return createStandingConsentSession({
    organizationId: fixture.organizationId, hostSubjectRef: fixture.subject,
    expectedOrigin: fixture.origin, manifest: manifest(fixture, ordinal, lifetime),
    maximumGrantLifetimeMs: lifetime + 60_000,
  });
}

function approval(fixture: Fixture, challengeId: string, ordinal: number, connector = 0) {
  return {
    challengeId, accountId: fixture.accountId, connectorId: fixture.connectorIds[connector],
    action: "approve" as const, decisionId: `${fixture.prefix}-decision-${ordinal}`,
    decidedAt: new Date(baseTime).toISOString(),
  };
}

type Outcome<T> = { value: T; error?: never } | { value?: never; error: unknown };
function observe<T>(promise: Promise<T>): Promise<Outcome<T>> {
  return promise.then(value => ({ value }), error => ({ error }));
}

async function blockedPid(holderPid: number, queryFragment: string): Promise<number> {
  const deadline = realNow() + 2_000;
  while (realNow() < deadline) {
    const result = await observer.query<{ pid: number }>(
      `SELECT pid FROM pg_stat_activity
       WHERE $1 = ANY(pg_blocking_pids(pid)) AND query LIKE '%' || $2 || '%'
       ORDER BY query_start LIMIT 1`,
      [holderPid, queryFragment],
    );
    if (result.rows[0]) return result.rows[0].pid;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Owned service query did not reach blocked-state barrier: ${queryFragment}`);
}

async function blockedByPid(blockerPid: number, queryFragment: string): Promise<void> {
  const deadline = realNow() + 2_000;
  while (realNow() < deadline) {
    const result = await observer.query<{ blocked: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM pg_stat_activity
       WHERE $1 = ANY(pg_blocking_pids(pid)) AND query LIKE '%' || $2 || '%') AS blocked`,
      [blockerPid, queryFragment],
    );
    if (result.rows[0].blocked) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`Second approval did not reach binding uniqueness barrier: ${queryFragment}`);
}

async function concurrentApprovals(fixture: Fixture, secondConnector: number) {
  const first = await enroll(fixture, 1);
  const second = await enroll(fixture, 2);
  const holder = new Client({ connectionString: databaseUrl });
  await holder.connect();
  let firstPending!: Promise<Outcome<Record<string, unknown>>>;
  let secondPending!: Promise<Outcome<Record<string, unknown>>>;
  try {
    await holder.query("BEGIN");
    await holder.query("LOCK TABLE cr2_standing_grants IN SHARE MODE");
    const result = await holder.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    firstPending = observe(decideStandingConsent(approval(fixture, first.challenge.challenge_id, 1)));
    const firstPid = await blockedPid(result.rows[0].pid, "cr2_standing_grants");
    secondPending = observe(decideStandingConsent(
      approval(fixture, second.challenge.challenge_id, 2, secondConnector),
    ));
    await blockedByPid(firstPid, "cr2_host_subject_bindings");
  } finally {
    await holder.query("ROLLBACK");
    await holder.end();
  }
  return { first, second, results: await Promise.all([firstPending, secondPending]) };
}

async function whileConsentLocked<T>(challengeId: string, start: () => Promise<T>, intervene: () => Promise<void> | void) {
  const holder = new Client({ connectionString: databaseUrl });
  await holder.connect();
  let pending!: Promise<Outcome<T>>;
  try {
    await holder.query("BEGIN");
    await holder.query('SELECT consent_session_id FROM cr2_standing_consent_sessions WHERE challenge_id = $1 FOR UPDATE', [challengeId]);
    const result = await holder.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    pending = observe(start());
    await blockedPid(result.rows[0].pid, "cr2_standing_consent_sessions");
    await intervene();
  } finally {
    await holder.query("ROLLBACK");
    await holder.end();
  }
  return pending;
}

async function whileGrantInsertBlocked<T>(start: () => Promise<T>, intervene: () => Promise<void>) {
  const holder = new Client({ connectionString: databaseUrl });
  await holder.connect();
  let pending!: Promise<Outcome<T>>;
  try {
    await holder.query("BEGIN");
    await holder.query("LOCK TABLE cr2_standing_grants IN SHARE MODE");
    const result = await holder.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    pending = observe(start());
    await blockedPid(result.rows[0].pid, "cr2_standing_grants");
    await intervene();
  } finally {
    await holder.query("ROLLBACK");
    await holder.end();
  }
  return pending;
}

beforeAll(async () => {
  databaseUrl = disposableDatabaseUrl();
  observer = new Client({ connectionString: databaseUrl });
  await observer.connect();
});
beforeEach(() => {
  baseTime = Math.ceil(realNow() / 1_000) * 1_000 + 1_000;
  jest.useFakeTimers({ now: baseTime, doNotFake: [
    "hrtime", "nextTick", "performance", "queueMicrotask", "setImmediate", "clearImmediate",
    "setInterval", "clearInterval", "setTimeout", "clearTimeout",
  ] });
});
afterEach(() => { jest.useRealTimers(); });
afterAll(async () => {
  await observer?.end();
  console.info(`Retained owned standing consent fixture namespace: ${RUN_ID}`);
});

describe("standing Consent concurrency", () => {
  it("converges concurrent same-target approvals to one subject binding and two Grants", async () => {
    const fixture = await seedFixture();
    const { first, second, results } = await concurrentApprovals(fixture, 0);
    expect(results[0].value).toMatchObject({ status: "approved", duplicate: false });
    expect(results[1].value).toMatchObject({ status: "approved", duplicate: false });
    const grants = await prisma.standingGrant.findMany({ where: { organizationId: fixture.organizationId } });
    expect(grants).toHaveLength(2);
    expect(new Set(grants.map(grant => grant.hostSubjectBindingId)).size).toBe(1);
    expect(new Set(grants.map(grant => grant.bindingId)).size).toBe(2);
    expect(await prisma.hostSubjectBinding.count({ where: { organizationId: fixture.organizationId } })).toBe(1);
    expect(await decideStandingConsent(approval(fixture, first.challenge.challenge_id, 1)))
      .toMatchObject({ status: "approved", duplicate: true });
    expect(await decideStandingConsent(approval(fixture, second.challenge.challenge_id, 2)))
      .toMatchObject({ status: "approved", duplicate: true });
    expect(await prisma.standingGrant.count({ where: { organizationId: fixture.organizationId } })).toBe(2);
  });

  it("keeps the original target and rejects a concurrently selected different target", async () => {
    const fixture = await seedFixture();
    const { second, results } = await concurrentApprovals(fixture, 1);
    expect(results[0].value).toMatchObject({ status: "approved" });
    expect(results[1].error).toMatchObject({ code: "host_subject_binding_conflict", statusCode: 409 });
    expect(await prisma.standingGrant.count({ where: { organizationId: fixture.organizationId } })).toBe(1);
    expect(await prisma.hostSubjectBinding.findUniqueOrThrow({
      where: { organizationId_hostSubjectRefDigest: {
        organizationId: fixture.organizationId, hostSubjectRefDigest: digest(fixture.subject),
      } },
    })).toMatchObject({ connectorId: fixture.connectorIds[0], deliveryTargetId: fixture.targetIds[0] });
    expect(await prisma.standingConsentSession.findUniqueOrThrow({ where: { challengeId: second.challenge.challenge_id } }))
      .toMatchObject({ status: "pending", accountId: null });
  });

  it.each(["consent", "connector"] as const)("rechecks %s expiry after a Consent row-lock wait", async authority => {
    const fixture = await seedFixture();
    const enrolled = await enroll(fixture, 1, authority === "consent" ? 1_000 : 300_000);
    if (authority === "connector") {
      await prisma.connector.update({
        where: { id: fixture.connectorIds[0] }, data: { expiresAt: new Date(baseTime + 1_000) },
      });
    }
    const result = await whileConsentLocked(enrolled.challenge.challenge_id, () =>
      decideStandingConsent(approval(fixture, enrolled.challenge.challenge_id, 1)), () => {
        jest.setSystemTime(baseTime + 2_000);
      });
    expect(result.error).toMatchObject({
      code: authority === "consent" ? "consent_decision_expired" : "connector_not_available",
      statusCode: authority === "consent" ? 403 : 409,
    });
    expect(await prisma.standingGrant.count({ where: { organizationId: fixture.organizationId } })).toBe(0);
  });

  it.each(["consent", "connector", "host-key"] as const)("rechecks %s authority after approval waits to persist its Grant", async authority => {
    const fixture = await seedFixture();
    const enrolled = await enroll(fixture, 1, authority === "consent" ? 1_000 : 300_000);
    if (authority === "connector") {
      await prisma.connector.update({
        where: { id: fixture.connectorIds[0] }, data: { expiresAt: new Date(baseTime + 1_000) },
      });
    }
    const result = await whileGrantInsertBlocked(() =>
      decideStandingConsent(approval(fixture, enrolled.challenge.challenge_id, 1)), async () => {
        if (authority === "host-key") {
          await prisma.hostKey.update({ where: { id: fixture.hostKeyId }, data: { revokedAt: new Date() } });
        } else {
          jest.setSystemTime(baseTime + 2_000);
        }
      });
    expect(result.error).toMatchObject({
      code: authority === "host-key" ? "manifest_key_unavailable"
        : authority === "consent" ? "consent_decision_expired" : "connector_not_available",
      statusCode: authority === "host-key" ? 401 : authority === "consent" ? 403 : 409,
    });
    expect(await prisma.standingGrant.count({ where: { organizationId: fixture.organizationId } })).toBe(0);
    expect(await prisma.hostSubjectBinding.count({ where: { organizationId: fixture.organizationId } })).toBe(0);
    expect(await prisma.standingConsentSession.findUniqueOrThrow({ where: { challengeId: enrolled.challenge.challenge_id } }))
      .toMatchObject({ status: "pending", decisionId: null });
  });
});

describe("standing wire-value error precedence", () => {
  it("validates Connector syntax before Claim syntax without touching the database", async () => {
    const transaction = jest.spyOn(prisma, "$transaction");
    try {
      await expect(claimStandingDelivery({ connectorToken: "bad token", claimToken: "bad token" }))
        .rejects.toMatchObject({ code: "connector_token_invalid", statusCode: 403 });
      expect(transaction).not.toHaveBeenCalled();
    } finally { transaction.mockRestore(); }
  });

  it("validates ACK wire values before reporting an unavailable effect authority", async () => {
    const transaction = jest.spyOn(prisma, "$transaction");
    try {
      await expect(acknowledgeStandingDelivery({
        connectorToken: "bad token", deliveryId: "bad id", leaseToken: "bad token", effectToken: "bad token",
      })).rejects.toMatchObject({ code: "connector_token_invalid", statusCode: 403 });
      expect(transaction).not.toHaveBeenCalled();
    } finally { transaction.mockRestore(); }
  });

  it.each([
    { field: "deliveryId", value: "bad id", code: "receiver_identifier_invalid", statusCode: 422 },
    { field: "leaseToken", value: "bad token", code: "delivery_claim_token_invalid", statusCode: 403 },
    { field: "effectToken", value: "bad token", code: "host_effect_token_invalid", statusCode: 403 },
  ])("validates ACK $field before the unavailable-authority gate", async ({ field, value, code, statusCode }) => {
    const input = {
      connectorToken: randomBytes(32).toString("base64url"), deliveryId: "syntax-only-delivery",
      leaseToken: randomBytes(32).toString("base64url"), effectToken: randomBytes(32).toString("base64url"),
      [field]: value,
    };
    const transaction = jest.spyOn(prisma, "$transaction");
    try {
      await expect(acknowledgeStandingDelivery(input)).rejects.toMatchObject({ code, statusCode });
      expect(transaction).not.toHaveBeenCalled();
    } finally { transaction.mockRestore(); }
  });

  it("still returns unavailable authority for syntactically valid ACK input without a database call", async () => {
    const transaction = jest.spyOn(prisma, "$transaction");
    try {
      await expect(acknowledgeStandingDelivery({
        connectorToken: randomBytes(32).toString("base64url"), deliveryId: "syntax-only-delivery",
        leaseToken: randomBytes(32).toString("base64url"), effectToken: randomBytes(32).toString("base64url"),
      })).rejects.toMatchObject({ code: "host_effect_authority_unavailable", statusCode: 501 });
      expect(transaction).not.toHaveBeenCalled();
    } finally { transaction.mockRestore(); }
  });
});
