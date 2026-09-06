# CR-TASK-001 — Reconcile Core source identity

**Status:** Open
**Owner:** Receiver conformance and release boundary

## Outcome

Establish one reviewed, committed Re-entry Core source identity that the Receiver conformance runner
can load without an implicit historical checkout or floating branch.

## Current boundary

The recorded pin is `1446d73aa3e66533547471728ad8fa5344d51f9e`. The source readback used sibling
checkout `90d75e5efa8d8ac403552abc2bda464d823c56ae` as its implementation baseline; the current
sibling checkout readback is `40a43f379715ed36a9e81d8793621e466d88ea0f`, and the intervening changes
are documentation-only. The pin is unavailable in both. The canonical
[CR-ISSUE-001](../Issues/CR-ISSUE-001-core-pin-does-not-match-current-checkout.md) owns the exact
source inventory, historical evidence, ADR mapping, and `CODE-AHEAD` classification; this task owns
only the resolution gate and does not duplicate that evidence.

## Next gate

Choose historical recovery or a new current pin, review the selected inventory and bytes, pass the
source verifier, then run the standing Receiver/Core, migration, and compatibility checks. Do not
replace the pin with `HEAD` without review.
