import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { verifyConformanceSource } from "./source-pin.mjs";

test("active Receiver rolls back a killed transaction and recovers a committed Delivery", {
  timeout: 30_000,
}, async (t) => {
  const receiverRoot = await realpath(fileURLToPath(new URL("../../../", import.meta.url)));
  const backendRoot = join(receiverRoot, "backend");
  const source = await verifyConformanceSource({
    coreRoot: process.env.REENTRY_CONFORMANCE_ROOT,
    receiverRoot,
    mode: process.env.REENTRY_CONFORMANCE_MODE ?? "pinned",
  });
  const coreRoot = await realpath(process.env.REENTRY_CONFORMANCE_ROOT);
  const databaseUrl = requireDisposableDatabase();

  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = databaseUrl;
  process.env.CLOUD_RECEIVER_RUNTIME_DATABASE_URL = databaseUrl;
  process.env.DIRECT_URL = databaseUrl;
  process.env.PORT = "0";
  process.env.RECEIVER_PUBLIC_URL = "http://127.0.0.1";
  process.env.FRONTEND_URL = "http://127.0.0.1:3000";
  process.env.COOKIE_DOMAIN = "";
  process.env.TS_NODE_PROJECT = join(backendRoot, "tsconfig.json");

  const [hostModule, connectorModule, protocol, authorityTypes, processRpc] = await Promise.all([
    import(pathToFileURL(join(coreRoot, "reentry-core/src/standing-host-sdk.mjs")).href),
    import(pathToFileURL(join(coreRoot, "reentry-core/src/local-connector-client.mjs")).href),
    import(pathToFileURL(join(coreRoot, "reentry-core/src/standing-protocol.mjs")).href),
    import(pathToFileURL(join(coreRoot, "reentry-core/src/standing-authorization-core.mjs")).href),
    import(pathToFileURL(join(coreRoot, "reentry-core/conformance/process-rpc.mjs")).href),
  ]);
  const require = createRequire(import.meta.url);
  require("ts-node/register/transpile-only");
  const service = require(join(backendRoot, "src/modules/standing/standing.service.ts"));
  const { prisma } = require(join(backendRoot, "src/db/index.ts"));
  const { digestSecret } = require(join(backendRoot, "src/middleware/organization-auth.ts"));
  let child;
  const children = new Set();
  t.after(async () => {
    for (const process of [...children].reverse()) await process.terminate();
    await prisma.$disconnect();
    await source.verifyUnchanged();
  });

  const suffix = randomUUID();
  const ids = {
    account: `account_standing_process_${suffix}`,
    developer: `developer_standing_process_${suffix}`,
    organization: `organization_standing_process_${suffix}`,
    pairing: `pairing_standing_process_${suffix}`,
    connector: `connector_standing_process_${suffix}`,
    target: `target_standing_process_${suffix}`,
    host: `host_standing_process_${suffix}`,
    hostKey: `host_key_standing_process_${suffix}`,
    workflow: `workflow_standing_process_${suffix}`,
    subject: `subject_standing_process_${suffix}`,
    decision: `decision_standing_process_${suffix}`,
  };
  const hostOrigin = `https://standing-process-${suffix}.example`;
  const canonicalUrl = `${hostOrigin}/workflows/${ids.workflow}`;
  const humanBoundary = "confirm_irreversible_action";
  const connectorToken = randomBytes(32).toString("base64url");
  const keys = generateKeyPairSync("ed25519");
  const publicKeyPem = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
  const host = new hostModule.StandingReentryHostSdk({
    origin: hostOrigin,
    privateKey: keys.privateKey,
    keyId: `key_standing_process_${suffix}`,
  });
  const now = new Date();

  await prisma.$transaction(async (transaction) => {
    await transaction.userAccount.create({
      data: {
        id: ids.account,
        email: `standing-process-user-${suffix}@example.com`,
        passwordHash: `!disabled-${randomBytes(32).toString("hex")}`,
      },
    });
    await transaction.developerAccount.create({
      data: {
        id: ids.developer,
        email: `standing-process-developer-${suffix}@example.com`,
        passwordHash: `!disabled-${randomBytes(32).toString("hex")}`,
      },
    });
    await transaction.organization.create({
      data: { id: ids.organization, developerId: ids.developer, name: `Standing process ${suffix}` },
    });
    await transaction.pairingSession.create({
      data: {
        id: ids.pairing,
        accountId: ids.account,
        pairingCodeDigest: digestSecret(randomBytes(32).toString("base64url")),
        expiresAt: new Date(now.getTime() + 5 * 60_000),
        consumedAt: now,
      },
    });
    await transaction.connector.create({
      data: {
        id: ids.connector,
        accountId: ids.account,
        pairingSessionId: ids.pairing,
        deliveryTargetId: ids.target,
        tokenDigest: digestSecret(connectorToken),
        deviceName: `Standing process ${suffix}`,
        expiresAt: new Date(now.getTime() + 2 * 60 * 60_000),
      },
    });
    await transaction.hostKey.create({
      data: {
        id: ids.hostKey,
        organizationId: ids.organization,
        hostId: ids.host,
        issuerOrigin: hostOrigin,
        keyId: `key_standing_process_${suffix}`,
        publicKeyPem,
      },
    });
  });

  const manifest = host.issueManifest({
    manifestId: `manifest_standing_process_${suffix}`,
    correlationId: `correlation_standing_process_${suffix}`,
    issuedAt: now.toISOString(),
    offerExpiresAt: new Date(now.getTime() + 5 * 60_000).toISOString(),
    workflow: {
      id: ids.workflow,
      type: "domain-neutral-workflow",
      stateVersion: 1,
      canonicalUrl,
    },
    display: {
      title: "Continue the standing fresh-process workflow",
      reason: "Read current authoritative state and prepare the next safe step.",
    },
    grantRequest: {
      eventType: "standing.fresh_process.ready",
      grantExpiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
      humanBoundary,
    },
  });
  const enrollment = await service.createStandingConsentSession({
    organizationId: ids.organization,
    hostSubjectRef: ids.subject,
    expectedOrigin: hostOrigin,
    manifest,
    maximumGrantLifetimeMs: 2 * 60 * 60_000,
  });
  const approval = await service.decideStandingConsent({
    challengeId: enrollment.challenge.challenge_id,
    accountId: ids.account,
    connectorId: ids.connector,
    action: "approve",
    decisionId: ids.decision,
    decidedAt: new Date().toISOString(),
  });
  assert.equal(approval.status, "approved");

  const fixtureUrl = new URL("./receiver-process.mjs", import.meta.url);
  child = processRpc.spawnProfileProcess(fixtureUrl, { timeoutMs: 10_000 });
  children.add(child);

  const firstStart = await child.request("start", { databaseUrl, backendRoot });
  assert.notEqual(firstStart.pid, globalThis.process.pid);
  assert.equal(firstStart.sqliteLoaded, false);
  let receiverOrigin = `http://127.0.0.1:${firstStart.port}`;

  const issuedEvent = host.issueEvent({
    binding: approval.binding,
    eventId: `event_standing_process_${suffix}`,
    eventSequence: 1,
    occurredAt: new Date().toISOString(),
    deliveryTimestamp: String(Math.floor(Date.now() / 1_000)),
    workflow: {
      id: ids.workflow,
      stateVersion: 2,
      canonicalUrl,
    },
  });
  const envelope = { body: issuedEvent.body, headers: issuedEvent.headers };
  assert.deepEqual(await child.request("armCrashAfterDeliveryWrite"), { armed: true });
  await assert.rejects(sendEvent(receiverOrigin, envelope));
  assert.deepEqual(await child.terminate(), { code: null, signal: "SIGKILL" });
  children.delete(child);
  child = undefined;

  const afterTransactionCrash = await readState(
    prisma,
    approval.binding.binding_id,
    issuedEvent.event.event_id,
  );
  assert.equal(afterTransactionCrash.grant.lastEventSequence, 0n);
  assert.equal(afterTransactionCrash.event, null);
  assert.equal(afterTransactionCrash.delivery, null);

  child = processRpc.spawnProfileProcess(fixtureUrl, { timeoutMs: 10_000 });
  children.add(child);
  const secondStart = await child.request("start", { databaseUrl, backendRoot });
  assert.notEqual(secondStart.pid, firstStart.pid);
  receiverOrigin = `http://127.0.0.1:${secondStart.port}`;

  const accepted = await sendEvent(receiverOrigin, envelope);
  assert.equal(accepted.statusCode, 202);
  assert.equal(accepted.body.accepted, true);
  assert.equal(accepted.body.duplicate, false);

  const beforeCrash = await readState(prisma, approval.binding.binding_id, issuedEvent.event.event_id);
  assert.equal(beforeCrash.grant.lastEventSequence, 1n);
  assert.ok(beforeCrash.event);
  assert.equal(beforeCrash.delivery.status, "pending");
  assert.equal(beforeCrash.delivery.currentAttempt, 0);

  await assert.rejects(child.request("crash"), { code: "profile_process_exited" });
  assert.deepEqual(await child.terminate(), { code: null, signal: "SIGKILL" });
  children.delete(child);
  child = undefined;

  const claimToken = randomBytes(32).toString("base64url");
  const effectToken = randomBytes(32).toString("base64url");
  child = processRpc.spawnProfileProcess(fixtureUrl, { timeoutMs: 10_000 });
  children.add(child);
  const thirdStart = await child.request("start", { databaseUrl, backendRoot });
  assert.notEqual(thirdStart.pid, secondStart.pid);
  receiverOrigin = `http://127.0.0.1:${thirdStart.port}`;

  const afterRestart = await readState(prisma, approval.binding.binding_id, issuedEvent.event.event_id);
  assert.equal(afterRestart.grant.lastEventSequence, 1n);
  assert.ok(afterRestart.event);
  assert.equal(afterRestart.delivery.status, "pending");
  assert.equal(afterRestart.delivery.currentAttempt, 0);

  const connector = new connectorModule.LocalConnectorClient({
    baseUrl: receiverOrigin,
    connectorToken,
    requestTimeoutMs: 2_000,
    protocolVersion: protocol.STANDING_PROTOCOL_VERSION,
  });
  const claim = await connector.claimDelivery({ claimToken });
  assert.equal(claim.duplicate, false);
  assert.equal(claim.lease.attempt, 1);
  assert.equal(claim.lease.event_id, issuedEvent.event.event_id);

  const effect = {
    type: authorityTypes.STANDING_HOST_EFFECT_ATTESTATION_TYPE,
    protocol_version: protocol.STANDING_PROTOCOL_VERSION,
    effect_id: `effect_standing_process_${suffix}`,
    delivery_id: claim.lease.delivery_id,
    event_id: claim.lease.event_id,
    correlation_id: claim.lease.continuation.correlation_id,
    workflow_id: claim.lease.continuation.workflow_id,
    outcome: authorityTypes.STANDING_HOST_EFFECT_OUTCOME,
    confirmed_at: new Date().toISOString(),
  };
  assert.deepEqual(await child.request("authorizeEffect", { effectToken, effect }), {
    authorized: true,
  });
  const acknowledgement = await connector.acknowledgeDelivery({
    deliveryId: claim.lease.delivery_id,
    leaseToken: claim.lease.lease_token,
    effectToken,
  });
  assert.equal(acknowledgement.acknowledged, true);
  assert.equal(acknowledgement.duplicate, false);

  const afterAcknowledgement = await readState(prisma, approval.binding.binding_id, issuedEvent.event.event_id);
  assert.equal(afterAcknowledgement.grant.lastEventSequence, 1n);
  assert.equal(afterAcknowledgement.delivery.status, "acknowledged");
  assert.equal(afterAcknowledgement.delivery.currentAttempt, 1);
  assert.equal(afterAcknowledgement.delivery.effectId, effect.effect_id);

  const replay = await sendEvent(receiverOrigin, envelope);
  assert.equal(replay.statusCode, 202);
  assert.equal(replay.body.accepted, true);
  assert.equal(replay.body.duplicate, true);

  const persisted = JSON.stringify({
    grant: afterAcknowledgement.grant,
    delivery: afterAcknowledgement.delivery,
  }, (_, value) => typeof value === "bigint" ? value.toString() : value);
  assert.equal(persisted.includes(connectorToken), false);
  assert.equal(persisted.includes(claimToken), false);
  assert.equal(persisted.includes(effectToken), false);

  await child.close();
  children.delete(child);
  child = undefined;
});

async function sendEvent(receiverOrigin, envelope) {
  const response = await fetch(`${receiverOrigin}/v0.2/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(envelope),
    redirect: "manual",
    signal: AbortSignal.timeout(2_000),
  });
  return { statusCode: response.status, body: JSON.parse(await response.text()) };
}

async function readState(prisma, bindingId, eventId) {
  const [grant, event, delivery] = await Promise.all([
    prisma.standingGrant.findUnique({
      where: { bindingId },
      select: { lastEventSequence: true },
    }),
    prisma.standingEvent.findUnique({
      where: { eventId },
      select: { eventId: true },
    }),
    prisma.standingDelivery.findUnique({
      where: { eventId },
      select: {
        status: true,
        currentAttempt: true,
        effectId: true,
      },
    }),
  ]);
  assert.ok(grant, "fresh_process_grant_missing");
  return { grant, event, delivery };
}

function requireDisposableDatabase() {
  assert.equal(process.env.NODE_ENV, "test", "standing_fresh_process_requires_node_env_test");
  const value = process.env.STANDING_MIGRATION_TEST_DATABASE_URL;
  assert.ok(typeof value === "string" && value.length > 0, "standing_fresh_process_database_url_required");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("standing_fresh_process_database_url_invalid");
  }
  assert.ok(["postgres:", "postgresql:"].includes(parsed.protocol));
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname));
  assert.ok(parsed.pathname.length > 1);
  assert.equal(parsed.search, "");
  assert.equal(parsed.hash, "");
  return value;
}
