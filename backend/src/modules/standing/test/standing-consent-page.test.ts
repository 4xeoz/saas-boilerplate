import { renderStandingConsentPage } from "../standing-consent-page";
import type { StandingConsentPrompt } from "../standing.service";

function prompt(overrides: Partial<StandingConsentPrompt> = {}): StandingConsentPrompt {
  return {
    consentSessionId: "standing_consent_test",
    status: "pending",
    session: {
      challenge_id: "standing_challenge_test",
      manifest_id: "standing_manifest_test",
      status: "pending",
      offer: {
        title: "Prepare the next safe step",
        reason: "A bounded standing workflow is ready.",
        canonical_url: "https://host.example/workflows/standing_test",
      },
      grant_scope: {
        authorization_mode: "standing",
        event_type: "workflow.ready",
        expires_at: "2026-09-10T12:00:00.000Z",
        max_active_activations: 1,
        human_boundary: "A person confirms the final action.",
      },
      issuer_origin: "https://host.example",
      workflow_id: "standing_workflow_test",
      title: "Prepare the next safe step",
      reason: "A bounded standing workflow is ready.",
    },
    connectors: [
      {
        id: "connector_test",
        deviceName: "Studio Mac",
        expiresAt: "2026-09-11T12:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("renderStandingConsentPage", () => {
  test("renders one bounded pending session and posts only the public completion message", () => {
    const html = renderStandingConsentPage(prompt(), {
      frontendUrl: "http://localhost:3000",
    });

    expect(html).toContain("Prepare the next safe step");
    expect(html).toContain("A bounded standing workflow is ready.");
    expect(html).toContain("Studio Mac");
    expect(html).toContain('value="connector_test"');
    expect(html).toContain('new URLSearchParams(window.location.search).get("token")');
    expect(html).toContain('fetch("/v0.2/account-consent-decisions"');
    expect(html).toContain('const hostOrigin = "https://host.example";');
    expect(html).toContain("window.opener.postMessage");
    expect(html).toContain("consent_session_id: consentSessionId");
    expect(html).not.toContain('postMessage({ type: "reentry.consent.complete", consent_session_id: consentSessionId, status }, "*")');
  });

  test("escapes Host-controlled display fields and device names", () => {
    const unsafe = prompt();
    unsafe.session.title = '<img src=x onerror="alert(1)">';
    unsafe.session.reason = "Review & approve <now>";
    unsafe.connectors[0].deviceName = '<script>alert("device")</script>';

    const html = renderStandingConsentPage(unsafe, {
      frontendUrl: "http://localhost:3000",
    });

    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain('<script>alert("device")</script>');
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("Review &amp; approve &lt;now&gt;");
    expect(html).toContain("&lt;script&gt;alert(&quot;device&quot;)&lt;/script&gt;");
  });

  test("disables approval when no account-owned Connector is available", () => {
    const html = renderStandingConsentPage(prompt({ connectors: [] }), {
      frontendUrl: "http://localhost:3000",
    });

    expect(html).toContain("No connected Mac is ready");
    expect(html).toContain('id="approve"');
    expect(html).toContain("disabled");
  });

  test.each(["approved", "declined", "expired"] as const)(
    "renders %s as terminal without decision controls",
    (status) => {
      const html = renderStandingConsentPage(prompt({ status }), {
        frontendUrl: "http://localhost:3000",
      });

      expect(html).toContain(`This request was ${status}`);
      expect(html).not.toContain('id="approve"');
      expect(html).not.toContain('id="decline"');
      expect(html).not.toContain("account-consent-decisions");
    },
  );
});
