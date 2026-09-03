# Standing control-plane proposal

**NON-AUTHORITATIVE — PROPOSED, NOT ACCEPTED OR IMPLEMENTED.**

This document proposes the missing active-Receiver account shell. It is not a
public API contract, release claim, or authorization to implement these routes.
The governing parent-repository records are TASK-027 (unresolved lifetime policy),
TASK-033 (standing implementation), TASK-028 (conformance), and ADR-0043/0044/0045
(standing authority, implementation portability, and kernel transport).
The parent `Docs/Mechanisms/01-host-integration-manifest-and-enrollment.md` and
`02-receiver-grant-and-event-authority.md` remain authoritative descriptions.

## Decision boundary

Recommend Receiver-owned HTML and a separate `/v1/standing/*` shell API. Accept
the exact public route, envelope, identity, token, CSRF, login-return, and lifetime
contracts before implementation. ADR-0045 standardizes only the three kernel
`/v0.2/*` routes; it does not standardize the candidates below.

Standing means non-consumable across Events, not permission without an expiry.
The current schema requires a finite Grant `expiresAt`. TASK-027 must decide the
actual policy; this proposal chooses neither a maximum lifetime nor a renewal
scheme. Missing accepted policy means **public enrollment remains disabled**.

## Current source evidence

- [Standing service](standing.service.ts): `createStandingConsentSession` accepts
  a trusted `maximumGrantLifetimeMs`, stores separate `expiresAt` and
  `effectiveGrantExpiresAt`, and returns a challenge. Its test/configuration inputs
  are not an accepted public lifetime policy.
- `decideStandingConsent`, `inspectStandingGrant`, and `revokeStandingGrant` are
  trusted internal functions, not complete authenticated public control surfaces.
  `terminalDecisionResponse` compares decision ID, action, account, exact decision
  time, and, for approval, Connector identity on an exact retry.
- `consentTokenForSession` already derives a standing-specific token using
  `cr2-standing-consent:`. A separate cryptographic namespace does not establish
  a public page-token expiry, owner-check, or login-handoff contract.
- [Schema](../../../prisma/schema.prisma): `StandingConsentSession` stores the
  two deadlines and terminal decision identity; `StandingGrant.expiresAt` is
  non-null. `HostSubjectBinding` uniquely binds Organization plus subject digest
  to a Connector/target; revoking a Grant does not release that binding.
- [Session handling](../authentication/session.ts) distinguishes `user` and
  `developer` identities. [Origin middleware](../../middleware/same-origin.ts)
  distinguishes Receiver origin from frontend origin. Neither replaces a
  complete standing public-request validation contract.
- [Existing v0.1 Consent service](../consent/consent.service.ts):
  `getConsentPrompt(token, accountId)` has no terminal-session account comparison;
  it and `validateConsentPageToken` enforce token/session expiry only while pending.
  This is source evidence against copying these helpers for standing terminal
  pages, not an exploited-incident claim or scope to change v0.1 here.
- [Existing Consent page](../consent/consent-page.ts) contains one-shot copy and
  a status/session-identity popup message. [Login return handling](../../../../frontend/components/auth/AuthPage.tsx)
  currently allows `/consent`, not the proposed standing paths. Neither is a
  standing UX or security acceptance proof.

## Candidate surfaces and identity

Every path and response below is a proposal requiring explicit acceptance.
`/v1` identifies the Receiver shell namespace, not a downgrade of protocol `0.2`.

| Candidate surface | Required authority | Bounded result or action |
| --- | --- | --- |
| `GET /standing-consent` | Standing page context; authenticated user before private scope/decision | Receiver-owned scope, target selection, approve/decline UI |
| `GET /standing-authorizations` | User session | Own standing authorizations UI |
| `POST /v1/standing/consent-sessions` | Organization API key | Enroll signed Manifest; return opaque session identity and consent URL |
| `GET /v1/standing/consent-sessions/:sessionId` | Same Organization API key | Bounded status; approved public binding only |
| `POST /v1/standing/consent-sessions/:sessionId/decision` | User session, valid page context, Origin/CSRF | Approve or decline one Consent |
| `GET /v1/standing/authorizations` | User session | Bounded, paginated same-user summaries |
| `GET /v1/standing/authorizations/:bindingId` | Owning user session | Bounded same-user inspection |
| `POST /v1/standing/authorizations/:bindingId/revoke` | Owning user session, Origin/CSRF | Idempotent revocation; no deletion |

Organization identity comes only from authenticated middleware. An Organization
key may enroll and poll only its own sessions; it cannot approve, list, inspect,
or revoke a user's Grants. A Host subject reference is not a Receiver account.
Developer login is not user login, even when both cookies exist in one browser.
All human authority uses the explicitly selected `user` session identity.

Candidate enrollment input is signed Manifest plus Host subject reference and
expected Host origin. Account, decision time, policy cap, private Grant identity,
and target authority are not caller-controlled fields. Decision input selects an
action and, on approval, an eligible account-owned Connector; no default-target
fallback. Exact field names, unknown-field rejection, success/error envelopes,
status codes, query rules, pagination bounds, and abuse limits remain acceptance
items, not wire contracts established by this table.

## Origin, JSON, and CSRF

Receiver-owned HTML submits state changes only to the exact configured Receiver
origin. Require the exact Origin value, strict bounded JSON, explicit CSRF
protection bound to the user/session context, and authenticated authorization on
every mutation. Reject missing/null/wrong Origin, frontend-origin substitution,
permissive content types, duplicate/unknown fields, malformed UTF-8, oversized
input, and unsupported encodings according to the accepted shell parser profile.
Do not assume the existing `req.is("application/json")` check supplies all of it.

GET navigation may legitimately lack Origin; it must never approve or revoke.
No broad credentialed CORS, bearer-to-cookie fallback, or body-provided account
identity. Use no-store for sensitive pages, API responses, errors, and redirects;
define safe logging and referrer policy before exposing a token-bearing page.

## Page-token custody and terminal access

Use a standing-only token namespace; never accept a v0.1 page token as standing
authority. Persist only its digest or equivalent non-bearer verification state.
Raw tokens must not enter persistent browser storage, analytics, ordinary logs,
Host status projections, list responses, or popup messages. A consent URL is
transient navigation context, never proof of human approval.

Specify a bounded page-token lifetime covering terminal access as well as pending
access. A terminal token must not become a permanent receipt capability. For
approved **and declined** sessions, verify the authenticated user matches the
recorded deciding account before revealing terminal scope or status. Token expiry
and account mismatch return a non-disclosing result; do not expose another user's
account or authorization through error details. Recheck identity after login or
an account switch. Separate page-token expiry from effective Grant expiry: neither
silently extends the other. The terminal-token duration is still an acceptance
decision; no numeric default is selected here.

## Login and popup handoff

Use a fixed, exact `return_to` allowlist for the configured Receiver origin and
the accepted `/standing-consent` and `/standing-authorizations` paths. Do not
accept arbitrary Host URLs, path prefixes, scheme-relative URLs, credentials,
fragments, encoded path aliases, or duplicate/unknown query parameters. The
Receiver constructs the continuation; the frontend independently validates it.
Existing `/consent` compatibility is separate and must remain unchanged.

The token-handoff mechanism needs explicit acceptance: a short Receiver-owned
HttpOnly continuation context can avoid forwarding a raw token through the login
frontend; a token-bearing query alternative requires an explicit custody and
referrer/logging design. Neither is silently selected by adding a return path.

Popup `postMessage` carries only a message discriminator, Consent session identity,
and status, to the exact verified Manifest Host origin, never `*`. It carries no
raw token, public binding, Grant, account, Connector, instruction, or credentials.
The Host checks message origin, popup source, and expected session; its backend
then confirms status through Organization-authenticated polling. A message or
closed popup never proves approval. Missing opener falls back to a safe Receiver
status page. Any popup-specific COOP exception needs review, not a global disable.

## Durable decision retries

The current terminal replay contract compares exact ID/time/action/account and
approved Connector. Generating `new Date()` or a UUID on every HTTP retry would
turn a lost-response retry into a conflict, not an idempotent decision.

The future adapter must use one Consent-locked unit of work:

1. Resolve the authenticated account and validate action/Connector intent.
2. On a pending Consent, take the first authoritative Receiver timestamp and
   decision ID under the Consent lock; persist them atomically with the decision.
   Apply current expiry, key, Connector, scope, and target-binding checks there.
3. On a terminal Consent, first match account/action/Connector intent; then reuse
   the stored decision ID and timestamp for the exact retry. Never replace a
   committed decision's metadata. A changed intent remains a conflict.
4. After an uncertain response, re-read durable state. A rolled-back attempt has
   no terminal decision; any new attempt must repeat current authority checks.

Account, decision timestamp, and lifetime cap must not be delegated to request
fields. A Receiver-issued opaque intent handle, if adopted, is correlation only.
Do not weaken `terminalDecisionResponse` to tolerate changing caller metadata.
The present service opens its own transaction: do not hold an outer Consent lock
and then call it through another transaction. A reviewed in-transaction helper or
equivalent single transaction boundary is needed during future implementation.
Current binding status may evolve after an exact decision replay without changing
the historical decision. Concurrent Consents for the same subject and target may
share a subject binding while producing separate Grants; a different target must
still conflict.

## Lifetime remains pending

TASK-027 must settle Consent/offer window, effective Grant lifetime and narrowing,
near-expiry decisions, existing-row treatment, visible expiry, and any separately
chosen renewal policy. The current finite schema cannot honestly be described as
“never expires.” Do not substitute a far-future date, select an incidental cap,
silently renew, or introduce periodic re-consent while implementing this shell.
If a future policy requires an unbounded Grant, that is a separate explicit
authority/schema decision, not an interpretation of the present DateTime field.

Until policy is accepted and explicitly configured, fail closed at public
enrollment. Do not borrow v0.1 defaults or accept a Host-selected policy cap.
Before approval, show both the short Consent approval deadline and the effective
Grant deadline, with any narrowing from requested scope. Inspection preserves
both as distinct facts; no invisible extension or misleading duration. Consent
and inspection must explicitly show the one-active-activation limit and the human
consequence boundary, alongside the immutable instruction and selected target.

## Same-user summaries and revocation

Return bounded, redacted summaries only after owner checks: public binding,
verified Host origin, workflow/event type, bounded instruction/scope description,
own target display label, effective expiry, status, and useful bounded activity
state. List pagination and cursors must remain account-scoped. Do not serialize
whole ORM rows, Manifests, Events, Host subject digests, key material, Connector
tokens, lease/effect evidence, session tokens, or Organization credentials.
Current internal inspection does not imply this entire projection already exists.

The current internal implementation reads the Grant and open Delivery in separate
queries. During concurrent Event acceptance it can observe an older sequence with
a newer active count. Before exposing this summary publicly, decide and test its
snapshot contract; a coherent read must not be assumed from separate successful
queries. This is an observed control-plane design gap, not a new accepted kernel
contract or authorization to change its transaction boundary in this proposal.

Make the limitation visible before and after revoke: “Revocation prevents new
signals and claims. An activation already sent to an Agent may still finish.”
Use the existing Grant serialization boundary and preserve accepted history and
valid pre-revocation effect acknowledgement. No external-work cancellation claim,
unrevoke, deletion, or automatic creation of replacement authority.

Revocation and new Consent must not transfer the subject to a different target.
The existing `HostSubjectBinding` remains sticky. Rebinding/decommissioning needs
a separate accepted lifecycle; a fresh Consent alone does not authorize it.

## Alternatives and trade-offs

| Alternative | Assessment |
| --- | --- |
| Receiver HTML plus isolated `/v1/standing/*` shell | Recommended proposal; keeps human decisions at Receiver origin without expanding kernel wire routes |
| Frontend-owned Consent | Requires a separate cross-origin cookie, CSRF, and token-custody design; not equivalent to the current proposal |
| New controls under `/v0.2/*` | Requires a new accepted transport contract; do not infer permission from ADR-0045 |
| Copy v0.1 page/helpers or one-shot copy | Fails standing lifetime/terminal-owner assumptions; use source evidence, not inheritance by analogy |
| Organization or Host-controlled Grant management | Violates authenticated same-user authority; not an acceptable shortcut |
| Keep internal services only until decisions close | Safe current boundary; does not claim a usable public control plane |

## Acceptance and verification gates

Before implementation, accept exact routes/methods/queries, request and response
envelopes, identity and ownership rules, JSON/CSRF profile, token custody and
terminal expiry, login return allowlist, popup message schema, retry persistence,
lifetime policy, redaction/pagination, abuse bounds, and existing-row treatment.
Record decisions in the parent authorities; this proposal cannot approve itself.

Required tests must cover:

- Organization isolation; user versus developer login; cross-account prompt,
  terminal page, list, inspect, decision, and revoke; no body identity override.
- Standing/v0.1 token separation; pending and terminal expiry; approved/declined
  terminal owner checks; no raw token in logs, storage, unapproved hops, or messages.
- Exact Receiver Origin, CSRF, strict JSON/body limits, malformed encodings,
  forbidden fields/queries, no state-changing GET, and no-store error paths.
- Exact login-return allowlist, open-redirect variants, account switching, popup
  origin/source/session mismatch, absent opener, and backend status confirmation.
- Lost-response/restart/concurrent exact decision retry reuses stored ID/time;
  changed action/account/Connector conflicts; same-target concurrent Consents
  preserve one subject binding; revoke/new Consent cannot move its target.
- Consent and Grant deadline boundaries and lock waits; Host-key revocation and
  Connector expiry while waiting; absent accepted lifetime policy disables enroll.
- Account-scoped bounded/redacted pagination; idempotent revoke and Event/claim/
  ACK races; explicit in-flight limitation; no history deletion or cancellation claim.
- Unchanged v0.1 behavior, unchanged kernel `/v0.2` wire routes, and the separately
  pinned TASK-028 conformance gate. Local kernel tests are not public-shell proof.

## Scope and non-goals

This change adds only this proposal and its module README link. It adds no routes,
schemas, migrations, production logic, DB operations, frontend changes, or tests.
Future implementation requires its own accepted scope and evidence. Production
effect authority, Connector capability selection, SDK facade, Game integration,
deployment, and fixing v0.1 are outside this proposal's implementation authority.
