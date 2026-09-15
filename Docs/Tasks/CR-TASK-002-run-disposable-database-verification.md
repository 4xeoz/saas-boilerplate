# CR-TASK-002 — Run disposable database verification

**Status:** Locally integrated — baseline, Consent coverage, and exact-source upgrade verified; deployment pending
**Owner:** Backend verification boundary

## Outcome

Run the backend module, migration, race, restart, and standing conformance suites against one newly
provisioned disposable loopback PostgreSQL database and retain only redacted claim-level evidence.

## Current boundary

A portable fixture now checks private provisioning proof, all aliases, and live database identity.
All six previously blocked suites pass (38 tests), and the complete existing backend aggregate passes
28 suites / 203 tests after adding 13 Consent HTTP/persistence cases. The exact nine-migration
upgrade passes against integrated Receiver commit `1ed853b481bb1b2b12f440b7172d3df89c22d822`,
preserving 13 original tables and 10 baseline rows before constraint probes. Shared conformance,
fresh-process recovery, type-check, and build also pass. Exact results belong to
[Validation and Evidence](../Core/05-validation-and-evidence.md); the harness contradictions belong to
[CR-ISSUE-004](../Issues/CR-ISSUE-004-database-verification-fixture-drift.md).

## Next gate

Run the deployment/release preflight against this integrated source. The local result does not
establish hosted continuation, deployed migration authority, or public release identity.
