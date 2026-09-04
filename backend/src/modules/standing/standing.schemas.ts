import { z } from "zod";

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

const origin = z.string().trim().min(1).max(2_048);
const consentToken = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const canonicalTimestamp = z
  .string()
  .max(27)
  .refine((value) => Number.isFinite(Date.parse(value)))
  .refine((value) => new Date(value).toISOString() === value);

export const standingHostKeySchema = z
  .object({
    host_id: identifier,
    issuer_origin: origin,
    key_id: identifier,
    public_key_pem: z.string().min(1).max(16_384),
  })
  .strict();

export const standingConsentSessionSchema = z
  .object({
    host_subject_ref: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
    expected_origin: origin,
    manifest: z.unknown(),
    maximum_grant_lifetime_ms: z.number().int().min(1_000).max(365 * 24 * 60 * 60 * 1_000),
  })
  .strict();

export const standingAccountConsentDecisionSchema = z
  .object({
    consent_token: consentToken,
    action: z.enum(["approve", "decline"]),
    connector_id: identifier.optional(),
    decision_id: identifier,
    decided_at: canonicalTimestamp,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === "approve" && value.connector_id === undefined) {
      context.addIssue({ code: "custom", path: ["connector_id"], message: "required" });
    }
    if (value.action === "decline" && value.connector_id !== undefined) {
      context.addIssue({ code: "custom", path: ["connector_id"], message: "forbidden" });
    }
  });

export const standingEmptyBodySchema = z.object({}).strict();

export type StandingHostKeyBody = z.infer<typeof standingHostKeySchema>;
export type StandingConsentSessionBody = z.infer<typeof standingConsentSessionSchema>;
export type StandingAccountConsentDecisionBody = z.infer<typeof standingAccountConsentDecisionSchema>;

export const standingDeliveryClaimFields = [
  "connector_token",
  "claim_token",
] as const;

export const standingDeliveryAcknowledgementFields = [
  "connector_token",
  "delivery_id",
  "lease_token",
  "effect_token",
] as const;

export const standingNotificationHandoffFields = [
  "connector_token",
  "delivery_id",
  "lease_token",
  "handoff_id",
  "runtime_admission_attestation",
] as const;

// These are controller boundary views only. Runtime value validation remains
// in the standing protocol/Receiver service so its typed status and code are
// not collapsed into an HTTP-body error.
export type StandingEventEnvelopeBody = {
  body: string;
  headers: {
    "WebMCP-Reentry-Key-Id": string;
    "WebMCP-Reentry-Timestamp": string;
    "WebMCP-Reentry-Signature": string;
  };
};

export type StandingDeliveryClaimBody = {
  connector_token: string;
  claim_token: string;
};

export type StandingDeliveryAcknowledgementBody = {
  connector_token: string;
  delivery_id: string;
  lease_token: string;
  effect_token: string;
};

export type StandingNotificationHandoffBody = {
  connector_token: string;
  delivery_id: string;
  lease_token: string;
  handoff_id: string;
  runtime_admission_attestation: unknown;
};
