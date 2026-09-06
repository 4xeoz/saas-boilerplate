# CR-ISSUE-001 — Core pin does not match the active sibling checkout

**Status:** Open
**Owner:** Receiver conformance and release boundary
**First observed:** 2026-09-05, Europe/London
**Last verified:** 2026-09-06, Europe/London

## Evidence

- `backend/conformance/standing-v0.2/core-pin.json` selects Core commit
  `1446d73aa3e66533547471728ad8fa5344d51f9e`.
- The source readback used the sibling checkout at `/Users/alex/Re-Entry/reentry` commit
  `90d75e5efa8d8ac403552abc2bda464d823c56ae` as its implementation baseline. The prior sibling
  checkout readback was `e20f16cd6def732a6ce2ca1d0264b491dd49a660`; the current checkout is
  `4f8ddaed997d7576cadcadf1fac226ca383c2338`. Changes from the prior readback to the current
  checkout are documentation-only, and neither checkout contains the selected pin. Earlier
  observations
  recorded `c0a42a5286dcbfeeccdda1068f0c7456a1df2da8`, then
  `91c68fd60aee2d30df8d64b75c325bd6c4d642cb`, and the original
  `787ff8867c0171cf113dcedd6af4473688191625` in this chain.
- `git cat-file -t 1446d73aa3e66533547471728ad8fa5344d51f9e` fails in the active sibling checkout.
- Running the Receiver source verifier against that checkout returns
  `conformance_pin_commit_unavailable` before any database or protocol import.
- The retrieval-only historical checkout `/Users/alex/OpenAI-WebMCP/WebMCP_Challenge` contains the
  selected commit, but it is outside the active workspace authority and must not become an implicit
  dependency.
- On 2026-09-06, a temporary detached clone of that retrieval checkout at the selected commit
  passed the pinned source verifier on Node 24.18.0 with source digest
  `6210d7724417e0533c77d5989e8ffdd3c404af4063ac9d70d70db9b622f73d45`. The verifier reported
  `source_identity_verified: true` and `release_conformance_verified: false`. This confirms that
  the historical pin is internally source-identifiable; it does not make the clone an active
  dependency or prove Receiver conformance.
- The verifier's fixed `SPEC_PATHS` still names historical `ADR-0043`, `ADR-0044`, and `ADR-0045`.
  None of those paths exists at the active Re-entry checkout. A semantic review of the active
  layout found that they are not a one-to-one rename:

  - `ADR-0043` (standing authorization) is represented by `ADR-1003` plus the standing sections
    in Mechanisms 01–04 and the Core requirements/design/evidence surfaces. Its old
    consumer-specific amendment and implementation chronology were intentionally removed from
    the domain-neutral Core reading path.
  - `ADR-0044` (independent conforming Receivers) is represented by `ADR-1004`, with proof limits
    in Core/05, implementation obligations in the Mechanisms, and the active Receiver gate in
    `TASK-101`.
  - `ADR-0045` (standing transport v0.2) is split between `ADR-1002` (versioned protocol and
    authority boundary) and Mechanism 03 (exact transport/Connector boundary). Its exact route
    and envelope details remain code/profile contract, not a missing standalone ADR.

  `ADR-1005` governs documentation and engineering ownership; it is not the semantic replacement
  for any of those three protocol decisions. The active documents are therefore semantically
  mapped but not path- or byte-compatible with the historical inventory. A current pin cannot
  pass by changing only `core_commit`; the selected source inventory and its verifier contract
  require an accepted compatibility review.
- A direct tree comparison on 2026-09-06 also shows that this is not documentation-only drift:
  the pinned checkout contains 53 `reentry-core` files, while the active checkout contains 59;
  six files are new and 12 common files differ. The active delta includes runtime-admission and
  notification-handoff modules, schema version 7 (the pinned source is version 6), and expanded
  standing authorization, HTTP, store, and fresh-process coverage. This is a `CODE-AHEAD`
  conflict at the source boundary, in addition to the historical documentation-inventory mismatch.

## Impact

The Receiver cannot currently establish the pinned Core source identity from the active workspace.
Therefore pinned conformance, release conformance, and any cross-project compatibility claim remain
open. The fixed selected inventory creates a second compatibility boundary beyond the commit pin;
this issue does not by itself prove a protocol or implementation defect, and it authorizes no
runtime, verifier, or pin mutation.

## Resolution gate

The owner must choose one reviewed source boundary:

1. recover and explicitly supply the historical pinned source as a retrieval fixture with recorded
   identity; or
2. review the current domain-neutral Core checkout, update the Receiver pin and selected verifier
   inventory as one accepted compatibility change, then rerun source identity, focused conformance,
   migration, and compatibility checks.

Do not replace the pin with `HEAD`, a branch, a package version, or a working tree without that
review. Close this issue only after the selected source is committed, the verifier passes, and
`Docs/00-current-status.md` is updated with the new evidence ceiling.
