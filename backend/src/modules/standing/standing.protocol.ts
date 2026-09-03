import {
  KeyObject,
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";

// Independent implementation of the accepted standing wire contract. No v0.1
// serializer or application state participates in signature verification.
export const STANDING_PROTOCOL_VERSION = "0.2" as const;
export const STANDING_AUTHORIZATION_MODE = "standing" as const;
export const STANDING_MAX_ACTIVE_ACTIVATIONS = 1 as const;
export const CONTINUATION_MODE = "open_canonical_page_read_current_state" as const;
export const REENTRY_HEADER_NAMES = Object.freeze({
  keyId: "WebMCP-Reentry-Key-Id",
  timestamp: "WebMCP-Reentry-Timestamp",
  signature: "WebMCP-Reentry-Signature",
} as const);
export const PROTOCOL_LIMITS = Object.freeze({
  identifierBytes: 160,
  canonicalUrlBytes: 2_048,
  displayTitleBytes: 120,
  displayReasonBytes: 500,
  manifestBytes: 16 * 1_024,
  eventBodyBytes: 8 * 1_024,
  receiptBytes: 8 * 1_024,
  manifestFutureSkewMs: 60_000,
  eventFutureSkewMs: 60_000,
  deliveryClockSkewMs: 300_000,
});

export class StandingProtocolError extends Error {
  readonly status: number;

  constructor(
    public readonly code: string,
    message = code,
    public readonly statusCode = 422,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "StandingProtocolError";
    this.status = statusCode;
  }
}

export interface StandingUnsignedManifest {
  type: "webmcp.reentry_manifest";
  protocol_version: "0.2";
  manifest_id: string;
  correlation_id: string;
  issuer_origin: string;
  issued_at: string;
  offer_expires_at: string;
  workflow: { id: string; type: string; state_version: number; canonical_url: string };
  display: { title: string; reason: string };
  grant_request: {
    authorization_mode: "standing";
    event_type: string;
    grant_expires_at: string;
    max_active_activations: 1;
    human_boundary: string;
  };
}

export interface StandingReentryManifest extends StandingUnsignedManifest {
  signature: { algorithm: "Ed25519"; key_id: string; value: string };
}

export interface StandingContinuationEvent {
  type: "webmcp.continuation_event";
  protocol_version: "0.2";
  event_id: string;
  correlation_id: string;
  binding_id: string;
  issuer_origin: string;
  workflow_id: string;
  event_type: string;
  event_sequence: number;
  state_version: number;
  occurred_at: string;
  canonical_url: string;
}

export interface StandingContinuationEventEnvelope {
  body: string;
  headers: {
    "WebMCP-Reentry-Key-Id": string;
    "WebMCP-Reentry-Timestamp": string;
    "WebMCP-Reentry-Signature": string;
  };
}

export interface StandingPublicBinding {
  type: "webmcp.reentry_binding";
  protocol_version: "0.2";
  binding_id: string;
  correlation_id: string;
  workflow_id: string;
  event_type: string;
  expires_at: string;
  authorization_mode: "standing";
  max_active_activations: 1;
  last_event_sequence: number;
  status: "active" | "revoked" | "expired";
}

export interface StandingContinuationReceipt {
  type: "webmcp.continuation_receipt";
  protocol_version: "0.2";
  grant_id: string;
  correlation_id: string;
  issuer_origin: string;
  workflow_id: string;
  event_type: string;
  canonical_url: string;
  expires_at: string;
  human_boundary: string;
  continuation_mode: typeof CONTINUATION_MODE;
  authorization_mode: "standing";
  max_active_activations: 1;
}

export interface StandingContinuationAcceptance {
  type: "webmcp.continuation_acceptance";
  protocol_version: "0.2";
  event_id: string;
  correlation_id: string;
  accepted: true;
  duplicate: boolean;
  status: "accepted";
}

export interface StandingKeyRequest {
  issuerOrigin: string;
  keyId: string;
  purpose: "manifest" | "event";
}

export type StandingKeyResolver = (request: StandingKeyRequest) => unknown;
export interface StandingManifestVerificationOptions {
  keyResolver?: StandingKeyResolver;
  expectedOrigin?: string;
  now?: Date;
  futureClockSkewMs?: number;
}
export interface StandingEventVerificationOptions extends StandingManifestVerificationOptions {
  expectedKeyId?: string;
  expectedKeyFingerprint?: string;
  deliveryClockSkewMs?: number;
}

const MANIFEST_FIELDS = [
  "type", "protocol_version", "manifest_id", "correlation_id", "issuer_origin", "issued_at",
  "offer_expires_at", "workflow", "display", "grant_request",
] as const;
const EVENT_FIELDS = [
  "type", "protocol_version", "event_id", "correlation_id", "binding_id", "issuer_origin",
  "workflow_id", "event_type", "event_sequence", "state_version", "occurred_at", "canonical_url",
] as const;
const BINDING_FIELDS = [
  "type", "protocol_version", "binding_id", "correlation_id", "workflow_id", "event_type",
  "expires_at", "authorization_mode", "max_active_activations", "last_event_sequence", "status",
] as const;
const RECEIPT_FIELDS = [
  "type", "protocol_version", "grant_id", "correlation_id", "issuer_origin", "workflow_id",
  "event_type", "canonical_url", "expires_at", "human_boundary", "continuation_mode",
  "authorization_mode", "max_active_activations",
] as const;
const ACCEPTANCE_FIELDS = [
  "type", "protocol_version", "event_id", "correlation_id", "accepted", "duplicate", "status",
] as const;

function invalid(code: string, message: string, status = 422): never {
  throw new StandingProtocolError(code, message, status);
}

function plainObject(value: unknown, code: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    invalid(code, "A plain object is required");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) invalid(code, "A plain object is required");
}

function dataProperties(value: object, code: string, array = false): void {
  for (const key of Reflect.ownKeys(value)) {
    if (array && key === "length") continue;
    if (typeof key !== "string") invalid(code, "Symbol properties are forbidden");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      invalid(code, "Only enumerable data properties are allowed");
    }
  }
}

function exact(value: unknown, fields: readonly string[]): Record<string, unknown> {
  plainObject(value, "record_invalid");
  dataProperties(value, "record_fields_invalid");
  const keys = Object.keys(value);
  if (keys.length !== fields.length || keys.some(key => !fields.includes(key))) {
    invalid("record_fields_invalid", "Fields do not match the standing protocol contract");
  }
  return value;
}

function unicodeScalars(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    const current = value.charCodeAt(index);
    if (current >= 0xd800 && current <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) invalid("protocol_unicode_invalid", "Invalid Unicode scalar");
      index += 1;
    } else if (current >= 0xdc00 && current <= 0xdfff) {
      invalid("protocol_unicode_invalid", "Invalid Unicode scalar");
    }
  }
}

export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();
  function encode(item: unknown): string {
    if (item === null) return "null";
    if (typeof item === "boolean") return item ? "true" : "false";
    if (typeof item === "string") { unicodeScalars(item); return JSON.stringify(item); }
    if (typeof item === "number") {
      if (!Number.isSafeInteger(item) || Object.is(item, -0)) invalid("canonical_number_invalid", "Numbers must be safe integers other than negative zero");
      return String(item);
    }
    if (typeof item !== "object") invalid("canonical_type_invalid", "Unsupported JSON value type");
    if (ancestors.has(item)) invalid("canonical_cycle_invalid", "Canonical JSON cannot contain cycles");
    ancestors.add(item);
    try {
      if (Array.isArray(item)) {
        const keys = Object.keys(item);
        if (keys.length !== item.length || keys.some((key, index) => key !== String(index))) {
          invalid("canonical_array_invalid", "Arrays must be dense with no named properties");
        }
        dataProperties(item, "protocol_property_invalid", true);
        return `[${keys.map(key => encode(item[Number(key)])).join(",")}]`;
      }
      plainObject(item, "protocol_object_invalid");
      dataProperties(item, "protocol_property_invalid");
      // Build bytes directly: JSON.stringify on a sorted object would reorder integer-like keys.
      return `{${Object.keys(item).sort().map(key => {
        unicodeScalars(key);
        return `${JSON.stringify(key)}:${encode(item[key])}`;
      }).join(",")}}`;
    } finally { ancestors.delete(item); }
  }
  return encode(value);
}

function bytes(value: string, maximum: number, code: string): void {
  if (Buffer.byteLength(value, "utf8") > maximum) invalid(code, "Protocol byte limit exceeded", 413);
}

function identifier(value: unknown): string {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 160 || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value)) {
    invalid("identifier_invalid", "Invalid protocol identifier");
  }
  return value;
}

function integer(value: unknown, positive = false): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (positive ? 1 : 0)) {
    invalid("integer_invalid", "Invalid protocol safe integer");
  }
  if (Object.is(value, -0)) invalid("canonical_number_invalid", "Negative zero is not a canonical protocol number");
  return value;
}

function origin(value: unknown): string {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > 2_048) invalid("origin_invalid", "Invalid Host origin");
  let parsed: URL;
  try { parsed = new URL(value); } catch { invalid("origin_invalid", "Invalid Host origin"); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.origin !== value) {
    invalid("origin_invalid", "Invalid Host origin");
  }
  return value;
}

function canonicalUrl(value: unknown, issuerOrigin: string): string {
  if (typeof value !== "string" || Buffer.byteLength(value, "utf8") > PROTOCOL_LIMITS.canonicalUrlBytes) {
    invalid("canonical_url_invalid", "Invalid canonical URL");
  }
  let parsed: URL;
  try { parsed = new URL(value); } catch { invalid("canonical_url_invalid", "Invalid canonical URL"); }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.hash || parsed.origin !== issuerOrigin || parsed.href !== value) {
    invalid("canonical_url_invalid", "Invalid canonical URL");
  }
  return value;
}

function isoTimestamp(value: unknown): string {
  if (typeof value !== "string" || value.length > 27 || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    invalid("timestamp_invalid", "Canonical ISO timestamp required");
  }
  return value;
}

function displayText(value: unknown, maximum: number): string {
  if (typeof value !== "string" || !value || value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value) || Buffer.byteLength(value, "utf8") > maximum) {
    invalid("display_text_invalid", "Invalid bounded display text");
  }
  unicodeScalars(value);
  return value;
}

function standing(mode: unknown, active: unknown): void {
  if (mode !== "standing") invalid("authorization_mode_invalid", "Authorization mode must be standing");
  if (active !== 1) invalid("activation_limit_invalid", "Exactly one active activation is supported");
}

function signatureValue(value: unknown): string {
  if (typeof value !== "string" || value.length !== 86 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    invalid("signature_invalid", "Invalid Ed25519 signature encoding");
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== 64 || decoded.toString("base64url") !== value) invalid("signature_invalid", "Noncanonical Ed25519 signature");
  return value;
}

function keyFingerprint(value: unknown): string {
  if (typeof value !== "string" || value.length !== 43 || !/^[A-Za-z0-9_-]+$/.test(value) || Buffer.from(value, "base64url").toString("base64url") !== value) {
    invalid("key_fingerprint_invalid", "Invalid consented Host key fingerprint");
  }
  return value;
}

function fingerprintPublicKey(key: KeyObject): string {
  return createHash("sha256").update(key.export({ type: "spki", format: "der" })).digest("base64url");
}

function resolveKey(resolver: StandingKeyResolver, request: StandingKeyRequest, unavailableCode: string): KeyObject {
  let supplied: unknown;
  try { supplied = resolver(request); } catch { invalid(unavailableCode, "Verification key unavailable", 401); }
  if (supplied === null || supplied === undefined) invalid(unavailableCode, "Verification key unavailable", 401);
  let key: KeyObject;
  try {
    if (supplied instanceof KeyObject && supplied.type === "public") key = supplied;
    else if (typeof supplied === "string" && supplied.startsWith("-----BEGIN PUBLIC KEY-----") && !supplied.includes("PRIVATE KEY")) key = createPublicKey(supplied);
    else throw new TypeError();
  } catch { invalid("verification_key_invalid", "Invalid verification public key", 401); }
  if (key.type !== "public" || key.asymmetricKeyType !== "ed25519") invalid("verification_key_invalid", "Verification key must be Ed25519", 401);
  return key;
}

function privateKey(value: unknown): KeyObject {
  let key: KeyObject;
  try {
    key = value instanceof KeyObject ? value : createPrivateKey(value as Parameters<typeof createPrivateKey>[0]);
  } catch { throw new TypeError("Invalid standing private key"); }
  if (key.type !== "private" || key.asymmetricKeyType !== "ed25519") throw new TypeError("Standing private key must be Ed25519");
  return key;
}

function clock(value: Date): number {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new TypeError("Verification clock must be a valid Date");
  return value.getTime();
}

function duration(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new TypeError("Clock skew must be a non-negative safe integer");
  return value;
}

function epochSeconds(value: unknown): string {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,15})$/.test(value) || !Number.isSafeInteger(Number(value))) {
    invalid("event_timestamp_invalid", "Invalid Event delivery timestamp");
  }
  return value;
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function normalizeManifest(input: unknown, signed: false): StandingUnsignedManifest;
function normalizeManifest(input: unknown, signed: true): StandingReentryManifest;
function normalizeManifest(input: unknown, signed: boolean): StandingUnsignedManifest | StandingReentryManifest {
  const value = exact(input, signed ? [...MANIFEST_FIELDS, "signature"] : MANIFEST_FIELDS);
  if (value.type !== "webmcp.reentry_manifest" || value.protocol_version !== "0.2") invalid("manifest_version_unsupported", "Unsupported standing Manifest version");
  const issuerOrigin = origin(value.issuer_origin);
  const workflow = exact(value.workflow, ["id", "type", "state_version", "canonical_url"]);
  const display = exact(value.display, ["title", "reason"]);
  const grant = exact(value.grant_request, ["authorization_mode", "event_type", "grant_expires_at", "max_active_activations", "human_boundary"]);
  standing(grant.authorization_mode, grant.max_active_activations);
  const manifest: StandingUnsignedManifest = {
    type: "webmcp.reentry_manifest", protocol_version: "0.2",
    manifest_id: identifier(value.manifest_id), correlation_id: identifier(value.correlation_id),
    issuer_origin: issuerOrigin, issued_at: isoTimestamp(value.issued_at), offer_expires_at: isoTimestamp(value.offer_expires_at),
    workflow: { id: identifier(workflow.id), type: identifier(workflow.type), state_version: integer(workflow.state_version), canonical_url: canonicalUrl(workflow.canonical_url, issuerOrigin) },
    display: { title: displayText(display.title, PROTOCOL_LIMITS.displayTitleBytes), reason: displayText(display.reason, PROTOCOL_LIMITS.displayReasonBytes) },
    grant_request: {
      authorization_mode: "standing", event_type: identifier(grant.event_type), grant_expires_at: isoTimestamp(grant.grant_expires_at),
      max_active_activations: 1, human_boundary: identifier(grant.human_boundary),
    },
  };
  if (!signed) return manifest;
  const signature = exact(value.signature, ["algorithm", "key_id", "value"]);
  if (signature.algorithm !== "Ed25519") invalid("manifest_signature_algorithm_invalid", "Manifest signature must use Ed25519");
  return { ...manifest, signature: { algorithm: "Ed25519", key_id: identifier(signature.key_id), value: signatureValue(signature.value) } };
}

function manifestTimeOrder(manifest: StandingUnsignedManifest): void {
  if (Date.parse(manifest.offer_expires_at) <= Date.parse(manifest.issued_at)) invalid("manifest_offer_window_invalid", "Offer expiry must follow issuance");
  if (Date.parse(manifest.grant_request.grant_expires_at) <= Date.parse(manifest.offer_expires_at)) invalid("manifest_grant_window_invalid", "Grant expiry must follow offer expiry");
}

// Parsing validates shape and internal consistency, not cryptographic authority or freshness.
export function parseStandingReentryManifest(input: unknown): StandingReentryManifest {
  const manifest = normalizeManifest(input, true);
  bytes(canonicalJson(manifest), PROTOCOL_LIMITS.manifestBytes, "manifest_too_large");
  manifestTimeOrder(manifest);
  return freeze(manifest);
}

export function createStandingReentryManifest(input: unknown, options: { privateKey: unknown; keyId: string }): StandingReentryManifest {
  const unsigned = normalizeManifest(input, false);
  manifestTimeOrder(unsigned);
  const key = privateKey(options.privateKey);
  const keyId = identifier(options.keyId);
  return parseStandingReentryManifest({ ...unsigned, signature: {
    algorithm: "Ed25519", key_id: keyId, value: sign(null, Buffer.from(canonicalJson(unsigned)), key).toString("base64url"),
  } });
}

export function verifyStandingReentryManifestAuthority(input: unknown, options: StandingManifestVerificationOptions = {}): { manifest: StandingReentryManifest; keyFingerprint: string } {
  if (typeof options.keyResolver !== "function") throw new TypeError("keyResolver is required for standing Manifest verification");
  if (options.expectedOrigin === undefined) throw new TypeError("expectedOrigin is required for standing Manifest verification");
  const manifest = normalizeManifest(input, true);
  bytes(canonicalJson(manifest), PROTOCOL_LIMITS.manifestBytes, "manifest_too_large");
  const current = clock(options.now === undefined ? new Date() : options.now);
  const skew = duration(options.futureClockSkewMs === undefined ? PROTOCOL_LIMITS.manifestFutureSkewMs : options.futureClockSkewMs);
  if (manifest.issuer_origin !== origin(options.expectedOrigin)) invalid("manifest_origin_mismatch", "Manifest origin does not match the expected Host");
  manifestTimeOrder(manifest);
  if (Date.parse(manifest.issued_at) > current + skew) invalid("manifest_issued_in_future", "Manifest issuance is outside the accepted future window");
  if (Date.parse(manifest.offer_expires_at) <= current) invalid("manifest_expired", "Manifest offer has expired", 410);
  const key = resolveKey(options.keyResolver, { issuerOrigin: manifest.issuer_origin, keyId: manifest.signature.key_id, purpose: "manifest" }, "manifest_key_unavailable");
  const { signature, ...unsigned } = manifest;
  if (!verify(null, Buffer.from(canonicalJson(unsigned)), key, Buffer.from(signature.value, "base64url"))) invalid("manifest_signature_invalid", "Manifest signature is invalid", 401);
  return freeze({ manifest, keyFingerprint: fingerprintPublicKey(key) });
}

export function validateStandingReentryManifest(input: unknown, options: StandingManifestVerificationOptions = {}): StandingReentryManifest {
  return verifyStandingReentryManifestAuthority(input, options).manifest;
}

export function createStandingContinuationEvent(input: unknown): StandingContinuationEvent {
  const value = exact(input, EVENT_FIELDS);
  if (value.type !== "webmcp.continuation_event" || value.protocol_version !== "0.2") invalid("event_version_unsupported", "Unsupported standing Event version");
  const issuerOrigin = origin(value.issuer_origin);
  return freeze({
    type: "webmcp.continuation_event", protocol_version: "0.2", event_id: identifier(value.event_id),
    correlation_id: identifier(value.correlation_id), binding_id: identifier(value.binding_id), issuer_origin: issuerOrigin,
    workflow_id: identifier(value.workflow_id), event_type: identifier(value.event_type), event_sequence: integer(value.event_sequence, true),
    state_version: integer(value.state_version), occurred_at: isoTimestamp(value.occurred_at), canonical_url: canonicalUrl(value.canonical_url, issuerOrigin),
  });
}

export function serializeStandingContinuationEvent(input: unknown): string {
  const body = canonicalJson(createStandingContinuationEvent(input));
  bytes(body, PROTOCOL_LIMITS.eventBodyBytes, "event_body_too_large");
  return body;
}

export function parseStandingContinuationEventBody(body: unknown): StandingContinuationEvent {
  if (typeof body !== "string" || !body.length) invalid("event_body_invalid", "Event body must be a non-empty string", 400);
  bytes(body, PROTOCOL_LIMITS.eventBodyBytes, "event_body_too_large");
  let input: unknown;
  try { input = JSON.parse(body); } catch { invalid("event_body_invalid", "Event body must be valid JSON", 400); }
  const event = createStandingContinuationEvent(input);
  if (canonicalJson(event) !== body) invalid("event_body_noncanonical", "Event body is not canonically encoded");
  return event;
}

export function createStandingContinuationEventEnvelope(input: unknown, options: { privateKey: unknown; keyId: string; timestamp: string }): StandingContinuationEventEnvelope {
  const body = serializeStandingContinuationEvent(input);
  const timestamp = epochSeconds(options.timestamp);
  const keyId = identifier(options.keyId);
  const key = privateKey(options.privateKey);
  return freeze({ body, headers: {
    "WebMCP-Reentry-Key-Id": keyId,
    "WebMCP-Reentry-Timestamp": timestamp,
    "WebMCP-Reentry-Signature": sign(null, Buffer.from(`${timestamp}.${body}`), key).toString("base64url"),
  } });
}

export function verifyStandingContinuationEventEnvelope(input: unknown, options: StandingEventVerificationOptions = {}): StandingContinuationEvent {
  if (typeof options.keyResolver !== "function") throw new TypeError("keyResolver is required for standing Event verification");
  if (options.expectedOrigin === undefined) throw new TypeError("expectedOrigin is required for standing Event verification");
  if (options.expectedKeyId === undefined) throw new TypeError("expectedKeyId is required for standing Event verification");
  if (options.expectedKeyFingerprint === undefined) throw new TypeError("expectedKeyFingerprint is required for standing Event verification");
  const consentedKeyId = identifier(options.expectedKeyId);
  const consentedFingerprint = keyFingerprint(options.expectedKeyFingerprint);
  const value = exact(input, ["body", "headers"]);
  const headers = exact(value.headers, Object.values(REENTRY_HEADER_NAMES));
  const event = parseStandingContinuationEventBody(value.body);
  if (event.issuer_origin !== origin(options.expectedOrigin)) invalid("event_origin_mismatch", "Event origin does not match the resolved Grant");
  const current = clock(options.now === undefined ? new Date() : options.now);
  const deliverySkew = duration(options.deliveryClockSkewMs === undefined ? PROTOCOL_LIMITS.deliveryClockSkewMs : options.deliveryClockSkewMs);
  const futureSkew = duration(options.futureClockSkewMs === undefined ? PROTOCOL_LIMITS.eventFutureSkewMs : options.futureClockSkewMs);
  const timestamp = epochSeconds(headers[REENTRY_HEADER_NAMES.timestamp]);
  if (Math.abs(current - Number(timestamp) * 1_000) > deliverySkew) invalid("event_delivery_timestamp_outside_window", "Event delivery timestamp is outside the accepted window", 401);
  if (Date.parse(event.occurred_at) > current + futureSkew) invalid("event_occurred_in_future", "Event occurrence is outside the accepted future window");
  const keyId = identifier(headers[REENTRY_HEADER_NAMES.keyId]);
  if (keyId !== consentedKeyId) invalid("event_key_scope_invalid", "Event key does not match the consented standing Grant", 401);
  const signature = signatureValue(headers[REENTRY_HEADER_NAMES.signature]);
  const key = resolveKey(options.keyResolver, { issuerOrigin: event.issuer_origin, keyId, purpose: "event" }, "event_key_unavailable");
  if (fingerprintPublicKey(key) !== consentedFingerprint) invalid("event_key_material_scope_invalid", "Event key material does not match the consented standing Grant", 401);
  if (!verify(null, Buffer.from(`${timestamp}.${value.body}`), key, Buffer.from(signature, "base64url"))) invalid("event_signature_invalid", "Event signature is invalid", 401);
  return event;
}

export function createStandingPublicBinding(input: unknown): StandingPublicBinding {
  const value = exact(input, BINDING_FIELDS);
  if (value.type !== "webmcp.reentry_binding" || value.protocol_version !== "0.2") invalid("binding_version_unsupported", "Unsupported standing binding version");
  standing(value.authorization_mode, value.max_active_activations);
  const normalized = {
    binding_id: identifier(value.binding_id), correlation_id: identifier(value.correlation_id),
    workflow_id: identifier(value.workflow_id), event_type: identifier(value.event_type),
    expires_at: isoTimestamp(value.expires_at), last_event_sequence: integer(value.last_event_sequence),
  };
  if (value.status !== "active" && value.status !== "revoked" && value.status !== "expired") invalid("enum_invalid", "Unsupported binding status");
  return freeze({
    type: "webmcp.reentry_binding", protocol_version: "0.2", ...normalized,
    authorization_mode: "standing", max_active_activations: 1, status: value.status,
  });
}

export function createStandingContinuationReceipt(input: unknown): StandingContinuationReceipt {
  const value = exact(input, RECEIPT_FIELDS);
  if (value.type !== "webmcp.continuation_receipt" || value.protocol_version !== "0.2") invalid("receipt_version_unsupported", "Unsupported standing receipt version");
  standing(value.authorization_mode, value.max_active_activations);
  if (value.continuation_mode !== CONTINUATION_MODE) invalid("receipt_mode_invalid", "Unsupported continuation mode");
  const issuerOrigin = origin(value.issuer_origin);
  const receipt: StandingContinuationReceipt = {
    type: "webmcp.continuation_receipt", protocol_version: "0.2", grant_id: identifier(value.grant_id),
    correlation_id: identifier(value.correlation_id), issuer_origin: issuerOrigin, workflow_id: identifier(value.workflow_id),
    event_type: identifier(value.event_type), canonical_url: canonicalUrl(value.canonical_url, issuerOrigin), expires_at: isoTimestamp(value.expires_at),
    human_boundary: identifier(value.human_boundary), continuation_mode: CONTINUATION_MODE, authorization_mode: "standing", max_active_activations: 1,
  };
  bytes(canonicalJson(receipt), PROTOCOL_LIMITS.receiptBytes, "receipt_too_large");
  return freeze(receipt);
}

export function validateStandingContinuationReceipt(input: unknown): StandingContinuationReceipt {
  return createStandingContinuationReceipt(input);
}

export function createStandingContinuationAcceptance(input: unknown): StandingContinuationAcceptance {
  const value = exact(input, ACCEPTANCE_FIELDS);
  if (value.type !== "webmcp.continuation_acceptance" || value.protocol_version !== "0.2") invalid("acceptance_version_unsupported", "Unsupported standing acceptance version");
  if (value.accepted !== true || typeof value.duplicate !== "boolean" || value.status !== "accepted") invalid("acceptance_value_invalid", "Unsupported acceptance outcome");
  return freeze({ type: "webmcp.continuation_acceptance", protocol_version: "0.2", event_id: identifier(value.event_id), correlation_id: identifier(value.correlation_id), accepted: true, duplicate: value.duplicate, status: "accepted" });
}
