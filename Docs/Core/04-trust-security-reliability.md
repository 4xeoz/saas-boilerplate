# Cloud Receiver 2 — Trust, Security, and Reliability

**Role:** Trust boundaries, secret custody, data lifecycle, and failure policy
**Status:** Current implementation baseline; live deployment hardening remains open

## Trust boundaries

- **Browser to backend:** User/Developer cookies identify only the matching account kind. State-
  changing browser requests require the configured Origin and JSON content type.
- **Organization to backend:** Organization API keys authenticate Host-key and enrollment calls.
  Organization identity is derived from the digest lookup, never from the body.
- **Host to backend:** Host public keys and signed canonical Manifests/Events establish issuer,
  origin, scope, time, and sequence. A Host assertion cannot override Receiver ownership.
- **Connector to backend:** Connector and claim tokens are bearer inputs checked against digest,
  target, lease, Grant, and revocation state. A Connector cannot choose another target.
- **Backend to database:** Prisma/PostgreSQL is the authority for account, binding, Grant, Event,
  Delivery, lease, effect, and revocation state. Browser roles are not database clients.
- **Runtime admission:** Standing notification handoff is accepted only through an explicitly
  injected server-side verifier. Absence or failure is a visible fail-closed result.
- **Consumer page:** WebMCP, browser prompts, and page UI are optional consumer capabilities; they
  never replace backend authorization or human review.

## Secret custody

The service stores or returns only the minimum representation required by its contract:

- passwords are bcrypt hashes;
- pairing codes, Connector tokens, Organization API keys, consent tokens, claim/lease tokens, and
  related control values are digested or revealed only at their explicitly one-time boundary;
- Host public keys and fingerprints may be persisted, but private keys never enter the service;
- effect attestations, runtime admission, and instructions are bounded and scoped to the owning
  Delivery or Grant; and
- logs and redacted portal projections exclude raw credentials, private Grant fields, Event bodies,
  canonical URLs where not required, and database row dumps.

Runtime environment values are loaded from configuration and must never be committed. Production
requires strong JWT and pairing-source secrets; migration credentials are separate from request-time
database configuration.

## Identity and data lifecycle

- User and Developer accounts are distinct models with distinct cookie names and route guards.
- One `(Organization, Host subject)` binding sticks to its first Connector target; a different
  target is a conflict, not an implicit reassignment.
- Consent and Grant decisions preserve accepted history. Revocation fences future Events/claims while
  avoiding deletion of the accepted record needed for replay and audit semantics.
- Delivery attempts are bounded. Expired leases reclaim only within the maximum-attempt profile;
  terminal exhaustion releases the active slot without treating the Delivery as acknowledged.
- PostgreSQL foreign keys, unique indexes, positive sequence checks, partial active-slot indexes,
  and backend-only privileges enforce the durable portion of these rules.

## Atomicity and concurrency

The Receiver locks the authority that determines scope and expiry before committing a consequential
transition. Accepted Event, Delivery, and eligible outbox/handoff state commit together. Duplicate
identity returns the existing result; changed identity, stale lease, revoked Grant, or mismatched
effect produces no partial transition. Database and runtime-admission failures surface as typed
bounded failures rather than guessed success.

## Browser and human boundary

The User may inspect and decide through the Receiver-owned consent or Grant surface. A browser safety
prompt or optional page capability is not a Grant. The Receiver does not infer User approval from a
Host, Connector, token, process exit, or frontend boolean. Consumer-specific human consequences stay
with the consumer application and require its own evidence.

## Operational boundary

Runtime health, migration order, deployment packaging, graceful shutdown, recovery, and live
hardening procedures are owned by
[Operations/01-runtime-deployment-recovery.md](../Operations/01-runtime-deployment-recovery.md).
This policy still requires those procedures to preserve secret custody, backend-only database
access, explicit migration authority, fail-closed admission, and a current evidence ceiling; it
does not duplicate their commands or mutable deployment state.

## Reopen conditions

Reopen this document and its focused tests when identity, secret representation, Grant lifetime,
Event ordering, Delivery attempts, acknowledgement evidence, browser origin policy, runtime
admission, migration privileges, or deployment topology changes.
