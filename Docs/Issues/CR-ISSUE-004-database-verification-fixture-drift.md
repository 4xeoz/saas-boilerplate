# CR-ISSUE-004 — Portable database fixtures and current-source upgrade verification

**Status:** Resolved and integrated in Receiver commit `1ed853b` — deployment and release pending
**Owner:** Backend verification and migration rehearsal
**Verified:** 2026-09-15, Europe/London

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

The initial upgrade ran against a locally committed test snapshot because the Receiver changes were
then uncommitted. That historical snapshot is not the Receiver branch or a release. The integrated
commit now has its own exact-source upgrade readback recorded below.

On 2026-09-15, the exact upgrade ran against Receiver commit
`1ed853b481bb1b2b12f440b7172d3df89c22d822` with dependency lock SHA-256
`3f4354370ec3fa4a965c8434c6e8dd3c80be238dcb6fa7c42747719ac8275314`. Node `v24.20.0` and
PostgreSQL `16.12` applied all nine migrations, preserved 13 original tables and 10 baseline rows
before post-upgrade probes, verified all migration checksums, and passed all six constraint tests.
The runner reported `release_conformance_verified: false` and `production_migration: false`.

## Integration and reopen gate

The source decision and fixture guards are integrated in Receiver commit `1ed853b`, and the exact
source upgrade passes against that commit. Reopen on changed migration inventory/bytes, an unexpected
additive catalog, changed proof/environment authority, or failed preservation/identity checks. Real
standing Consent HTTP/persistence coverage is integrated; real Agent admission, Browser/Game
continuation, deployment and release remain separate gates.
