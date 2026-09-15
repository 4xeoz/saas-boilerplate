# CR-TASK-002 — Run disposable database verification

**Status:** In progress — baseline and Consent coverage verified; integration pending
**Owner:** Backend verification boundary

## Outcome

Run the backend module, migration, race, restart, and standing conformance suites against one newly
provisioned disposable loopback PostgreSQL database and retain only redacted claim-level evidence.

## Current boundary

A portable fixture now checks private provisioning proof, all aliases, and live database identity.
All six previously blocked suites pass (38 tests), and the complete existing backend aggregate passes
28 suites / 203 tests after adding 13 Consent HTTP/persistence cases. A separate empty cluster passes the nine-migration upgrade against an isolated
committed copy of the working sources, preserving 13 original tables and 10 baseline rows. Shared
conformance, fresh-process recovery, type-check, and build also pass. Exact results belong to
[Validation and Evidence](../Core/05-validation-and-evidence.md); the harness contradictions belong to
[CR-ISSUE-004](../Issues/CR-ISSUE-004-database-verification-fixture-drift.md).

## Next gate

Integrate the working changes through the primary session and rerun the exact-source upgrade on that
Receiver commit. The isolated snapshot is local test evidence, not release identity. The added
[CR-TASK-005](CR-TASK-005-cover-standing-consent-handoff.md) HTTP/persistence coverage passes locally
and awaits primary review and integration; it does not establish hosted continuation.
