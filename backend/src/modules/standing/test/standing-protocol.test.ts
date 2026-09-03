import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "@jest/globals";
import {
  canonicalJson,
  createStandingContinuationAcceptance,
  createStandingContinuationEvent,
  createStandingContinuationEventEnvelope,
  createStandingContinuationReceipt,
  createStandingPublicBinding,
  createStandingReentryManifest,
  parseStandingContinuationEventBody,
  parseStandingReentryManifest,
  serializeStandingContinuationEvent,
  StandingProtocolError,
  validateStandingContinuationReceipt,
  validateStandingReentryManifest,
  verifyStandingContinuationEventEnvelope,
  verifyStandingReentryManifestAuthority,
} from "../standing.protocol";

const origin = "https://standing.example";
const now = new Date("2026-09-03T12:00:00.000Z");
const timestamp = String(now.getTime() / 1_000);
const keys = generateKeyPairSync("ed25519");
const otherKeys = generateKeyPairSync("ed25519");
const fingerprint = createHash("sha256")
  .update(keys.publicKey.export({ type: "spki", format: "der" }))
  .digest("base64url");

// Fixed contract bytes are deliberately independent of the implementation serializer.
const manifestBytes = '{"correlation_id":"correlation-7","display":{"reason":"Continue after a bounded signal","title":"Standing fixture"},"grant_request":{"authorization_mode":"standing","event_type":"worker.ready","grant_expires_at":"2026-09-04T12:00:00.000Z","human_boundary":"confirm_purchase","max_active_activations":1},"issued_at":"2026-09-03T12:00:00.000Z","issuer_origin":"https://standing.example","manifest_id":"manifest-7","offer_expires_at":"2026-09-03T12:10:00.000Z","protocol_version":"0.2","type":"webmcp.reentry_manifest","workflow":{"canonical_url":"https://standing.example/work/7","id":"workflow-7","state_version":0,"type":"worker_dispatch"}}';
const eventBytes = '{"binding_id":"binding-7","canonical_url":"https://standing.example/work/7","correlation_id":"correlation-7","event_id":"signal-7","event_sequence":7,"event_type":"worker.ready","issuer_origin":"https://standing.example","occurred_at":"2026-09-03T12:00:00.000Z","protocol_version":"0.2","state_version":8,"type":"webmcp.continuation_event","workflow_id":"workflow-7"}';

function manifest(): Record<string, any> {
  return {
    ...JSON.parse(manifestBytes),
    signature: {
      algorithm: "Ed25519",
      key_id: "host-key-7",
      value: sign(null, Buffer.from(manifestBytes), keys.privateKey).toString("base64url"),
    },
  };
}

function event(): Record<string, any> {
  return JSON.parse(eventBytes);
}

function envelope(body = eventBytes, time = timestamp, privateKey = keys.privateKey) {
  return {
    body,
    headers: {
      "WebMCP-Reentry-Key-Id": "host-key-7",
      "WebMCP-Reentry-Timestamp": time,
      "WebMCP-Reentry-Signature": sign(null, Buffer.from(`${time}.${body}`), privateKey).toString("base64url"),
    },
  };
}

const manifestOptions = { expectedOrigin: origin, keyResolver: () => keys.publicKey, now };
const eventOptions = {
  ...manifestOptions,
  expectedKeyId: "host-key-7",
  expectedKeyFingerprint: fingerprint,
};

function fails(action: () => unknown, code: string, statusCode = 422): void {
  let caught: unknown;
  try { action(); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(StandingProtocolError);
  expect(caught).toMatchObject({ code, statusCode, status: statusCode, retryable: false });
}

function binding() {
  return {
    type: "webmcp.reentry_binding", protocol_version: "0.2", binding_id: "binding-7",
    correlation_id: "correlation-7", workflow_id: "workflow-7", event_type: "worker.ready",
    expires_at: "2026-09-04T12:00:00.000Z", authorization_mode: "standing",
    max_active_activations: 1, last_event_sequence: 0, status: "active",
  };
}

function receipt() {
  return {
    type: "webmcp.continuation_receipt", protocol_version: "0.2", grant_id: "grant-7",
    correlation_id: "correlation-7", issuer_origin: origin, workflow_id: "workflow-7",
    event_type: "worker.ready", canonical_url: `${origin}/work/7`,
    expires_at: "2026-09-04T12:00:00.000Z", human_boundary: "confirm_purchase",
    continuation_mode: "open_canonical_page_read_current_state", authorization_mode: "standing",
    max_active_activations: 1,
  };
}

describe("standing canonical JSON", () => {
  it("uses code-unit key ordering, not locale or integer-key enumeration order", () => {
    expect(canonicalJson({ z: 4, a: 3, Z: 2, A: 1, "2": "two", "10": "ten", "é": 5 }))
      .toBe('{"10":"ten","2":"two","A":1,"Z":2,"a":3,"z":4,"é":5}');
    expect(canonicalJson([null, true, false, "line\nquote\"", Number.MAX_SAFE_INTEGER]))
      .toBe('[null,true,false,"line\\nquote\\\"",9007199254740991]');
    expect(canonicalJson(Object.assign(Object.create(null), { b: 2, a: 1 }))).toBe('{"a":1,"b":2}');
  });

  it.each([NaN, Infinity, -Infinity, -0, 0.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid numeric value %s", value => {
    fails(() => canonicalJson(value), "canonical_number_invalid");
  });

  it.each([undefined, 1n, Symbol("invalid"), () => 1])("rejects non-JSON values", value => {
    fails(() => canonicalJson(value), "canonical_type_invalid");
  });

  it("rejects cycles but permits repeated acyclic objects", () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    fails(() => canonicalJson(cycle), "canonical_cycle_invalid");
    const shared = { a: 1 };
    expect(canonicalJson([shared, shared])).toBe('[{"a":1},{"a":1}]');
  });

  it("rejects sparse/named arrays, custom prototypes, hidden fields and symbols", () => {
    fails(() => canonicalJson(Array(1)), "canonical_array_invalid");
    fails(() => canonicalJson(Object.assign([1], { named: 2 })), "canonical_array_invalid");
    fails(() => canonicalJson(new Date()), "protocol_object_invalid");
    fails(() => canonicalJson(Object.create({ inherited: 1 })), "protocol_object_invalid");
    fails(() => canonicalJson(Object.defineProperty({}, "hidden", { value: 1 })), "protocol_property_invalid");
    fails(() => canonicalJson({ [Symbol("hidden")]: 1 }), "protocol_property_invalid");
  });

  it("does not execute accessors or toJSON and rejects lone Unicode surrogates", () => {
    let invoked = false;
    const accessor = Object.defineProperty({}, "a", { enumerable: true, get() { invoked = true; return 1; } });
    fails(() => canonicalJson(accessor), "protocol_property_invalid");
    expect(invoked).toBe(false);
    fails(() => canonicalJson({ toJSON() { invoked = true; return {}; } }), "canonical_type_invalid");
    expect(invoked).toBe(false);
    fails(() => canonicalJson("\ud800"), "protocol_unicode_invalid");
    fails(() => canonicalJson({ "\udfff": 1 }), "protocol_unicode_invalid");
  });
});

describe("standing Manifest authority", () => {
  it("verifies independently signed bytes and returns a pinned SHA-256 SPKI fingerprint", () => {
    const input = manifest();
    const authority = verifyStandingReentryManifestAuthority(input, manifestOptions);
    expect(authority.manifest).toEqual(input);
    expect(authority.keyFingerprint).toBe(fingerprint);
    expect(fingerprint).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Object.isFrozen(authority.manifest.grant_request)).toBe(true);
    expect(Object.isFrozen(input)).toBe(false);
    expect(validateStandingReentryManifest(input, manifestOptions)).toEqual(input);
    expect(parseStandingReentryManifest(input)).toEqual(input);
  });

  it("signs the fixed Manifest message exactly and rejects non-private Ed25519 keys", () => {
    expect(createStandingReentryManifest(JSON.parse(manifestBytes), { privateKey: keys.privateKey, keyId: "host-key-7" })).toEqual(manifest());
    expect(() => createStandingReentryManifest(JSON.parse(manifestBytes), { privateKey: keys.publicKey, keyId: "host-key-7" })).toThrow(TypeError);
    expect(() => createStandingReentryManifest(JSON.parse(manifestBytes), { privateKey: generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey, keyId: "host-key-7" })).toThrow(TypeError);
  });

  it("accepts public PEM but rejects private keys, other algorithms and unavailable resolvers", () => {
    const pem = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
    expect(validateStandingReentryManifest(manifest(), { ...manifestOptions, keyResolver: () => pem })).toBeDefined();
    for (const key of [keys.privateKey, keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString(), generateKeyPairSync("ec", { namedCurve: "P-256" }).publicKey]) {
      fails(() => validateStandingReentryManifest(manifest(), { ...manifestOptions, keyResolver: () => key }), "verification_key_invalid", 401);
    }
    fails(() => validateStandingReentryManifest(manifest(), { ...manifestOptions, keyResolver: () => undefined }), "manifest_key_unavailable", 401);
    fails(() => validateStandingReentryManifest(manifest(), { ...manifestOptions, keyResolver: () => { throw new Error("private diagnostic"); } }), "manifest_key_unavailable", 401);
    fails(() => validateStandingReentryManifest(manifest(), { ...manifestOptions, keyResolver: () => otherKeys.publicKey }), "manifest_signature_invalid", 401);
  });

  it.each(["workflow", "display", "grant_request", "signature"])("rejects extra fields in %s", field => {
    const value = manifest();
    value[field].extra = true;
    fails(() => parseStandingReentryManifest(value), "record_fields_invalid");
  });

  it("rejects missing, hidden, accessor, symbol and non-plain Manifest fields without reading accessors", () => {
    const missing = manifest();
    delete missing.manifest_id;
    fails(() => parseStandingReentryManifest(missing), "record_fields_invalid");
    fails(() => parseStandingReentryManifest({ ...manifest(), extra: true }), "record_fields_invalid");
    fails(() => parseStandingReentryManifest(Object.setPrototypeOf(manifest(), { injected: true })), "record_invalid");
    fails(() => parseStandingReentryManifest(Object.defineProperty(manifest(), "hidden", { value: true })), "record_fields_invalid");
    fails(() => parseStandingReentryManifest({ ...manifest(), [Symbol("hidden")]: true }), "record_fields_invalid");
    let invoked = false;
    const value = manifest();
    Object.defineProperty(value, "manifest_id", { enumerable: true, get() { invoked = true; return "manifest-7"; } });
    fails(() => parseStandingReentryManifest(value), "record_fields_invalid");
    expect(invoked).toBe(false);
  });

  it("rejects v0.1, one-shot fields, unsupported standing mode and parallel activation", () => {
    fails(() => parseStandingReentryManifest({ ...manifest(), protocol_version: "0.1" }), "manifest_version_unsupported");
    const value = manifest();
    value.grant_request.max_runs = 1;
    fails(() => parseStandingReentryManifest(value), "record_fields_invalid");
    delete value.grant_request.max_runs;
    value.grant_request.authorization_mode = "one_shot";
    fails(() => parseStandingReentryManifest(value), "authorization_mode_invalid");
    value.grant_request.authorization_mode = "standing";
    value.grant_request.max_active_activations = 2;
    fails(() => parseStandingReentryManifest(value), "activation_limit_invalid");
  });

  it("enforces byte limits, identifiers, scalar text, URL identity and canonical timestamps", () => {
    const cases: Array<[string, (value: Record<string, any>) => void]> = [
      ["identifier_invalid", value => { value.manifest_id = "a".repeat(161); }],
      ["display_text_invalid", value => { value.display.title = "é".repeat(61); }],
      ["display_text_invalid", value => { value.display.reason = "x".repeat(501); }],
      ["display_text_invalid", value => { value.display.title = " leading"; }],
      ["display_text_invalid", value => { value.display.title = "bad\ntext"; }],
      ["protocol_unicode_invalid", value => { value.display.title = "\ud800"; }],
      ["origin_invalid", value => { value.issuer_origin = `${origin}/`; }],
      ["canonical_url_invalid", value => { value.workflow.canonical_url = "https://other.example/work/7"; }],
      ["canonical_url_invalid", value => { value.workflow.canonical_url = `${origin}/work/7#fragment`; }],
      ["canonical_url_invalid", value => { value.workflow.canonical_url = `${origin}/${"x".repeat(2_048)}`; }],
      ["timestamp_invalid", value => { value.issued_at = "2026-09-03T12:00:00Z"; }],
      ["canonical_number_invalid", value => { value.workflow.state_version = -0; }],
    ];
    for (const [code, change] of cases) {
      const value = manifest(); change(value);
      fails(() => parseStandingReentryManifest(value), code);
    }
  });

  it("enforces time ordering, expiry equality, future skew and expected origin", () => {
    const value = manifest();
    value.offer_expires_at = value.issued_at;
    fails(() => parseStandingReentryManifest(value), "manifest_offer_window_invalid");
    value.offer_expires_at = "2026-09-03T12:10:00.000Z";
    value.grant_request.grant_expires_at = value.offer_expires_at;
    fails(() => parseStandingReentryManifest(value), "manifest_grant_window_invalid");
    fails(() => validateStandingReentryManifest(manifest(), { ...manifestOptions, now: new Date("2026-09-03T12:10:00.000Z") }), "manifest_expired", 410);
    fails(() => validateStandingReentryManifest(manifest(), { ...manifestOptions, now: new Date(now.getTime() - 60_001) }), "manifest_issued_in_future");
    expect(validateStandingReentryManifest(manifest(), { ...manifestOptions, now: new Date(now.getTime() - 60_000) })).toBeDefined();
    fails(() => validateStandingReentryManifest(manifest(), { ...manifestOptions, expectedOrigin: "https://other.example" }), "manifest_origin_mismatch");
  });

  it("requires canonical Ed25519 signature bytes", () => {
    const value = manifest();
    value.signature.algorithm = "HS256";
    fails(() => parseStandingReentryManifest(value), "manifest_signature_algorithm_invalid");
    value.signature.algorithm = "Ed25519";
    for (const signature of ["a".repeat(86), "A".repeat(85), `${"A".repeat(86)}=`, "A".repeat(85) + "B"]) {
      value.signature.value = signature;
      fails(() => parseStandingReentryManifest(value), "signature_invalid");
    }
  });
});

describe("standing signed Event", () => {
  it("serializes fixed canonical bytes and accepts sequence greater than one", () => {
    expect(serializeStandingContinuationEvent(event())).toBe(eventBytes);
    expect(parseStandingContinuationEventBody(eventBytes)).toEqual(event());
    expect(createStandingContinuationEvent(event())).toEqual(event());
    expect(verifyStandingContinuationEventEnvelope(envelope(), eventOptions)).toEqual(event());
    expect(createStandingContinuationEventEnvelope(event(), { privateKey: keys.privateKey, keyId: "host-key-7", timestamp })).toEqual(envelope());
  });

  it.each(["", "{", "null"])("rejects invalid body %s", body => {
    fails(() => parseStandingContinuationEventBody(body), body === "null" ? "record_invalid" : "event_body_invalid", body === "null" ? 422 : 400);
  });

  it("rejects whitespace, duplicate keys, body limits and extra exact-envelope fields", () => {
    fails(() => parseStandingContinuationEventBody(` ${eventBytes}`), "event_body_noncanonical");
    fails(() => parseStandingContinuationEventBody(eventBytes.replace('"event_sequence":7', '"event_sequence":6,"event_sequence":7')), "event_body_noncanonical");
    fails(() => parseStandingContinuationEventBody(" ".repeat(8_193)), "event_body_too_large", 413);
    fails(() => verifyStandingContinuationEventEnvelope({ ...envelope(), extra: true }, eventOptions), "record_fields_invalid");
    const value = envelope();
    fails(() => verifyStandingContinuationEventEnvelope({ ...value, headers: { ...value.headers, Authorization: "not-allowed" } }, eventOptions), "record_fields_invalid");
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "7"])("rejects invalid event sequence %s", value => {
    fails(() => createStandingContinuationEvent({ ...event(), event_sequence: value }), "integer_invalid");
  });

  it.each<[string, number, string]>([
    ["event_sequence", 7, "integer_invalid"],
    ["state_version", 8, "canonical_number_invalid"],
  ])("preserves the exact negative-zero error for %s", (field, original, code) => {
    const body = eventBytes.replace(`"${field}":${original}`, `"${field}":-0`);
    fails(() => parseStandingContinuationEventBody(body), code);
  });

  it("rejects state negative zero and frozen one-shot version", () => {
    fails(() => createStandingContinuationEvent({ ...event(), state_version: -0 }), "canonical_number_invalid");
    fails(() => createStandingContinuationEvent({ ...event(), protocol_version: "0.1" }), "event_version_unsupported");
    expect(createStandingContinuationEvent({ ...event(), event_sequence: Number.MAX_SAFE_INTEGER }).event_sequence).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("pins both key ID and public-key bytes even when the same registry ID is rebound", () => {
    const wrongId = envelope();
    wrongId.headers["WebMCP-Reentry-Key-Id"] = "other-key";
    fails(() => verifyStandingContinuationEventEnvelope(wrongId, eventOptions), "event_key_scope_invalid", 401);
    fails(() => verifyStandingContinuationEventEnvelope(envelope(eventBytes, timestamp, otherKeys.privateKey), { ...eventOptions, keyResolver: () => otherKeys.publicKey }), "event_key_material_scope_invalid", 401);
    fails(() => verifyStandingContinuationEventEnvelope(envelope(eventBytes, timestamp, otherKeys.privateKey), eventOptions), "event_signature_invalid", 401);
    fails(() => verifyStandingContinuationEventEnvelope(envelope(), { ...eventOptions, keyResolver: () => undefined }), "event_key_unavailable", 401);
    fails(() => verifyStandingContinuationEventEnvelope(envelope(), { ...eventOptions, expectedKeyFingerprint: "A".repeat(42) + "B" }), "key_fingerprint_invalid");
  });

  it("requires all consented authority options and a finite verification clock", () => {
    for (const property of ["keyResolver", "expectedOrigin", "expectedKeyId", "expectedKeyFingerprint"] as const) {
      expect(() => verifyStandingContinuationEventEnvelope(envelope(), { ...eventOptions, [property]: undefined })).toThrow(TypeError);
    }
    expect(() => verifyStandingContinuationEventEnvelope(envelope(), { ...eventOptions, now: new Date(NaN) })).toThrow(TypeError);
    expect(() => verifyStandingContinuationEventEnvelope(envelope(), { ...eventOptions, deliveryClockSkewMs: -1 })).toThrow(TypeError);
    expect(() => verifyStandingContinuationEventEnvelope(envelope(), { ...eventOptions, now: null as unknown as Date })).toThrow(TypeError);
    expect(() => verifyStandingContinuationEventEnvelope(envelope(), { ...eventOptions, deliveryClockSkewMs: null as unknown as number })).toThrow(TypeError);
    expect(() => validateStandingReentryManifest(manifest(), { ...manifestOptions, now: null as unknown as Date })).toThrow(TypeError);
    expect(() => validateStandingReentryManifest(manifest(), { ...manifestOptions, futureClockSkewMs: null as unknown as number })).toThrow(TypeError);
  });

  it("enforces exact epoch seconds, skew boundaries, occurred time and origin", () => {
    fails(() => verifyStandingContinuationEventEnvelope(envelope(eventBytes, `0${timestamp}`), eventOptions), "event_timestamp_invalid");
    fails(() => verifyStandingContinuationEventEnvelope(envelope(eventBytes, String(Number(timestamp) - 301)), eventOptions), "event_delivery_timestamp_outside_window", 401);
    expect(verifyStandingContinuationEventEnvelope(envelope(eventBytes, String(Number(timestamp) - 300)), eventOptions)).toBeDefined();
    const future = eventBytes.replace('"occurred_at":"2026-09-03T12:00:00.000Z"', '"occurred_at":"2026-09-03T12:01:00.001Z"');
    fails(() => verifyStandingContinuationEventEnvelope(envelope(future), eventOptions), "event_occurred_in_future");
    fails(() => verifyStandingContinuationEventEnvelope(envelope(), { ...eventOptions, expectedOrigin: "https://other.example" }), "event_origin_mismatch");
  });
});

describe("standing public protocol projections", () => {
  it("validates immutable binding/receipt/acceptance values without exposing private fields", () => {
    expect(createStandingPublicBinding(binding())).toEqual(binding());
    expect(createStandingPublicBinding({ ...binding(), last_event_sequence: 7, status: "revoked" }).last_event_sequence).toBe(7);
    expect(validateStandingContinuationReceipt(receipt())).toEqual(receipt());
    expect(Object.isFrozen(createStandingContinuationReceipt(receipt()))).toBe(true);
    const acceptance = { type: "webmcp.continuation_acceptance", protocol_version: "0.2", event_id: "signal-7", correlation_id: "correlation-7", accepted: true, duplicate: true, status: "accepted" };
    expect(createStandingContinuationAcceptance(acceptance)).toEqual(acceptance);
    fails(() => createStandingContinuationAcceptance({ ...acceptance, accepted: false }), "acceptance_value_invalid");
    fails(() => createStandingContinuationAcceptance({ ...acceptance, protocol_version: "0.1" }), "acceptance_version_unsupported");
    fails(() => createStandingContinuationAcceptance({ ...acceptance, receipt: receipt() }), "record_fields_invalid");
  });

  it("rejects wrong versions, one-shot/private fields, unsafe sequences and receipt authority drift", () => {
    fails(() => createStandingPublicBinding({ ...binding(), protocol_version: "0.1" }), "binding_version_unsupported");
    fails(() => createStandingPublicBinding({ ...binding(), grant_id: "private" }), "record_fields_invalid");
    fails(() => createStandingPublicBinding({ ...binding(), runs_remaining: 1 }), "record_fields_invalid");
    fails(() => createStandingPublicBinding({ ...binding(), last_event_sequence: -0 }), "canonical_number_invalid");
    fails(() => createStandingPublicBinding({ ...binding(), status: "consumed" }), "enum_invalid");
    fails(() => createStandingContinuationReceipt({ ...receipt(), protocol_version: "0.1" }), "receipt_version_unsupported");
    fails(() => createStandingContinuationReceipt({ ...receipt(), continuation_mode: "execute_without_page" }), "receipt_mode_invalid");
    fails(() => createStandingContinuationReceipt({ ...receipt(), canonical_url: "https://other.example/" }), "canonical_url_invalid");
    fails(() => createStandingContinuationReceipt({ ...receipt(), connector_token: "private" }), "record_fields_invalid");
  });

  it("retains explicit retryability only in typed errors, never private diagnostics", () => {
    expect(new StandingProtocolError("activation_in_progress", "Activation is pending", 409, true))
      .toMatchObject({ code: "activation_in_progress", statusCode: 409, status: 409, retryable: true });
    expect(new StandingProtocolError("scope_invalid")).toMatchObject({ statusCode: 422, retryable: false });
  });
});
