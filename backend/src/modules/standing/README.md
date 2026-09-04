# Standing Authorization v0.2

This module is the additive active-Receiver implementation of Re-entry's
standing-authorization kernel. It does not modify or upgrade protocol v0.1
authority.

## Implemented boundary

The public protocol router exposes only these exact request targets:

- `POST /v0.2/events`
- `POST /v0.2/delivery-claims`
- `POST /v0.2/delivery-acknowledgements`
- `POST /v0.2/delivery-notification-handoffs`

The transport resolves the raw request target before method, headers, or body.
It requires one JSON content type, no content encoding, fatal UTF-8 decoding,
bounded bodies and responses, canonical JSON responses, and no-store headers.
Absolute-form URL aliases are classified by Express's parsed path solely for
rejection; they never become accepted routes and cannot bypass pre-parser or
pre-CORS policy.
There is no version negotiation or fallback to v0.1.

Consent enrollment and status are exposed to the Host through organization-key
protected routes. Account approval, Grant inspection, and revocation are
exposed through authenticated same-user/session/CSRF controls. These routes are
additive to v0.1 and do not create a fresh task or permit a client-selected
binding.

The [non-authoritative control-plane proposal](CONTROL-PLANE-PROPOSAL.md) describes
candidate Receiver-owned pages and shell APIs. It is not an accepted public
contract; lifetime policy and the public security boundary remain decision gates.

## Authority and state flow

1. A signed standing Manifest is verified against the Organization's current
   Host key. The Consent-session deadline and effective Grant deadline are
   stored separately. The caller must provide the currently selected maximum
   Grant lifetime; this module does not decide the unresolved product policy.
2. One authenticated human decision selects an account-owned Connector target
   and creates a non-consumable standing Grant. The Grant pins the exact Host
   key ID and SHA-256 SPKI material fingerprint.
3. A valid signed Event must use the next positive contiguous sequence. Under
   one Grant lock, acceptance rechecks replay identity, current Host-key
   authority, scope, time, sequence, and the one-active slot, then advances the
   sequence and creates one Event plus one pending Delivery atomically.
4. The Connector's outbound polling loop claims one bounded lease. The active
   implementation supports at most three attempts and terminal
   `retry_exhausted` state. Raw Connector, claim, and lease credentials are not
   persisted.
5. Acknowledgement requires a separately injected Host-effect authority and a
   correlated effect confirmed inside the lease, Grant, Connector, and
   revocation windows. Agent output by itself is not effect evidence.
6. Notification handoff requires a separately injected server-side runtime
   admission authority. The default app has no authority and fails closed;
   Connector authentication or process exit is never runtime proof.
7. Revocation fences future Events and claims while preserving history and
   exact accepted replay behavior.

PostgreSQL enforces separate standing tables, safe `BIGINT` sequences, unique
Event identity and `(Grant, sequence)`, one Delivery per Event, at most one
pending/leased Delivery per Grant, three-attempt state shapes, immutable Grant
key pins, restricted history foreign keys, and backend-only table access.

## Verification layers

- `standing-protocol.test.ts` owns strict protocol, canonicalization, signature,
  key-pin, and error-code vectors.
- `standing-migration.test.ts` owns additive PostgreSQL constraints and the
  retained v0.1 upgrade sentinel.
- `standing-http.test.ts` owns the exact Express transport and bounded error
  surface.
- `standing-service-races.test.ts` owns deterministic PostgreSQL lock-barrier
  authority and expiry races.
- `standing-consent-concurrency.test.ts` owns concurrent subject binding,
  approval-time authority fences, and validation precedence.
- `standing-event-concurrency.test.ts` owns real-HTTP sequence, duplicate, and
  revocation ordering under independent PostgreSQL lock barriers.
- `standing-delivery-profile.test.ts` owns the active Receiver's three-attempt
  claim/reclaim/exhaustion profile and the next Event after terminal delivery.
- `backend/conformance/standing-v0.2/receiver.test.mjs` consumes the shared Core
  scenario without copying it and drives real Express and PostgreSQL state.

The Jest database suites require `NODE_ENV=test` and an explicit test URL for the
dedicated loopback port and database. The shared runner requires an explicit
loopback test URL; its caller must separately verify disposable ownership. No
suite falls back to a runtime database. Run database suites serially: the Consent
race suite deliberately holds a short table lock as a deterministic barrier.

See the [verification and reproduction record](../../../conformance/standing-v0.2/README.md)
for the checked runtime, commands, results, and exact evidence limitations.

## Deliberate non-claims

This kernel is not yet a production standing-mode release. It does not provide
a production runtime-admission authority, Local Connector capability selection,
Receiver rate/quota policy, a pinned cross-repository release gate, Sleepless
Kingdom signal mapping, or deployment evidence. The shared conformance runner
verifies an exact reviewed Core pin; Receiver source closure and migration
evidence are recorded separately in the verification record. Source identity
and an injected interface alone are not full release conformance.
