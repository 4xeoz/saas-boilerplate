import { canonicalJson } from "./standing.protocol";

export const NOTIFICATION_HANDOFF_PROTOCOL_VERSION = "0.2" as const;
export const RUNTIME_ADMISSION_ATTESTATION_TYPE =
  "webmcp.runtime_admission_attestation" as const;
export const NOTIFICATION_HANDOFF_RECEIPT_TYPE =
  "webmcp.notification_handoff_receipt" as const;

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const MAX_TIMESTAMP_CHARACTERS = 27;
const MAX_SERIALIZED_ATTESTATION_BYTES = 8 * 1_024;
const MAX_SERIALIZED_RECEIPT_BYTES = 8 * 1_024;
const FUTURE_CLOCK_SKEW_MS = 60 * 1_000;

const RUNTIME_ADMISSION_FIELDS = [
  "type",
  "protocol_version",
  "admission_id",
  "adapter_id",
  "binding_generation",
  "delivery_id",
  "event_id",
  "handoff_id",
  "accepted_at",
] as const;

const NOTIFICATION_HANDOFF_RECEIPT_FIELDS = [
  "type",
  "protocol_version",
  "delivery_id",
  "event_id",
  "handoff_id",
  "correlation_id",
  "workflow_id",
  "status",
  "duplicate",
  "runtime_admission_ref",
] as const;

export type StandingRuntimeAdmissionAttestation = {
  type: typeof RUNTIME_ADMISSION_ATTESTATION_TYPE;
  protocol_version: typeof NOTIFICATION_HANDOFF_PROTOCOL_VERSION;
  admission_id: string;
  adapter_id: string;
  binding_generation: string;
  delivery_id: string;
  event_id: string;
  handoff_id: string;
  accepted_at: string;
};

export type StandingNotificationHandoffReceipt = {
  type: typeof NOTIFICATION_HANDOFF_RECEIPT_TYPE;
  protocol_version: typeof NOTIFICATION_HANDOFF_PROTOCOL_VERSION;
  delivery_id: string;
  event_id: string;
  handoff_id: string;
  correlation_id: string;
  workflow_id: string;
  status: "handed_off";
  duplicate: boolean;
  runtime_admission_ref: string;
};

export type StandingNotificationHandoffValidationCode =
  | "runtime_admission_input_invalid"
  | "runtime_admission_input_fields_invalid"
  | "runtime_admission_version_invalid"
  | "runtime_admission_scope_invalid"
  | "runtime_admission_time_invalid"
  | "notification_handoff_receipt_invalid"
  | "notification_handoff_receipt_scope_invalid";

export class StandingNotificationHandoffValidationError extends Error {
  constructor(
    public readonly code: StandingNotificationHandoffValidationCode,
    message: string = code,
  ) {
    super(message);
    this.name = "StandingNotificationHandoffValidationError";
  }
}

export function normalizeRuntimeAdmissionAttestation(
  value: unknown,
  expected: {
    deliveryId?: string;
    eventId?: string;
    handoffId?: string;
    now?: Date;
  } = {},
): StandingRuntimeAdmissionAttestation {
  requireExactRecord(value, RUNTIME_ADMISSION_FIELDS, "Runtime admission attestation");
  const record = value as Record<string, unknown>;
  if (
    record.type !== RUNTIME_ADMISSION_ATTESTATION_TYPE ||
    record.protocol_version !== NOTIFICATION_HANDOFF_PROTOCOL_VERSION
  ) {
    throw handoffValidation(
      "runtime_admission_version_invalid",
      "Runtime admission attestation version is unsupported",
    );
  }
  const normalized: StandingRuntimeAdmissionAttestation = {
    type: RUNTIME_ADMISSION_ATTESTATION_TYPE,
    protocol_version: NOTIFICATION_HANDOFF_PROTOCOL_VERSION,
    admission_id: requireIdentifier(record.admission_id, "admission_id"),
    adapter_id: requireIdentifier(record.adapter_id, "adapter_id"),
    binding_generation: requireDigest(record.binding_generation, "binding_generation"),
    delivery_id: requireIdentifier(record.delivery_id, "delivery_id"),
    event_id: requireIdentifier(record.event_id, "event_id"),
    handoff_id: requireIdentifier(record.handoff_id, "handoff_id"),
    accepted_at: requireTimestamp(record.accepted_at, "accepted_at"),
  };
  if (expected.deliveryId !== undefined && normalized.delivery_id !== expected.deliveryId) {
    throw handoffValidation("runtime_admission_scope_invalid", "Runtime admission delivery is out of scope");
  }
  if (expected.eventId !== undefined && normalized.event_id !== expected.eventId) {
    throw handoffValidation("runtime_admission_scope_invalid", "Runtime admission Event is out of scope");
  }
  if (expected.handoffId !== undefined && normalized.handoff_id !== expected.handoffId) {
    throw handoffValidation("runtime_admission_scope_invalid", "Runtime admission handoff is out of scope");
  }
  if (expected.now !== undefined) {
    if (!(expected.now instanceof Date) || !Number.isFinite(expected.now.getTime())) {
      throw new TypeError("Runtime admission validation clock must be valid");
    }
    if (Date.parse(normalized.accepted_at) > expected.now.getTime() + FUTURE_CLOCK_SKEW_MS) {
      throw handoffValidation("runtime_admission_time_invalid", "Runtime admission attestation is in the future");
    }
  }
  if (Buffer.byteLength(canonicalJson(normalized), "utf8") > MAX_SERIALIZED_ATTESTATION_BYTES) {
    throw handoffValidation("runtime_admission_input_invalid", "Runtime admission attestation is too large");
  }
  return Object.freeze(normalized);
}

export function createNotificationHandoffReceipt(
  value: unknown,
): StandingNotificationHandoffReceipt {
  requireExactRecord(value, NOTIFICATION_HANDOFF_RECEIPT_FIELDS, "Notification handoff receipt");
  const record = value as Record<string, unknown>;
  if (
    record.type !== NOTIFICATION_HANDOFF_RECEIPT_TYPE ||
    record.protocol_version !== NOTIFICATION_HANDOFF_PROTOCOL_VERSION ||
    record.status !== "handed_off" ||
    typeof record.duplicate !== "boolean"
  ) {
    throw handoffValidation("notification_handoff_receipt_invalid", "Notification handoff receipt is invalid");
  }
  const normalized: StandingNotificationHandoffReceipt = {
    type: NOTIFICATION_HANDOFF_RECEIPT_TYPE,
    protocol_version: NOTIFICATION_HANDOFF_PROTOCOL_VERSION,
    delivery_id: requireIdentifier(record.delivery_id, "delivery_id"),
    event_id: requireIdentifier(record.event_id, "event_id"),
    handoff_id: requireIdentifier(record.handoff_id, "handoff_id"),
    correlation_id: requireIdentifier(record.correlation_id, "correlation_id"),
    workflow_id: requireIdentifier(record.workflow_id, "workflow_id"),
    status: "handed_off",
    duplicate: record.duplicate,
    runtime_admission_ref: requireIdentifier(record.runtime_admission_ref, "runtime_admission_ref"),
  };
  if (Buffer.byteLength(canonicalJson(normalized), "utf8") > MAX_SERIALIZED_RECEIPT_BYTES) {
    throw handoffValidation("notification_handoff_receipt_invalid", "Notification handoff receipt is too large");
  }
  return Object.freeze(normalized);
}

export function validateNotificationHandoffReceipt(
  value: unknown,
  expected: { deliveryId?: string; eventId?: string; handoffId?: string } = {},
): StandingNotificationHandoffReceipt {
  const receipt = createNotificationHandoffReceipt(value as StandingNotificationHandoffReceipt);
  if (expected.deliveryId !== undefined && receipt.delivery_id !== expected.deliveryId) {
    throw handoffValidation("notification_handoff_receipt_scope_invalid", "Notification receipt delivery is out of scope");
  }
  if (expected.eventId !== undefined && receipt.event_id !== expected.eventId) {
    throw handoffValidation("notification_handoff_receipt_scope_invalid", "Notification receipt Event is out of scope");
  }
  if (expected.handoffId !== undefined && receipt.handoff_id !== expected.handoffId) {
    throw handoffValidation("notification_handoff_receipt_scope_invalid", "Notification receipt handoff is out of scope");
  }
  return receipt;
}

export const normalizeNotificationHandoffReceipt = validateNotificationHandoffReceipt;

function requireExactRecord(
  value: unknown,
  fields: readonly string[],
  label: string,
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw handoffValidation("runtime_admission_input_invalid", `${label} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw handoffValidation("runtime_admission_input_invalid", `${label} must be a plain object`);
  }
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key === "symbol" || !descriptor?.enumerable || !("value" in descriptor)) {
      throw handoffValidation("runtime_admission_input_invalid", `${label} contains an invalid property`);
    }
  }
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) {
    throw handoffValidation("runtime_admission_input_fields_invalid", `${label} fields are invalid`);
  }
}

function requireIdentifier(value: unknown, label: string): string {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 160 || !IDENTIFIER_PATTERN.test(value)) {
    throw handoffValidation("runtime_admission_input_invalid", `${label} is invalid`);
  }
  return value;
}

function requireDigest(value: unknown, label: string): string {
  if (typeof value !== "string" || !DIGEST_PATTERN.test(value)) {
    throw handoffValidation("runtime_admission_input_invalid", `${label} is invalid`);
  }
  return value;
}

function requireTimestamp(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length > MAX_TIMESTAMP_CHARACTERS) {
    throw handoffValidation("runtime_admission_input_invalid", `${label} is invalid`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) {
    throw handoffValidation("runtime_admission_input_invalid", `${label} is invalid`);
  }
  return value;
}

function handoffValidation(
  code: StandingNotificationHandoffValidationCode,
  message: string,
): StandingNotificationHandoffValidationError {
  return new StandingNotificationHandoffValidationError(code, message);
}
