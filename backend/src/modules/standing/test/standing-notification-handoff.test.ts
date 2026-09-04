import { describe, expect, it } from "@jest/globals";
import {
  normalizeNotificationHandoffReceipt,
  normalizeRuntimeAdmissionAttestation,
} from "../standing-notification-handoff";

const baseAttestation = () => ({
  type: "webmcp.runtime_admission_attestation",
  protocol_version: "0.2",
  admission_id: "admission_001",
  adapter_id: "codex_desktop_v1",
  binding_generation: "a".repeat(64),
  delivery_id: "delivery_001",
  event_id: "event_001",
  handoff_id: "handoff_001",
  accepted_at: "2026-09-04T12:00:00.000Z",
});

const baseReceipt = () => ({
  type: "webmcp.notification_handoff_receipt",
  protocol_version: "0.2",
  delivery_id: "delivery_001",
  event_id: "event_001",
  handoff_id: "handoff_001",
  correlation_id: "correlation_001",
  workflow_id: "workflow_001",
  status: "handed_off",
  duplicate: false,
  runtime_admission_ref: "admission_001",
});

describe("standing notification handoff value contract", () => {
  it("normalizes and freezes the exact runtime admission shape", () => {
    const value = normalizeRuntimeAdmissionAttestation(baseAttestation(), {
      deliveryId: "delivery_001",
      eventId: "event_001",
      handoffId: "handoff_001",
      now: new Date("2026-09-04T12:00:00.000Z"),
    });
    expect(value).toEqual(baseAttestation());
    expect(Object.isFrozen(value)).toBe(true);
  });

  it.each([
    ["unexpected field", { extra: true }],
    ["wrong event", { event_id: "other_event" }],
    ["wrong version", { protocol_version: "0.1" }],
    ["invalid digest", { binding_generation: "a".repeat(63) }],
  ])("rejects %s", (_label, override) => {
    expect(() => normalizeRuntimeAdmissionAttestation({ ...baseAttestation(), ...override }, {
      eventId: "event_001",
    })).toThrow();
  });

  it("rejects a future admission outside the bounded clock skew", () => {
    expect(() => normalizeRuntimeAdmissionAttestation(baseAttestation(), {
      now: new Date("2026-09-04T11:58:59.000Z"),
    })).toThrow();
  });

  it("binds the receipt to delivery, Event, and handoff identity", () => {
    expect(normalizeNotificationHandoffReceipt(baseReceipt(), {
      deliveryId: "delivery_001",
      eventId: "event_001",
      handoffId: "handoff_001",
    })).toEqual(baseReceipt());
    expect(() => normalizeNotificationHandoffReceipt({ ...baseReceipt(), event_id: "other_event" }, {
      deliveryId: "delivery_001",
      eventId: "event_001",
      handoffId: "handoff_001",
    })).toThrow();
  });
});
