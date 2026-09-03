import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Client } from "pg";
import { appConfig } from "../../../config/config";
import { prisma } from "../../../db";
import { disconnectConnector } from "../../connectors/pairing.service";
import { createStandingContinuationEventEnvelope } from "../standing.protocol";
import {
  acceptStandingEvent,
  acknowledgeStandingDelivery,
  claimStandingDelivery,
  revokeStandingGrant,
  type StandingEffectAttestation,
} from "../standing.service";

const RUN_ID = `standing-races-${randomUUID()}`;
const realNow = Date.now.bind(Date);
const keys = generateKeyPairSync("ed25519");
const otherKeys = generateKeyPairSync("ed25519");
const publicKeyPem = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
const fingerprint = createHash("sha256")
  .update(keys.publicKey.export({ type: "spki", format: "der" }))
  .digest("base64url");
let fixtureNumber = 0;
let databaseUrl: string;
let observer: Client;
let baseTime: number;

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function requireDisposableDatabase(): string {
  const value = process.env.STANDING_RACE_TEST_DATABASE_URL;
  if (process.env.NODE_ENV !== "test" || !value || value !== appConfig.databaseUrl) {
    throw new Error("Race tests require NODE_ENV=test and an explicit matching disposable database URL");
  }
  const parsed = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    parsed.hostname !== "127.0.0.1" ||
    parsed.port !== "55432" ||
    parsed.pathname !== "/reentry_baseline" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new Error("Race tests are restricted to the task-owned loopback baseline database");
  }
  return value;
}

type Fixture = Awaited<ReturnType<typeof seedFixture>>;

// Every probe owns a new, logged UUID namespace. Setup is atomic INSERT-only;
// only an individual probe's own HostKey/Connector may be revoked or rebound.
// All fixture rows intentionally remain; there is no cleanup or shared-row mutation.
async function seedFixture(options: { grantLifetime?: number; connectorLifetime?: number } = {}) {
  const prefix = `${RUN_ID}-${++fixtureNumber}`;
  const origin = "https://standing-races.example";
  const connectorToken = randomBytes(32).toString("base64url");
  const createdAt = new Date(baseTime - 60_000);
  const grantExpiry = new Date(baseTime + (options.grantLifetime ?? 300_000));
  const connectorExpiry = new Date(baseTime + (options.connectorLifetime ?? 300_000));
  const fixture = {
    prefix,
    origin,
    connectorToken,
    accountId: `${prefix}-account`,
    organizationId: `${prefix}-org`,
    connectorId: `${prefix}-connector`,
    targetId: `${prefix}-target`,
    hostKeyId: `${prefix}-host-key`,
    keyId: `${prefix}-key`,
    grantId: `${prefix}-grant`,
    bindingId: `${prefix}-binding`,
    eventId: `${prefix}-event`,
    correlationId: `${prefix}-correlation`,
    workflowId: `${prefix}-workflow`,
  };
  await prisma.$transaction(async (transaction) => {
    await transaction.userAccount.create({ data: {
      id: fixture.accountId, email: `${prefix}@account.example.invalid`, passwordHash: "test-only",
      createdAt, updatedAt: createdAt,
    } });
    await transaction.developerAccount.create({ data: {
      id: `${prefix}-developer`, email: `${prefix}@developer.example.invalid`, passwordHash: "test-only",
      createdAt, updatedAt: createdAt,
    } });
    await transaction.organization.create({ data: {
      id: fixture.organizationId, developerId: `${prefix}-developer`, name: "Owned standing race fixture",
      createdAt, updatedAt: createdAt,
    } });
    await transaction.pairingSession.create({ data: {
      id: `${prefix}-pairing`, accountId: fixture.accountId, pairingCodeDigest: digest(`${prefix}-pairing`),
      createdAt, expiresAt: connectorExpiry,
    } });
    await transaction.connector.create({ data: {
      id: fixture.connectorId, accountId: fixture.accountId, pairingSessionId: `${prefix}-pairing`,
      deliveryTargetId: fixture.targetId, tokenDigest: digest(connectorToken), deviceName: "Owned race target",
      createdAt, expiresAt: connectorExpiry,
    } });
    await transaction.hostKey.create({ data: {
      id: fixture.hostKeyId, organizationId: fixture.organizationId, hostId: `${prefix}-host`,
      issuerOrigin: origin, keyId: fixture.keyId, publicKeyPem, createdAt,
    } });
    await transaction.hostSubjectBinding.create({ data: {
      id: `${prefix}-subject`, organizationId: fixture.organizationId,
      hostSubjectRefDigest: digest(`${prefix}-subject`), connectorId: fixture.connectorId,
      deliveryTargetId: fixture.targetId, createdAt,
    } });
    await transaction.standingConsentSession.create({ data: {
      id: `${prefix}-consent`, challengeId: `${prefix}-challenge`, tokenDigest: digest(`${prefix}-consent`),
      organizationId: fixture.organizationId, hostSubjectRefDigest: digest(`${prefix}-subject`),
      expectedOrigin: origin, manifestId: `${prefix}-manifest`, manifestJson: {},
      expiresAt: grantExpiry, effectiveGrantExpiresAt: grantExpiry, status: "approved",
      decisionId: `${prefix}-decision`, decisionAction: "approve", decisionAt: createdAt,
      accountId: fixture.accountId, createdAt,
    } });
    await transaction.standingGrant.create({ data: {
      id: fixture.grantId, consentSessionId: `${prefix}-consent`, bindingId: fixture.bindingId,
      hostSubjectBindingId: `${prefix}-subject`, organizationId: fixture.organizationId,
      accountId: fixture.accountId, connectorId: fixture.connectorId, deliveryTargetId: fixture.targetId,
      correlationId: fixture.correlationId, issuerOrigin: origin, issuerKeyId: fixture.keyId,
      issuerKeyFingerprint: fingerprint, workflowId: fixture.workflowId, workflowType: "race_fixture",
      canonicalUrl: `${origin}/work`, eventType: "worker.ready", instruction: "Read the current workflow state",
      humanBoundary: "human_review", expiresAt: grantExpiry, createdAt,
    } });
  });
  return fixture;
}

function envelope(fixture: Fixture) {
  return createStandingContinuationEventEnvelope({
    type: "webmcp.continuation_event", protocol_version: "0.2", event_id: fixture.eventId,
    binding_id: fixture.bindingId, correlation_id: fixture.correlationId, issuer_origin: fixture.origin,
    workflow_id: fixture.workflowId, event_type: "worker.ready", event_sequence: 1, state_version: 1,
    occurred_at: new Date(baseTime).toISOString(), canonical_url: `${fixture.origin}/work`,
  }, { privateKey: keys.privateKey, keyId: fixture.keyId, timestamp: String(baseTime / 1_000) });
}

type Outcome<T> = { value: T; error?: never } | { value?: never; error: unknown };
function observe<T>(promise: Promise<T>): Promise<Outcome<T>> {
  // Attach rejection handling immediately while the database barrier is held.
  return promise.then(value => ({ value }), error => ({ error }));
}

async function waitForBlocked(holderPid: number): Promise<void> {
  const deadline = realNow() + 2_000;
  while (realNow() < deadline) {
    const result = await observer.query<{ blocked: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS blocked",
      [holderPid],
    );
    if (result.rows[0].blocked) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("Expected service query did not reach the PostgreSQL blocked-state barrier");
}

async function whileBlocked<T>(
  fixture: Fixture,
  lock: "grant" | "target" | "host-key" | "connector",
  start: () => Promise<T>,
  intervene: () => Promise<void> | void,
): Promise<Outcome<T>> {
  const holder = new Client({ connectionString: databaseUrl });
  await holder.connect();
  let pending: Promise<Outcome<T>> | undefined;
  try {
    await holder.query("BEGIN");
    const result = await holder.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    if (lock === "grant") {
      await holder.query('SELECT grant_id FROM cr2_standing_grants WHERE grant_id = $1 FOR UPDATE', [fixture.grantId]);
    } else if (lock === "host-key") {
      await holder.query('SELECT host_key_id FROM cr2_host_keys WHERE host_key_id = $1 FOR UPDATE', [fixture.hostKeyId]);
    } else if (lock === "connector") {
      await holder.query('SELECT connector_id FROM cr2_connectors WHERE connector_id = $1 FOR UPDATE', [fixture.connectorId]);
    } else {
      await holder.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [fixture.targetId]);
    }
    pending = observe(start());
    await waitForBlocked(result.rows[0].pid);
    await intervene();
  } finally {
    // The holder never mutates data; rollback releases only its row/advisory lock.
    await holder.query("ROLLBACK");
    await holder.end();
  }
  if (!pending) throw new Error("Service operation was not started");
  return pending;
}

async function expectNoAcceptedEvent(fixture: Fixture): Promise<void> {
  expect(await prisma.standingEvent.count({ where: { grantId: fixture.grantId } })).toBe(0);
  expect(await prisma.standingDelivery.count({ where: { grantId: fixture.grantId } })).toBe(0);
  expect((await prisma.standingGrant.findUniqueOrThrow({ where: { id: fixture.grantId } })).lastEventSequence).toBe(0n);
}

async function prepareLease(fixture: Fixture) {
  await acceptStandingEvent(envelope(fixture));
  const token = randomBytes(32).toString("base64url");
  const result = await claimStandingDelivery({ connectorToken: fixture.connectorToken, claimToken: token });
  expect(result).not.toBeNull();
  const delivery = await prisma.standingDelivery.findUniqueOrThrow({ where: { eventId: fixture.eventId } });
  return { token, delivery };
}

function effect(fixture: Fixture, deliveryId: string, confirmedAt: number): StandingEffectAttestation {
  return {
    type: "webmcp.host_effect_attestation", protocol_version: "0.2", effect_id: `${fixture.prefix}-effect`,
    delivery_id: deliveryId, event_id: fixture.eventId, correlation_id: fixture.correlationId,
    workflow_id: fixture.workflowId, outcome: "committed", confirmed_at: new Date(confirmedAt).toISOString(),
  };
}

beforeAll(async () => {
  databaseUrl = requireDisposableDatabase();
  observer = new Client({ connectionString: databaseUrl });
  await observer.connect();
});

beforeEach(() => {
  baseTime = Math.floor(realNow() / 1_000) * 1_000;
  // Fake Date only. PostgreSQL I/O, polling, and transaction timers remain real;
  // no production clock or barrier API is introduced.
  jest.useFakeTimers({ now: baseTime, doNotFake: [
    "hrtime", "nextTick", "performance", "queueMicrotask", "setImmediate", "clearImmediate",
    "setInterval", "clearInterval", "setTimeout", "clearTimeout",
  ] });
});

afterEach(() => { jest.useRealTimers(); });
afterAll(async () => {
  await observer?.end();
  console.info(`Retained owned standing race fixture namespace: ${RUN_ID}`);
});

describe("standing service PostgreSQL authority barriers", () => {
  it("rejects a new Event when Grant expiry passes while its Grant row lock is blocked", async () => {
    const fixture = await seedFixture({ grantLifetime: 1_000 });
    const signed = envelope(fixture);
    const result = await whileBlocked(fixture, "grant", () => acceptStandingEvent(signed), () => {
      jest.setSystemTime(baseTime + 2_000);
    });
    expect(result.error).toMatchObject({ code: "grant_expired", statusCode: 410 });
    await expectNoAcceptedEvent(fixture);
  });

  it("does not create a lease after Grant expiry passes behind the target advisory lock", async () => {
    const fixture = await seedFixture({ grantLifetime: 1_000 });
    await acceptStandingEvent(envelope(fixture));
    const result = await whileBlocked(fixture, "target", () => claimStandingDelivery({
      connectorToken: fixture.connectorToken, claimToken: randomBytes(32).toString("base64url"),
    }), () => { jest.setSystemTime(baseTime + 2_000); });
    expect(result).toEqual({ value: null });
    const delivery = await prisma.standingDelivery.findUniqueOrThrow({ where: { eventId: fixture.eventId } });
    expect(delivery).toMatchObject({ status: "cancelled", currentAttempt: 0, terminalReason: "grant_expired" });
    expect(await prisma.standingDeliveryAttempt.count({ where: { deliveryId: delivery.deliveryId } })).toBe(0);
  });

  it("refreshes Event expiry after waiting for the final HostKey authority lock", async () => {
    const fixture = await seedFixture({ grantLifetime: 1_000 });
    const result = await whileBlocked(fixture, "host-key", () => acceptStandingEvent(envelope(fixture)), () => {
      jest.setSystemTime(baseTime + 2_000);
    });
    expect(result.error).toMatchObject({ code: "grant_expired", statusCode: 410 });
    await expectNoAcceptedEvent(fixture);
  });

  it("refreshes Claim expiry after waiting for the final Connector authority lock", async () => {
    const fixture = await seedFixture({ grantLifetime: 1_000 });
    await acceptStandingEvent(envelope(fixture));
    const result = await whileBlocked(fixture, "connector", () => claimStandingDelivery({
      connectorToken: fixture.connectorToken, claimToken: randomBytes(32).toString("base64url"),
    }), () => { jest.setSystemTime(baseTime + 2_000); });
    expect(result).toEqual({ value: null });
    const delivery = await prisma.standingDelivery.findUniqueOrThrow({ where: { eventId: fixture.eventId } });
    expect(delivery).toMatchObject({ status: "cancelled", currentAttempt: 0 });
    expect(await prisma.standingDeliveryAttempt.count({ where: { deliveryId: delivery.deliveryId } })).toBe(0);
  });

  it("does not reclaim an expired lease when Grant expiry passes during the Grant lock wait", async () => {
    const fixture = await seedFixture({ grantLifetime: 120_000 });
    const { delivery } = await prepareLease(fixture);
    jest.setSystemTime(baseTime + 60_001);
    const result = await whileBlocked(fixture, "grant", () => claimStandingDelivery({
      connectorToken: fixture.connectorToken, claimToken: randomBytes(32).toString("base64url"),
    }), () => { jest.setSystemTime(baseTime + 120_001); });
    expect(result).toEqual({ value: null });
    expect(await prisma.standingDelivery.findUniqueOrThrow({ where: { deliveryId: delivery.deliveryId } }))
      .toMatchObject({ status: "retry_exhausted", currentAttempt: 1, terminalReason: "grant_expired" });
    expect(await prisma.standingDeliveryAttempt.count({ where: { deliveryId: delivery.deliveryId } })).toBe(1);
  });

  it("does not replay a lease whose Grant expires while the claim token waits for the Grant lock", async () => {
    const fixture = await seedFixture({ grantLifetime: 1_000 });
    const { token, delivery } = await prepareLease(fixture);
    const result = await whileBlocked(fixture, "grant", () => claimStandingDelivery({
      connectorToken: fixture.connectorToken, claimToken: token,
    }), () => { jest.setSystemTime(baseTime + 2_000); });
    expect(result).toEqual({ value: null });
    expect(await prisma.standingDeliveryAttempt.count({ where: { deliveryId: delivery.deliveryId } })).toBe(1);
  });

  it.each(["revoke", "rebind"] as const)("rechecks HostKey %s after reaching the Grant lock barrier", async (mutation) => {
    const fixture = await seedFixture();
    const signed = envelope(fixture);
    const result = await whileBlocked(fixture, "grant", () => acceptStandingEvent(signed), async () => {
      await prisma.hostKey.update({ where: { id: fixture.hostKeyId }, data: mutation === "revoke"
        ? { revokedAt: new Date() }
        : { publicKeyPem: otherKeys.publicKey.export({ type: "spki", format: "pem" }).toString() },
      });
    });
    expect(result.error).toMatchObject({
      code: mutation === "revoke" ? "event_key_unavailable" : "event_key_material_scope_invalid", statusCode: 401,
    });
    await expectNoAcceptedEvent(fixture);
  });

  it.each(["target", "grant"] as const)("rejects a Connector disconnected while Claim waits for its %s lock", async (lock) => {
    const fixture = await seedFixture();
    await acceptStandingEvent(envelope(fixture));
    const result = await whileBlocked(fixture, lock, () => claimStandingDelivery({
      connectorToken: fixture.connectorToken, claimToken: randomBytes(32).toString("base64url"),
    }), async () => {
      await disconnectConnector({ connector_token: fixture.connectorToken });
      expect((await prisma.connector.findUniqueOrThrow({ where: { id: fixture.connectorId } })).revokedAt).not.toBeNull();
    });
    expect(result.error).toMatchObject({ code: "connector_identity_invalid", statusCode: 403 });
    const delivery = await prisma.standingDelivery.findUniqueOrThrow({ where: { eventId: fixture.eventId } });
    expect(delivery).toMatchObject({ status: "pending", currentAttempt: 0 });
    expect(await prisma.standingDeliveryAttempt.count({ where: { deliveryId: delivery.deliveryId } })).toBe(0);
  });

  it("timestamps revocation after its lock barrier so a prior effect and exact ACK replay converge", async () => {
    const fixture = await seedFixture();
    const { token, delivery } = await prepareLease(fixture);
    const result = await whileBlocked(fixture, "grant", () => revokeStandingGrant({
      accountId: fixture.accountId, bindingId: fixture.bindingId,
    }), () => { jest.setSystemTime(baseTime + 1_000); });
    expect(result.value).toMatchObject({ revoked_at: new Date(baseTime + 1_000).toISOString(), duplicate: false });
    const input = {
      connectorToken: fixture.connectorToken, deliveryId: delivery.deliveryId, leaseToken: token,
      effectToken: randomBytes(32).toString("base64url"),
      effectAuthority: { verifyEffect: () => effect(fixture, delivery.deliveryId, baseTime + 500) },
    };
    expect(await acknowledgeStandingDelivery(input)).toMatchObject({ acknowledged: true, duplicate: false });
    expect(await acknowledgeStandingDelivery(input)).toMatchObject({ acknowledged: true, duplicate: true });
  });

  it("rechecks Connector expiry after an asynchronous Host-effect verifier returns", async () => {
    const fixture = await seedFixture({ connectorLifetime: 1_000 });
    const { token, delivery } = await prepareLease(fixture);
    let entered!: () => void;
    let resume!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const released = new Promise<void>(resolve => { resume = resolve; });
    const pending = observe(acknowledgeStandingDelivery({
      connectorToken: fixture.connectorToken, deliveryId: delivery.deliveryId, leaseToken: token,
      effectToken: randomBytes(32).toString("base64url"), effectAuthority: {
        verifyEffect: async () => { entered(); await released; return effect(fixture, delivery.deliveryId, baseTime + 100); },
      },
    }));
    await started;
    jest.setSystemTime(baseTime + 2_000);
    resume();
    const result = await pending;
    expect(result.error).toMatchObject({ code: "connector_identity_invalid", statusCode: 403 });
    expect(await prisma.standingDelivery.findUniqueOrThrow({ where: { deliveryId: delivery.deliveryId } }))
      .toMatchObject({ status: "leased", effectId: null, acknowledgedAt: null });
  });

  it("rejects ACK when Connector disconnect commits while its final Grant lock is blocked", async () => {
    const fixture = await seedFixture();
    const { token, delivery } = await prepareLease(fixture);
    const result = await whileBlocked(fixture, "grant", () => acknowledgeStandingDelivery({
      connectorToken: fixture.connectorToken, deliveryId: delivery.deliveryId, leaseToken: token,
      effectToken: randomBytes(32).toString("base64url"),
      effectAuthority: { verifyEffect: () => effect(fixture, delivery.deliveryId, baseTime) },
    }), async () => { await disconnectConnector({ connector_token: fixture.connectorToken }); });
    expect(result.error).toMatchObject({ code: "connector_identity_invalid", statusCode: 403 });
    expect(await prisma.standingDelivery.findUniqueOrThrow({ where: { deliveryId: delivery.deliveryId } }))
      .toMatchObject({ status: "leased", effectId: null, acknowledgedAt: null });
  });
});
