# CR-TASK-001 — Reconcile Core source identity

**Status:** In progress — accepted source verified; integration and complete compatibility pending
**Owner:** Receiver conformance and release boundary

## Outcome

Establish one reviewed, committed Re-entry Core source identity that the Receiver conformance runner
can load without an implicit historical checkout or floating branch.

## Current boundary

The owner selected the reviewed current Core boundary on 2026-09-07. The Receiver pin and selected
contract inventory have been updated together. Exact source identity, the shared standing scenario
on disposable PostgreSQL, and fresh-process rollback/recovery pass locally. The changes remain
uncommitted for primary-session integration; they are not a release claim.
[CR-ISSUE-001](../Issues/CR-ISSUE-001-core-pin-does-not-match-current-checkout.md) owns the exact
source baseline, historical recovery evidence, ADR mapping, and CODE-AHEAD classification.
This task owns the resolution outcome and next gate, not a duplicate evidence chronology.

## Next gate

Integrate the reviewed Receiver changes through the primary session and retain the now-passing
database aggregate and snapshot upgrade evidence in
[CR-TASK-002](CR-TASK-002-run-disposable-database-verification.md). Complete the compatibility matrix
against the integrated source before raising the claim beyond local test evidence. Any later pin or selected-inventory
change requires a new source review; this acceptance does not authorize a floating `HEAD`.
