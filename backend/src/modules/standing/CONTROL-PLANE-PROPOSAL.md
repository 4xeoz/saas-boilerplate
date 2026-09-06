# Standing Control-Plane Decision Brief

**Status:** NON-AUTHORITATIVE — proposed expanded account-facing shell; not accepted or implemented
**Owner:** Receiver service

## 1. Purpose and decision boundary

This brief describes a possible Receiver-owned HTML and `/v1/standing/*` account-facing shell for
standing authorization. It is a proposal, not a public API contract or permission to implement.
The checked-in `/v0.2/*` router already has a bounded, authenticated protocol-control group; those
routes remain governed by the accepted Core and the Standing module README and are not this shell.

Standing means a Grant may accept multiple Events within its configured lifetime; it does not mean
unbounded authority. The current schema stores finite Consent and Grant deadlines. The existing
organization-authenticated `/v0.2/consent-sessions` endpoint accepts a bounded caller-supplied cap;
that implementation field is not an accepted product lifetime or renewal policy. The expanded
account-facing shell remains out of scope until those policies are accepted.

Parent decisions own the unresolved lifetime, conformance, implementation, and transport questions.
This brief may be updated only as a decision input; it cannot approve itself.

## 2. Current source facts

- The checked-in `/v0.2` router exposes organization-authenticated Host-key/enrollment/status routes
  and same-user decision/inspection/revocation routes. They are bounded protocol controls, not the
  proposed account-facing list/login/terminal shell.
- Standing Consent creation accepts a schema-bounded `maximum_grant_lifetime_ms` request cap and
  stores Consent and effective Grant deadlines separately; a caller cap is not a product lifetime
  decision.
- Standing Consent tokens use a separate cryptographic namespace; that alone does not define expiry,
  owner checks, login handoff, or terminal-page custody.
- The schema pins one Organization/Host-subject binding to one Connector target; Grant revocation does
  not release that binding.
- User and Developer sessions are distinct, and frontend-origin checks are distinct from Receiver-origin
  checks.
- The shared unversioned `GET /consent?token=...` route supports a bounded standing Consent prompt
  after standing-token validation. It redirects unauthenticated users to the User login continuation,
  renders only one standing Consent session (pending or approved/declined terminal), and posts the
  same-user decision to `/v0.2/account-consent-decisions`; an expired pending token returns a bounded
  expiry response. This is not the proposed list, renewal, or management shell.
- Existing v0.1 page helpers and login paths remain compatibility evidence. Neither they nor the bounded
  standing prompt settle the expanded shell's lifetime, redaction, custody, renewal, or public-management
  policy.

## 3. Candidate surfaces

Every path and envelope below requires explicit acceptance:

| Candidate | Authority | Bounded purpose |
|---|---|---|
| `GET /standing-consent` | authenticated User before private scope | Receiver-owned approval/decline page |
| `GET /standing-authorizations` | User session | Own authorization list |
| `POST /v1/standing/consent-sessions` | Organization API key | Enroll a signed Manifest |
| `GET /v1/standing/consent-sessions/:sessionId` | same Organization API key | Own session status |
| `POST /v1/standing/consent-sessions/:sessionId/decision` | User session plus page/Origin checks | Approve or decline once |
| `GET /v1/standing/authorizations` | User session | Bounded, paginated own summaries |
| `GET /v1/standing/authorizations/:bindingId` | owning User session | Bounded own inspection |
| `POST /v1/standing/authorizations/:bindingId/revoke` | owning User session plus Origin/CSRF | Idempotent revocation without deletion |

Organization identity comes only from authenticated middleware. Organization keys cannot approve or
revoke User Grants. A Host subject is not a Receiver account, and Developer login is not User login.
Account, decision time, policy cap, Grant identity, and target authority are server-owned fields.

## 4. Required security and custody controls

- Receiver-owned mutations require exact Receiver Origin, strict bounded JSON, authenticated User
  identity, explicit CSRF protection, canonical responses, and no-store sensitive responses.
- Reject missing/wrong Origin, permissive content types, unknown or duplicate fields, malformed UTF-8,
  oversized input, unsupported encodings, state-changing GET, body identity overrides, open redirects,
  and broad credentialed CORS.
- Use a standing-only page-token namespace. Persist only a digest or equivalent verification state.
  Raw tokens must not enter browser storage, analytics, ordinary logs, Host projections, lists, or
  popup messages.
- Bound page-token lifetime across pending and terminal access. Verify the deciding User for both
  approved and declined sessions; expiry and mismatch return non-disclosing results.
- Construct login continuations from an exact Receiver-origin/path allowlist. A token-bearing query
  requires a separately accepted custody, referrer, and logging design.
- Popup messages contain only a discriminator, Consent-session identity, and status, sent to the exact
  verified Host origin. Origin, source, and expected-session checks are mandatory.
- Revocation fences future signals and claims but does not cancel an activation already sent; preserve
  history and exact accepted replay behavior.

## 5. Retry, lifetime, and summary policy still pending

An exact terminal decision retry must match the stored decision identity, action, account, and approved
Connector, then reuse the committed decision timestamp and id. A changed intent is a conflict. A rolled
back attempt has no terminal decision and must repeat current authority checks.

Before public implementation, accept:

- Consent/offer deadline, effective Grant lifetime, narrowing, near-expiry behavior, existing-row
  treatment, visible expiry, and any renewal policy;
- account-scoped bounded/redacted list and inspection projections, pagination, and snapshot consistency;
- public revocation semantics, in-flight behavior, and binding decommission/rebinding policy; and
- exact routes, fields, status/error envelopes, abuse limits, token custody, and login/popup protocol.

The current `/v0.2` inspection endpoint reads Grant and open Delivery separately; it must not be reused
as a coherent account-facing shell snapshot until concurrent Event acceptance and ordering semantics
are decided and tested.

## 6. Alternatives

| Alternative | Assessment |
|---|---|
| Receiver HTML plus isolated `/v1/standing/*` shell | Keeps human authority at the Receiver origin without expanding kernel routes; preferred proposal |
| Frontend-owned control plane | Requires a separate cross-origin cookie, CSRF, and token-custody design |
| New controls under `/v0.2/*` | Requires a new accepted transport contract; not implied by kernel routes |
| Copy v0.1 page/helpers | Fails standing terminal-owner and lifetime assumptions |
| Organization/Host-controlled Grant management | Violates authenticated same-user authority |
| Keep the current `/v0.2` controls only | Safest current boundary while the account-facing shell decisions remain open |

## 7. Acceptance and verification gates

Before implementation, the owning decisions must accept every route/method/query, envelope, identity
and ownership rule, JSON/CSRF/parser profile, token lifetime/custody, login allowlist, popup schema,
retry persistence, lifetime policy, redaction/pagination, abuse bounds, and existing-row behavior.

Required verification covers organization isolation, account switching, pending/terminal expiry,
standing/v0.1 token separation, open-redirect variants, popup origin/source/session mismatch, exact
retry after lost response/restart, concurrent binding and Event races, revoke/new-Consent target
stickiness, redacted pagination, and unchanged v0.1 and v0.2 kernel behavior.

A local kernel test or internal service call is not public-shell proof. Public implementation requires
its own task, accepted decision, migration review if needed, focused tests, transitive tests, and runtime
evidence.

## 8. Scope and non-goals

This brief adds no route, schema, migration, production logic, database operation, frontend change,
or test. It does not choose a lifetime, renewal, public Grant API, runtime admission provider,
Connector capability, consumer workflow, deployment, or cross-project contract.
