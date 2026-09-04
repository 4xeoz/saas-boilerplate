import type { StandingConsentPrompt } from "./standing.service";

type StandingConsentPageOptions = {
  frontendUrl: string;
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character] ?? character));
}

function safeScriptValue(value: string): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function hostLabel(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

function deviceChoices(prompt: StandingConsentPrompt): string {
  if (prompt.connectors.length === 0) {
    return `<div class="empty-device"><strong>No connected Mac is ready</strong><span>Pair a Mac from your device dashboard, then refresh this request.</span></div>`;
  }
  return prompt.connectors.map((connector, index) => `<label class="device-choice">
    <input type="radio" name="connector" value="${escapeHtml(connector.id)}" ${index === 0 ? "checked" : ""}>
    <span class="radio" aria-hidden="true"></span>
    <span><strong>${escapeHtml(connector.deviceName)}</strong><small>Connected and ready</small></span>
    <em>Codex</em>
  </label>`).join("");
}

function terminalContent(prompt: StandingConsentPrompt): string {
  const approved = prompt.status === "approved";
  return `<section class="card complete" aria-labelledby="title">
    <div class="origin">${escapeHtml(hostLabel(prompt.session.issuer_origin))}</div>
    <p class="kicker">Decision complete</p>
    <h1 id="title">This request was ${escapeHtml(prompt.status)}.</h1>
    <p class="reason">${approved ? "The website can send future in-scope signals until the standing Grant expires or is revoked." : "Nothing was approved or sent to your Mac."}</p>
    <button class="primary" type="button" onclick="window.close()">Close window</button>
  </section>`;
}

function pendingContent(prompt: StandingConsentPrompt): string {
  const sessionId = safeScriptValue(prompt.consentSessionId);
  const hostOrigin = safeScriptValue(prompt.session.issuer_origin);
  const hasConnector = prompt.connectors.length > 0;
  return `<section class="card" aria-labelledby="title">
    <div class="origin">${escapeHtml(hostLabel(prompt.session.issuer_origin))} is asking</div>
    <h1 id="title">${escapeHtml(prompt.session.title)}</h1>
    <p class="reason">${escapeHtml(prompt.session.reason)}</p>
    <div class="scope" aria-label="Requested permission">
      <div><small>Event</small><strong>${escapeHtml(prompt.session.grant_scope.event_type)}</strong></div>
      <div><small>Workflow</small><strong>${escapeHtml(prompt.session.workflow_id)}</strong></div>
      <div><small>Until</small><strong>${escapeHtml(prompt.session.grant_scope.expires_at)}</strong></div>
    </div>
    <div class="device-head"><div><small>Deliver to</small><h2>Choose your Codex device</h2></div><button id="refresh" class="text" type="button">Refresh</button></div>
    <div class="devices">${deviceChoices(prompt)}</div>
    <p id="result" class="status" role="status" aria-live="polite"></p>
    <div class="actions"><button id="decline" class="secondary" type="button">Decline</button><button id="approve" class="primary" type="button" ${hasConnector ? "" : "disabled"}>Approve standing access</button></div>
    <p class="boundary">This authorizes one bounded workflow and one active notification at a time. The website still decides what to do.</p>
  </section>
  <script>
    (() => {
      const token = new URLSearchParams(window.location.search).get("token");
      const consentSessionId = ${sessionId};
      const hostOrigin = ${hostOrigin};
      const result = document.querySelector("#result");
      const approve = document.querySelector("#approve");
      const decline = document.querySelector("#decline");
      const refresh = document.querySelector("#refresh");
      const buttons = [approve, decline];
      refresh?.addEventListener("click", () => window.location.reload());
      function setPending(value) { buttons.forEach((button) => { if (button) button.disabled = value || (button === approve && !document.querySelector('input[name="connector"]')); }); }
      function errorMessage(code) { return ({ consent_session_expired: "This request expired. Start again from the website.", consent_token_invalid: "This request is no longer available.", connector_not_available: "That Mac is no longer available. Refresh and choose another.", host_subject_binding_conflict: "This workflow is already connected to a different Mac." })[code] || "The decision could not be saved. Please try again."; }
      async function decide(action) {
        const selected = document.querySelector('input[name="connector"]:checked');
        if (action === "approve" && !selected) { result.textContent = "Connect a Mac before approving."; return; }
        if (!token) { result.textContent = "This request is no longer available."; return; }
        setPending(true); result.textContent = action === "approve" ? "Creating the standing return path…" : "Declining…";
        const body = { consent_token: token, action, decision_id: (crypto.randomUUID ? crypto.randomUUID() : "decision-" + Date.now()), decided_at: new Date().toISOString() };
        if (action === "approve" && selected) body.connector_id = selected.value;
        try {
          const response = await fetch("/v0.2/account-consent-decisions", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body) });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) { result.textContent = errorMessage(payload?.error?.code || payload?.error); setPending(false); return; }
          if (payload?.status !== "approved" && payload?.status !== "declined") { result.textContent = "The decision could not be confirmed. Please try again."; setPending(false); return; }
          result.textContent = payload.status === "approved" ? "Approved. Future in-scope signals can use this standing path." : "Declined. Nothing was approved.";
          document.querySelector(".card")?.classList.add("complete"); buttons.forEach((button) => button?.remove());
          if (window.opener) window.opener.postMessage({ type: "reentry.consent.complete", consent_session_id: consentSessionId, status: payload.status }, hostOrigin);
        } catch { result.textContent = "Could not reach Re-entry. Check your connection and try again."; setPending(false); }
      }
      approve?.addEventListener("click", () => void decide("approve"));
      decline?.addEventListener("click", () => void decide("decline"));
    })();
  </script>`;
}

export function renderStandingConsentPage(
  prompt: StandingConsentPrompt,
  options: StandingConsentPageOptions,
): string {
  const body = prompt.status === "pending" ? pendingContent(prompt) : terminalContent(prompt);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${escapeHtml(prompt.session.title)} — Re-entry</title><style>
  :root{color-scheme:dark;--ink:#f5f4ef;--muted:#aaa99f;--line:#353630;--panel:#171815;--green:#b9f57b;--blue:#9fc7ff}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 12% 15%,rgba(74,99,129,.18),transparent 35%),#0d0e0c;color:var(--ink);font:15px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}button{font:inherit}button:focus-visible{outline:3px solid rgba(185,245,123,.34);outline-offset:3px}.shell{width:min(690px,calc(100% - 32px));margin:0 auto;padding:28px 0 54px}.wordmark{display:block;margin-bottom:54px;color:var(--ink);font-size:22px;font-weight:700;letter-spacing:-1px;text-decoration:none}.card{padding:42px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(145deg,rgba(255,255,255,.035),transparent 52%),var(--panel);box-shadow:0 30px 90px rgba(0,0,0,.38)}.card.complete{border-color:rgba(185,245,123,.35)}.origin{color:var(--blue);font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase}.kicker{margin:24px 0 0;color:var(--green);font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase}h1{margin:23px 0 12px;font-size:clamp(34px,7vw,56px);line-height:1.03;letter-spacing:-.055em}.reason{max-width:560px;margin:0;color:#c7c6be;font-size:17px}.scope{display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;margin:30px 0;background:var(--line);border:1px solid var(--line);border-radius:14px;overflow:hidden}.scope div{min-width:0;padding:15px;background:#11120f}.scope small,.device-head small{display:block;margin-bottom:5px;color:#77786f;font:700 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;text-transform:uppercase}.scope strong{display:block;overflow:hidden;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.device-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:12px}.device-head h2{margin:3px 0 0;font-size:18px}.text{border:0;background:none;color:var(--muted);cursor:pointer;font-size:12px;font-weight:650}.devices{display:grid;gap:9px}.device-choice{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px;padding:15px;border:1px solid var(--line);border-radius:14px;background:#10110f;cursor:pointer}.device-choice:has(input:checked){border-color:rgba(185,245,123,.55);background:rgba(185,245,123,.045)}.device-choice input{position:absolute;opacity:0}.radio{width:18px;height:18px;border:1px solid #61625b;border-radius:50%}.device-choice input:checked+.radio{border:5px solid var(--green)}.device-choice strong,.device-choice small{display:block}.device-choice small{color:var(--muted)}.device-choice em{color:var(--green);font-size:12px;font-style:normal}.empty-device{padding:17px;border:1px dashed #4b4d45;border-radius:14px;color:var(--muted)}.empty-device strong,.empty-device span{display:block}.empty-device strong{margin-bottom:4px;color:var(--ink)}.status{min-height:22px;margin:16px 0 4px;color:var(--green);font-size:13px}.actions{display:flex;justify-content:flex-end;gap:10px}.actions button,.primary{min-height:44px;padding:0 18px;border-radius:999px;cursor:pointer;font-size:14px;font-weight:700}.primary{border:1px solid var(--ink);background:var(--ink);color:#10110f}.secondary{min-height:44px;padding:0 18px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--ink);cursor:pointer;font-weight:700}.boundary{margin:20px 0 0;padding-top:18px;border-top:1px solid var(--line);color:#797a72;font-size:12px}button:disabled{cursor:not-allowed;opacity:.4}@media(max-width:600px){.card{padding:28px 22px}.scope{grid-template-columns:1fr}.actions{flex-direction:column-reverse}.actions button{width:100%}}
  </style></head><body><main class="shell"><a class="wordmark" href="${escapeHtml(options.frontendUrl)}">re-entry</a>${body}</main></body></html>`;
}
