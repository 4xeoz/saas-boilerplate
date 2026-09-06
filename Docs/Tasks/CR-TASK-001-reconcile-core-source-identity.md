# CR-TASK-001 — Reconcile Core source identity

**Status:** Open
**Owner:** Receiver conformance and release boundary

## Outcome

Establish one reviewed, committed Re-entry Core source identity that the Receiver conformance runner
can load without an implicit historical checkout or floating branch.

## Current boundary

The recorded pin is `1446d73aa3e66533547471728ad8fa5344d51f9e`, while the active sibling checkout is
`c0a42a5286dcbfeeccdda1068f0c7456a1df2da8`; the pin is unavailable there. Earlier documentation
used `91c68fd60aee2d30df8d64b75c325bd6c4d642cb` before subsequent documentation-only commits.
Details and evidence live
in [CR-ISSUE-001](../Issues/CR-ISSUE-001-core-pin-does-not-match-current-checkout.md). The verifier
also selects historical ADR paths that are absent from the active documentation layout, so the
resolution is a reviewed source-inventory/contract decision rather than a pin-only update. The
semantic mapping is now explicit: historical ADR-0043 is represented by ADR-1003 plus standing
Mechanism/Core sections; ADR-0044 by ADR-1004 plus the proof and implementation gates; and ADR-0045
by ADR-1002 plus Mechanism 03 and the exact code/profile contract. ADR-1005 is governance metadata,
not a replacement for the transport decision. This mapping does not satisfy the verifier's exact
path/byte inventory by itself.

## Next gate

Choose historical recovery or a new current pin, review the selected inventory and bytes, pass the
source verifier, then run the standing Receiver/Core, migration, and compatibility checks. Do not
replace the pin with `HEAD` without review.
