# Event Ingress

**Role:** Signed continuation Event validation and durable Delivery creation
**Status:** Active

This module owns the retained v0.1 Event ingress and the event service called by the standing
transport. It validates canonical JSON, identifiers, origin/URL scope, timestamp skew, key id,
signature, Grant authority, sequence, replay identity, and expiry before persistence.

A new accepted Event consumes the Grant run and creates exactly one Event plus one pending Delivery
inside one transaction. The same canonical Event replay returns a duplicate acceptance without a
second Delivery. A changed body or Grant scope is an identity conflict; future, expired, revoked,
out-of-order, or unauthorized Events fail with bounded non-retryable errors.

The module does not own Connector claims, acknowledgement effects, public Grant controls, consumer
event mapping, or WebMCP page behavior. Those boundaries remain in Deliveries, Consent/Standing,
and the consuming application.

## Verification boundary

Tests cover canonicalization, signature/key availability, clock windows, Grant scope, sequence
ordering, duplicate/conflict replay, transaction rollback, and no-mutation failures. A passing Event
suite proves ingress and persistence scope only.
