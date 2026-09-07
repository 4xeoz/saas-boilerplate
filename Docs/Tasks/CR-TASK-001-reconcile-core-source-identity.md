# CR-TASK-001 — Reconcile Core source identity

**Status:** Open
**Owner:** Receiver conformance and release boundary

## Outcome

Establish one reviewed, committed Re-entry Core source identity that the Receiver conformance runner
can load without an implicit historical checkout or floating branch.

## Current boundary

The selected pin cannot be verified against the reviewed active-source layout. Both the commit
identity and the selected contract inventory need reconciliation.
[CR-ISSUE-001](../Issues/CR-ISSUE-001-core-pin-does-not-match-current-checkout.md) owns the exact
source baseline, historical recovery evidence, ADR mapping, and CODE-AHEAD classification.
This task owns the resolution outcome and next gate, not a duplicate evidence chronology.

## Next gate

Choose historical recovery or a new current pin, review the selected inventory and bytes, pass the
source verifier, then run the standing Receiver/Core, migration, and compatibility checks. Do not
replace the pin with `HEAD` without review.
