# CR-ISSUE-001 — Core pin does not match the active sibling checkout

**Status:** Open
**Owner:** Receiver conformance and release boundary
**Observed:** 2026-09-05, Europe/London

## Evidence

- `backend/conformance/standing-v0.2/core-pin.json` selects Core commit
  `1446d73aa3e66533547471728ad8fa5344d51f9e`.
- The active sibling checkout at `/Users/alex/Re-Entry/reentry` is at
  `e4130d6d02a66e90e04eec6b38180f1de8f6deee`.
- `git cat-file -t 1446d73aa3e66533547471728ad8fa5344d51f9e` fails in the active sibling checkout.
- Running the Receiver source verifier against that checkout returns
  `conformance_pin_commit_unavailable` before any database or protocol import.
- The retrieval-only historical checkout `/Users/alex/OpenAI-WebMCP/WebMCP_Challenge` contains the
  selected commit, but it is outside the active workspace authority and must not become an implicit
  dependency.

## Impact

The Receiver cannot currently establish the pinned Core source identity from the active workspace.
Therefore pinned conformance, release conformance, and any cross-project compatibility claim remain
open. This issue does not by itself prove a protocol or implementation defect, and it authorizes no
runtime or pin mutation.

## Resolution gate

The owner must choose one reviewed source boundary:

1. recover and explicitly supply the historical pinned source as a retrieval fixture with recorded
   identity; or
2. review the current domain-neutral Core checkout, update the Receiver pin and selected inventory,
   then rerun source identity, focused conformance, migration, and compatibility checks.

Do not replace the pin with `HEAD`, a branch, a package version, or a working tree without that
review. Close this issue only after the selected source is committed, the verifier passes, and
`Docs/00-current-status.md` is updated with the new evidence ceiling.
