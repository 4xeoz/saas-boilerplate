import type { Request, Response } from "express";
import { asyncHandler } from "../../lib/async-handler";
import { getSessionAccountId, requireSession } from "../authentication/session";
import { ConsentError, createConsentSession, decideConsent, getConsentPrompt, getConsentStatus, registerHostKey, validateConsentPageToken } from "./consent.service";
import type { AccountConsentDecision, CreateConsentSession, RegisterHostKey } from "./consent.schemas";

function sendConsentError(res: Response, error: ConsentError): void {
  res.status(error.statusCode).json({ error: { code: error.code } });
}

export const registerHostKeyController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationAuth?.organizationId;
    if (!organizationId) {
      return res.status(403).json({ error: { code: "organization_auth_invalid" } });
    }
    const result = await registerHostKey(organizationId, req.body as RegisterHostKey);
    res.set("Cache-Control", "no-store");
    return res.status(result.duplicate ? 200 : 201).json(result);
  } catch (error) {
    if (error instanceof ConsentError) {
      sendConsentError(res, error);
      return;
    }
    throw error;
  }
});

export const createConsentSessionController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationAuth?.organizationId;
    if (!organizationId) {
      return res.status(403).json({ error: { code: "organization_auth_invalid" } });
    }
    const result = await createConsentSession(organizationId, req.body as CreateConsentSession);
    res.set("Cache-Control", "no-store");
    return res.status(result.duplicate ? 200 : 201).json(result);
  } catch (error) {
    if (error instanceof ConsentError) {
      sendConsentError(res, error);
      return;
    }
    throw error;
  }
});

export const getConsentStatusController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const organizationId = req.organizationAuth?.organizationId;
    if (!organizationId) {
      return res.status(403).json({ error: { code: "organization_auth_invalid" } });
    }
    const result = await getConsentStatus(organizationId, req.params.consentSessionId);
    res.set("Cache-Control", "no-store");
    return res.json(result);
  } catch (error) {
    if (error instanceof ConsentError) {
      sendConsentError(res, error);
      return;
    }
    throw error;
  }
});

export const accountConsentDecisionController = asyncHandler(async (req: Request, res: Response) => {
  try {
    const accountId = req.auth?.accountId;
    if (!accountId) {
      return res.status(401).json({ error: { code: "session_required" } });
    }
    const result = await decideConsent(accountId, req.body as AccountConsentDecision);
    res.set("Cache-Control", "no-store");
    return res.json(result);
  } catch (error) {
    if (error instanceof ConsentError) {
      sendConsentError(res, error);
      return;
    }
    throw error;
  }
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function renderConsentPage(prompt: Awaited<ReturnType<typeof getConsentPrompt>>): string {
  const consentSessionId = JSON.stringify(prompt.consentSessionId);
  const connectorOptions = prompt.connectors
    .map(
      (connector) =>
        `<option value="${escapeHtml(connector.id)}">${escapeHtml(connector.deviceName)}</option>`
    )
    .join("");
  const canDecide = prompt.status === "pending";
  const controls = canDecide
    ? `<label>Connector <select id="connector">${connectorOptions}</select></label>
       <button id="approve" type="button">Approve</button>
       <button id="decline" type="button">Decline</button>
       <p id="result" role="status"></p>
       <script>
         const token = new URLSearchParams(location.search).get("token");
         const consentSessionId = ${consentSessionId};
         async function decide(action) {
           const body = { consent_token: token, action };
           if (action === "approve") body.connector_id = document.querySelector("#connector").value;
           const response = await fetch("/v0.1/account-consent-decisions", {
             method: "POST",
             headers: { "Content-Type": "application/json", "Origin": location.origin },
             credentials: "same-origin",
             body: JSON.stringify(body)
           });
           document.querySelector("#result").textContent = response.ok ? "Decision saved." : "Decision could not be saved.";
           if (response.ok && window.opener) {
             window.opener.postMessage(
               {
                 type: "reentry.consent.complete",
                 consent_session_id: consentSessionId,
                 status: action === "approve" ? "approved" : "declined"
               },
               window.location.origin
             );
           }
         }
         document.querySelector("#approve").addEventListener("click", () => decide("approve"));
         document.querySelector("#decline").addEventListener("click", () => decide("decline"));
       </script>`
    : `<p>This consent session is ${escapeHtml(prompt.status)}.</p>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(prompt.session.display.title)}</title></head>
<body>
  <main>
    <h1>${escapeHtml(prompt.session.display.title)}</h1>
    <p>${escapeHtml(prompt.session.display.reason)}</p>
    <p>Requested action: ${escapeHtml(prompt.session.grant_scope.human_boundary)}</p>
    ${controls}
  </main>
</body></html>`;
}

export const consentPageController = asyncHandler(async (req: Request, res: Response) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  try {
    await validateConsentPageToken(token);
  } catch (error) {
    if (error instanceof ConsentError) {
      sendConsentError(res, error);
      return;
    }
    throw error;
  }

  const accountId = getSessionAccountId(req, "user");
  if (!accountId) {
    const returnTo = `/consent?token=${encodeURIComponent(token)}`;
    return res.redirect(302, `/login?return_to=${encodeURIComponent(returnTo)}`);
  }

  try {
    const prompt = await getConsentPrompt(token, accountId);
    res.set("Cache-Control", "no-store");
    return res.status(200).type("html").send(renderConsentPage(prompt));
  } catch (error) {
    if (error instanceof ConsentError) {
      sendConsentError(res, error);
      return;
    }
    throw error;
  }
});

export const requireUserConsentSession = requireSession("user");
