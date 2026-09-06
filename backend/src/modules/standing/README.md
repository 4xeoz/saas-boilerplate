# Standing Authorization v0.2

**Role:** Additive Receiver standing-authorization module
**Status:** Active implementation; release gates remain open

This module owns the additive v0.2 transport and standing authority composition. It does not modify
or upgrade the retained v0.1 authority, and it does not define a consumer's event mapping or UI.

## Accepted transport boundary

The v0.2 router has two explicitly separated route groups. The protocol kernel exposes exactly:

- `POST /v0.2/events`
- `POST /v0.2/delivery-claims`
- `POST /v0.2/delivery-acknowledgements`
- `POST /v0.2/delivery-notification-handoffs`

The authenticated control group additionally exposes:

- `POST /v0.2/host-keys`
- `POST /v0.2/consent-sessions`
- `GET /v0.2/consent-sessions/:consentSessionId`
- `POST /v0.2/account-consent-decisions`
- `GET /v0.2/grants/:bindingId`
- `POST /v0.2/grants/:bindingId/revoke`

Host enrollment uses an Organization API key. Account decisions, inspection, and revocation use the
authenticated User session; JSON writes also require the Receiver-origin check. These checked-in
control endpoints are a bounded protocol surface, not a general Grant-listing or account-management
API. They are not an alternate protocol transport and do not relax the kernel's exact-target rules.

Raw request-target resolution precedes method, headers, body, CORS, and application dispatch. The
transport requires one JSON content type, no content encoding, fatal UTF-8 decoding, bounded bodies
and responses, canonical JSON, and no-store headers. Absolute-form aliases are rejected; there is no
version negotiation or fallback to v0.1.

Host enrollment and account decisions use their own organization-key and authenticated same-user
boundaries. The [control-plane proposal](CONTROL-PLANE-PROPOSAL.md) covers the still-missing
account-facing shell (lists, terminal-page custody, login continuation, and its public policy); it
is non-authoritative until its lifetime, redaction, and security decisions are accepted.

## Authority and state flow

1. Verify a signed Manifest against the Organization's current Host key; store Consent and Grant
   deadlines separately.
2. One authenticated decision selects an account-owned Connector target and creates a non-consumable
   Grant pinned to the Host key identity.
3. A signed Event must use the next positive contiguous sequence. Under one Grant lock, replay identity,
   key authority, scope, time, sequence, and the one-active slot are rechecked; one Event and one
   pending Delivery are created atomically.
4. A Connector claims one bounded lease. The active profile permits at most three attempts and a
   terminal `retry_exhausted` state; raw credentials are not persisted.
5. Acknowledgement requires separately injected effect authority and a correlated effect inside the
   lease, Grant, Connector, and revocation windows.
6. Notification handoff requires a separately injected server-side runtime-admission authority. The
   default app has no authority and fails closed.
7. Revocation fences future Events and claims while preserving accepted history and exact replay.

PostgreSQL enforces positive sequences, unique Event identity and Grant/sequence pairs, one Delivery
per Event, at most one pending/leased Delivery per Grant, bounded attempt state, immutable Host-key
pins, restricted history references, and backend-only table access.

## Verification ownership

- `standing-protocol.test.ts`: strict transport, canonicalization, signatures, key pins, and errors.
- `standing-migration.test.ts`: additive schema constraints and retained v0.1 upgrade sentinel.
- `standing-http.test.ts`: exact Express transport and bounded error surface.
- `standing-service-races.test.ts`: lock-barrier authority and expiry races.
- `standing-consent-concurrency.test.ts`: concurrent subject binding and approval fences.
- `standing-event-concurrency.test.ts`: sequence, duplicate, and revocation ordering over HTTP.
- `standing-delivery-profile.test.ts`: three-attempt lease/reclaim/exhaustion profile.
- `backend/conformance/standing-v0.2/receiver.test.mjs`: the shared Core scenario against real
  Express and PostgreSQL state.

Database suites require `NODE_ENV=test` and an explicitly verified disposable loopback database.
Run lock-barrier suites serially. No suite may fall back to a runtime database.

See the [conformance procedure](../../../conformance/standing-v0.2/README.md) for source pin,
commands, and exact claim limits.

## Non-claims

This module does not by itself prove a production release, mandatory CI/release enforcement, a
runtime-admission provider, Connector capability selection, quota policy, public control-plane UX,
deployment, or a complete consumer end-to-end continuation. Source identity and an injected interface
are necessary controls, not release proof.
