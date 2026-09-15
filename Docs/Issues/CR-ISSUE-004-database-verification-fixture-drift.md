# CR-ISSUE-004 — Portable database fixtures and current-source upgrade verification

**Status:** Resolved in working changes — primary integration pending
**Owner:** Backend verification and migration rehearsal
**Verified:** 2026-09-07, Europe/London

## Accepted repair

The owner approved repairing the database fixture isolation and upgrade runner after the earlier
source-pin increment exposed two harness restrictions. The six standing suites hard-coded legacy
port/database pairs, both ports were occupied, and the upgrade runner selected seven migrations
while the current Receiver contained nine. No occupied service, migration SQL, service behavior,
production credential, or live database was changed to resolve this issue.

`disposable-postgres.py` creates a new loopback-only cluster with SCRAM authentication, a unique
`cr_test_` database, and private proof/credential files. It records and checks the empty database and
actual cluster identity. Its run wrapper sets every database alias explicitly and uses test-only
signing/control secrets. Stop verifies the owned cluster before shutting it down and retains files.

`disposable-database.cjs` replaces the six fixed-target guards with a stricter identity check:

- `NODE_ENV=test`, a bounded private regular proof file owned by the invoking user, and no symlink
  path redirection;
- a unique test database name, explicit loopback IPv4 address and port, a matching test user, no
  query/fragment overrides, no inherited PostgreSQL routing variables, and all six URL aliases equal;
- before suite writes, live database/user/address/port/data-directory/PostgreSQL system identity
  must match the provisioning proof.

This is a trusted local provisioner boundary, not cryptographic attestation against another process
running as the same OS user. A caller-supplied URL, familiar port, or proof without live identity is
insufficient. Existing listeners and remote databases remain outside this authority.

The upgrade runner retains exact committed-source/SQL/dependency checks and refuses a populated
upgrade database. It applies the six v0.1 migrations, seeds the preservation fixture, verifies the
standing migration preserves the complete original catalog, then applies the two reviewed additions.
It requires exactly the extra pairing-budget table, checks that it is empty, and compares every
original table's rows, columns, indexes, constraints, user triggers, ownership, ACLs and policies.
Preservation is checked before post-upgrade seeding and again after the six constraint probes.

## Executed evidence

[Validation and Evidence](../Core/05-validation-and-evidence.md) owns exact hashes, runtime, database
identities, snapshot identity and commands. Results:

- all six previously blocked suites: 38 tests pass;
- complete existing backend aggregate: 27 suites / 190 tests pass, none skipped;
- source, fixture and upgrade guards: 26 tests pass;
- shared standing conformance and fresh-process recovery: 2 scenarios pass;
- real nine-migration upgrade: 13 original tables and 10 baseline rows preserved, all SQL checksums
  match, six constraint tests pass; and
- type-check and build pass.

The upgrade ran against a locally committed copy of the working sources because the active Receiver
changes remain uncommitted. That isolated test snapshot is not the Receiver branch or a release.
All 121 tested source files were compared byte for byte against the working source afterward.

## Integration and reopen gate

Primary-session integration must preserve the source decision and fixture guards together, then
rerun the exact-source upgrade against the resulting Receiver commit. Reopen on changed migration
inventory/bytes, an unexpected additive catalog, changed proof/environment authority, or failed
preservation/identity checks. Real standing Consent HTTP/persistence coverage remains CR-TASK-005;
real Agent admission, Browser/Game continuation, deployment and release remain separate gates.
