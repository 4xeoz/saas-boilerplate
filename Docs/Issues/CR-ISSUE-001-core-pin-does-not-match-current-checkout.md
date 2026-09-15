# CR-ISSUE-001 — Accepted Core source boundary and remaining compatibility closure

**Status:** Open — source mismatch resolved locally; integration and complete compatibility pending
**Owner:** Receiver conformance and release boundary
**First observed:** 2026-09-05, Europe/London
**Last verified:** 2026-09-07, Europe/London

## Accepted current source boundary

On 2026-09-07 the owner approved current-source reconciliation after reviewing the candidate pin,
selected document inventory, source preflight, and guard results. The active Receiver selection now
uses the immutable [Core commit](https://github.com/Alex0158/Re-Entry/commit/339acbcd664374235a4ab49b9152bf834b43c210)
`339acbcd664374235a4ab49b9152bf834b43c210`; the repository URL identifies the counterpart source, not
an independently verified public release.

The accepted inventory selects ADR-1002/1003/1004, all five Mechanism documents, Core/02–05, and the
entire recursive `reentry-core` source tree. The verifier's `SPEC_PATHS` is the exact path inventory.
The semantic mapping below was reviewed; this is not a three-file rename or a documentation-only
compatibility assumption. Byte, recursive-inventory, symlink, Git-replacement, routing-variable,
fixed-pin, and post-run drift guards remain intact.

The applied two-file Receiver change passes exact Core identity, 16 source-guard tests, the shared
standing scenario over Express/PostgreSQL, and fresh-process transaction rollback/Delivery recovery.
[Validation and Evidence](../Core/05-validation-and-evidence.md) owns exact Receiver working-source
hashes, runtime, database scope, counts, and the release ceiling. The existing database matrix and snapshot upgrade
now pass locally; fixture implementation and integration limits are recorded in [CR-ISSUE-004](CR-ISSUE-004-database-verification-fixture-drift.md).

## Historical evidence — superseded source selection

- Before the accepted change, `backend/conformance/standing-v0.2/core-pin.json` selected Core commit
  `1446d73aa3e66533547471728ad8fa5344d51f9e`.
- Source preflight baseline: Re-entry `main` at
  `f23b8b5d988ca6041feaa561b6517cc93e897fe9`, Receiver `Re-Entry` at
  `9756b08b12d8716d932c2329d7cd7046548aa93d`, reviewed on 2026-09-07 with Node 24.13.1.
  These are tested source identities, not moving checkout labels. The preflight is reproducible
  through [Verification/01](../Verification/01-standing-conformance.md#source-preflight-without-a-database).
- `git cat-file -t 1446d73aa3e66533547471728ad8fa5344d51f9e` fails in the active sibling checkout.
- Running the Receiver source verifier against that checkout returns
  `conformance_pin_commit_unavailable` before any database or protocol import.
- A direct readback of the explicit `development` mode against the same active checkout on
  2026-09-07 also fails closed with `conformance_source_missing`: the verifier's fixed
  `SPEC_PATHS` still requires the three historical ADR paths listed below, and none exists in the
  current checkout. Therefore development mode cannot currently produce even its non-release
  working-checkout fingerprint for this source layout; it is not a fallback or a release claim.
- The [retrieval-only historical WebMCP repository](https://github.com/Alex0158/OpenAI-Web-MCP-Challenge)
  contains the selected commit, but it is outside the active workspace authority and must not
  become an implicit dependency.
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
- A historical tree comparison on 2026-09-06 against Core implementation baseline
  `90d75e5efa8d8ac403552abc2bda464d823c56ae` shows this was not documentation-only drift:
  the pinned checkout contains 53 `reentry-core` files, while the active checkout contains 59;
  six files are new and 12 common files differ. The active delta includes runtime-admission and
  notification-handoff modules, schema version 7 (the pinned source is version 6), and expanded
  standing authorization, HTTP, store, and fresh-process coverage. This is a `CODE-AHEAD`
  conflict at the source boundary, in addition to the historical documentation-inventory mismatch.

## Current impact

The historical source-identity obstruction is resolved by the accepted working change. The named
local standing and process scenarios now run against that exact Core source. This does not establish
complete v0.1/v0.2 compatibility, a committed Receiver release, published SDK/Connector compatibility,
production admission, or Game continuation. The current source must not silently follow a later
checkout or accept an unrelated inventory change.

## Remaining resolution gate

The owner chose the reviewed current-source option; historical recovery is no longer the pending
decision. Keep the accepted pin and inventory together during primary-session integration, preserve
the source-bound evidence, and rerun exact-source upgrade against the integrated Receiver commit through CR-TASK-002.
Reopen source selection only when the chosen revision, normative inventory, exact bytes, or consumer
compatibility requirement changes. No deployment, live migration, publication, credential change,
or push is authorized by this source decision.
