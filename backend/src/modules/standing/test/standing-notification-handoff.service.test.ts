import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "@jest/globals";
import { appConfig } from "../../../config/config";
import { prisma } from "../../../db";
import { canonicalJson, createStandingContinuationEventEnvelope } from "../standing.protocol";
import {
  acceptStandingEvent,
  claimStandingDelivery,
  handoffStandingDelivery,
  type StandingRuntimeAdmissionAuthority,
  type StandingRuntimeAdmissionExpected,
} from "../standing.service";
import type { StandingRuntimeAdmissionAttestation } from "../standing-notification-handoff";

function requireDisposableDatabase(): string {
  const value = process.env.STANDING_MIGRATION_TEST_DATABASE_URL;
  if (process.env.NODE_ENV !== "test" || !value) {
    throw new Error("Notification handoff service tests require NODE_ENV=test and a disposable database URL");
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
    throw new Error("Notification handoff service tests are restricted to the task-owned loopback database");
  }
  if (appConfig.databaseUrl !== value) {
    throw new Error("Notification handoff service tests found a different configured database");
  }
  return value;
}

const databaseUrl = requireDisposableDatabase();
const namespace = `standing-handoff-${randomUUID()}`;
const ids = {
  account: `${namespace}-account`,
  developer: `${namespace}-developer`,
  organization: `${namespace}-org`,
  pairing: `${namespace}-pairing`,
  connector: `${namespace}-connector`,
  target: `${namespace}-target`,
  hostKey: `${namespace}-host-key`,
  key: `${namespace}-key`,
  subject: `${namespace}-subject`,
  grant: `${namespace}-grant`,
  binding: `${namespace}-binding`,
  event: `${namespace}-event`,
  correlation: `${namespace}-correlation`,
  workflow: `${namespace}-workflow`,
};
const origin = `https://${namespace}.example`;
const canonicalUrl = `${origin}/work`;
const connectorToken = randomBytes(32).toString("base64url");
const keys = generateKeyPairSync("ed25519");
const publicKeyPem = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
const keyFingerprint = createHash("sha256")
  .update(keys.publicKey.export({ type: "spki", format: "der" }))
  .digest("base64url");
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

async function seedFixture(): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60_000);
  await prisma.$transaction(async (transaction) => {
    await transaction.userAccount.create({
      data: {
        id: ids.account,
        email: `${namespace}@user.example.invalid`,
        passwordHash: "test-only",
        createdAt: now,
        updatedAt: now,
      },
    });
    await transaction.developerAccount.create({
      data: {
        id: ids.developer,
        email: `${namespace}@developer.example.invalid`,
        passwordHash: "test-only",
        createdAt: now,
        updatedAt: now,
      },
    });
    await transaction.organization.create({
      data: { id: ids.organization, developerId: ids.developer, name: namespace, createdAt: now, updatedAt: now },
    });
    await transaction.pairingSession.create({
      data: {
        id: ids.pairing,
        accountId: ids.account,
        pairingCodeDigest: digest(`${namespace}-pairing-code`),
        createdAt: now,
        expiresAt,
        consumedAt: now,
      },
    });
    await transaction.connector.create({
      data: {
        id: ids.connector,
        accountId: ids.account,
        pairingSessionId: ids.pairing,
        deliveryTargetId: ids.target,
        tokenDigest: digest(connectorToken),
        deviceName: namespace,
        createdAt: now,
        expiresAt,
      },
    });
    await transaction.hostKey.create({
      data: {
        id: ids.hostKey,
        organizationId: ids.organization,
        hostId: `${namespace}-host`,
        issuerOrigin: origin,
        keyId: ids.key,
        publicKeyPem,
        createdAt: now,
      },
    });
    await transaction.hostSubjectBinding.create({
      data: {
        id: ids.subject,
        organizationId: ids.organization,
        hostSubjectRefDigest: digest(`${namespace}-subject-ref`),
        connectorId: ids.connector,
        deliveryTargetId: ids.target,
        createdAt: now,
      },
    });
    await transaction.standingConsentSession.create({
      data: {
        id: `${namespace}-consent`,
        challengeId: `${namespace}-challenge`,
        tokenDigest: digest(`${namespace}-consent-token`),
        organizationId: ids.organization,
        hostSubjectRefDigest: digest(`${namespace}-subject-ref`),
        expectedOrigin: origin,
        manifestId: `${namespace}-manifest`,
        manifestJson: {},
        expiresAt,
        effectiveGrantExpiresAt: expiresAt,
        status: "approved",
        decisionId: `${namespace}-decision`,
        decisionAction: "approve",
        decisionAt: now,
        accountId: ids.account,
        createdAt: now,
      },
    });
    await transaction.standingGrant.create({
      data: {
        id: ids.grant,
        consentSessionId: `${namespace}-consent`,
        bindingId: ids.binding,
        hostSubjectBindingId: ids.subject,
        organizationId: ids.organization,
        accountId: ids.account,
        connectorId: ids.connector,
        deliveryTargetId: ids.target,
        correlationId: ids.correlation,
        issuerOrigin: origin,
        issuerKeyId: ids.key,
        issuerKeyFingerprint: keyFingerprint,
        workflowId: ids.workflow,
        workflowType: "notification_handoff_test",
        canonicalUrl,
        eventType: "workflow.ready",
        instruction: "Read the current workflow state",
        humanBoundary: "human_review",
        expiresAt,
        createdAt: now,
      },
    });
  });
}

function signedEvent() {
  const now = new Date();
  return createStandingContinuationEventEnvelope(
    {
      type: "webmcp.continuation_event",
      protocol_version: "0.2",
      event_id: ids.event,
      binding_id: ids.binding,
      correlation_id: ids.correlation,
      issuer_origin: origin,
      workflow_id: ids.workflow,
      event_type: "workflow.ready",
      event_sequence: 1,
      state_version: 1,
      occurred_at: now.toISOString(),
      canonical_url: canonicalUrl,
    },
    {
      privateKey: keys.privateKey,
      keyId: ids.key,
      timestamp: String(Math.floor(now.getTime() / 1_000)),
    },
  );
}

afterAll(async () => {
  await prisma.$disconnect();
  console.info(`Retained owned notification handoff fixture namespace: ${namespace}`);
});

describe("standing notification handoff service", () => {
  it("persists a verified handoff and replays it after lease/grant lifetime changes", async () => {
    // The environment guard above prevents accidental writes outside the task-owned DB.
    expect(databaseUrl).toContain("127.0.0.1:55432/reentry_baseline");
    await seedFixture();
    await expect(acceptStandingEvent(signedEvent())).resolves.toMatchObject({ accepted: true });
    const leaseToken = randomBytes(32).toString("base64url");
    const claimed = await claimStandingDelivery({ connectorToken, claimToken: leaseToken });
    expect(claimed).not.toBeNull();
    const delivery = await prisma.standingDelivery.findUniqueOrThrow({ where: { eventId: ids.event } });
    const acceptedAt = delivery.leaseStartedAt!.toISOString();
    const attestation = {
      type: "webmcp.runtime_admission_attestation",
      protocol_version: "0.2",
      admission_id: `${namespace}-admission`,
      adapter_id: "codex_desktop_v1",
      binding_generation: "a".repeat(64),
      delivery_id: delivery.deliveryId,
      event_id: ids.event,
      handoff_id: `${namespace}-handoff`,
      accepted_at: acceptedAt,
    } as const;
    let verifyCalls = 0;
    const authority: StandingRuntimeAdmissionAuthority = {
      verifyAdmission: async ({ attestation: supplied, expected }: {
        attestation: StandingRuntimeAdmissionAttestation;
        expected: StandingRuntimeAdmissionExpected;
      }) => {
        verifyCalls += 1;
        expect(expected).toMatchObject({
          delivery_id: delivery.deliveryId,
          event_id: ids.event,
          grant_id: ids.grant,
          connector_id: ids.connector,
          delivery_target_id: ids.target,
          correlation_id: ids.correlation,
          workflow_id: ids.workflow,
        });
        return supplied;
      },
    };
    const result = await handoffStandingDelivery({
      connectorToken,
      deliveryId: delivery.deliveryId,
      leaseToken,
      handoffId: attestation.handoff_id,
      runtimeAdmissionAttestation: attestation,
      runtimeAdmissionAuthority: authority,
    });
    expect(result).toMatchObject({
      status: "handed_off",
      duplicate: false,
      delivery_id: delivery.deliveryId,
      event_id: ids.event,
      handoff_id: attestation.handoff_id,
      runtime_admission_ref: attestation.admission_id,
    });
    expect(verifyCalls).toBe(1);
    const persisted = await prisma.standingDelivery.findUniqueOrThrow({ where: { deliveryId: delivery.deliveryId } });
    expect(persisted).toMatchObject({
      status: "handed_off",
      handoffId: attestation.handoff_id,
      runtimeAdmissionJson: canonicalJson(attestation),
    });
    await prisma.standingGrant.update({ where: { id: ids.grant }, data: { revokedAt: new Date() } });
    const replay = await handoffStandingDelivery({
      connectorToken,
      deliveryId: delivery.deliveryId,
      leaseToken,
      handoffId: attestation.handoff_id,
      runtimeAdmissionAttestation: attestation,
      runtimeAdmissionAuthority: undefined,
    });
    expect(replay).toEqual({ ...result, duplicate: true });
    expect(verifyCalls).toBe(1);

    await prisma.standingDelivery.update({
      where: { deliveryId: delivery.deliveryId },
      data: {
        handoffReceiptJson: canonicalJson({
          ...result,
          runtime_admission_ref: `${namespace}-different-admission`,
        }),
      },
    });
    await expect(
      handoffStandingDelivery({
        connectorToken,
        deliveryId: delivery.deliveryId,
        leaseToken,
        handoffId: attestation.handoff_id,
        runtimeAdmissionAttestation: attestation,
        runtimeAdmissionAuthority: undefined,
      }),
    ).rejects.toMatchObject({
      code: "delivery_private_state_invalid",
      statusCode: 500,
    });
  });
});
