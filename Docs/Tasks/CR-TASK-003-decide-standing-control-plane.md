# CR-TASK-003 — Decide the standing control plane

**Status:** Open
**Owner:** Standing module and Receiver product authority

## Outcome

Accept or reject a public standing enrollment, inspection, and revocation surface before treating
the current proposal as an implementation contract.

## Current boundary

`backend/src/modules/standing/CONTROL-PLANE-PROPOSAL.md` is explicitly non-authoritative. Lifetime,
renewal, redaction, CSRF, token custody, login continuation, popup/session checks, revocation, and
snapshot consistency remain undecided.

## Next gate

Record an accepted decision or keep the internal-only boundary. If accepted, define every route,
field, error, identity, expiry, abuse limit, and retry rule before implementation and focused tests.
