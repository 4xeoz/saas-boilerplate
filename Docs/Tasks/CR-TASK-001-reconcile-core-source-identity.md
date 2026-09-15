# CR-TASK-001 — Reconcile Core source identity

**Status:** Locally integrated — source identity and upgrade verified; compatibility and release pending
**Owner:** Receiver conformance and release boundary

## Outcome

Establish one reviewed, committed Re-entry Core source identity that the Receiver conformance runner
can load without an implicit historical checkout or floating branch.

## Current boundary

The owner selected the reviewed current Core boundary on 2026-09-07. Receiver commit
`1ed853b481bb1b2b12f440b7172d3df89c22d822` carries the pin and selected contract inventory. Exact
source identity, the shared standing scenario on disposable PostgreSQL, fresh-process
rollback/recovery, and the exact-source migration upgrade pass against that commit. This is local
source/conformance evidence, not a published or deployed release.
[CR-ISSUE-001](../Issues/CR-ISSUE-001-core-pin-does-not-match-current-checkout.md) owns the exact
source baseline, historical recovery evidence, ADR mapping, and CODE-AHEAD classification.
This task owns the resolution outcome and next gate, not a duplicate evidence chronology.

## Next gate

Complete the compatibility matrix and release/deployment evidence against the integrated source.
Any later pin or selected-inventory change requires a new source review; this acceptance does not
authorize a floating `HEAD`.
