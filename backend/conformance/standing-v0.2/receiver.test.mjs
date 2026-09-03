import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SCENARIO_PATH, verifyConformanceSource } from "./source-pin.mjs";

const SERVICE_EXPORTS = [
  "createStandingConsentSession",
  "decideStandingConsent",
  "inspectStandingGrant",
  "revokeStandingGrant",
];

test("active Receiver runs the shared standing v0.2 scenario over Express and PostgreSQL", {
  timeout: 30_000,
}, async (t) => {
  const receiverRoot = await realpath(fileURLToPath(new URL("../../../", import.meta.url)));
  const backendRoot = join(receiverRoot, "backend");
  // No Core module, Prisma, or database operation may precede source verification.
  // Development is explicit and can never produce pinned/release evidence.
  const source = await verifyConformanceSource({
    coreRoot: process.env.REENTRY_CONFORMANCE_ROOT,
    receiverRoot,
    mode: process.env.REENTRY_CONFORMANCE_MODE ?? "pinned",
  });
  const coreRoot = await realpath(process.env.REENTRY_CONFORMANCE_ROOT);
  const databaseUrl = requireDisposableDatabase();
  t.diagnostic(JSON.stringify({
    ...source.identity,
    node: process.version,
    receiver_commit: gitValue(receiverRoot, ["rev-parse", "HEAD"]),
  }));
  t.after(async () => {
    await source.verifyUnchanged();
  });

  // These are test-only imports from one exact working checkout. The shared scenario, not this
  // adapter or the active Receiver, owns every expected standing transition and failure.
  const coreModule = (path) => import(pathToFileURL(join(coreRoot, "reentry-core", path)).href);
  const [scenario, hostModule, connectorModule, adapterModule, protocol, authorityTypes] = await Promise.all([
    import(pathToFileURL(join(coreRoot, SCENARIO_PATH)).href),
    coreModule("src/standing-host-sdk.mjs"),
    coreModule("src/local-connector-client.mjs"),
    coreModule("src/agent-adapter.mjs"),
    coreModule("src/standing-protocol.mjs"),
    coreModule("src/standing-authorization-core.mjs"),
  ]);
  assert.equal(typeof scenario.runStandingAuthorizationV02Scenario, "function", "shared_scenario_missing");

  // Fail before loading Prisma or creating fixtures when the implementation seam is absent.
  const servicePath = join(backendRoot, "src/modules/standing/standing.service.ts");
  assert.ok(existsSync(servicePath), "standing_service_not_implemented");

  // config.ts loads local env files and prefers the Cloud alias. All aliases must be explicitly
  // fenced to the same disposable loopback database before any active Receiver module is loaded.
  process.env.DATABASE_URL = databaseUrl;
  process.env.CLOUD_RECEIVER_RUNTIME_DATABASE_URL = databaseUrl;
  process.env.DIRECT_URL = databaseUrl;
  process.env.PORT = "0";
  process.env.RECEIVER_PUBLIC_URL = "http://127.0.0.1";
  process.env.FRONTEND_URL = "http://127.0.0.1:3000";
  process.env.COOKIE_DOMAIN = "";
  process.env.TS_NODE_PROJECT = join(backendRoot, "tsconfig.json");
  const require = createRequire(import.meta.url);
  require("ts-node/register/transpile-only");
  const service = require(servicePath);
  for (const name of SERVICE_EXPORTS) {
    assert.equal(typeof service[name], "function", `standing_service_export_missing:${name}`);
  }
  const { createApp } = require(join(backendRoot, "src/app.ts"));
  const { appConfig } = require(join(backendRoot, "src/config/config.ts"));
  const { prisma } = require(join(backendRoot, "src/db/index.ts"));
  const { digestSecret } = require(join(backendRoot, "src/middleware/organization-auth.ts"));
  assert.ok(appConfig.databaseUrl === databaseUrl, "disposable_database_alias_mismatch");

  const suffix = randomUUID();
  const ids = {
    account: `account_standing_${suffix}`,
    developer: `developer_standing_${suffix}`,
    organization: `organization_standing_${suffix}`,
    pairing: `pairing_standing_${suffix}`,
    connector: `connector_standing_${suffix}`,
    target: `target_standing_${suffix}`,
    host: `host_standing_${suffix}`,
    hostKey: `host_key_standing_${suffix}`,
    alternateHostKey: `host_key_alternate_${suffix}`,
    key: `key_standing_${suffix}`,
    alternateKey: `key_alternate_${suffix}`,
    workflow: `workflow_standing_${suffix}`,
    subject: `subject_standing_${suffix}`,
    decision: `decision_standing_${suffix}`,
  };
  const hostOrigin = `https://standing-${suffix}.example`;
  const canonicalUrl = `${hostOrigin}/workflows/${ids.workflow}`;
  const humanBoundary = "confirm_irreversible_action";
  const connectorToken = randomBytes(32).toString("base64url");
  const consentedKeys = generateKeyPairSync("ed25519");
  const alternateKeys = generateKeyPairSync("ed25519");
  const publicPem = (keys) => keys.publicKey.export({ type: "spki", format: "pem" }).toString();
  const consentedPem = publicPem(consentedKeys);
  const alternatePem = publicPem(alternateKeys);
  const effects = new Map();
  let currentKeyMaterial = "consented";
  let receiver;
  let connector;
  let receiverOrigin;
  let approvalCalls = 0;
  let activationCalls = 0;
  let effectAuthorityCalls = 0;

  async function setConsentedKeyMaterialForTest({ material }) {
    assert.ok(["replacement", "consented"].includes(material), "fixture_key_material_invalid");
    const previousPem = currentKeyMaterial === "consented" ? consentedPem : alternatePem;
    const nextPem = material === "consented" ? consentedPem : alternatePem;
    const changed = await prisma.hostKey.updateMany({
      where: {
        id: ids.hostKey,
        organizationId: ids.organization,
        issuerOrigin: hostOrigin,
        keyId: ids.key,
        publicKeyPem: previousPem,
      },
      data: { publicKeyPem: nextPem },
    });
    assert.equal(changed.count, 1, "fixture_key_material_target_changed");
    currentKeyMaterial = material;
  }

  async function stopRuntime() {
    connector = undefined;
    if (!receiver) return;
    const active = receiver;
    receiver = undefined;
    active.closeAllConnections();
    await new Promise((resolve, reject) => active.close((error) => error ? reject(error) : resolve()));
  }

  t.after(async () => {
    try {
      if (currentKeyMaterial === "replacement") {
        await setConsentedKeyMaterialForTest({ material: "consented" });
      }
    } finally {
      try {
        await stopRuntime();
      } finally {
        await prisma.$disconnect();
      }
    }
    // Fixture rows deliberately remain in the task-owned disposable database. This test never
    // deletes accounts, standing authority, audit history, tables, schemas, or databases.
  });

  const now = new Date();
  await prisma.$transaction(async (transaction) => {
    await transaction.userAccount.create({
      data: {
        id: ids.account,
        email: `standing-user-${suffix}@example.com`,
        passwordHash: `!disabled-${randomBytes(32).toString("hex")}`,
      },
    });
    await transaction.developerAccount.create({
      data: {
        id: ids.developer,
        email: `standing-developer-${suffix}@example.com`,
        passwordHash: `!disabled-${randomBytes(32).toString("hex")}`,
      },
    });
    await transaction.organization.create({
      data: { id: ids.organization, developerId: ids.developer, name: `Standing conformance ${suffix}` },
    });
    // PairingSession is a required Connector foreign key, not a pre-created Consent or Grant.
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
        deviceName: `Standing conformance ${suffix}`,
        expiresAt: new Date(now.getTime() + 2 * 60 * 60_000),
      },
    });
    for (const [id, keyId, publicKeyPem] of [
      [ids.hostKey, ids.key, consentedPem],
      [ids.alternateHostKey, ids.alternateKey, alternatePem],
    ]) {
      await transaction.hostKey.create({
        data: { id, organizationId: ids.organization, hostId: ids.host, issuerOrigin: hostOrigin, keyId, publicKeyPem },
      });
    }
  });
  t.diagnostic("Unique fixture identities retained; no standing authority was pre-seeded.");

  const effectAuthority = {
    verifyEffect({ effectToken, expected }) {
      const effect = effects.get(effectToken);
      assert.ok(effect, "fixture_effect_unknown");
      assert.deepEqual(expected, {
        delivery_id: effect.delivery_id,
        event_id: effect.event_id,
        correlation_id: effect.correlation_id,
        workflow_id: effect.workflow_id,
        canonical_url: canonicalUrl,
        human_boundary: humanBoundary,
        outcome: authorityTypes.STANDING_HOST_EFFECT_OUTCOME,
      }, "fixture_effect_context_mismatch");
      effectAuthorityCalls += 1;
      return effect;
    },
  };

  async function startRuntime() {
    const app = createApp();
    app.locals.standingEffectAuthority = effectAuthority;
    receiver = createServer(app);
    await new Promise((resolve, reject) => {
      receiver.once("error", reject);
      receiver.listen(0, "127.0.0.1", resolve);
    });
    receiverOrigin = `http://127.0.0.1:${receiver.address().port}`;
    appConfig.receiverPublicUrl = receiverOrigin;
    connector = new connectorModule.LocalConnectorClient({
      baseUrl: receiverOrigin,
      connectorToken,
      requestTimeoutMs: 2_000,
      protocolVersion: protocol.STANDING_PROTOCOL_VERSION,
    });
  }

  const makeHost = (keys, keyId) => new hostModule.StandingReentryHostSdk({
    origin: hostOrigin,
    privateKey: keys.privateKey,
    keyId,
  });
  const hosts = {
    consented: makeHost(consentedKeys, ids.key),
    "alternate-trusted": makeHost(alternateKeys, ids.alternateKey),
    "same-id-replacement": makeHost(alternateKeys, ids.key),
  };
  await startRuntime();

  const driver = {
    issueManifest() {
      const issuedAt = new Date();
      return hosts.consented.issueManifest({
        manifestId: `manifest_standing_${suffix}`,
        correlationId: `correlation_standing_${suffix}`,
        issuedAt: issuedAt.toISOString(),
        offerExpiresAt: new Date(issuedAt.getTime() + 5 * 60_000).toISOString(),
        workflow: { id: ids.workflow, type: "domain-neutral-workflow", stateVersion: 0, canonicalUrl },
        display: {
          title: "Continue the standing workflow",
          reason: "Read current authoritative state and prepare the next safe step.",
        },
        grantRequest: {
          eventType: "workflow.ready",
          grantExpiresAt: new Date(issuedAt.getTime() + 60 * 60_000).toISOString(),
          humanBoundary,
        },
      });
    },
    // Shell route names are intentionally unspecified. These service calls carry the same fixture
    // account identity and exercise real persistence; they do not prove browser session or CSRF UX.
    enroll({ manifest }) {
      return service.createStandingConsentSession({
        organizationId: ids.organization,
        hostSubjectRef: ids.subject,
        expectedOrigin: hostOrigin,
        manifest,
        maximumGrantLifetimeMs: 2 * 60 * 60_000,
      });
    },
    approve({ challengeId }) {
      approvalCalls += 1;
      return service.decideStandingConsent({
        challengeId,
        accountId: ids.account,
        connectorId: ids.connector,
        action: "approve",
        decisionId: ids.decision,
        decidedAt: new Date().toISOString(),
      });
    },
    issueEvent({ binding, ordinal, signer = "consented", discriminator = "" }) {
      assert.ok(Object.hasOwn(hosts, signer), "fixture_signer_unknown");
      const occurredAt = new Date();
      return hosts[signer].issueEvent({
        binding,
        eventId: `event_standing_${suffix}_${signer}_${ordinal}${discriminator ? `_${discriminator}` : ""}`,
        eventSequence: ordinal,
        occurredAt: occurredAt.toISOString(),
        deliveryTimestamp: String(Math.floor(occurredAt.getTime() / 1_000)),
        workflow: { id: ids.workflow, stateVersion: ordinal, canonicalUrl },
      });
    },
    setConsentedKeyMaterialForTest,
    async sendEvent({ envelope }) {
      const response = await fetch(`${receiverOrigin}/v0.2/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(envelope),
        redirect: "manual",
        signal: AbortSignal.timeout(2_000),
      });
      let body;
      try {
        body = await response.json();
      } catch {
        throw new Error("standing_event_response_json_invalid");
      }
      return { statusCode: response.status, body };
    },
    claim({ claimToken }) {
      return connector.claimDelivery({ claimToken });
    },
    dispatch({ lease }) {
      return adapterModule.dispatchAgentActivation({
        lease,
        now: new Date(),
        timeoutMs: 1_000,
        adapter: {
          activate(activation) {
            activationCalls += 1;
            return {
              type: adapterModule.AGENT_ACTIVATION_RESULT_TYPE,
              protocol_version: activation.protocol_version,
              delivery_id: activation.delivery_id,
              event_id: activation.event_id,
              attempt: activation.attempt,
              outcome: "accepted",
              code: "activation_dispatch_accepted",
              unavailable_capability: null,
            };
          },
        },
      });
    },
    authorizeEffect({ lease, sequence }) {
      const effectToken = randomBytes(32).toString("base64url");
      effects.set(effectToken, Object.freeze({
        type: authorityTypes.STANDING_HOST_EFFECT_ATTESTATION_TYPE,
        protocol_version: protocol.STANDING_PROTOCOL_VERSION,
        effect_id: `effect_standing_${suffix}_${sequence}`,
        delivery_id: lease.delivery_id,
        event_id: lease.event_id,
        correlation_id: lease.continuation.correlation_id,
        workflow_id: lease.continuation.workflow_id,
        outcome: authorityTypes.STANDING_HOST_EFFECT_OUTCOME,
        confirmed_at: new Date().toISOString(),
      }));
      return effectToken;
    },
    acknowledge({ deliveryId, leaseToken, effectToken }) {
      return connector.acknowledgeDelivery({ deliveryId, leaseToken, effectToken });
    },
    async restart() {
      await stopRuntime();
      await prisma.$disconnect();
      await startRuntime();
    },
    inspect({ bindingId }) {
      return service.inspectStandingGrant({ accountId: ids.account, bindingId });
    },
    revoke({ bindingId }) {
      return service.revokeStandingGrant({ accountId: ids.account, bindingId });
    },
  };

  const claimTokens = Array.from({ length: 3 }, () => randomBytes(32).toString("base64url"));
  const result = await scenario.runStandingAuthorizationV02Scenario({ driver, claimTokens });
  assert.equal(result.status, "passed");
  assert.equal(approvalCalls, result.consent_decisions, "fixture_consent_call_count");
  assert.equal(activationCalls, result.deliveries.length, "fixture_activation_call_count");
  assert.equal(effectAuthorityCalls, result.deliveries.length, "fixture_effect_call_count");
  assert.deepEqual(result.ordering, {
    out_of_order_rejected: true,
    retryable: false,
    no_mutation: true,
  });
  assert.deepEqual(result.concurrency, {
    distinct_sequence_conflict: true,
    conflict_responses: 1,
    duplicate_event_converged: true,
    accepted_responses: 1,
    duplicate_responses: 1,
  });
  assert.equal(currentKeyMaterial, "consented", "fixture_key_material_not_restored");
});

function requireDisposableDatabase() {
  assert.equal(process.env.NODE_ENV, "test", "standing_conformance_requires_node_env_test");
  const value = process.env.STANDING_MIGRATION_TEST_DATABASE_URL;
  assert.ok(typeof value === "string" && value.length > 0, "standing_conformance_database_url_required");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("standing_conformance_database_url_invalid");
  }
  assert.ok(["postgres:", "postgresql:"].includes(parsed.protocol), "standing_conformance_requires_postgresql");
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname), "standing_conformance_requires_loopback_database");
  assert.ok(parsed.pathname.length > 1, "standing_conformance_database_name_required");
  // pg connection-string query parameters can override the transport host. Reject all of them
  // rather than allow a loopback-looking URL to select a remote endpoint or external service.
  assert.ok(parsed.search === "", "standing_conformance_database_query_forbidden");
  assert.ok(parsed.hash === "", "standing_conformance_database_fragment_forbidden");
  return value;
}

function gitValue(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
