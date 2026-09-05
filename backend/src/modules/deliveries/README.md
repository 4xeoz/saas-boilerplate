# Delivery and Acknowledgement

**Role:** Target-scoped lease, retry, effect verification, and acknowledgement boundary
**Status:** Active

This module owns the retained v0.1 Delivery claim and acknowledgement behavior. The standing v0.2
transport composes its own service in the Standing module while preserving the same authority ideas.

## Contract

- `POST /v0.1/delivery-claims` accepts a Connector token and a fresh claim token.
- A valid pending Delivery returns one bounded lease; no work or exhausted work returns an empty
  `204` with no response body or content type.
- The active profile permits at most three attempts with a 60-second lease and retires each prior
  claim token on reclaim.
- `POST /v0.1/delivery-acknowledgements` requires the matching Connector, Delivery, lease, and
  effect token. The injected Host-effect authority must attest the exact Delivery/Event context.
- Acknowledgement is once-only and replay-safe; invalid scope, expired lease, revoked Grant, missing
  effect authority, or mismatched attestation fails closed.

Raw Connector, claim, lease, and effect credentials are not returned in unrelated projections or
persisted as raw values. Continuation instruction is bounded untrusted context, not authority.

## Ownership boundary

This module does not decide Consent, Grant lifetime, Event mapping, Connector capability selection,
runtime admission, human consequences, or deployment. It exposes effect and acknowledgement seams
that callers must inject and verify at the appropriate evidence level.

## Verification boundary

Tests cover lease state transitions, reclaim/exhaustion, scope, expiry, duplicate acknowledgement,
effect attestation, replay, and failure atomicity. Focused tests cannot claim external delivery or
production runtime authority.
