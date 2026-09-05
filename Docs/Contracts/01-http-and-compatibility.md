# HTTP and Compatibility Contract

**Role:** Version boundaries, transport guards, envelopes, and compatibility rules
**Status:** Current implementation baseline

## Version surfaces

| Prefix | Surface | Compatibility rule |
|---|---|---|
| `/v1/auth` | User and Developer account/session routes | Account-kind cookies remain separate; validation errors use the application envelope |
| `/v0.1` | Pairing, consent, signed Event, finite Delivery, and acknowledgement | Retained finite-run profile; no standing semantics are inferred |
| `/v0.2` | Standing enrollment, Event, Delivery, inspection, revocation, and handoff | Additive profile with exact transport and separate persistence; never negotiates or falls back to v0.1 |
| `/health*`, `/readyz` | Process and database health | Unversioned for infrastructure consumers |
| `/api/organizations` | Developer portal | Separate Developer session and ownership checks |

## Standing transport guard

For `/v0.2`, the raw origin-form request target is resolved before CORS, JSON parsing, or application
dispatch. The guard rejects unknown paths, wrong methods, absolute-form aliases, query/fragment
variants, duplicate or invalid `Content-Type`/`Content-Encoding`/`Content-Length` headers, malformed
JSON, invalid UTF-8, and oversized bodies.

The current limits are 16 KiB for protocol request bodies and 32 KiB for protocol JSON responses.
Responses are canonical JSON with `Cache-Control: no-store`, `Pragma: no-cache`, and
`X-Content-Type-Options: nosniff`. Typed transport failures include bounded `retryable: false` in
the standing profile; database contention is a bounded retryable `503` with `Retry-After: 1`.

The v0.1 guard retains its own JSON/content-encoding and response policy. It is not a relaxed alias
for v0.2, and neither version accepts a silent fallback to the other.

## Request and response ownership

- Zod schemas reject unknown fields before service dispatch for application and standing control
  bodies.
- Signed Event bodies are canonicalized and verified against Host key, origin, Grant, time, sequence,
  scope, and replay identity by the Events/Standing services.
- Organization and session identity come from authenticated middleware and database lookup, never
  from a client-selected body field.
- Private responses are bounded and no-store. Developer history is an explicit redacted projection.
- A successful HTTP response does not by itself mean a Host effect occurred; acknowledgement is a
  separate effect-backed transition.

## Route ownership summary

The exact route registration lives in `backend/src/routes/index.ts` and module route files. The
stable public families are:

- `/v1/auth/users/*` and `/v1/auth/developers/*`;
- `/v0.1/account/*`, `/v0.1/host-keys`, `/v0.1/consent-sessions*`, `/v0.1/events`,
  `/v0.1/delivery-claims`, `/v0.1/delivery-acknowledgements`, and `/v0.1/connectors/disconnect`;
- `/v0.2/host-keys`, `/v0.2/consent-sessions*`, `/v0.2/account-consent-decisions`,
  `/v0.2/grants/:bindingId*`, `/v0.2/events`, `/v0.2/delivery-claims`,
  `/v0.2/delivery-acknowledgements`, and `/v0.2/delivery-notification-handoffs`; and
- `/api/organizations*` plus the unversioned health and consent page routes.

Changing a route or envelope requires focused transport tests, module tests, compatibility review,
and a current status update. Do not advertise a route that the router does not register.
