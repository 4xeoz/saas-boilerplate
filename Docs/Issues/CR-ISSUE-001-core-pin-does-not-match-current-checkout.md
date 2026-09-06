# CR-ISSUE-001 — Core pin does not match the active sibling checkout

**Status:** Open
**Owner:** Receiver conformance and release boundary
**Observed:** 2026-09-05, Europe/London

## Evidence

- `backend/conformance/standing-v0.2/core-pin.json` selects Core commit
  `1446d73aa3e66533547471728ad8fa5344d51f9e`.
- The active sibling checkout at `/Users/alex/Re-Entry/reentry` is at
  `8a9ac315872fe04a17820e46f4d01a2bfbb8977b`.
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
