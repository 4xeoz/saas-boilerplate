# Cloud Receiver v2 Developer Portal and SDK Guide Report

**Date:** 2026-09-03
**Scope:** `saas-boilerplate/` only
**Status:** Feature evidence was captured before consolidation. The implementation is now verified on an isolated consolidation WorkTree; push, deployment, publication, and shared-root Docs changes remain pending.

## 1. What was built

### Developer portal backend

- Added developer-session-authenticated organization control at `/api`.
- Added strict developer ownership checks for every organization-scoped read and mutation.
- Added organization creation with one initial API key.
- Added API-key list, create, and idempotent revoke operations.
- Generated API keys are 32 random bytes encoded as base64url (43 characters). Only the SHA-256 digest and first eight-character prefix are stored. The raw key is returned only in the creation response.
- Added redacted organization Event history joined to Delivery. The response contains only Event ID/type, issuer origin, workflow ID, received time, Delivery state/attempt, acknowledgement time, and terminal reason.
- Added `requireSameOriginJson` to all three cookie-authenticated POST mutations. Correct `FRONTEND_URL` origin succeeds; missing or wrong origin returns `403` with `csrf_origin_invalid`.
- No public Grant inspection or revocation route was added.

### Delivery continuation context

- Lease responses now copy the consented signed Manifest `display.reason` into `lease.continuation.instruction`.
- The value is parsed and bounded at claim time and fails closed if stored private state is invalid.
- The field remains untrusted task context. It does not alter Event, Grant, target, URL, Host state, WebMCP tools, or the human boundary.
- Updated lease-producing fixtures, including acknowledgement fixtures, to use valid bounded Manifest display data and assert the instruction where applicable.

### Developer UI and guide

- Added the four-tab portal: Overview, API Keys, SDK Guide, and Events.
- Added organization switching plus an always-available compact `New organization` action. Successful creation selects the new organization, opens API Keys, and reveals the first key once.
- Added one-time key reveal, copy, metadata-only listing, and revoke UI.
- Reused the existing `SdkDocumentation` component and visual system.
- Made the server facade the primary guide path:

  `createReentry(config)` → `request({ subject, prompt, url })` → `confirm(handle)` → `trigger(continuation)`

- Kept `createHostSdk` and explicit Manifest construction in a clearly labelled Advanced section.

## 2. Tests passed and failed

### Final passing results

All database-backed tests below used real Express through `createApp()` and the disposable local PostgreSQL database named in Section 4.

| Suite | Result |
| --- | ---: |
| Developer portal (`DEVELOPER-001`–`003`) | 3/3 passed |
| Delivery Claim (`CLAIM-001`–`005`) | 5/5 passed |
| Legacy delivery claim regression (`CLAIM-001`–`005`) | 5/5 passed |
| Acknowledgement (`ACK-001`–`005`) | 5/5 passed |
| Pairing and Pairing restart | 9/9 passed |
| Consent and consent-popup page | 14/14 passed |
| Signed Event ingress (`EVENT-001`–`004`) | 4/4 passed |
| Backend type-check | passed |
| Backend TypeScript build | passed |
| Frontend type-check | passed |
| Frontend ESLint | passed |
| Frontend webpack production build | passed; 19/19 static pages generated |

The listed backend suites total **45/45 tests passed**.

The isolated consolidation rerun then built the backend and ran the complete backend Jest suite
against a new disposable local PostgreSQL database. All **14/14 suites and 56/56 tests passed**;
this rerun is the current candidate evidence for the consolidated WorkTree.

Exact database-test command form:

```sh
env NODE_ENV=test PORT=4000 FRONTEND_URL=http://localhost:3000 \
  JWT_SECRET=test-only-developer-portal-jwt \
  DATABASE_URL=postgresql://mac@127.0.0.1:55440/sdk_receiver_29cdf_cloud_built_20260902 \
  CLOUD_RECEIVER_RUNTIME_DATABASE_URL= DIRECT_URL= \
  npm test -w backend -- --runInBand <test-file>
```

The final focused command used:

```sh
... npm test -w backend -- --runInBand backend/src/modules/developer-portal/test/developer-portal.test.ts
```

The final prior-feature commands used the same environment with these files:

```text
backend/src/modules/deliveries/test/delivery-claim.test.ts
backend/src/modules/delivery/test/delivery.test.ts
backend/src/modules/acknowledgements/test/acknowledgement.test.ts
backend/src/modules/connectors/test/pairing.test.ts
backend/src/modules/connectors/test/pairing-restart.test.ts
backend/src/modules/consent/test/consent.test.ts
backend/src/modules/consent/test/consent-page.test.ts
backend/src/modules/events/test/event.test.ts
```

Other final commands:

```sh
npm run type-check
npm run build -w backend
npm run type-check -w frontend
npm run lint -w frontend
npm run build -w frontend -- --webpack
```

### Failed or intermediate results

- The intentional initial Developer Portal red run failed because `/api/organizations` did not yet exist: unauthenticated access returned `404` instead of the expected `401`, and organization creation returned `404`. The final run passed after implementation.
- Initial delivery instruction assertions failed because the service did not yet propagate `display.reason`. The final Claim and delivery suites passed.
- The first frontend type-check after editing the guide caught an unescaped nested template literal in the displayed Advanced snippet. It was corrected; the final type-check passed.
- ESLint first reported React `set-state-in-effect` findings in the portal. The state transitions were moved to async callbacks and user event handlers; final lint passed with no warnings or errors.
- `npm run build -w frontend` failed twice in Turbopack, including an elevated retry, with `TurbopackInternalError` / `Operation not permitted` while creating a process and binding a port during CSS processing. The supported webpack build passed, so this remains an environment/tooling mismatch rather than an application compile failure.

## 3. Exact commit SHA and repository status

The exact source-baseline `HEAD` captured for this feature increment was:

```text
e0d6b72f724aad7462b6a62c0591a081eac8cb66
```

No feature commit had been created at the time of this report. The local cached `origin/main` ref was
`498bd18a92b488b440ccd2e3b00f55362cb4d443`; it was not fetched or changed in this task. The local branch was `8` commits ahead and `0` behind that cached ref.

The nested repository was already dirty. The following paths are uncommitted at report time; unrelated collaborator paths are preserved:

```text
README.md
backend/README.md
backend/src/middleware/protocol-transport.ts
backend/src/middleware/same-origin.ts
backend/src/modules/acknowledgements/test/acknowledgement.test.ts
backend/src/modules/connectors/pairing.controller.ts
backend/src/modules/connectors/pairing.routes.ts
backend/src/modules/connectors/pairing.schemas.ts
backend/src/modules/connectors/pairing.service.ts
backend/src/modules/connectors/test/pairing.test.ts
backend/src/modules/consent/consent.controller.ts
backend/src/modules/consent/consent.routes.ts
backend/src/modules/consent/test/consent.test.ts
backend/src/modules/deliveries/delivery.service.ts
backend/src/modules/deliveries/test/delivery-claim.test.ts
backend/src/modules/delivery/test/delivery.test.ts
backend/src/modules/events/test/event.test.ts
backend/src/modules/system-health/test/http.test.ts
backend/src/routes/index.ts
frontend/app/dashboard/page.tsx
frontend/app/developer-dashboard/page.tsx
frontend/app/docs/page.tsx
frontend/app/page.tsx
frontend/app/user-dashboard/page.tsx
frontend/components/auth/AuthPage.tsx
frontend/components/connectors/PairThisMac.tsx
frontend/components/dashboard/AccountDashboard.tsx
frontend/components/layout/AppLayout.tsx
backend/src/modules/consent/consent-page.ts
backend/src/modules/consent/test/consent-page.test.ts
backend/src/modules/developer-portal/developer-portal.controller.ts
backend/src/modules/developer-portal/developer-portal.routes.ts
backend/src/modules/developer-portal/developer-portal.schemas.ts
backend/src/modules/developer-portal/developer-portal.service.ts
backend/src/modules/developer-portal/test/developer-portal.test.ts
frontend/app/dashboard/contracts/page.tsx
frontend/app/dashboard/devices/page.tsx
frontend/app/user-dashboard/contracts/page.tsx
frontend/app/user-dashboard/devices/page.tsx
frontend/components/dashboard/ContractsDashboard.tsx
frontend/components/dashboard/DevicesDashboard.tsx
frontend/components/developer/DeveloperPortal.tsx
frontend/components/developer/SdkDocumentation.tsx
frontend/components/landing/LandingSession.tsx
frontend/components/layout/WorkspaceTopBar.tsx
frontend/lib/api/developer-portal.ts
DEVELOPER-PORTAL-INTEGRATION-REPORT.md
```

## 4. Runtime and database evidence

- Host: macOS arm64.
- Node.js: `v26.8.1`.
- npm: `11.19.0`.
- Prisma CLI/client: `7.10.0`.
- TypeScript: `5.9.3`.
- Next.js build: `16.3.0`.
- PostgreSQL server: `14.18 (Homebrew)`.
- Database: `sdk_receiver_29cdf_cloud_built_20260902` on `127.0.0.1:55440`.
- Schema evidence: 13 `cr2_` tables were present, including organizations, API keys, Events, Deliveries, delivery attempts, Grants, Consent sessions, and both account tables.

The database identity/count probe was:

```sh
psql postgresql://mac@127.0.0.1:55440/sdk_receiver_29cdf_cloud_built_20260902 \
  -X -F '|' -Atc "SELECT current_database(), current_setting('server_version'), (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'cr2_%');"
```

Result:

```text
sdk_receiver_29cdf_cloud_built_20260902|14.18 (Homebrew)|13
```

Durable assertions covered:

- organization ownership is enforced by the database query predicate;
- organization and first-key creation is one Prisma transaction;
- API-key rows contain only digest, prefix, timestamps, and revocation state;
- key creation and revoke replay do not log or return an old raw key;
- Event history is selected from an allow-listed projection and joined to Delivery;
- claim attempts, lease state, restart replay, expiry, concurrency, and `retry_exhausted` survive in PostgreSQL;
- raw Connector and claim secrets are absent from tested response/database projections.

No migration was required for this increment. The existing Prisma schema already contained the required relations and columns.

## 5. Required changes from the other teams

### Host SDK

- Use an organization API key issued by the portal only in trusted Host server configuration.
- Make `createReentry` the normal integration path and keep `createHostSdk`/Manifest construction secondary.
- Run the SDK contract suite against the exact Cloud Receiver commit selected for integration.
- Persist the request handle and approved continuation in Host-owned storage; do not put either, the organization key, signing key, binding, or Connector credential in browser state.
- Treat Event `202` as accepted/queued only, not delivery, effect, or acknowledgement.

### Local Connector

- Accept the bounded `lease.continuation.instruction` field from the delivery lease.
- Display/use it only as untrusted task context inside the Connector’s fixed safety frame.
- Continue to open the exact `canonical_url`, read fresh authoritative Host state, use current WebMCP tools, and stop before the human consequence.
- Preserve existing target scope, lease replay, acknowledgement, and secret-redaction behavior. No fallback route or protocol change is required.
- Run the received Cloud test document against the exact Receiver commit.

### Shared integration boundary

- Do not add public Grant inspection/revocation until ADR-0013 is accepted.
- Do not start Event delivery, acknowledgement, or deployment work as part of this portal increment.

## 6. Integration-test document

The following is the exact counterpart contract to exchange with the SDK and Local Connector teams. Values in angle brackets are generated per test and must not be replaced with real production secrets in evidence.

### 6.1 Developer session and organization control

All requests use the `developer_session` httpOnly cookie obtained from the existing email/password developer login. No Google/OAuth flow is involved.

List organizations:

```http
GET /api/organizations
Cookie: developer_session=<session>
```

Success: `200`, `Cache-Control: no-store`, envelope:

```json
{
  "success": true,
  "data": {
    "organizations": [
      {
        "organization_id": "<id>",
        "name": "Example",
        "created_at": "<ISO-8601>",
        "updated_at": "<ISO-8601>"
      }
    ]
  }
}
```

Create an organization and its initial key:

```http
POST /api/organizations
Origin: http://localhost:3000
Content-Type: application/json
Cookie: developer_session=<session>

{"name":"Example"}
```

Success: `201`, with `data.organization` as above and `data.api_key` containing exactly:

```json
{
  "api_key_id": "<id>",
  "key_prefix": "<first-eight-characters>",
  "api_key": "<43-character-base64url-secret>",
  "created_at": "<ISO-8601>",
  "expires_at": null,
  "revoked_at": null
}
```

The raw `api_key` is returned only in this one response. It is never returned by list, revoke, Event history, logs, or database reads.

Create a key:

```http
POST /api/organizations/<organization_id>/api-keys
Origin: http://localhost:3000
Content-Type: application/json
Cookie: developer_session=<session>

{}
```

Success: `201` with `{ "success": true, "data": { "api_key": <one-time reveal> } }` using the same key schema.

List keys: `GET /api/organizations/<organization_id>/api-keys` returns `200` and only `api_key_id`, `key_prefix`, `created_at`, `expires_at`, and `revoked_at` per key.

Revoke a key:

```http
POST /api/organizations/<organization_id>/api-keys/<api_key_id>/revoke
Origin: http://localhost:3000
Content-Type: application/json
Cookie: developer_session=<session>

{}
```

The first successful revoke returns `200` with `duplicate: false` and metadata showing `revoked_at`. Replaying the same request returns the same metadata with `duplicate: true`. Neither response contains the raw key.

Origin and error contracts:

| Condition | Status | Body/code |
| --- | ---: | --- |
| Missing developer session | 401 | `success:false`, `error:"UNAUTHORIZED"` |
| Missing or wrong POST `Origin` | 403 | `{ "error": { "code": "csrf_origin_invalid" } }` |
| Non-JSON POST | 415 | `{ "error": { "code": "http_content_type_invalid" } }` |
| Invalid body | 400 | `success:false`, `error:"VALIDATION_ERROR"` |
| Other developer’s organization | 404 | `success:false`, `error:"ORGANIZATION_NOT_FOUND"` |
| Unknown key within owned organization | 404 | `success:false`, `error:"API_KEY_NOT_FOUND"` |

### 6.2 Redacted Event history

```http
GET /api/organizations/<organization_id>/events
Cookie: developer_session=<session>
```

Success: `200`, with at most 100 newest entries. Each entry contains exactly:

```json
{
  "event_id": "<event-id>",
  "event_type": "<event-type>",
  "issuer_origin": "https://host.example",
  "workflow_id": "<workflow-id>",
  "received_at": "<ISO-8601>",
  "delivery_state": "pending|leased|acknowledged|retry_exhausted|null",
  "delivery_attempt": 1,
  "acknowledged_at": "<ISO-8601>|null",
  "terminal_reason": "<reason>|null"
}
```

The body must not contain Event body, canonical URL, binding, subject, Grant ID, consent token, Connector ID, Connector token, private receipt, or API key.

### 6.3 Delivery instruction and replay contract

The stopped Local Connector claims with:

```http
POST /v0.1/delivery-claims
Content-Type: application/json

{
  "connector_token":"<saved-connector-token>",
  "claim_token":"<fresh-32-byte-base64url-token>"
}
```

Valid work returns `200` and a canonical JSON envelope with `duplicate`, then `lease` containing:

```json
{
  "duplicate": false,
  "lease": {
    "type": "webmcp.delivery_lease",
    "protocol_version": "0.1",
    "delivery_id": "<id>",
    "event_id": "<id>",
    "attempt": 1,
    "lease_token": "<claim-token>",
    "lease_expires_at": "<ISO-8601, no more than 60 seconds>",
    "continuation": {
      "correlation_id": "<id>",
      "workflow_id": "<id>",
      "event_type": "<type>",
      "event_sequence": 1,
      "state_version": 1,
      "occurred_at": "<ISO-8601>",
      "canonical_url": "https://host.example/workflows/current",
      "instruction": "<bounded consented display.reason>"
    },
    "receipt": {
      "type": "webmcp.continuation_receipt",
      "protocol_version": "0.1",
      "grant_id": "<grant-id>",
      "correlation_id": "<id>",
      "issuer_origin": "https://host.example",
      "workflow_id": "<workflow-id>",
      "event_type": "<type>",
      "canonical_url": "https://host.example/workflows/current",
      "expires_at": "<ISO-8601>",
      "human_boundary": "<identifier>",
      "continuation_mode": "open_canonical_page_read_current_state"
    }
  }
}
```

Replay the same `connector_token` and `claim_token` before lease expiry: `200`, `duplicate:true`, and the exact same lease. A genuine wrong-target test uses a fresh claim token and returns empty `204`. Reusing a claim token from another Connector is a scope error and returns `403` with `delivery_lease_scope_invalid`.

No work and exhausted work both return an empty `204` with no response body or Content-Type. PostgreSQL stores `retry_exhausted` and the maximum attempt count of 3. Lease duration is 60 seconds; Connector polling is 5 seconds; delivery request timeout is 5 seconds.

The raw Connector token is accepted only for identity, never returned by the Receiver, persisted, or logged. The claim token is stored only as a digest. `instruction` is task context, not authority, and must not be copied into a later Event as a control field.

### 6.4 Cross-team full-chain test

This is the final combined test to run against exact counterpart commits; it was not claimed as passed by this component report:

1. Host SDK calls `createReentry(config).request({ subject, prompt, url })` from trusted server code.
2. Host sends only the consent URL/session identifier to the browser.
3. User approves or declines in the exact-origin popup.
4. Host calls `confirm(handle)`. A non-approved status stops the flow without an Event.
5. After approval, Host calls `trigger(continuation)`; Receiver returns `202` accepted/queued only.
6. Stopped Local Connector claims with a fresh claim token and receives `200` plus bounded `continuation.instruction`.
7. Connector opens the exact canonical URL, reads current Host state, and performs the allowed non-consequential Host effect.
8. Connector posts the existing acknowledgement request with its lease token and effect token; Receiver returns `200` and durably records acknowledgement.
9. Replay checks confirm no second Event, Delivery, effect, or acknowledgement transition; database state and all logs remain secret-free.

## 7. Unresolved mismatches and blockers

- Public Grant inspection/revocation remains blocked by unapproved ADR-0013. No public route was invented.
- The default Turbopack production build is still blocked by the environment’s process/port restriction; webpack production build passes.
- Verification ran on Node `26.8.1`, while the repository closure baseline is Node 24. A Node 24 rerun is still required for baseline closure.
- SDK and Local Connector exact-counterpart integration, browser/external E2E, and the combined Host → Receiver → Connector → Host effect → acknowledgement test remain outside this component verification.
- The nested repository remains uncommitted and was not pushed or deployed. This report does not claim remote, CI, Preview, production, or judge verification.
