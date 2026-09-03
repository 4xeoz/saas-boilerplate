import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import type { StandingPublicBinding } from "../standing.protocol";

function requireDisposableDatabase(): string {
  const value = process.env.STANDING_MIGRATION_TEST_DATABASE_URL;
  if (process.env.NODE_ENV !== "test" || !value) {
    throw new Error("Standing delivery profile requires NODE_ENV=test and an explicit disposable database URL");
  }
  const parsed = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    parsed.hostname !== "127.0.0.1" ||
    parsed.port !== "55432" ||
    parsed.pathname !== "/reentry_baseline" ||
    parsed.search !== "" || parsed.hash !== ""
  ) {
    throw new Error("Standing delivery profile is restricted to the task-owned loopback baseline database");
  }
  return value;
}

const databaseUrl = requireDisposableDatabase();
process.env.DATABASE_URL = databaseUrl;
process.env.DIRECT_URL = databaseUrl;
process.env.CLOUD_RECEIVER_RUNTIME_DATABASE_URL = "";

// The global Jest setup may already have loaded config/Prisma. Reject any stale
// configuration before a query rather than silently use another database.
const { appConfig }: typeof import("../../../config/config") = require("../../../config/config");
if (appConfig.databaseUrl !== databaseUrl) {
  throw new Error("Standing delivery profile runtime database does not match the disposable database");
}
const { prisma }: typeof import("../../../db") = require("../../../db");
const { createApp }: typeof import("../../../app") = require("../../../app");
const {
  createStandingReentryManifest,
  createStandingContinuationEventEnvelope,
}: typeof import("../standing.protocol") = require("../standing.protocol");
const {
  createStandingConsentSession,
  decideStandingConsent,
}: typeof import("../standing.service") = require("../standing.service");

const namespace = `standing-delivery-profile-${randomUUID()}`;
const ids = {
  account: `${namespace}-account`,
  developer: `${namespace}-developer`,
  organization: `${namespace}-org`,
  pairing: `${namespace}-pairing`,
  connector: `${namespace}-connector`,
  target: `${namespace}-target`,
  host: `${namespace}-host`,
  hostKey: `${namespace}-host-key`,
  key: `${namespace}-key`,
  workflow: `${namespace}-workflow`,
  correlation: `${namespace}-correlation`,
};
const origin = `https://${namespace}.example`;
const canonicalUrl = `${origin}/work`;
const keys = generateKeyPairSync("ed25519");
const connectorToken = randomBytes(32).toString("base64url");
const digest = (value: string): string => createHash("sha256").update(value).digest("hex");
const token = (): string => randomBytes(32).toString("base64url");
const eventId = (sequence: number): string => `${namespace}-event-${sequence}`;
const app = createApp();

async function createFixture(): Promise<StandingPublicBinding> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60_000);
  // Only prerequisite identities are inserted. Consent, the subject binding,
  // Grant, Events, Deliveries and Attempts are created by normal service calls.
  await prisma.$transaction(async (transaction) => {
    await transaction.userAccount.create({ data: {
      id: ids.account, email: `${namespace}@user.example.invalid`,
      passwordHash: `!disabled-${randomBytes(32).toString("hex")}`,
    } });
    await transaction.developerAccount.create({ data: {
      id: ids.developer, email: `${namespace}@developer.example.invalid`,
      passwordHash: `!disabled-${randomBytes(32).toString("hex")}`,
    } });
    await transaction.organization.create({ data: {
      id: ids.organization, developerId: ids.developer, name: namespace,
    } });
    await transaction.pairingSession.create({ data: {
      id: ids.pairing, accountId: ids.account, pairingCodeDigest: digest(token()),
      expiresAt, consumedAt: now,
    } });
    await transaction.connector.create({ data: {
      id: ids.connector, accountId: ids.account, pairingSessionId: ids.pairing,
      deliveryTargetId: ids.target, tokenDigest: digest(connectorToken),
      deviceName: namespace, expiresAt,
    } });
    await transaction.hostKey.create({ data: {
      id: ids.hostKey, organizationId: ids.organization, hostId: ids.host,
      issuerOrigin: origin, keyId: ids.key,
      publicKeyPem: keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
    } });
  });
  expect(await prisma.standingGrant.count({ where: { organizationId: ids.organization } })).toBe(0);
  const manifest = createStandingReentryManifest({
    type: "webmcp.reentry_manifest", protocol_version: "0.2",
    manifest_id: `${namespace}-manifest`, correlation_id: ids.correlation,
    issuer_origin: origin, issued_at: now.toISOString(),
    offer_expires_at: new Date(now.getTime() + 5 * 60_000).toISOString(),
    workflow: { id: ids.workflow, type: "delivery_profile", state_version: 0, canonical_url: canonicalUrl },
    display: { title: "Standing delivery profile", reason: "Read current state before the next safe step" },
    grant_request: {
      authorization_mode: "standing", event_type: "workflow.ready",
      grant_expires_at: expiresAt.toISOString(), max_active_activations: 1,
      human_boundary: "confirm_irreversible_action",
    },
  }, { privateKey: keys.privateKey, keyId: ids.key });
  // Shell routes remain unspecified; these calls explicitly carry the same account.
  const enrollment = await createStandingConsentSession({
    organizationId: ids.organization, hostSubjectRef: `${namespace}-subject`,
    expectedOrigin: origin, manifest, maximumGrantLifetimeMs: 60 * 60_000,
  });
  expect(enrollment.duplicate).toBe(false);
  const approval = await decideStandingConsent({
    challengeId: enrollment.challenge.challenge_id, accountId: ids.account,
    connectorId: ids.connector, action: "approve", decisionId: `${namespace}-decision`,
    decidedAt: new Date().toISOString(),
  });
  expect(approval).toMatchObject({ status: "approved", duplicate: false });
  const binding = approval.binding as StandingPublicBinding;
  expect(binding).toMatchObject({ status: "active", last_event_sequence: 0 });
  return binding;
}

function sendEvent(binding: StandingPublicBinding, sequence: number) {
  const now = new Date();
  const envelope = createStandingContinuationEventEnvelope({
    type: "webmcp.continuation_event", protocol_version: "0.2", event_id: eventId(sequence),
    binding_id: binding.binding_id, correlation_id: ids.correlation, issuer_origin: origin,
    workflow_id: ids.workflow, event_type: "workflow.ready", event_sequence: sequence,
    state_version: sequence, occurred_at: now.toISOString(), canonical_url: canonicalUrl,
  }, { privateKey: keys.privateKey, keyId: ids.key, timestamp: String(Math.floor(now.getTime() / 1_000)) });
  return request(app).post("/v0.2/events").send(envelope);
}

function claim(claimToken: string) {
  return request(app).post("/v0.2/delivery-claims")
    .send({ connector_token: connectorToken, claim_token: claimToken });
}

async function snapshot(grantId: string) {
  return prisma.$transaction([
    prisma.standingGrant.findUniqueOrThrow({ where: { id: grantId } }),
    prisma.standingEvent.findMany({ where: { grantId }, orderBy: { eventSequence: "asc" } }),
    prisma.standingDelivery.findMany({ where: { grantId }, orderBy: { deliveryId: "asc" } }),
    prisma.standingDeliveryAttempt.findMany({
      where: { delivery: { grantId } }, orderBy: { attempt: "asc" },
    }),
  ]);
}

async function expireOwnedLease(grantId: string, deliveryId: string, attempt: number, claimToken: string) {
  const claimDigest = digest(claimToken);
  await prisma.$transaction(async (transaction) => {
    const current = await transaction.standingDelivery.findUniqueOrThrow({ where: { deliveryId } });
    expect(current).toMatchObject({
      grantId, eventId: eventId(1), deliveryTargetId: ids.target, status: "leased",
      currentAttempt: attempt, currentConnectorId: ids.connector,
      currentClaimTokenDigest: claimDigest, currentLeaseTokenDigest: claimDigest,
    });
    expect(current.leaseStartedAt).not.toBeNull();
    expect(current.leaseExpiresAt).not.toBeNull();
    const duration = current.leaseExpiresAt!.getTime() - current.leaseStartedAt!.getTime();
    expect(duration).toBeGreaterThan(0);
    const expiredAt = new Date(Date.now() - 1_000);
    const startedAt = new Date(expiredAt.getTime() - duration);
    // Raw UPDATE is deliberate: Prisma's @updatedAt would mutate a non-lease
    // field. Both writes are CAS-fenced to this suite's exact generated rows.
    const deliveries = await transaction.$executeRaw`
      UPDATE cr2_standing_deliveries
      SET lease_started_at = ${startedAt}, lease_expires_at = ${expiredAt}
      WHERE delivery_id = ${deliveryId} AND grant_id = ${grantId}
        AND event_id = ${eventId(1)} AND delivery_target_id = ${ids.target}
        AND status = 'leased' AND current_attempt = ${attempt}
        AND current_connector_id = ${ids.connector}
        AND current_claim_token_digest = ${claimDigest} AND current_lease_token_digest = ${claimDigest}
        AND lease_started_at = ${current.leaseStartedAt} AND lease_expires_at = ${current.leaseExpiresAt}
    `;
    expect(deliveries).toBe(1);
    const attempts = await transaction.$executeRaw`
      UPDATE cr2_standing_delivery_attempts
      SET lease_started_at = ${startedAt}, lease_expires_at = ${expiredAt}
      WHERE delivery_id = ${deliveryId} AND connector_id = ${ids.connector}
        AND attempt = ${attempt} AND claim_token_digest = ${claimDigest} AND lease_token_digest = ${claimDigest}
        AND lease_started_at = ${current.leaseStartedAt} AND lease_expires_at = ${current.leaseExpiresAt}
    `;
    expect(attempts).toBe(1);
  });
}

afterAll(async () => {
  await prisma.$disconnect();
  // No cleanup: all uniquely owned rows remain until the disposable DB lifecycle ends.
  console.info(`Retained standing delivery profile fixture namespace: ${namespace}`);
});

describe("standing active-v2 production delivery profile (not the shared conformance oracle)", () => {
  it("reclaims exactly three attempts, retires old tokens, then releases the standing slot on exhaustion", async () => {
    const binding = await createFixture();
    const accepted = await sendEvent(binding, 1);
    expect(accepted.status).toBe(202);
    expect(accepted.body).toMatchObject({ event_id: eventId(1), accepted: true, duplicate: false });
    const firstDelivery = await prisma.standingDelivery.findUniqueOrThrow({ where: { eventId: eventId(1) } });
    const { grantId, deliveryId } = firstDelivery;
    expect(firstDelivery).toMatchObject({ status: "pending", currentAttempt: 0, maximumAttempts: 3 });
    const tokens = [token(), token(), token(), token()];

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const activeToken = tokens[attempt - 1];
      const claimed = await claim(activeToken);
      expect(claimed.status).toBe(200);
      expect(claimed.body).toMatchObject({
        duplicate: false,
        lease: { delivery_id: deliveryId, event_id: eventId(1), attempt, lease_token: activeToken },
      });
      const live = await snapshot(grantId);
      expect(live[3].map(row => row.attempt)).toEqual(Array.from({ length: attempt }, (_, index) => index + 1));
      const duplicate = await claim(activeToken);
      expect(duplicate.status).toBe(200);
      expect(duplicate.body).toEqual({ ...claimed.body, duplicate: true });
      expect(await snapshot(grantId)).toEqual(live);

      for (const retiredToken of tokens.slice(0, attempt - 1)) {
        const retired = await claim(retiredToken);
        expect(retired.status).toBe(409);
        expect(retired.body).toEqual({ error: { code: "claim_token_retired", retryable: false } });
        expect(await snapshot(grantId)).toEqual(live);
      }

      await expireOwnedLease(grantId, deliveryId, attempt, activeToken);
      const expired = await snapshot(grantId);
      const retired = await claim(activeToken);
      expect(retired.status).toBe(409);
      expect(retired.body).toEqual({ error: { code: "claim_token_retired", retryable: false } });
      expect(await snapshot(grantId)).toEqual(expired);
    }

    const noWork = await claim(tokens[3]);
    expect(noWork.status).toBe(204);
    expect(noWork.text).toBe("");
    expect(noWork.headers["content-type"]).toBeUndefined();
    const exhausted = await snapshot(grantId);
    expect(exhausted[0].lastEventSequence).toBe(1n);
    expect(exhausted[2]).toHaveLength(1);
    expect(exhausted[2][0]).toMatchObject({
      deliveryId, status: "retry_exhausted", terminalReason: "attempt_limit_reached",
      currentAttempt: 3, maximumAttempts: 3, effectId: null, acknowledgedAt: null,
    });
    expect(exhausted[3].map(row => row.attempt)).toEqual([1, 2, 3]);
    expect(exhausted[3].map(row => row.claimTokenDigest)).toEqual(tokens.slice(0, 3).map(digest));
    expect((await claim(tokens[3])).status).toBe(204);
    expect(await snapshot(grantId)).toEqual(exhausted);

    const next = await sendEvent(binding, 2);
    expect(next.status).toBe(202);
    expect(next.body).toMatchObject({ event_id: eventId(2), accepted: true, duplicate: false });
    const released = await snapshot(grantId);
    expect(released[0].lastEventSequence).toBe(2n);
    expect(released[1].map(row => row.eventSequence)).toEqual([1n, 2n]);
    expect(released[2]).toHaveLength(2);
    expect(released[2].find(row => row.deliveryId === deliveryId)).toEqual(exhausted[2][0]);
    expect(released[2].filter(row => ["pending", "leased"].includes(row.status))).toEqual([
      expect.objectContaining({ eventId: eventId(2), status: "pending", currentAttempt: 0 }),
    ]);
    expect(released[3]).toEqual(exhausted[3]);
  });
});
