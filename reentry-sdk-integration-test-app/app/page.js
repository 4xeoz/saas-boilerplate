"use client";

import { useCallback, useRef, useState } from "react";
import { createReentryConsentAction } from "@4xeoz/re-entry-sdk/client";
import styles from "./page.module.css";

const statusCopy = {
  idle: "Ready to create a signed consent request.",
  requesting: "Creating a signed request on the Host server…",
  approved: "Consent approved. The test Event is ready to send.",
  triggering: "Sending one signed Event to Re-entry Cloud…",
  accepted: "Event accepted by Re-entry Cloud and queued for delivery.",
  declined: "The consent request was declined.",
  cancelled: "The consent review was closed.",
  error: "The consent request could not be completed.",
};

export default function Page() {
  const actionRef = useRef(null);
  const [status, setStatus] = useState("idle");
  const [continuationId, setContinuationId] = useState("");
  const [eventId, setEventId] = useState("");
  const [error, setError] = useState("");

  const signTestContract = useCallback(async () => {
    setError("");
    setContinuationId("");
    setEventId("");
    setStatus("requesting");

    try {
      actionRef.current ??= createReentryConsentAction({
        async createConsentSession() {
          const session = await postJson("/api/reentry/consent", {});
          return {
            title: session.title,
            reason: session.reason,
            consentUrl: session.consent_url,
            consentSessionId: session.consent_session_id,
          };
        },
        async confirmConsentSession({ consentSessionId }) {
          const confirmation = await postJson("/api/reentry/consent/status", {
            consent_session_id: consentSessionId,
          });
          return {
            status: confirmation.status,
            continuationId: confirmation.continuation_id,
          };
        },
      });

      const result = await actionRef.current({});
      setStatus(result.status);
      if (result.status === "approved") setContinuationId(result.continuationId);
    } catch (caught) {
      setStatus("error");
      setError(publicErrorCode(caught).replaceAll("_", " "));
    }
  }, []);

  const triggerTestEvent = useCallback(async () => {
    if (!continuationId) return;
    setError("");
    setStatus("triggering");

    try {
      const result = await postJson("/api/reentry/trigger", {
        continuation_id: continuationId,
      });
      setEventId(result.event_id);
      setStatus("accepted");
    } catch (caught) {
      setStatus("error");
      setError(publicErrorCode(caught).replaceAll("_", " "));
    }
  }, [continuationId]);

  return (
    <main className={styles.shell}>
      <section className={styles.card}>
        <div className={styles.labelRow}>
          <span className={styles.eyebrow}>Re-entry SDK</span>
          <span className={styles.badge}>TEST ONLY</span>
        </div>
        <h1 className={styles.title}>Sign one test contract</h1>
        <p className={styles.intro}>
          This tiny Host app checks the consent handoff between the installed SDK and Re-entry
          Cloud, then sends one trusted test Event through the approved continuation.
        </p>

        <button
          className={styles.button}
          type="button"
          disabled={status === "requesting"}
          onClick={signTestContract}
        >
          {status === "requesting" ? "Opening consent…" : "Sign a test contract"}
          <span aria-hidden="true">↗</span>
        </button>

        {continuationId ? (
          <button
            className={styles.secondaryButton}
            type="button"
            disabled={status === "triggering" || status === "accepted"}
            onClick={triggerTestEvent}
          >
            {status === "triggering" ? "Sending Event…" : status === "accepted" ? "Event sent" : "Trigger test Event"}
            <span aria-hidden="true">→</span>
          </button>
        ) : null}

        <div className={styles.status} aria-live="polite">
          <span className={`${styles.statusDot} ${status === "approved" ? styles.statusDotGood : ""}`} />
          <span>{statusCopy[status]}</span>
        </div>

        {continuationId ? (
          <p className={styles.success}>
            Stored opaque continuation: <code>{continuationId}</code>
          </p>
        ) : null}
        {eventId ? (
          <p className={styles.success}>
            Cloud accepted Event <code>{eventId}</code> with status <strong>202 / queued</strong>.
          </p>
        ) : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.recorded}>
          <strong>What this test records</strong>
          <span>Approval: ConsentSession, Binding, and Grant.</span>
          <span>After the second button: Event and pending Delivery.</span>
          <span>No workflow update, Agent activation, or fallback.</span>
        </div>

        <div className={styles.boundary}>
          <strong>Intentionally excluded</strong>
          <span>WebMCP, business actions, Agent activation, and fallbacks.</span>
        </div>
      </section>
    </main>
  );
}

async function postJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const value = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error("Re-entry request failed"), {
      code: value?.error?.code,
    });
  }
  return value;
}

function publicErrorCode(error) {
  return typeof error?.code === "string" && /^[a-z][a-z0-9_]{0,95}$/.test(error.code)
    ? error.code
    : "reentry_request_failed";
}
