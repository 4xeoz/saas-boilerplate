# CR-TASK-003 — Decide the standing control plane

**Status:** Open
**Owner:** Standing module and Receiver product authority

## Outcome

Accept or reject the expanded account-facing standing control-plane shell before treating the
current proposal as an implementation contract. The bounded authenticated enrollment, decision,
inspection, and revocation endpoints already present under `/v0.2` remain the current protocol
surface; they do not settle the shell's UX and public-policy questions.

## Current boundary

`backend/src/modules/standing/CONTROL-PLANE-PROPOSAL.md` is explicitly non-authoritative for the
expanded shell. Lifetime, renewal, redaction, CSRF, token custody, login continuation, popup/session
checks, public revocation semantics, and snapshot consistency remain undecided.

## Next gate

Record an accepted decision or keep the current bounded `/v0.2` controls without adding a shell. If
accepted, define every new route, field, error, identity, expiry, abuse limit, and retry rule before
implementation and focused tests.
