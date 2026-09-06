# CR-TASK-001 — Reconcile Core source identity

**Status:** Open
**Owner:** Receiver conformance and release boundary

## Outcome

Establish one reviewed, committed Re-entry Core source identity that the Receiver conformance runner
can load without an implicit historical checkout or floating branch.

## Current boundary

The recorded pin is `1446d73aa3e66533547471728ad8fa5344d51f9e`, while the active sibling checkout is
`787ff8867c0171cf113dcedd6af4473688191625`; the pin is unavailable there. Details and evidence live
in [CR-ISSUE-001](../Issues/CR-ISSUE-001-core-pin-does-not-match-current-checkout.md). The verifier
also selects historical ADR paths that are absent from the active documentation layout, so the
resolution is a reviewed source-inventory/contract decision rather than a pin-only update.

## Next gate

Choose historical recovery or a new current pin, review the selected inventory and bytes, pass the
source verifier, then run the standing Receiver/Core, migration, and compatibility checks. Do not
replace the pin with `HEAD` without review.
