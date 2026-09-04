import { createHmac, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { appConfig } from "../../config/config";
import { prisma } from "../../db";
import { isUniqueConstraintError } from "../../lib/prisma-errors";
import { digestSecret } from "../../middleware/organization-auth";
import { normalizeOrigin, validatePublicKeyPem } from "../consent/manifest";
import {
  CONTINUATION_MODE,
  STANDING_AUTHORIZATION_MODE,
  STANDING_MAX_ACTIVE_ACTIVATIONS,
  STANDING_PROTOCOL_VERSION,
  canonicalJson,
  createStandingContinuationAcceptance,
  createStandingContinuationReceipt,
  createStandingPublicBinding,
  parseStandingContinuationEventBody,
  parseStandingReentryManifest,
  verifyStandingContinuationEventEnvelope,
  verifyStandingReentryManifestAuthority,
  type StandingContinuationAcceptance,
  type StandingContinuationEvent,
  type StandingContinuationEventEnvelope,
  type StandingPublicBinding,
  type StandingReentryManifest,
} from "./standing.protocol";
import {
  normalizeNotificationHandoffReceipt,
  normalizeRuntimeAdmissionAttestation,
  StandingNotificationHandoffValidationError,
  type StandingNotificationHandoffReceipt,
  type StandingRuntimeAdmissionAttestation,
} from "./standing-notification-handoff";

const CONSENT_LIFETIME_MS = 10 * 60 * 1_000;
const LEASE_DURATION_MS = 60 * 1_000;
const AUTHORITY_FUTURE_SKEW_MS = 60 * 1_000;
const MAXIMUM_ATTEMPTS = 3;
const CLAIM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;

export class StandingReceiverError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    public readonly retryable = false,
    message = code
  ) {
    super(message);
    this.name = "StandingReceiverError";
  }
}

export type StandingEffectExpected = {
  delivery_id: string;
  event_id: string;
  correlation_id: string;
  workflow_id: string;
  canonical_url: string;
  human_boundary: string;
  outcome: "committed";
};

export type StandingEffectAttestation = {
  type: "webmcp.host_effect_attestation";
  protocol_version: "0.2";
  effect_id: string;
  delivery_id: string;
  event_id: string;
  correlation_id: string;
  workflow_id: string;
  outcome: "committed";
  confirmed_at: string;
};

export type StandingEffectAuthority = {
  verifyEffect(input: {
    effectToken: string;
    expected: StandingEffectExpected;
  }): StandingEffectAttestation | Promise<StandingEffectAttestation>;
};

export type StandingConsentChallenge = {
  challenge_id: string;
  manifest_id: string;
  status: "pending" | "approved" | "declined" | "expired";
  offer: {
    title: string;
    reason: string;
    canonical_url: string;
  };
  grant_scope: {
    authorization_mode: "standing";
    event_type: string;
    expires_at: string;
    max_active_activations: 1;
    human_boundary: string;
  };
};

export type StandingConsentEnrollment = {
  type: "webmcp.reentry_consent_session";
  protocol_version: "0.2";
  consent_session_id: string;
  challenge: StandingConsentChallenge;
  consent_url: string;
  expires_at: string;
  duplicate: boolean;
};

export type StandingHostKeyRegistration = {
  type: "webmcp.reentry_host_key";
  protocol_version: "0.2";
  host_id: string;
  issuer_origin: string;
  key_id: string;
  status: "active";
  duplicate: boolean;
};

export type StandingConsentStatus = {
  type: "webmcp.reentry_consent_status";
  protocol_version: "0.2";
  consent_session_id: string;
  challenge_id: string;
  status: "pending" | "approved" | "declined" | "expired";
  effective_status: "active" | "revoked" | "expired" | null;
  expires_at: string;
  binding: StandingPublicBinding | null;
};

export type StandingConsentPrompt = {
  consentSessionId: string;
  session: StandingConsentChallenge & {
    issuer_origin: string;
    workflow_id: string;
    title: string;
    reason: string;
  };
  status: "pending" | "approved" | "declined" | "expired";
  connectors: Array<{ id: string; deviceName: string; expiresAt: string }>;
};

type CreateStandingConsentInput = {
  organizationId: string;
  hostSubjectRef: string;
  expectedOrigin: string;
  manifest: unknown;
  maximumGrantLifetimeMs: number;
};

type RegisterStandingHostKeyInput = {
  hostId: string;
  issuerOrigin: string;
  keyId: string;
  publicKeyPem: string;
};

type StandingAccountConsentDecisionInput = {
  consentToken: string;
  action: "approve" | "decline";
  connectorId?: string;
  decisionId: string;
  decidedAt: string;
};

type DecideStandingConsentInput = {
  challengeId: string;
  accountId: string;
  connectorId?: string;
  action: "approve" | "decline";
  decisionId: string;
  decidedAt: string;
};

type StandingGrantControlInput = {
  accountId: string;
  bindingId: string;
};

type ClaimStandingDeliveryInput = {
  connectorToken: string;
  claimToken: string;
};

type AcknowledgeStandingDeliveryInput = {
  connectorToken: string;
  deliveryId: string;
  leaseToken: string;
  effectToken: string;
  effectAuthority?: StandingEffectAuthority;
};

export type StandingRuntimeAdmissionExpected = {
  delivery_id: string;
  event_id: string;
  grant_id: string;
  connector_id: string;
  delivery_target_id: string;
  correlation_id: string;
  workflow_id: string;
};

export type StandingRuntimeAdmissionAuthority = {
  verifyAdmission(input: {
    attestation: StandingRuntimeAdmissionAttestation;
    expected: StandingRuntimeAdmissionExpected;
  }): StandingRuntimeAdmissionAttestation | Promise<StandingRuntimeAdmissionAttestation>;
};

type HandoffStandingDeliveryInput = {
  connectorToken: string;
  deliveryId: string;
  leaseToken: string;
  handoffId: string;
  runtimeAdmissionAttestation: unknown;
  runtimeAdmissionAuthority?: StandingRuntimeAdmissionAuthority;
};

const standingDeliverySelect = {
  deliveryId: true,
  eventId: true,
  grantId: true,
  deliveryTargetId: true,
  status: true,
  maximumAttempts: true,
  currentAttempt: true,
  currentConnectorId: true,
  currentClaimTokenDigest: true,
  currentLeaseTokenDigest: true,
  leaseStartedAt: true,
  leaseExpiresAt: true,
  effectId: true,
  effectAttestationJson: true,
  acknowledgedAt: true,
  terminalReason: true,
  handoffId: true,
  runtimeAdmissionJson: true,
  handoffReceiptJson: true,
  handoffAcceptedAt: true,
  createdAt: true,
  updatedAt: true,
  event: {
    select: {
      eventId: true,
      grantId: true,
      eventSequence: true,
      canonicalBody: true,
      acceptanceJson: true,
      receivedAt: true,
    },
  },
  grant: {
    select: {
      id: true,
      bindingId: true,
      hostSubjectBindingId: true,
      organizationId: true,
      accountId: true,
      connectorId: true,
      deliveryTargetId: true,
      correlationId: true,
      issuerOrigin: true,
      issuerKeyId: true,
      issuerKeyFingerprint: true,
      workflowId: true,
      workflowType: true,
      canonicalUrl: true,
      eventType: true,
      instruction: true,
      humanBoundary: true,
      continuationMode: true,
      authorizationMode: true,
      maxActiveActivations: true,
      lastEventSequence: true,
      expiresAt: true,
      revokedAt: true,
      createdAt: true,
    },
  },
} as const;

type StandingDeliveryRecord = Prisma.StandingDeliveryGetPayload<{
  select: typeof standingDeliverySelect;
}>;

type ConnectorIdentity = {
  id: string;
  accountId: string;
  deliveryTargetId: string;
  expiresAt: Date;
};

function receiverFailure(
  code: string,
  statusCode: number,
  retryable = false,
  message = code
): StandingReceiverError {
  return new StandingReceiverError(code, statusCode, retryable, message);
}

function requireExactReceiverInput(
  value: unknown,
  fields: readonly string[],
  label: string
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw receiverFailure(
      "receiver_input_invalid",
      422,
      false,
      `${label} must be an object`
    );
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw receiverFailure(
      "receiver_input_invalid",
      422,
      false,
      `${label} must be a plain object`
    );
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      typeof key === "symbol" ||
      !descriptor?.enumerable ||
      !("value" in descriptor)
    ) {
      throw receiverFailure(
        "receiver_input_invalid",
        422,
        false,
        `${label} must contain enumerable data properties only`
      );
    }
  }
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (
    actual.length !== expected.length ||
    actual.some((field, index) => field !== expected[index])
  ) {
    throw receiverFailure(
      "receiver_input_fields_invalid",
      422,
      false,
      `${label} fields are invalid`
    );
  }
}

function requireIdentifier(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    Buffer.byteLength(value, "utf8") > 160 ||
    !IDENTIFIER_PATTERN.test(value)
  ) {
    throw receiverFailure("receiver_identifier_invalid", 422, false, `${label} is invalid`);
  }
  return value;
}

function requireOpaqueToken(value: unknown, code: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    Buffer.byteLength(value, "utf8") > 4 * 1_024 ||
    /[^\x21-\x7e]/.test(value)
  ) {
    throw receiverFailure(code, 403);
  }
  return value;
}

function requireClaimToken(value: unknown, label = "Delivery claim token"): string {
  if (typeof value !== "string" || !CLAIM_TOKEN_PATTERN.test(value)) {
    throw receiverFailure("delivery_claim_token_invalid", 403, false, `${label} is invalid`);
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== 32 || decoded.toString("base64url") !== value) {
    throw receiverFailure("delivery_claim_token_invalid", 403, false, `${label} is invalid`);
  }
  return value;
}

function requireCanonicalTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length > 27) {
    throw receiverFailure("receiver_timestamp_invalid", 422, false, `${label} is invalid`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw receiverFailure("receiver_timestamp_invalid", 422, false, `${label} is invalid`);
  }
  return value;
}

function requireOrigin(value: unknown): string {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 2_048) {
    throw receiverFailure("manifest_origin_mismatch", 422);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw receiverFailure("manifest_origin_mismatch", 422);
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.origin !== value ||
    parsed.username ||
    parsed.password
  ) {
    throw receiverFailure("manifest_origin_mismatch", 422);
  }
  return value;
}

function requireHostSubjectRef(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    Buffer.byteLength(value, "utf8") > 512 ||
    CONTROL_CHARACTER_PATTERN.test(value)
  ) {
    throw receiverFailure("host_subject_ref_invalid", 400);
  }
  return value;
}

function readNow(): Date {
  return new Date();
}

function consentTokenForSession(sessionId: string): string {
  return createHmac("sha256", String(appConfig.jwtSecret))
    .update(`cr2-standing-consent:${sessionId}`, "utf8")
    .digest("base64url");
}

function standingConsentUrl(sessionId: string): string {
  const base = appConfig.receiverPublicUrl.replace(/\/$/, "");
  return `${base}/consent?token=${encodeURIComponent(consentTokenForSession(sessionId))}`;
}

function standingConsentSessionResponse(
  session: {
    id: string;
    challengeId: string;
    manifestId: string;
    expiresAt: Date;
    effectiveGrantExpiresAt: Date;
    status: string;
  },
  manifest: StandingReentryManifest,
  duplicate: boolean,
  now: Date,
): StandingConsentEnrollment {
  return {
    type: "webmcp.reentry_consent_session",
    protocol_version: STANDING_PROTOCOL_VERSION,
    consent_session_id: session.id,
    challenge: publicChallenge(session, manifest, now),
    consent_url: standingConsentUrl(session.id),
    expires_at: session.expiresAt.toISOString(),
    duplicate,
  };
}

function publicChallenge(
  session: {
    challengeId: string;
    manifestId: string;
    expiresAt: Date;
    effectiveGrantExpiresAt: Date;
    status: string;
  },
  manifest: StandingReentryManifest,
  now: Date
): StandingConsentChallenge {
  const status =
    session.status === "pending" && session.expiresAt <= now
      ? "expired"
      : session.status;
  if (!["pending", "approved", "declined", "expired"].includes(status)) {
    throw receiverFailure("challenge_status_invalid", 500);
  }
  return {
    challenge_id: session.challengeId,
    manifest_id: session.manifestId,
    status: status as StandingConsentChallenge["status"],
    offer: {
      title: manifest.display.title,
      reason: manifest.display.reason,
      canonical_url: manifest.workflow.canonical_url,
    },
    grant_scope: {
      authorization_mode: STANDING_AUTHORIZATION_MODE,
      event_type: manifest.grant_request.event_type,
      expires_at: session.effectiveGrantExpiresAt.toISOString(),
      max_active_activations: STANDING_MAX_ACTIVE_ACTIVATIONS,
      human_boundary: manifest.grant_request.human_boundary,
    },
  };
}

function standingGrantStatus(
  grant: { revokedAt: Date | null; expiresAt: Date },
  now: Date
): "active" | "revoked" | "expired" {
  if (grant.revokedAt !== null) return "revoked";
  if (grant.expiresAt <= now) return "expired";
  return "active";
}

function safeSequence(value: bigint, code = "grant_sequence_invalid"): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw receiverFailure(code, 500);
  }
  return number;
}

function publicBinding(
  grant: {
    bindingId: string;
    correlationId: string;
    workflowId: string;
    eventType: string;
    expiresAt: Date;
    lastEventSequence: bigint;
    revokedAt: Date | null;
  },
  now: Date
): StandingPublicBinding {
  return createStandingPublicBinding({
    type: "webmcp.reentry_binding",
    protocol_version: STANDING_PROTOCOL_VERSION,
    binding_id: grant.bindingId,
    correlation_id: grant.correlationId,
    workflow_id: grant.workflowId,
    event_type: grant.eventType,
    expires_at: grant.expiresAt.toISOString(),
    authorization_mode: STANDING_AUTHORIZATION_MODE,
    max_active_activations: STANDING_MAX_ACTIVE_ACTIVATIONS,
    last_event_sequence: safeSequence(grant.lastEventSequence),
    status: standingGrantStatus(grant, now),
  });
}

function sameManifestIdentity(
  session: {
    hostSubjectRefDigest: string;
    expectedOrigin: string;
    manifestJson: Prisma.JsonValue;
  },
  subjectDigest: string,
  expectedOrigin: string,
  manifest: StandingReentryManifest
): boolean {
  return (
    session.hostSubjectRefDigest === subjectDigest &&
    session.expectedOrigin === expectedOrigin &&
    canonicalJson(session.manifestJson) === canonicalJson(manifest)
  );
}

async function verifyManifestForOrganization(
  database: typeof prisma | Prisma.TransactionClient,
  organizationId: string,
  manifestInput: unknown,
  expectedOrigin: string,
  now: Date
): Promise<{ manifest: StandingReentryManifest; keyFingerprint: string }> {
  const parsed = parseStandingReentryManifest(manifestInput);
  if (parsed.issuer_origin !== expectedOrigin) {
    throw receiverFailure("manifest_origin_mismatch", 422);
  }
  const hostKey = await database.hostKey.findUnique({
    where: {
      organizationId_issuerOrigin_keyId: {
        organizationId,
        issuerOrigin: parsed.issuer_origin,
        keyId: parsed.signature.key_id,
      },
    },
    select: { publicKeyPem: true, revokedAt: true },
  });
  if (!hostKey || hostKey.revokedAt !== null) {
    throw receiverFailure("manifest_key_unavailable", 401);
  }
  return verifyStandingReentryManifestAuthority(parsed, {
    expectedOrigin,
    now,
    keyResolver: () => hostKey.publicKeyPem,
  });
}

/** Register the exact public key used by a standing Host Manifest/Event signer. */
export async function registerStandingHostKey(
  organizationId: string,
  input: RegisterStandingHostKeyInput,
): Promise<StandingHostKeyRegistration> {
  const normalizedOrganizationId = requireIdentifier(organizationId, "organizationId");
  const hostId = requireIdentifier(input.hostId, "hostId");
  const keyId = requireIdentifier(input.keyId, "keyId");
  let issuerOrigin: string;
  try {
    issuerOrigin = normalizeOrigin(input.issuerOrigin);
    validatePublicKeyPem(input.publicKeyPem);
  } catch {
    throw receiverFailure("host_key_invalid", 400);
  }
  if (
    typeof input.publicKeyPem !== "string" ||
    input.publicKeyPem.length === 0 ||
    Buffer.byteLength(input.publicKeyPem, "utf8") > 16 * 1_024
  ) {
    throw receiverFailure("host_key_invalid", 400);
  }

  const where = {
    organizationId_issuerOrigin_keyId: {
      organizationId: normalizedOrganizationId,
      issuerOrigin,
      keyId,
    },
  } as const;
  const existing = await prisma.hostKey.findUnique({ where });
  if (existing) {
    if (
      existing.hostId === hostId &&
      existing.publicKeyPem === input.publicKeyPem &&
      existing.revokedAt === null
    ) {
      return {
        type: "webmcp.reentry_host_key",
        protocol_version: STANDING_PROTOCOL_VERSION,
        host_id: existing.hostId,
        issuer_origin: existing.issuerOrigin,
        key_id: existing.keyId,
        status: "active",
        duplicate: true,
      };
    }
    throw receiverFailure("host_key_conflict", 409);
  }
  try {
    const created = await prisma.hostKey.create({
      data: {
        organizationId: normalizedOrganizationId,
        hostId,
        issuerOrigin,
        keyId,
        publicKeyPem: input.publicKeyPem,
      },
    });
    return {
      type: "webmcp.reentry_host_key",
      protocol_version: STANDING_PROTOCOL_VERSION,
      host_id: created.hostId,
      issuer_origin: created.issuerOrigin,
      key_id: created.keyId,
      status: "active",
      duplicate: false,
    };
  } catch (error) {
    if (isUniqueConstraintError(error)) throw receiverFailure("host_key_conflict", 409);
    throw error;
  }
}

export async function createStandingConsentSession(
  input: CreateStandingConsentInput
): Promise<StandingConsentEnrollment> {
  const organizationId = requireIdentifier(input.organizationId, "organizationId");
  const hostSubjectRef = requireHostSubjectRef(input.hostSubjectRef);
  const expectedOrigin = requireOrigin(input.expectedOrigin);
  if (
    !Number.isSafeInteger(input.maximumGrantLifetimeMs) ||
    input.maximumGrantLifetimeMs < 1_000
  ) {
    throw new TypeError("maximumGrantLifetimeMs must be at least one second");
  }

  const now = readNow();
  const { manifest } = await verifyManifestForOrganization(
    prisma,
    organizationId,
    input.manifest,
    expectedOrigin,
    now
  );
  const maximumExpiryMs = now.getTime() + input.maximumGrantLifetimeMs;
  if (!Number.isFinite(maximumExpiryMs)) {
    throw new TypeError("maximumGrantLifetimeMs exceeds the Date range");
  }
  const effectiveGrantExpiresAt = new Date(
    Math.min(Date.parse(manifest.grant_request.grant_expires_at), maximumExpiryMs)
  );
  const expiresAt = new Date(
    Math.min(
      now.getTime() + CONSENT_LIFETIME_MS,
      Date.parse(manifest.offer_expires_at),
      effectiveGrantExpiresAt.getTime()
    )
  );
  if (expiresAt <= now || effectiveGrantExpiresAt <= now) {
    throw receiverFailure("consent_expired", 410);
  }

  const subjectDigest = digestSecret(hostSubjectRef);
  const existing = await prisma.standingConsentSession.findUnique({
    where: {
      organizationId_manifestId: {
        organizationId,
        manifestId: manifest.manifest_id,
      },
    },
  });
  if (existing) {
    if (!sameManifestIdentity(existing, subjectDigest, expectedOrigin, manifest)) {
      throw receiverFailure("manifest_identity_conflict", 409);
    }
    return standingConsentSessionResponse(
      existing,
      parseStandingReentryManifest(existing.manifestJson),
      true,
      now,
    );
  }

  const sessionId = randomUUID();
  const token = consentTokenForSession(sessionId);
  try {
    const session = await prisma.standingConsentSession.create({
      data: {
        id: sessionId,
        challengeId: randomUUID(),
        tokenDigest: digestSecret(token),
        organizationId,
        hostSubjectRefDigest: subjectDigest,
        expectedOrigin,
        manifestId: manifest.manifest_id,
        manifestJson: manifest as unknown as Prisma.InputJsonValue,
        expiresAt,
        effectiveGrantExpiresAt,
      },
    });
    return standingConsentSessionResponse(session, manifest, false, now);
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const raced = await prisma.standingConsentSession.findUnique({
      where: {
        organizationId_manifestId: {
          organizationId,
          manifestId: manifest.manifest_id,
        },
      },
    });
    if (!raced) throw receiverFailure("receiver_busy", 503, true);
    if (!sameManifestIdentity(raced, subjectDigest, expectedOrigin, manifest)) {
      throw receiverFailure("manifest_identity_conflict", 409);
    }
    return standingConsentSessionResponse(
      raced,
      parseStandingReentryManifest(raced.manifestJson),
      true,
      now,
    );
  }
}

/** Read standing Consent/Grant state for the Host confirmation poll. */
export async function getStandingConsentStatus(
  organizationId: string,
  consentSessionId: string,
): Promise<StandingConsentStatus> {
  const normalizedOrganizationId = requireIdentifier(organizationId, "organizationId");
  const normalizedSessionId = requireIdentifier(consentSessionId, "consentSessionId");
  const session = await prisma.standingConsentSession.findFirst({
    where: { id: normalizedSessionId, organizationId: normalizedOrganizationId },
    include: { grant: true },
  });
  if (!session) throw receiverFailure("consent_session_not_found", 404);

  const now = readNow();
  const status = session.status === "pending" && session.expiresAt <= now
    ? "expired"
    : session.status;
  if (!["pending", "approved", "declined", "expired"].includes(status)) {
    throw receiverFailure("challenge_status_invalid", 500);
  }
  let effectiveStatus: StandingConsentStatus["effective_status"] = null;
  let binding: StandingPublicBinding | null = null;
  if (status === "pending") {
    effectiveStatus = null;
  } else if (status === "expired") {
    effectiveStatus = "expired";
  } else if (status === "approved") {
    if (!session.grant) throw receiverFailure("approved_grant_missing", 500);
    effectiveStatus = standingGrantStatus(session.grant, now);
    binding = publicBinding(session.grant, now);
  }
  return {
    type: "webmcp.reentry_consent_status",
    protocol_version: STANDING_PROTOCOL_VERSION,
    consent_session_id: session.id,
    challenge_id: session.challengeId,
    status: status as StandingConsentStatus["status"],
    effective_status: effectiveStatus,
    expires_at: session.expiresAt.toISOString(),
    binding,
  };
}

/** Validate a standing consent URL token without exposing whether it belongs to a user. */
export async function validateStandingConsentPageToken(token: string): Promise<void> {
  if (typeof token !== "string" || !CLAIM_TOKEN_PATTERN.test(token)) {
    throw receiverFailure("consent_token_invalid", 404);
  }
  const session = await prisma.standingConsentSession.findUnique({
    where: { tokenDigest: digestSecret(token) },
    select: { status: true, expiresAt: true },
  });
  if (!session) throw receiverFailure("consent_token_invalid", 404);
  if (session.status === "pending" && session.expiresAt <= readNow()) {
    throw receiverFailure("consent_session_expired", 410);
  }
}

/** Data needed by the authenticated standing Consent page; no token is echoed. */
export async function getStandingConsentPrompt(
  token: string,
  accountId: string,
): Promise<StandingConsentPrompt> {
  if (typeof token !== "string" || !CLAIM_TOKEN_PATTERN.test(token)) {
    throw receiverFailure("consent_token_invalid", 404);
  }
  const normalizedAccountId = requireIdentifier(accountId, "accountId");
  const session = await prisma.standingConsentSession.findUnique({
    where: { tokenDigest: digestSecret(token) },
  });
  if (!session) throw receiverFailure("consent_token_invalid", 404);
  const now = readNow();
  if (session.status === "pending" && session.expiresAt <= now) {
    throw receiverFailure("consent_session_expired", 410);
  }
  const manifest = parseStandingReentryManifest(session.manifestJson);
  const connectors = await prisma.connector.findMany({
    where: { accountId: normalizedAccountId, revokedAt: null, expiresAt: { gt: now } },
    select: { id: true, deviceName: true, expiresAt: true },
    orderBy: { createdAt: "asc" },
  });
  const status = session.status === "pending" && session.expiresAt <= now
    ? "expired"
    : session.status;
  if (!["pending", "approved", "declined", "expired"].includes(status)) {
    throw receiverFailure("challenge_status_invalid", 500);
  }
  return {
    consentSessionId: session.id,
    session: {
      ...publicChallenge(session, manifest, now),
      issuer_origin: manifest.issuer_origin,
      workflow_id: manifest.workflow.id,
      title: manifest.display.title,
      reason: manifest.display.reason,
    },
    status: status as StandingConsentPrompt["status"],
    connectors: connectors.map((connector) => ({
      id: connector.id,
      deviceName: connector.deviceName,
      expiresAt: connector.expiresAt.toISOString(),
    })),
  };
}

/** Translate the browser token into the strict challenge-based standing decision call. */
export async function decideStandingConsentByToken(
  accountId: string,
  input: StandingAccountConsentDecisionInput,
): Promise<Record<string, unknown>> {
  const normalizedAccountId = requireIdentifier(accountId, "accountId");
  const token = requireClaimToken(input.consentToken, "Consent token");
  const session = await prisma.standingConsentSession.findUnique({
    where: { tokenDigest: digestSecret(token) },
    select: { id: true, challengeId: true },
  });
  if (!session) throw receiverFailure("consent_token_invalid", 403);
  const result = await decideStandingConsent({
    challengeId: session.challengeId,
    accountId: normalizedAccountId,
    connectorId: input.connectorId,
    action: input.action,
    decisionId: input.decisionId,
    decidedAt: input.decidedAt,
  });
  return {
    type: "webmcp.reentry_account_consent_decision",
    protocol_version: STANDING_PROTOCOL_VERSION,
    consent_session_id: session.id,
    ...result,
  };
}

async function lockStandingConsent(
  transaction: Prisma.TransactionClient,
  challengeId: string
): Promise<boolean> {
  const rows = await transaction.$queryRaw<Array<{ consent_session_id: string }>>`
    SELECT "consent_session_id"
    FROM "cr2_standing_consent_sessions"
    WHERE "challenge_id" = ${challengeId}
    FOR UPDATE
  `;
  return rows.length === 1;
}

function terminalDecisionResponse(
  session: {
    challengeId: string;
    status: string;
    decisionId: string | null;
    decisionAction: string | null;
    decisionAt: Date | null;
    accountId: string | null;
    grant: {
      connectorId: string;
      bindingId: string;
      correlationId: string;
      workflowId: string;
      eventType: string;
      expiresAt: Date;
      lastEventSequence: bigint;
      revokedAt: Date | null;
    } | null;
  },
  input: DecideStandingConsentInput,
  now: Date
): Record<string, unknown> {
  if (
    session.decisionId !== input.decisionId ||
    session.decisionAction !== input.action ||
    session.accountId !== input.accountId ||
    session.decisionAt?.toISOString() !== input.decidedAt
  ) {
    throw receiverFailure("consent_decision_conflict", 409);
  }
  if (session.status === "declined") {
    return {
      status: "declined",
      challenge_id: session.challengeId,
      duplicate: true,
    };
  }
  if (session.status !== "approved" || !session.grant) {
    throw receiverFailure("approved_grant_missing", 500);
  }
  if (session.grant.connectorId !== input.connectorId) {
    throw receiverFailure("consent_decision_identity_conflict", 409);
  }
  return {
    status: "approved",
    challenge_id: session.challengeId,
    duplicate: true,
    binding: publicBinding(session.grant, now),
  };
}

export async function decideStandingConsent(
  input: DecideStandingConsentInput
): Promise<Record<string, unknown>> {
  const challengeId = requireIdentifier(input.challengeId, "challengeId");
  const accountId = requireIdentifier(input.accountId, "accountId");
  const decisionId = requireIdentifier(input.decisionId, "decisionId");
  const decidedAt = requireCanonicalTimestamp(input.decidedAt, "decidedAt");
  if (!['approve', 'decline'].includes(input.action)) {
    throw receiverFailure("consent_decision_invalid", 403);
  }
  if (input.action === "approve") {
    requireIdentifier(input.connectorId, "connectorId");
  } else if (input.connectorId !== undefined) {
    throw receiverFailure("consent_decision_invalid", 403);
  }
  const decisionTime = Date.parse(decidedAt);

  try {
    return await prisma.$transaction(async (transaction) => {
      if (!(await lockStandingConsent(transaction, challengeId))) {
        throw receiverFailure("challenge_not_found", 404);
      }
      const session = await transaction.standingConsentSession.findUnique({
        where: { challengeId },
        include: { grant: true },
      });
      if (!session) throw receiverFailure("challenge_not_found", 404);
      let now = readNow();
      if (session.status !== "pending") {
        return terminalDecisionResponse(session, input, now);
      }
      if (
        decisionTime < session.createdAt.getTime() ||
        decisionTime > now.getTime() + AUTHORITY_FUTURE_SKEW_MS
      ) {
        throw receiverFailure("consent_decision_time_invalid", 403);
      }
      if (
        session.expiresAt <= now ||
        decisionTime >= session.expiresAt.getTime() ||
        decisionTime >= session.effectiveGrantExpiresAt.getTime()
      ) {
        throw receiverFailure("consent_decision_expired", 403);
      }

      if (input.action === "decline") {
        const changed = await transaction.standingConsentSession.updateMany({
          where: { id: session.id, status: "pending" },
          data: {
            status: "declined",
            decisionId,
            decisionAction: "decline",
            decisionAt: new Date(decisionTime),
            accountId,
          },
        });
        if (changed.count !== 1) {
          throw receiverFailure("consent_decision_race", 409);
        }
        return {
          status: "declined",
          challenge_id: challengeId,
          duplicate: false,
        };
      }

      const connector = await transaction.connector.findUnique({
        where: { id: input.connectorId as string },
        select: {
          id: true,
          accountId: true,
          deliveryTargetId: true,
          expiresAt: true,
          revokedAt: true,
        },
      });
      if (
        !connector ||
        connector.accountId !== accountId ||
        connector.revokedAt !== null ||
        connector.expiresAt <= now
      ) {
        throw receiverFailure("connector_not_available", 409);
      }

      const { manifest, keyFingerprint } = await verifyManifestForOrganization(
        transaction,
        session.organizationId,
        session.manifestJson,
        session.expectedOrigin,
        now
      );
      let subjectBinding = await transaction.hostSubjectBinding.findUnique({
        where: {
          organizationId_hostSubjectRefDigest: {
            organizationId: session.organizationId,
            hostSubjectRefDigest: session.hostSubjectRefDigest,
          },
        },
        select: { id: true, connectorId: true, deliveryTargetId: true },
      });
      if (!subjectBinding) {
        // A different Consent may concurrently establish the same sticky
        // subject target. ON CONFLICT DO NOTHING keeps this transaction usable;
        // catching a failed INSERT and reading in its aborted transaction does not.
        await transaction.hostSubjectBinding.createMany({
          data: {
            organizationId: session.organizationId,
            hostSubjectRefDigest: session.hostSubjectRefDigest,
            connectorId: connector.id,
            deliveryTargetId: connector.deliveryTargetId,
          },
          skipDuplicates: true,
        });
        // A separate READ COMMITTED statement sees the winner after the unique
        // index wait. Never overwrite a raced binding's Connector or target.
        subjectBinding = await transaction.hostSubjectBinding.findUnique({
          where: {
            organizationId_hostSubjectRefDigest: {
              organizationId: session.organizationId,
              hostSubjectRefDigest: session.hostSubjectRefDigest,
            },
          },
          select: { id: true, connectorId: true, deliveryTargetId: true },
        });
        if (!subjectBinding) throw receiverFailure("receiver_busy", 503, true);
      }
      if (
        subjectBinding.connectorId !== connector.id ||
        subjectBinding.deliveryTargetId !== connector.deliveryTargetId
      ) {
        throw receiverFailure("host_subject_binding_conflict", 409);
      }

      const grant = await transaction.standingGrant.create({
        data: {
          consentSessionId: session.id,
          bindingId: randomUUID(),
          hostSubjectBindingId: subjectBinding.id,
          organizationId: session.organizationId,
          accountId,
          connectorId: connector.id,
          deliveryTargetId: connector.deliveryTargetId,
          correlationId: manifest.correlation_id,
          issuerOrigin: manifest.issuer_origin,
          issuerKeyId: manifest.signature.key_id,
          issuerKeyFingerprint: keyFingerprint,
          workflowId: manifest.workflow.id,
          workflowType: manifest.workflow.type,
          canonicalUrl: manifest.workflow.canonical_url,
          eventType: manifest.grant_request.event_type,
          instruction: manifest.display.reason,
          humanBoundary: manifest.grant_request.human_boundary,
          continuationMode: CONTINUATION_MODE,
          authorizationMode: STANDING_AUTHORIZATION_MODE,
          maxActiveActivations: STANDING_MAX_ACTIVE_ACTIVATIONS,
          lastEventSequence: BigInt(0),
          expiresAt: session.effectiveGrantExpiresAt,
        },
      });
      // The inserted Grant remains private to this transaction. Keep the same
      // Grant -> authority lock order used by Event/Claim/ACK, then revalidate
      // after binding uniqueness, INSERT, and authority-row waits. Any failure
      // rolls back the new Grant and any newly inserted subject binding.
      if (!(await lockStandingGrantById(transaction, grant.id))) {
        throw receiverFailure("grant_disappeared", 500);
      }
      const keyRows = await transaction.$queryRaw<Array<{ host_key_id: string }>>`
        SELECT "host_key_id" FROM "cr2_host_keys"
        WHERE "organization_id" = ${session.organizationId}
          AND "issuer_origin" = ${manifest.issuer_origin}
          AND "key_id" = ${manifest.signature.key_id}
        FOR SHARE
      `;
      if (keyRows.length !== 1) throw receiverFailure("manifest_key_unavailable", 401);
      const connectorRows = await transaction.$queryRaw<Array<{ connector_id: string }>>`
        SELECT "connector_id" FROM "cr2_connectors"
        WHERE "connector_id" = ${connector.id}
        FOR SHARE
      `;
      if (connectorRows.length !== 1) throw receiverFailure("connector_not_available", 409);
      now = readNow();
      if (session.expiresAt <= now || session.effectiveGrantExpiresAt <= now) {
        throw receiverFailure("consent_decision_expired", 403);
      }
      const currentConnector = await transaction.connector.findUnique({
        where: { id: connector.id },
        select: { accountId: true, deliveryTargetId: true, expiresAt: true, revokedAt: true },
      });
      if (
        !currentConnector ||
        currentConnector.accountId !== accountId ||
        currentConnector.deliveryTargetId !== connector.deliveryTargetId ||
        currentConnector.revokedAt !== null ||
        currentConnector.expiresAt <= now
      ) {
        throw receiverFailure("connector_not_available", 409);
      }
      const currentAuthority = await verifyManifestForOrganization(
        transaction, session.organizationId, session.manifestJson, session.expectedOrigin, now
      );
      if (currentAuthority.keyFingerprint !== grant.issuerKeyFingerprint) {
        throw receiverFailure("grant_key_scope_invalid", 500);
      }
      const changed = await transaction.standingConsentSession.updateMany({
        where: { id: session.id, status: "pending" },
        data: {
          status: "approved",
          decisionId,
          decisionAction: "approve",
          decisionAt: new Date(decisionTime),
          accountId,
        },
      });
      if (changed.count !== 1) {
        throw receiverFailure("consent_decision_race", 409);
      }
      return {
        status: "approved",
        challenge_id: challengeId,
        duplicate: false,
        binding: publicBinding(grant, now),
      };
    });
  } catch (error) {
    if (error instanceof StandingReceiverError) throw error;
    if (isUniqueConstraintError(error)) {
      throw receiverFailure("consent_decision_conflict", 409);
    }
    throw error;
  }
}

async function lockStandingGrantById(
  transaction: Prisma.TransactionClient,
  grantId: string
): Promise<boolean> {
  const rows = await transaction.$queryRaw<Array<{ grant_id: string }>>`
    SELECT "grant_id"
    FROM "cr2_standing_grants"
    WHERE "grant_id" = ${grantId}
    FOR UPDATE
  `;
  return rows.length === 1;
}

async function lockStandingGrantByBinding(
  transaction: Prisma.TransactionClient,
  bindingId: string
): Promise<string | null> {
  const rows = await transaction.$queryRaw<Array<{ grant_id: string }>>`
    SELECT "grant_id"
    FROM "cr2_standing_grants"
    WHERE "binding_id" = ${bindingId}
    FOR UPDATE
  `;
  return rows[0]?.grant_id ?? null;
}

async function lockStandingDeliveryById(
  transaction: Prisma.TransactionClient,
  deliveryId: string
): Promise<boolean> {
  const rows = await transaction.$queryRaw<Array<{ delivery_id: string }>>`
    SELECT "delivery_id"
    FROM "cr2_standing_deliveries"
    WHERE "delivery_id" = ${deliveryId}
    FOR UPDATE
  `;
  return rows.length === 1;
}

function assertEventScope(
  event: StandingContinuationEvent,
  grant: {
    correlationId: string;
    issuerOrigin: string;
    workflowId: string;
    eventType: string;
    canonicalUrl: string;
    expiresAt: Date;
    revokedAt: Date | null;
  },
  now: Date
): void {
  if (grant.revokedAt !== null) throw receiverFailure("grant_revoked", 410);
  if (grant.expiresAt <= now) throw receiverFailure("grant_expired", 410);
  if (
    event.correlation_id !== grant.correlationId ||
    event.issuer_origin !== grant.issuerOrigin ||
    event.workflow_id !== grant.workflowId ||
    event.event_type !== grant.eventType ||
    event.canonical_url !== grant.canonicalUrl
  ) {
    throw receiverFailure("event_scope_invalid", 422);
  }
  if (Date.parse(event.occurred_at) >= grant.expiresAt.getTime()) {
    throw receiverFailure("event_after_grant_expiry", 422);
  }
}

function replayAcceptance(
  stored: { grantId: string; canonicalBody: string; acceptanceJson: string },
  expectedGrantId: string,
  event: StandingContinuationEvent,
  body: string
): StandingContinuationAcceptance {
  if (stored.grantId !== expectedGrantId || stored.canonicalBody !== body) {
    throw receiverFailure("event_identity_conflict", 409);
  }
  try {
    const value = JSON.parse(stored.acceptanceJson) as Record<string, unknown>;
    if (canonicalJson(value) !== stored.acceptanceJson) throw new Error("noncanonical");
    if (value.event_id !== event.event_id || value.correlation_id !== event.correlation_id) {
      throw new Error("identity");
    }
    return createStandingContinuationAcceptance({ ...value, duplicate: true });
  } catch (error) {
    if (error instanceof StandingReceiverError) throw error;
    throw receiverFailure("event_private_state_invalid", 500);
  }
}

export async function acceptStandingEvent(
  envelope: StandingContinuationEventEnvelope
): Promise<StandingContinuationAcceptance> {
  requireExactReceiverInput(
    envelope,
    ["body", "headers"],
    "Standing Event envelope"
  );
  const parsed = parseStandingContinuationEventBody(envelope.body);
  const initialGrant = await prisma.standingGrant.findUnique({
    where: { bindingId: parsed.binding_id },
  });
  if (!initialGrant) throw receiverFailure("event_scope_invalid", 422);
  const hostKey = await prisma.hostKey.findUnique({
    where: {
      organizationId_issuerOrigin_keyId: {
        organizationId: initialGrant.organizationId,
        issuerOrigin: initialGrant.issuerOrigin,
        keyId: initialGrant.issuerKeyId,
      },
    },
    select: { publicKeyPem: true, revokedAt: true },
  });
  if (!hostKey || hostKey.revokedAt !== null) {
    throw receiverFailure("event_key_unavailable", 401);
  }
  const event = verifyStandingContinuationEventEnvelope(envelope, {
    expectedOrigin: initialGrant.issuerOrigin,
    expectedKeyId: initialGrant.issuerKeyId,
    expectedKeyFingerprint: initialGrant.issuerKeyFingerprint,
    now: readNow(),
    keyResolver: () => hostKey.publicKeyPem,
  });

  try {
    return await prisma.$transaction(async (transaction) => {
      const grantId = await lockStandingGrantByBinding(transaction, event.binding_id);
      if (!grantId) throw receiverFailure("event_scope_invalid", 422);
      const existing = await transaction.standingEvent.findUnique({
        where: { eventId: event.event_id },
        select: { grantId: true, canonicalBody: true, acceptanceJson: true },
      });
      if (existing) {
        return replayAcceptance(existing, grantId, event, envelope.body);
      }
      const grant = await transaction.standingGrant.findUnique({
        where: { id: grantId },
      });
      if (!grant) throw receiverFailure("grant_disappeared", 500);
      if (
        grant.issuerKeyId !== initialGrant.issuerKeyId ||
        grant.issuerKeyFingerprint !== initialGrant.issuerKeyFingerprint
      ) {
        throw receiverFailure("grant_key_scope_invalid", 500);
      }
      // The preflight signature check is not an authority snapshot for this
      // transaction. Lock the current key after the Grant so revocation or
      // material rebinding cannot commit between this recheck and acceptance.
      const currentKeys = await transaction.$queryRaw<Array<{
        public_key_pem: string;
        revoked_at: Date | null;
      }>>`
        SELECT "public_key_pem", "revoked_at"
        FROM "cr2_host_keys"
        WHERE "organization_id" = ${grant.organizationId}
          AND "issuer_origin" = ${grant.issuerOrigin}
          AND "key_id" = ${grant.issuerKeyId}
        FOR SHARE
      `;
      const currentKey = currentKeys[0];
      if (!currentKey || currentKey.revoked_at !== null) {
        throw receiverFailure("event_key_unavailable", 401);
      }
      const now = readNow();
      verifyStandingContinuationEventEnvelope(envelope, {
        expectedOrigin: grant.issuerOrigin,
        expectedKeyId: grant.issuerKeyId,
        expectedKeyFingerprint: grant.issuerKeyFingerprint,
        now,
        keyResolver: () => currentKey.public_key_pem,
      });
      assertEventScope(event, grant, now);
      const lastSequence = safeSequence(grant.lastEventSequence);
      const expectedSequence = lastSequence + 1;
      if (event.event_sequence !== expectedSequence) {
        throw receiverFailure(
          event.event_sequence <= lastSequence
            ? "event_sequence_conflict"
            : "event_sequence_out_of_order",
          409
        );
      }
      const openDelivery = await transaction.standingDelivery.findFirst({
        where: {
          grantId,
          status: { in: ["pending", "leased"] },
        },
        select: { deliveryId: true },
      });
      if (openDelivery) {
        throw receiverFailure("activation_in_progress", 409, true);
      }
      const acceptance = createStandingContinuationAcceptance({
        type: "webmcp.continuation_acceptance",
        protocol_version: STANDING_PROTOCOL_VERSION,
        event_id: event.event_id,
        correlation_id: event.correlation_id,
        accepted: true,
        duplicate: false,
        status: "accepted",
      });
      const advanced = await transaction.standingGrant.updateMany({
        where: {
          id: grantId,
          lastEventSequence: grant.lastEventSequence,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { lastEventSequence: BigInt(event.event_sequence) },
      });
      if (advanced.count !== 1) {
        throw receiverFailure("grant_reservation_lost", 409);
      }
      await transaction.standingEvent.create({
        data: {
          eventId: event.event_id,
          grantId,
          eventSequence: BigInt(event.event_sequence),
          canonicalBody: envelope.body,
          acceptanceJson: canonicalJson(acceptance),
          receivedAt: now,
        },
      });
      await transaction.standingDelivery.create({
        data: {
          eventId: event.event_id,
          grantId,
          deliveryTargetId: grant.deliveryTargetId,
          status: "pending",
          maximumAttempts: MAXIMUM_ATTEMPTS,
          currentAttempt: 0,
          createdAt: now,
          updatedAt: now,
        },
      });
      return acceptance;
    });
  } catch (error) {
    if (error instanceof StandingReceiverError) throw error;
    if (!isUniqueConstraintError(error)) throw error;
    const existing = await prisma.standingEvent.findUnique({
      where: { eventId: event.event_id },
      select: { grantId: true, canonicalBody: true, acceptanceJson: true },
    });
    if (existing) {
      return replayAcceptance(existing, initialGrant.id, event, envelope.body);
    }
    throw receiverFailure("grant_reservation_lost", 409);
  }
}

async function resolveConnector(
  transaction: Prisma.TransactionClient,
  connectorToken: string,
  now: Date
): Promise<ConnectorIdentity> {
  const token = requireOpaqueToken(connectorToken, "connector_token_invalid");
  const connector = await transaction.connector.findUnique({
    where: { tokenDigest: digestSecret(token) },
    select: {
      id: true,
      accountId: true,
      deliveryTargetId: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  if (!connector || connector.revokedAt !== null || connector.expiresAt <= now) {
    throw receiverFailure("connector_identity_invalid", 403);
  }
  return connector;
}

async function lockConnectorIdentity(
  transaction: Prisma.TransactionClient,
  connectorToken: string,
  connectorId: string
): Promise<{ connector: ConnectorIdentity; now: Date }> {
  // Acquire only after the Grant/Delivery locks. A disconnect that committed
  // while those locks were pending must be visible; a later disconnect waits
  // for this authority-dependent transaction to finish. FOR SHARE also fences
  // non-key column updates, unlike the weaker lock acquired by a foreign key.
  const rows = await transaction.$queryRaw<Array<{ connector_id: string }>>`
    SELECT "connector_id"
    FROM "cr2_connectors"
    WHERE "connector_id" = ${connectorId}
    FOR SHARE
  `;
  if (rows.length !== 1) throw receiverFailure("connector_identity_invalid", 403);
  const now = readNow();
  const connector = await resolveConnector(transaction, connectorToken, now);
  if (connector.id !== connectorId) throw receiverFailure("connector_identity_invalid", 403);
  return { connector, now };
}

async function lockDeliveryTarget(
  transaction: Prisma.TransactionClient,
  deliveryTargetId: string
): Promise<void> {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${deliveryTargetId}, 0))
  `;
}

function assertConnectorScope(
  connector: ConnectorIdentity,
  delivery: StandingDeliveryRecord
): void {
  if (
    delivery.deliveryTargetId !== connector.deliveryTargetId ||
    delivery.grant.connectorId !== connector.id ||
    delivery.grant.accountId !== connector.accountId
  ) {
    throw receiverFailure("connector_delivery_scope_invalid", 403);
  }
}

function grantAuthorityEndReason(
  delivery: StandingDeliveryRecord,
  now: Date
): "grant_revoked" | "grant_expired" | null {
  if (delivery.grant.revokedAt !== null) return "grant_revoked";
  if (delivery.grant.expiresAt <= now) return "grant_expired";
  return null;
}

function requireStoredInstruction(value: string): string {
  if (
    value.length === 0 ||
    value.trim() !== value ||
    CONTROL_CHARACTER_PATTERN.test(value) ||
    Buffer.byteLength(value, "utf8") > 500
  ) {
    throw receiverFailure("delivery_private_state_invalid", 500);
  }
  return value;
}

function buildStandingLease(
  delivery: StandingDeliveryRecord,
  connector: ConnectorIdentity,
  claimToken: string,
  duplicate: boolean,
  now: Date
): Record<string, unknown> {
  const leaseExpiresAt = delivery.leaseExpiresAt;
  if (
    !leaseExpiresAt ||
    leaseExpiresAt <= now ||
    leaseExpiresAt > delivery.grant.expiresAt ||
    leaseExpiresAt > connector.expiresAt
  ) {
    throw receiverFailure("delivery_private_state_invalid", 500);
  }
  let event: StandingContinuationEvent;
  try {
    event = parseStandingContinuationEventBody(delivery.event.canonicalBody);
  } catch {
    throw receiverFailure("delivery_private_state_invalid", 500);
  }
  if (
    delivery.eventId !== delivery.event.eventId ||
    delivery.grantId !== delivery.event.grantId ||
    delivery.grantId !== delivery.grant.id ||
    event.event_id !== delivery.eventId ||
    event.binding_id !== delivery.grant.bindingId ||
    event.event_sequence !== safeSequence(delivery.event.eventSequence, "delivery_private_state_invalid") ||
    event.correlation_id !== delivery.grant.correlationId ||
    event.issuer_origin !== delivery.grant.issuerOrigin ||
    event.workflow_id !== delivery.grant.workflowId ||
    event.event_type !== delivery.grant.eventType ||
    event.canonical_url !== delivery.grant.canonicalUrl ||
    delivery.deliveryTargetId !== delivery.grant.deliveryTargetId ||
    delivery.grant.authorizationMode !== STANDING_AUTHORIZATION_MODE ||
    delivery.grant.maxActiveActivations !== STANDING_MAX_ACTIVE_ACTIVATIONS ||
    delivery.grant.continuationMode !== CONTINUATION_MODE
  ) {
    throw receiverFailure("delivery_private_state_invalid", 500);
  }
  const receipt = createStandingContinuationReceipt({
    type: "webmcp.continuation_receipt",
    protocol_version: STANDING_PROTOCOL_VERSION,
    grant_id: delivery.grant.id,
    correlation_id: delivery.grant.correlationId,
    issuer_origin: delivery.grant.issuerOrigin,
    workflow_id: delivery.grant.workflowId,
    event_type: delivery.grant.eventType,
    canonical_url: delivery.grant.canonicalUrl,
    expires_at: delivery.grant.expiresAt.toISOString(),
    human_boundary: delivery.grant.humanBoundary,
    continuation_mode: CONTINUATION_MODE,
    authorization_mode: STANDING_AUTHORIZATION_MODE,
    max_active_activations: STANDING_MAX_ACTIVE_ACTIVATIONS,
  });
  return {
    duplicate,
    lease: {
      type: "webmcp.delivery_lease",
      protocol_version: STANDING_PROTOCOL_VERSION,
      delivery_id: delivery.deliveryId,
      event_id: delivery.eventId,
      attempt: delivery.currentAttempt,
      lease_token: claimToken,
      lease_expires_at: leaseExpiresAt.toISOString(),
      continuation: {
        correlation_id: event.correlation_id,
        workflow_id: event.workflow_id,
        event_type: event.event_type,
        event_sequence: event.event_sequence,
        state_version: event.state_version,
        occurred_at: event.occurred_at,
        canonical_url: event.canonical_url,
        instruction: requireStoredInstruction(delivery.grant.instruction),
      },
      receipt,
    },
  };
}

type StandingDeliveryCandidate = {
  delivery_id: string;
  grant_id: string;
};

async function findStandingClaimCandidate(
  transaction: Prisma.TransactionClient,
  deliveryTargetId: string,
  now: Date
): Promise<StandingDeliveryCandidate | null> {
  const rows = await transaction.$queryRaw<StandingDeliveryCandidate[]>`
    SELECT d."delivery_id", d."grant_id"
    FROM "cr2_standing_deliveries" d
    WHERE d."delivery_target_id" = ${deliveryTargetId}
      AND d."status" IN ('pending', 'leased')
      AND (d."status" = 'pending' OR d."lease_expires_at" <= ${now})
    ORDER BY d."created_at" ASC, d."delivery_id" ASC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function claimStandingDelivery(
  input: ClaimStandingDeliveryInput
): Promise<Record<string, unknown> | null> {
  const connectorToken = requireOpaqueToken(input.connectorToken, "connector_token_invalid");
  const claimToken = requireClaimToken(input.claimToken);
  const claimTokenDigest = digestSecret(claimToken);
  return prisma.$transaction(async (transaction) => {
    let now = readNow();
    let connector = await resolveConnector(transaction, connectorToken, now);
    const targetIdentity = { id: connector.id, deliveryTargetId: connector.deliveryTargetId };
    await lockDeliveryTarget(transaction, connector.deliveryTargetId);
    now = readNow();
    connector = await resolveConnector(transaction, connectorToken, now);
    if (connector.id !== targetIdentity.id || connector.deliveryTargetId !== targetIdentity.deliveryTargetId) {
      throw receiverFailure("connector_identity_invalid", 403);
    }

    let previousAttempt = await transaction.standingDeliveryAttempt.findUnique({
      where: { claimTokenDigest },
      select: {
        attempt: true,
        connectorId: true,
        deliveryId: true,
      },
    });
    if (previousAttempt) {
      if (!(await lockStandingGrantForDelivery(transaction, previousAttempt.deliveryId))) {
        throw receiverFailure("delivery_disappeared", 500);
      }
      ({ connector, now } = await lockConnectorIdentity(transaction, connectorToken, connector.id));
      previousAttempt = await transaction.standingDeliveryAttempt.findUnique({
        where: { claimTokenDigest },
        select: { attempt: true, connectorId: true, deliveryId: true },
      });
      if (!previousAttempt) throw receiverFailure("delivery_disappeared", 500);
      const delivery = await transaction.standingDelivery.findUnique({
        where: { deliveryId: previousAttempt.deliveryId },
        select: standingDeliverySelect,
      });
      if (!delivery) throw receiverFailure("delivery_disappeared", 500);
      if (previousAttempt.connectorId !== connector.id) {
        throw receiverFailure("delivery_lease_scope_invalid", 403);
      }
      assertConnectorScope(connector, delivery);
      if (
        delivery.currentAttempt !== previousAttempt.attempt ||
        delivery.currentClaimTokenDigest !== claimTokenDigest
      ) {
        throw receiverFailure("claim_token_retired", 409);
      }
      if (grantAuthorityEndReason(delivery, now)) return null;
      if (
        delivery.status === "leased" &&
        delivery.leaseExpiresAt &&
        delivery.leaseExpiresAt > now
      ) {
        return buildStandingLease(delivery, connector, claimToken, true, now);
      }
      throw receiverFailure("claim_token_retired", 409);
    }

    const activeLease = await transaction.standingDelivery.findFirst({
      where: {
        deliveryTargetId: connector.deliveryTargetId,
        status: "leased",
        leaseExpiresAt: { gt: now },
      },
      select: { deliveryId: true },
    });
    if (activeLease) return null;

    const candidate = await findStandingClaimCandidate(
      transaction,
      connector.deliveryTargetId,
      now
    );
    if (!candidate) return null;
    if (!(await lockStandingGrantById(transaction, candidate.grant_id))) {
      throw receiverFailure("delivery_claim_race", 409, true);
    }
    if (!(await lockStandingDeliveryById(transaction, candidate.delivery_id))) {
      throw receiverFailure("delivery_claim_race", 409, true);
    }
    ({ connector, now } = await lockConnectorIdentity(transaction, connectorToken, connector.id));
    const delivery = await transaction.standingDelivery.findUnique({
      where: { deliveryId: candidate.delivery_id },
      select: standingDeliverySelect,
    });
    if (!delivery) throw receiverFailure("delivery_claim_race", 409, true);
    assertConnectorScope(connector, delivery);

    const authorityEndReason = grantAuthorityEndReason(delivery, now);
    if (delivery.status === "pending") {
      if (delivery.currentAttempt !== 0) {
        throw receiverFailure("delivery_state_invalid", 500);
      }
      if (authorityEndReason) {
        const changed = await transaction.standingDelivery.updateMany({
          where: {
            deliveryId: delivery.deliveryId,
            status: "pending",
            currentAttempt: 0,
          },
          data: {
            status: "cancelled",
            terminalReason: authorityEndReason,
            updatedAt: now,
          },
        });
        if (changed.count !== 1) throw receiverFailure("delivery_claim_race", 409, true);
        return null;
      }
    } else if (delivery.status === "leased") {
      if (!delivery.leaseExpiresAt || delivery.leaseExpiresAt > now) {
        throw receiverFailure("delivery_claim_race", 409, true);
      }
      if (authorityEndReason || delivery.currentAttempt >= delivery.maximumAttempts) {
        const changed = await transaction.standingDelivery.updateMany({
          where: {
            deliveryId: delivery.deliveryId,
            status: "leased",
            currentAttempt: delivery.currentAttempt,
            currentConnectorId: delivery.currentConnectorId,
            currentClaimTokenDigest: delivery.currentClaimTokenDigest,
            currentLeaseTokenDigest: delivery.currentLeaseTokenDigest,
            leaseExpiresAt: delivery.leaseExpiresAt,
          },
          data: {
            status: "retry_exhausted",
            terminalReason: authorityEndReason ?? "attempt_limit_reached",
            updatedAt: now,
          },
        });
        if (changed.count !== 1) throw receiverFailure("delivery_claim_race", 409, true);
        return null;
      }
    } else {
      throw receiverFailure("delivery_state_invalid", 500);
    }

    const leaseExpiresAtMs = Math.min(
      now.getTime() + LEASE_DURATION_MS,
      delivery.grant.expiresAt.getTime(),
      connector.expiresAt.getTime()
    );
    if (leaseExpiresAtMs <= now.getTime()) {
      throw receiverFailure("connector_identity_expired", 403);
    }
    const leaseExpiresAt = new Date(leaseExpiresAtMs);
    const attempt = delivery.currentAttempt + 1;
    const changed = await transaction.standingDelivery.updateMany({
      where: {
        deliveryId: delivery.deliveryId,
        status: delivery.status,
        currentAttempt: delivery.currentAttempt,
        currentConnectorId: delivery.currentConnectorId,
        currentClaimTokenDigest: delivery.currentClaimTokenDigest,
        currentLeaseTokenDigest: delivery.currentLeaseTokenDigest,
        leaseExpiresAt: delivery.leaseExpiresAt,
      },
      data: {
        status: "leased",
        currentAttempt: attempt,
        currentConnectorId: connector.id,
        currentClaimTokenDigest: claimTokenDigest,
        currentLeaseTokenDigest: claimTokenDigest,
        leaseStartedAt: now,
        leaseExpiresAt,
        terminalReason: null,
        updatedAt: now,
      },
    });
    if (changed.count !== 1) throw receiverFailure("delivery_claim_race", 409, true);
    try {
      await transaction.standingDeliveryAttempt.create({
        data: {
          deliveryId: delivery.deliveryId,
          connectorId: connector.id,
          attempt,
          claimTokenDigest,
          leaseTokenDigest: claimTokenDigest,
          leaseStartedAt: now,
          leaseExpiresAt,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw receiverFailure("claim_token_retired", 409);
      }
      throw error;
    }
    return buildStandingLease(
      {
        ...delivery,
        status: "leased",
        currentAttempt: attempt,
        currentConnectorId: connector.id,
        currentClaimTokenDigest: claimTokenDigest,
        currentLeaseTokenDigest: claimTokenDigest,
        leaseStartedAt: now,
        leaseExpiresAt,
        terminalReason: null,
        updatedAt: now,
      },
      connector,
      claimToken,
      false,
      now
    );
  });
}

async function lockStandingGrantForDelivery(
  transaction: Prisma.TransactionClient,
  deliveryId: string
): Promise<boolean> {
  const rows = await transaction.$queryRaw<Array<{ grant_id: string }>>`
    SELECT g."grant_id"
    FROM "cr2_standing_grants" g
    INNER JOIN "cr2_standing_deliveries" d ON d."grant_id" = g."grant_id"
    WHERE d."delivery_id" = ${deliveryId}
    FOR UPDATE OF g
  `;
  return rows.length === 1;
}

function assertCurrentLease(
  connector: ConnectorIdentity,
  delivery: StandingDeliveryRecord,
  leaseTokenDigest: string
): void {
  assertConnectorScope(connector, delivery);
  if (!["leased", "acknowledged", "retry_exhausted"].includes(delivery.status)) {
    throw receiverFailure("delivery_not_leased", 409);
  }
  if (
    delivery.currentConnectorId !== connector.id ||
    delivery.currentLeaseTokenDigest !== leaseTokenDigest
  ) {
    throw receiverFailure("delivery_lease_invalid", 403);
  }
}

function mapNotificationHandoffValidation(error: unknown): never {
  if (error instanceof StandingNotificationHandoffValidationError) {
    throw receiverFailure(error.code, 403);
  }
  throw error;
}

function assertNotificationHandoffLease(
  connector: ConnectorIdentity,
  delivery: StandingDeliveryRecord,
  leaseTokenDigest: string,
  now: Date,
): void {
  assertConnectorScope(connector, delivery);
  if (delivery.status !== "leased") {
    throw receiverFailure("delivery_not_handoffable", 409);
  }
  if (
    delivery.currentConnectorId !== connector.id ||
    delivery.currentLeaseTokenDigest !== leaseTokenDigest
  ) {
    throw receiverFailure("delivery_lease_invalid", 403);
  }
  if (!delivery.leaseStartedAt || !delivery.leaseExpiresAt || delivery.leaseExpiresAt <= now) {
    throw receiverFailure("delivery_lease_expired", 409);
  }
  const authorityEndReason = grantAuthorityEndReason(delivery, now);
  if (authorityEndReason) throw receiverFailure(authorityEndReason, 410);
}

function assertNotificationHandoffWindow(
  attestation: StandingRuntimeAdmissionAttestation,
  delivery: StandingDeliveryRecord,
  now: Date,
): void {
  if (!delivery.leaseStartedAt || !delivery.leaseExpiresAt) {
    throw receiverFailure("delivery_private_state_invalid", 500);
  }
  const acceptedAt = Date.parse(attestation.accepted_at);
  if (
    acceptedAt < delivery.leaseStartedAt.getTime() ||
    acceptedAt >= delivery.leaseExpiresAt.getTime() ||
    acceptedAt >= delivery.grant.expiresAt.getTime() ||
    acceptedAt > now.getTime() + AUTHORITY_FUTURE_SKEW_MS ||
    (delivery.grant.revokedAt !== null && acceptedAt >= delivery.grant.revokedAt.getTime())
  ) {
    throw receiverFailure("runtime_admission_time_invalid", 403);
  }
}

function notificationHandoffReceipt(
  delivery: StandingDeliveryRecord,
  attestation: StandingRuntimeAdmissionAttestation,
  duplicate: boolean,
): StandingNotificationHandoffReceipt {
  try {
    return normalizeNotificationHandoffReceipt({
      type: "webmcp.notification_handoff_receipt",
      protocol_version: STANDING_PROTOCOL_VERSION,
      delivery_id: delivery.deliveryId,
      event_id: delivery.eventId,
      handoff_id: attestation.handoff_id,
      correlation_id: delivery.grant.correlationId,
      workflow_id: delivery.grant.workflowId,
      status: "handed_off",
      duplicate,
      runtime_admission_ref: attestation.admission_id,
    });
  } catch (error) {
    mapNotificationHandoffValidation(error);
  }
}

function parseStoredNotificationHandoff(
  delivery: StandingDeliveryRecord,
  duplicate: boolean,
): StandingNotificationHandoffReceipt {
  if (
    delivery.status !== "handed_off" ||
    !delivery.handoffReceiptJson ||
    !delivery.runtimeAdmissionJson ||
    !delivery.handoffId
  ) {
    throw receiverFailure("delivery_private_state_invalid", 500);
  }
  try {
    const receiptValue = JSON.parse(delivery.handoffReceiptJson) as unknown;
    const receipt = normalizeNotificationHandoffReceipt(receiptValue, {
      deliveryId: delivery.deliveryId,
      eventId: delivery.eventId,
      handoffId: delivery.handoffId,
    });
    if (canonicalJson(receipt) !== delivery.handoffReceiptJson) {
      throw new Error("noncanonical receipt");
    }
    const storedAttestation = normalizeRuntimeAdmissionAttestation(
      JSON.parse(delivery.runtimeAdmissionJson),
      {
        deliveryId: delivery.deliveryId,
        eventId: delivery.eventId,
        handoffId: delivery.handoffId,
      },
    );
    if (
      canonicalJson(storedAttestation) !== delivery.runtimeAdmissionJson ||
      receipt.runtime_admission_ref !== storedAttestation.admission_id
    ) {
      throw new Error("runtime admission receipt reference mismatch");
    }
    return Object.freeze({ ...receipt, duplicate });
  } catch (error) {
    if (error instanceof StandingReceiverError) throw error;
    throw receiverFailure("delivery_private_state_invalid", 500);
  }
}

export async function handoffStandingDelivery(
  input: HandoffStandingDeliveryInput,
): Promise<StandingNotificationHandoffReceipt> {
  const connectorToken = requireOpaqueToken(input.connectorToken, "connector_token_invalid");
  const deliveryId = requireIdentifier(input.deliveryId, "deliveryId");
  const leaseToken = requireClaimToken(input.leaseToken, "Delivery lease token");
  const handoffId = requireIdentifier(input.handoffId, "handoffId");
  const leaseTokenDigest = digestSecret(leaseToken);
  let suppliedAttestation: StandingRuntimeAdmissionAttestation;
  try {
    suppliedAttestation = normalizeRuntimeAdmissionAttestation(input.runtimeAdmissionAttestation, {
      deliveryId,
      handoffId,
      now: readNow(),
    });
  } catch (error) {
    mapNotificationHandoffValidation(error);
  }

  const initial = await prisma.$transaction(async (transaction) => {
    const connector = await resolveConnector(transaction, connectorToken, readNow());
    const existingByHandoff = await transaction.standingDelivery.findUnique({
      where: { handoffId },
      select: standingDeliverySelect,
    });
    if (existingByHandoff && existingByHandoff.deliveryId !== deliveryId) {
      throw receiverFailure("notification_handoff_identity_conflict", 409);
    }
    const delivery = existingByHandoff ?? await transaction.standingDelivery.findUnique({
      where: { deliveryId },
      select: standingDeliverySelect,
    });
    if (!delivery) throw receiverFailure("delivery_not_found", 404);
    assertConnectorScope(connector, delivery);
    if (delivery.handoffId !== null) {
      if (delivery.handoffId !== handoffId) {
        throw receiverFailure("notification_handoff_identity_conflict", 409);
      }
      let storedAttestation: StandingRuntimeAdmissionAttestation;
      try {
        if (!delivery.runtimeAdmissionJson) throw new Error("missing admission");
        storedAttestation = normalizeRuntimeAdmissionAttestation(
          JSON.parse(delivery.runtimeAdmissionJson),
          { deliveryId, eventId: delivery.eventId, handoffId, now: readNow() },
        );
      } catch (error) {
        if (error instanceof StandingReceiverError) throw error;
        throw receiverFailure("delivery_private_state_invalid", 500);
      }
      if (canonicalJson(storedAttestation) !== canonicalJson(suppliedAttestation)) {
        throw receiverFailure("notification_handoff_identity_conflict", 409);
      }
      return { connector, delivery, replay: true as const };
    }
    const now = readNow();
    assertNotificationHandoffLease(connector, delivery, leaseTokenDigest, now);
    const eventId = delivery.eventId;
    try {
      suppliedAttestation = normalizeRuntimeAdmissionAttestation(
        suppliedAttestation,
        { deliveryId, eventId, handoffId, now },
      );
    } catch (error) {
      mapNotificationHandoffValidation(error);
    }
    return { connector, delivery, replay: false as const };
  });

  if (initial.replay) {
    return parseStoredNotificationHandoff(initial.delivery, true);
  }
  if (!input.runtimeAdmissionAuthority) {
    throw receiverFailure("runtime_admission_authority_unavailable", 501);
  }
  const expected: StandingRuntimeAdmissionExpected = {
    delivery_id: initial.delivery.deliveryId,
    event_id: initial.delivery.eventId,
    grant_id: initial.delivery.grantId,
    connector_id: initial.delivery.grant.connectorId,
    delivery_target_id: initial.delivery.deliveryTargetId,
    correlation_id: initial.delivery.grant.correlationId,
    workflow_id: initial.delivery.grant.workflowId,
  };
  let verifiedAttestation: StandingRuntimeAdmissionAttestation;
  try {
    verifiedAttestation = normalizeRuntimeAdmissionAttestation(
      await input.runtimeAdmissionAuthority.verifyAdmission({
        attestation: suppliedAttestation,
        expected,
      }),
      { deliveryId, eventId: expected.event_id, handoffId, now: readNow() },
    );
  } catch (error) {
    if (error instanceof StandingNotificationHandoffValidationError) {
      mapNotificationHandoffValidation(error);
    }
    throw receiverFailure("runtime_admission_invalid", 403);
  }
  if (canonicalJson(verifiedAttestation) !== canonicalJson(suppliedAttestation)) {
    throw receiverFailure("runtime_admission_invalid", 403);
  }
  assertNotificationHandoffWindow(verifiedAttestation, initial.delivery, readNow());
  const runtimeAdmissionJson = canonicalJson(verifiedAttestation);

  try {
    return await prisma.$transaction(async (transaction) => {
      if (!(await lockStandingGrantById(transaction, initial.delivery.grantId))) {
        throw receiverFailure("delivery_disappeared", 500);
      }
      if (!(await lockStandingDeliveryById(transaction, deliveryId))) {
        throw receiverFailure("delivery_disappeared", 500);
      }
      const { connector, now } = await lockConnectorIdentity(
        transaction,
        connectorToken,
        initial.delivery.grant.connectorId,
      );
      const current = await transaction.standingDelivery.findUnique({
        where: { deliveryId },
        select: standingDeliverySelect,
      });
      if (!current) throw receiverFailure("delivery_disappeared", 500);
      if (current.handoffId !== null) {
        if (
          current.handoffId !== handoffId ||
          current.runtimeAdmissionJson !== runtimeAdmissionJson
        ) {
          throw receiverFailure("notification_handoff_identity_conflict", 409);
        }
        return parseStoredNotificationHandoff(current, true);
      }
      assertNotificationHandoffLease(connector, current, leaseTokenDigest, now);
      assertNotificationHandoffWindow(verifiedAttestation, current, now);
      const receipt = notificationHandoffReceipt(current, verifiedAttestation, false);
      const receiptJson = canonicalJson(receipt);
      const changed = await transaction.standingDelivery.updateMany({
        where: {
          deliveryId,
          status: "leased",
          currentAttempt: current.currentAttempt,
          currentConnectorId: current.currentConnectorId,
          currentClaimTokenDigest: current.currentClaimTokenDigest,
          currentLeaseTokenDigest: current.currentLeaseTokenDigest,
          leaseExpiresAt: current.leaseExpiresAt,
          handoffId: null,
        },
        data: {
          status: "handed_off",
          handoffId,
          runtimeAdmissionJson,
          handoffReceiptJson: receiptJson,
          handoffAcceptedAt: now,
          terminalReason: null,
          updatedAt: now,
        },
      });
      if (changed.count !== 1) {
        throw receiverFailure("notification_handoff_race", 409, true);
      }
      return receipt;
    });
  } catch (error) {
    if (error instanceof StandingReceiverError) throw error;
    if (isUniqueConstraintError(error)) {
      throw receiverFailure("notification_handoff_identity_conflict", 409);
    }
    throw error;
  }
}

const EFFECT_FIELDS = [
  "type",
  "protocol_version",
  "effect_id",
  "delivery_id",
  "event_id",
  "correlation_id",
  "workflow_id",
  "outcome",
  "confirmed_at",
] as const;

function normalizeStandingEffect(
  value: unknown,
  now: Date
): StandingEffectAttestation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw receiverFailure("host_effect_invalid", 403);
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const expectedKeys = [...EFFECT_FIELDS].sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw receiverFailure("host_effect_invalid", 403);
  }
  if (
    record.type !== "webmcp.host_effect_attestation" ||
    record.protocol_version !== STANDING_PROTOCOL_VERSION ||
    record.outcome !== "committed"
  ) {
    throw receiverFailure("host_effect_version_invalid", 403);
  }
  const effect: StandingEffectAttestation = {
    type: "webmcp.host_effect_attestation",
    protocol_version: STANDING_PROTOCOL_VERSION,
    effect_id: requireEffectIdentifier(record.effect_id),
    delivery_id: requireEffectIdentifier(record.delivery_id),
    event_id: requireEffectIdentifier(record.event_id),
    correlation_id: requireEffectIdentifier(record.correlation_id),
    workflow_id: requireEffectIdentifier(record.workflow_id),
    outcome: "committed",
    confirmed_at: requireEffectTimestamp(record.confirmed_at),
  };
  if (Date.parse(effect.confirmed_at) > now.getTime() + AUTHORITY_FUTURE_SKEW_MS) {
    throw receiverFailure("host_effect_time_invalid", 403);
  }
  return effect;
}

function requireEffectIdentifier(value: unknown): string {
  if (
    typeof value !== "string" ||
    Buffer.byteLength(value, "utf8") > 160 ||
    !IDENTIFIER_PATTERN.test(value)
  ) {
    throw receiverFailure("host_effect_invalid", 403);
  }
  return value;
}

function requireEffectTimestamp(value: unknown): string {
  if (typeof value !== "string" || value.length > 27) {
    throw receiverFailure("host_effect_invalid", 403);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw receiverFailure("host_effect_invalid", 403);
  }
  return value;
}

function assertEffectMatches(
  effect: StandingEffectAttestation,
  delivery: StandingDeliveryRecord
): void {
  if (
    effect.delivery_id !== delivery.deliveryId ||
    effect.event_id !== delivery.eventId ||
    effect.correlation_id !== delivery.grant.correlationId ||
    effect.workflow_id !== delivery.grant.workflowId
  ) {
    throw receiverFailure("host_effect_scope_invalid", 403);
  }
}

function assertEffectWindow(
  effect: StandingEffectAttestation,
  delivery: StandingDeliveryRecord,
  now: Date
): void {
  if (!delivery.leaseStartedAt || !delivery.leaseExpiresAt) {
    throw receiverFailure("delivery_private_state_invalid", 500);
  }
  const confirmedAt = Date.parse(effect.confirmed_at);
  if (
    confirmedAt < delivery.leaseStartedAt.getTime() ||
    confirmedAt >= delivery.leaseExpiresAt.getTime() ||
    confirmedAt >= delivery.grant.expiresAt.getTime() ||
    confirmedAt > now.getTime() + AUTHORITY_FUTURE_SKEW_MS ||
    (delivery.grant.revokedAt !== null &&
      confirmedAt >= delivery.grant.revokedAt.getTime())
  ) {
    throw receiverFailure("host_effect_time_invalid", 403);
  }
}

function acknowledgementResponse(
  delivery: StandingDeliveryRecord,
  effectId: string,
  duplicate: boolean
): Record<string, unknown> {
  return {
    type: "webmcp.delivery_acknowledgement",
    protocol_version: STANDING_PROTOCOL_VERSION,
    delivery_id: delivery.deliveryId,
    event_id: delivery.eventId,
    effect_id: effectId,
    acknowledged: true,
    duplicate,
    status: "acknowledged",
  };
}

export async function acknowledgeStandingDelivery(
  input: AcknowledgeStandingDeliveryInput
): Promise<Record<string, unknown>> {
  const connectorToken = requireOpaqueToken(input.connectorToken, "connector_token_invalid");
  const deliveryId = requireIdentifier(input.deliveryId, "deliveryId");
  const leaseToken = requireClaimToken(input.leaseToken, "Delivery lease token");
  const effectToken = requireOpaqueToken(input.effectToken, "host_effect_token_invalid");
  if (!input.effectAuthority) {
    throw receiverFailure("host_effect_authority_unavailable", 501);
  }
  const leaseTokenDigest = digestSecret(leaseToken);

  const initial = await prisma.$transaction(async (transaction) => {
    const connector = await resolveConnector(transaction, connectorToken, readNow());
    const delivery = await transaction.standingDelivery.findUnique({
      where: { deliveryId },
      select: standingDeliverySelect,
    });
    if (!delivery) throw receiverFailure("delivery_not_found", 404);
    assertCurrentLease(connector, delivery, leaseTokenDigest);
    return delivery;
  });
  const expected: StandingEffectExpected = {
    delivery_id: initial.deliveryId,
    event_id: initial.eventId,
    correlation_id: initial.grant.correlationId,
    workflow_id: initial.grant.workflowId,
    canonical_url: initial.grant.canonicalUrl,
    human_boundary: initial.grant.humanBoundary,
    outcome: "committed",
  };
  let effect: StandingEffectAttestation;
  try {
    effect = normalizeStandingEffect(
      await input.effectAuthority.verifyEffect({ effectToken, expected }),
      readNow()
    );
  } catch (error) {
    if (
      error instanceof StandingReceiverError &&
      ["host_effect_time_invalid", "host_effect_version_invalid"].includes(error.code)
    ) {
      throw error;
    }
    throw receiverFailure("host_effect_invalid", 403);
  }
  assertEffectMatches(effect, initial);
  assertEffectWindow(effect, initial, readNow());
  const effectJson = canonicalJson(effect);

  try {
    return await prisma.$transaction(async (transaction) => {
      if (!(await lockStandingGrantById(transaction, initial.grantId))) {
        throw receiverFailure("delivery_disappeared", 500);
      }
      if (!(await lockStandingDeliveryById(transaction, deliveryId))) {
        throw receiverFailure("delivery_disappeared", 500);
      }
      const { connector, now } = await lockConnectorIdentity(
        transaction,
        connectorToken,
        initial.grant.connectorId
      );
      const current = await transaction.standingDelivery.findUnique({
        where: { deliveryId },
        select: standingDeliverySelect,
      });
      if (!current) throw receiverFailure("delivery_disappeared", 500);
      assertCurrentLease(connector, current, leaseTokenDigest);
      assertEffectMatches(effect, current);
      assertEffectWindow(effect, current, now);

      const effectOwner = await transaction.standingDelivery.findUnique({
        where: { effectId: effect.effect_id },
        select: { deliveryId: true },
      });
      if (effectOwner && effectOwner.deliveryId !== deliveryId) {
        throw receiverFailure("effect_identity_conflict", 409);
      }
      if (current.status === "acknowledged") {
        if (
          current.effectId !== effect.effect_id ||
          current.effectAttestationJson !== effectJson
        ) {
          throw receiverFailure("delivery_effect_conflict", 409);
        }
        return acknowledgementResponse(current, effect.effect_id, true);
      }
      if (!["leased", "retry_exhausted"].includes(current.status)) {
        throw receiverFailure("delivery_not_acknowledgeable", 409);
      }
      const changed = await transaction.standingDelivery.updateMany({
        where: {
          deliveryId,
          status: current.status,
          currentAttempt: current.currentAttempt,
          currentConnectorId: current.currentConnectorId,
          currentClaimTokenDigest: current.currentClaimTokenDigest,
          currentLeaseTokenDigest: current.currentLeaseTokenDigest,
          leaseExpiresAt: current.leaseExpiresAt,
        },
        data: {
          status: "acknowledged",
          effectId: effect.effect_id,
          effectAttestationJson: effectJson,
          acknowledgedAt: now,
          terminalReason: null,
          updatedAt: now,
        },
      });
      if (changed.count !== 1) {
        throw receiverFailure("delivery_acknowledgement_race", 409, true);
      }
      return acknowledgementResponse(current, effect.effect_id, false);
    });
  } catch (error) {
    if (error instanceof StandingReceiverError) throw error;
    if (isUniqueConstraintError(error)) {
      throw receiverFailure("effect_identity_conflict", 409);
    }
    throw error;
  }
}

export async function inspectStandingGrant(
  input: StandingGrantControlInput
): Promise<Record<string, unknown>> {
  const bindingId = requireIdentifier(input.bindingId, "bindingId");
  const accountId = requireIdentifier(input.accountId, "accountId");
  const now = readNow();
  const grant = await prisma.standingGrant.findUnique({
    where: { bindingId },
  });
  if (!grant) throw receiverFailure("grant_not_found", 404);
  if (grant.accountId !== accountId) {
    throw receiverFailure("grant_control_subject_invalid", 403);
  }
  const openDelivery = await prisma.standingDelivery.findFirst({
    where: {
      grantId: grant.id,
      status: { in: ["pending", "leased"] },
    },
    select: { deliveryId: true },
  });
  return {
    type: "webmcp.receiver_grant_summary",
    protocol_version: STANDING_PROTOCOL_VERSION,
    binding_id: grant.bindingId,
    correlation_id: grant.correlationId,
    workflow_id: grant.workflowId,
    event_type: grant.eventType,
    authorization_mode: STANDING_AUTHORIZATION_MODE,
    max_active_activations: STANDING_MAX_ACTIVE_ACTIVATIONS,
    last_event_sequence: safeSequence(grant.lastEventSequence),
    active_activations: openDelivery ? 1 : 0,
    expires_at: grant.expiresAt.toISOString(),
    status: standingGrantStatus(grant, now),
    revoked_at: grant.revokedAt?.toISOString() ?? null,
  };
}

export async function revokeStandingGrant(
  input: StandingGrantControlInput
): Promise<Record<string, unknown>> {
  const bindingId = requireIdentifier(input.bindingId, "bindingId");
  const accountId = requireIdentifier(input.accountId, "accountId");
  return prisma.$transaction(async (transaction) => {
    const grantId = await lockStandingGrantByBinding(transaction, bindingId);
    if (!grantId) throw receiverFailure("grant_not_found", 404);
    const grant = await transaction.standingGrant.findUnique({ where: { id: grantId } });
    if (!grant) throw receiverFailure("grant_not_found", 404);
    if (grant.accountId !== accountId) {
      throw receiverFailure("grant_control_subject_invalid", 403);
    }
    if (grant.revokedAt !== null) {
      return {
        type: "webmcp.receiver_grant_revocation",
        protocol_version: STANDING_PROTOCOL_VERSION,
        binding_id: grant.bindingId,
        status: "revoked",
        revoked_at: grant.revokedAt.toISOString(),
        duplicate: true,
      };
    }
    // Stamp the serialized decision, not the start of a request that may have
    // waited for a connection or a Grant lock while a Host effect completed.
    const now = readNow();
    const changed = await transaction.standingGrant.updateMany({
      where: { id: grant.id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (changed.count !== 1) throw receiverFailure("grant_revocation_race", 409, true);
    return {
      type: "webmcp.receiver_grant_revocation",
      protocol_version: STANDING_PROTOCOL_VERSION,
      binding_id: grant.bindingId,
      status: "revoked",
      revoked_at: now.toISOString(),
      duplicate: false,
    };
  });
}
