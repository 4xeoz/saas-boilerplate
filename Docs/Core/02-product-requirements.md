# Cloud Receiver 2 — Product Requirements

**Role:** Stable behavior and reliability requirements
**Status:** Current baseline; implementation and release status are tracked separately

The requirements below define the intended Receiver boundary. A requirement marked implemented in
code still needs the verification level named in [Validation and evidence](05-validation-and-evidence.md)
before it can support a release claim.

## Functional requirements

| ID | Requirement | Owning surface |
|---|---|---|
| CR-REQ-01 | Keep User and Developer accounts, sessions, and ownership checks separate. | Authentication, Users, Developers |
| CR-REQ-02 | Create one short-lived pairing session and allow one cookie-free Connector claim with digest-only credential storage. | Connectors |
| CR-REQ-03 | Require trusted source identity and a durable bounded budget for anonymous pairing claims. | Connectors |
| CR-REQ-04 | Register Host keys and accept consent only within the authenticated Organization boundary. | Consent, Standing |
| CR-REQ-05 | Bind one `(Organization, Host subject)` to one Connector target; reject a different target without reassignment. | Consent, database constraints |
| CR-REQ-06 | Validate signed Event identity, canonical bytes, origin, time, sequence, Grant, and replay before mutation. | Events, Standing |
| CR-REQ-07 | Commit accepted Event history and eligible Delivery creation atomically. | Events, Deliveries, database |
| CR-REQ-08 | Lease one target-scoped Delivery with bounded attempts, expiry, reclaim, and terminal exhaustion. | Deliveries, Standing |
| CR-REQ-09 | Accept acknowledgement only with matching Connector, Delivery, lease, Grant, revocation window,
  and separately verified Host-effect context. | Deliveries, Standing |
| CR-REQ-10 | Keep v0.1 and standing v0.2 transport and persistence profiles distinct; no negotiation or silent fallback. | Protocol transport, Standing |
| CR-REQ-11 | Make standing notification handoff fail closed unless a real server-side runtime-admission
  authority is explicitly composed. | Standing |
| CR-REQ-12 | Expose only bounded account, organization, Connector, consent, Grant, health, and redacted history projections. | Frontend and module routes |

## Reliability and security requirements

- **CR-REQ-13 — Atomicity:** state mutation, durable Event, and eligible Delivery/outbox work commit
  or roll back together within the owning transaction.
- **CR-REQ-14 — Idempotency:** duplicate identity replays the committed result; changed identity is
  a conflict; effect and acknowledgement identity cannot cause a second domain transition.
- **CR-REQ-15 — Isolation:** every account, Organization, Host subject, Connector, Grant, Event, and
  Delivery lookup is server-scoped; client-selected identity is never authoritative.
- **CR-REQ-16 — Secret custody:** store only digests, prefixes, public keys, or bounded attestations
  where possible; never put raw credentials in ordinary projections, logs, or documentation.
- **CR-REQ-17 — Fail closed:** invalid transport, unavailable limiter/database/authority, expired or
  revoked state, and unsupported capability return typed bounded failures without partial mutation.
- **CR-REQ-18 — Operability:** expose public liveness separately from database readiness and make
  migration, shutdown, rollback, and recovery order explicit.

## Explicit non-requirements

The current product does not require public Grant listing/revocation, runtime admission provider
selection, quota policy, multi-instance ownership, consumer-specific workflow, arbitrary external
effect execution, or live database hardening. Each is an open decision or separate release gate,
not an implied implementation task.

## Change rule

An implementation may satisfy a requirement only when its code, tests, schema, and current status
agree. A new route, field, identity rule, state transition, or migration is a contract change and
must update this table, its owning module, focused tests, and the relevant release gate.
