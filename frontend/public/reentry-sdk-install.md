# Re-entry SDK install instructions

Give this file to a coding agent. It contains the smallest account-first integration for a
Next.js Host application.

## Goal

Add one button that opens Re-entry consent and confirm the result on the Host server. Do not add a
later Event, Agent callback, WebMCP tool, workflow update, or fallback yet.

## 1. Install

Use Node.js 24 or newer and install the version currently verified by this project:

```sh
npm install @4xeoz/re-entry-sdk@0.3.2
```

The package has three entrypoints:

- `@4xeoz/re-entry-sdk/server` for trusted Host server code.
- `@4xeoz/re-entry-sdk/client` for the browser button.
- `@4xeoz/re-entry-sdk/next` for optional Next.js Route Handler adapters.

## 2. Add server environment variables

Create `.env.local` and keep it out of source control:

```env
HOST_ORIGIN=https://your-host.example
RECEIVER_ORIGIN=https://your-reentry-cloud.example
REENTRY_KEY_ID=host_key_your_app
REENTRY_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
REENTRY_ORGANIZATION_API_KEY=re_org_your_dashboard_key
```

Keep the organization API key and private key on the Host server only. Never use either value in
client components or variables prefixed with `NEXT_PUBLIC_`. If the private key is stored on one
line, replace the literal `\\n` with newlines before passing it to the SDK.

## 3. Create one server-only SDK module

Create `lib/reentry/server.js` (or the equivalent server-only location):

```js
import { createReentry } from "@4xeoz/re-entry-sdk/server";

export const reentry = createReentry({
  origin: process.env.HOST_ORIGIN,
  receiverOrigin: process.env.RECEIVER_ORIGIN,
  privateKey: process.env.REENTRY_PRIVATE_KEY?.replaceAll("\\n", "\n"),
  keyId: process.env.REENTRY_KEY_ID,
  organizationApiKey: process.env.REENTRY_ORGANIZATION_API_KEY,
});
```

Do not import this module into browser code.

## 4. Add a consent route

Create `app/api/reentry/consent/route.js`. Use the existing authenticated user and current Host
page/workflow. Store the returned `handle` in your Host database keyed by the consent session and
user. The browser receives only the display fields and opaque session ID.

```js
import { reentry } from "@/lib/reentry/server";

export async function POST() {
  const user = await requireAuthenticatedUser();
  const pageUrl = new URL("/workflows/current", process.env.HOST_ORIGIN).href;

  const request = await reentry.request({
    subject: user.id,
    prompt: "Approve this Host workflow in Re-entry.",
    url: pageUrl,
  });

  await db.reentryRequests.save({
    userId: user.id,
    consentSessionId: request.consentSessionId,
    handle: request.handle,
  });

  return Response.json({
    title: "Approve this Host workflow?",
    reason: "Approve this Host workflow in Re-entry.",
    consent_url: request.consentUrl,
    consent_session_id: request.consentSessionId,
  });
}
```

Replace `requireAuthenticatedUser`, `db.reentryRequests.save`, and the workflow URL with the
application's real authentication, database, and route code. Do not accept the user ID or URL from
the browser request body.

## 5. Add a confirmation route

Create `app/api/reentry/consent/status/route.js`. Load the saved handle for the authenticated user,
ask the Receiver for the current status, and store the approved continuation on the Host server.
Return only an opaque continuation ID to the browser.

```js
import { reentry } from "@/lib/reentry/server";

export async function POST(request) {
  const user = await requireAuthenticatedUser();
  const { consent_session_id: consentSessionId } = await request.json();
  const saved = await db.reentryRequests.findForUser(user.id, consentSessionId);
  if (!saved) return Response.json({ error: { code: "consent_not_found" } }, { status: 404 });

  let continuationId = null;
  const result = await reentry.confirm(saved.handle, {
    onApproved: async (continuation) => {
      const savedContinuation = await db.reentryContinuations.save({
        userId: user.id,
        consentSessionId,
        continuation,
      });
      continuationId = savedContinuation.id;
    },
  });

  if ("status" in result) {
    return Response.json({ status: result.status });
  }

  return Response.json({ status: "approved", continuation_id: continuationId });
}
```

The `binding` inside the approved continuation is server-only. Never return it to the browser.
Approval confirms permission for a future continuation; it does not send a later Event.

## 6. Add one browser button

Create a client component such as `components/ReentryButton.jsx`. The same action can later be
shared with WebMCP, but do not register a WebMCP tool in this first integration.

```jsx
"use client";

import { useRef, useState } from "react";
import { createReentryConsentAction } from "@4xeoz/re-entry-sdk/client";

export function ReentryButton() {
  const actionRef = useRef(null);
  const [status, setStatus] = useState("idle");

  async function askForConsent() {
    setStatus("requesting");
    try {
      actionRef.current ??= createReentryConsentAction({
        async createConsentSession() {
          const response = await fetch("/api/reentry/consent", { method: "POST" });
          if (!response.ok) throw new Error("consent_request_failed");
          const value = await response.json();
          return {
            title: value.title,
            reason: value.reason,
            consentUrl: value.consent_url,
            consentSessionId: value.consent_session_id,
          };
        },
        async confirmConsentSession({ consentSessionId }) {
          const response = await fetch("/api/reentry/consent/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ consent_session_id: consentSessionId }),
          });
          if (!response.ok) throw new Error("consent_confirmation_failed");
          const value = await response.json();
          return {
            status: value.status,
            continuationId: value.continuation_id,
          };
        },
      });

      const result = await actionRef.current({});
      setStatus(result.status);
    } catch {
      setStatus("error");
    }
  }

  return (
    <button type="button" onClick={() => void askForConsent()} disabled={status === "requesting"}>
      {status === "requesting" ? "Opening consent…" : "Approve in Re-entry"}
    </button>
  );
}
```

## 7. What is intentionally not included yet

- No `reentry.trigger(...)` call.
- No later Event route.
- No WebMCP registration.
- No Agent activation or callback.
- No browser-side secret, binding, or workflow state.
- No retry or fallback transport.

When the real Host business event exists, add one trusted server handler that loads the saved
continuation and calls `reentry.trigger(continuation)`. Treat an Event `202` response as accepted
and queued, not delivered or acknowledged.

## 8. Verify

1. Run the existing type check, lint, and test commands.
2. Open the Host page and click the button.
3. Approve the consent in Re-entry.
4. Confirm the Host server returns an opaque continuation ID.
5. Confirm no Event is created until a later business-event handler is deliberately added.
