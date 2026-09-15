# Cloud Receiver 2 — Validation and Evidence

**Role:** Verification matrix and claim ceiling
**Status:** Integrated local backend baseline and exact-source upgrade pass; runtime, deployment, and
cross-project release remain open

## Historical local checks

The following checks were recorded against the Receiver implementation baseline
`4fa4ba312902d9ae70734e8b82305ba2e4924987` on branch `Re-Entry`. These are source-bound historical results, not a fresh run on every later
checkout:

| Check | Result | Claim supported |
|---|---|---|
| `npm run type-check` | Passed (backend and frontend) | Type-level consistency for the checked workspaces |
| `npm run build` | Passed (backend and frontend) | Production build compilation; not deployment proof |
| `node --test backend/conformance/standing-v0.2/source-pin.test.mjs` | Passed, 16 tests | Source-pin guard behavior in synthetic fixtures |
| `npm test -w backend -- --runInBand src/modules/standing/test/standing-consent-page.test.ts` | Passed, 6 tests | Standing Consent renderer behavior only; no HTTP, database, or hosted claim |
| `npm test -w backend -- --runInBand src/modules/consent/test/consent-page-http.test.ts` | Passed, 5 tests | Shared Consent and standing decision HTTP-boundary mapping with mocked services; no database or hosted claim |
| Pinned source readback at the recorded sibling baseline | Failed with `conformance_pin_commit_unavailable` | Historical source obstruction; superseded by the accepted source verification below |
| `npm test -w backend -- --runInBand` | Not run to completion; configuration exits because no database URL is configured | No database-backed test or release claim |

The executed runtime versions were Node `v26.5.0`, npm `11.17.0`, Next.js `16.3.0` in the frontend
build, and the repository package manager declaration is npm `10.9.2`. Node 24 remains the intended
reproducible conformance baseline; a different local runtime must not be silently presented as that
baseline.

The focused renderer and mocked HTTP suites were supplied a PostgreSQL-shaped local placeholder
solely because the shared Jest setup validates `DATABASE_URL`; these suites do not open a database
connection.

## Accepted source and 2026-09-07 working-change verification

Executed on 2026-09-07 after owner approval of current-source alignment and the portable database
fixture/upgrade repair. Receiver source was baseline `f1dc869a7c6e6056d4f9e9972f275770885b0c0b` on
`Re-Entry` plus the reviewed working changes. Service behavior, schema, migration SQL, and dependency
lock were unchanged. The changed code was test/conformance infrastructure; primary-session integration
was pending at that time. The current integrated readback follows below.

| Source identity | Value |
|---|---|
| Selected Core commit | `339acbcd664374235a4ab49b9152bf834b43c210` |
| Core selected-source SHA-256 | `8f4700c313a43795ac0877a268e14128accfb884c5366139adf424d257f03094` |
| Isolated test-source snapshot commit | `26b1a272056068f1a83c486ccfbe83731df9111f` |
| Tested Receiver source inventory SHA-256 | `85d26bb7d907084bb848311c5af23b814ffc731c5909ff2d562799230e3b888f` |
| `package-lock.json` SHA-256 | `3f4354370ec3fa4a965c8434c6e8dd3c80be238dcb6fa7c42747719ac8275314` |
| Nine-migration source inventory SHA-256 | `46b25516cf161681dd8da3f0dd72609386591a3ec8006f08bc8b7cd435cafe9e` |

The upgrade runner requires committed bytes. It ran in an isolated, locally committed copy of the
working sources; that commit is a **test snapshot**, not a Receiver branch commit or published
artifact. The active Receiver index was untouched. All 121 tested source files were compared byte
for byte with the snapshot after the run. Their hash concatenates sorted repository-relative paths,
NUL, bytes, and NUL: all non-Markdown files under `backend/src/`, `backend/prisma/`, and
`backend/conformance/`, plus root/backend package manifests, root lock, backend TypeScript/Jest/Prisma
configuration, and `shared/package.json`/`shared/index.d.ts`. The migration hash uses the same
algorithm on the nine sorted SQL paths. Core selected 12 governing documents and 59 package files.

Runtime: Node `v24.20.0`, npm `10.9.2`, PostgreSQL `16.12` (Homebrew), Prisma CLI/client `7.10.0`,
`pg` `8.22.0`, Next.js `16.3.0`, macOS `26.5.2` arm64. Existing installed dependencies were used;
the isolated snapshot linked those dependencies. No clean-install or registry-release claim follows.

The provisioner created separate empty loopback clusters with private proof files, unique
`cr_test_` database names, and generated test credentials. Baseline/concurrency/conformance used
`cr_test_feb050e4b1daefa0bc6a3fb4e0dff49c` at port `50521`, PostgreSQL system identifier
`7682777881901118811`. Upgrade used `cr_test_cc7564d84bd80ebbf1eff6e36707909c` at port `52169`,
system identifier `7682780723298786144`. All six aliases matched the selected database. The new
helper checked the proof and live database/user/address/port/data-directory/system identity before
suite writes. No existing service or runtime database was used. All task-created clusters were
stopped after verification; fixture files are retained.

| Executed check | Result | Maximum claim |
|---|---|---|
| Node tests: `source-pin.test.mjs`, `disposable-database.test.mjs`, `migration-upgrade.test.mjs` | 26/26 pass (16 source, 4 fixture, 6 upgrade guards) | Guard behavior, not a database upgrade by itself |
| Actual pinned source preflight and post-run source checks | Pass; source identity true, release conformance false | Exact selected Core identity |
| Existing nine migrations on the new baseline database | All applied successfully | Clean disposable installation |
| Six previously blocked standing suites, serial Jest | 6 suites / 38 tests pass | Real migration constraints, races, delivery profile and deterministic-authority handoff cases |
| `npm test -w backend -- --runInBand` | **27 suites / 190 tests pass**, no failures or skips | Complete existing backend test baseline on this disposable cluster |
| Node shared `receiver.test.mjs` and `fresh-process.test.mjs`, serial | 2/2 pass | Exact-Core standing Express/PostgreSQL scenario and killed-transaction rollback/committed Delivery recovery |
| Real `migration-upgrade.mjs` on the isolated committed snapshot | Pass, 9 completed migrations with matching SQL checksums; 13 original tables / 10 baseline rows preserved; 6 constraint tests pass | v0.1-to-current local upgrade preservation on the named source snapshot |
| `npm run type-check` | Backend and frontend pass | Type-level consistency |
| `npm run build` | Backend and frontend pass | Compilation/bundle only |
| Documentation links, language, diff and source-secret scan | 52 Markdown files / 150 local path links; no missing paths or leaked fixture credentials; `git diff --check` passes | Local documentation and change-scope consistency; no external URL availability claim |

Reproduce through [Verification/01](../Verification/01-standing-conformance.md), using the provisioner
wrapper for all database commands and exact Receiver commit/lock variables for upgrade. The upgrade
compares original rows/catalog before any post-upgrade seeding, requires exactly the reviewed
additional pairing-budget table, verifies that table remains empty, then rechecks preservation and
migration records after constraint probes. The baseline snapshot SHA-256 was
`2725c9a42c21e84c54675d12094cc4ce9fd5261e7f276c146ccbe3b1be9e0b56`.

The earlier 152-pass/32-fail result was blocked at legacy endpoint guards. Three suites previously
failed during module loading, so their actual six additional cases were absent from that count;
loading and running all suites produces 190 tests, not 184. No behavior assertion was removed to
obtain the passing result. PostgreSQL reports inet text with a `/32` suffix; the live-address check
uses `host(inet_server_addr())` while still requiring exact `127.0.0.1`. Expected injected readiness
and Event-transaction errors remain covered failures, not unhandled test failures.

At the time of this 2026-09-07 working-change record, the [fixture issue](../Issues/CR-ISSUE-004-database-verification-fixture-drift.md)
awaited primary integration; the test snapshot did not replace a Receiver branch commit. The
integrated readback below now covers that boundary. Independent runtime admission, actual same-task
wake, browser/page access, published SDK/Connector artifacts, mandatory release enforcement, hosted
deployment, and Game continuation remain open.

## Hardening evidence boundary

A retained local observation reports that the prepared SQL was executed transactionally on a
disposable PostgreSQL table/role fixture: existing tables gained RLS, client privileges were removed,
service-role access remained, and future tables received no client privileges. The retained account
does not provide an exact tested source revision, runtime, date, or replayable output artifact.
It is therefore historical supporting context, not reproducible current proof or live hardening
approval. Rehearse the [hardening runbook](../Operations/02-database-hardening.md) with exact source,
fixture identity, before/after ACL readback, and recorded results before raising that claim.
No live application of the migration is established by this record.

## Verification layers

1. **Static:** TypeScript, lint, schema/migration review, secret scan, and exact source inventory.
2. **Focused module:** Jest suites for authentication, pairing, consent, Events, Delivery,
   acknowledgement, standing transport, races, and portal ownership.
3. **Database/concurrency:** disposable PostgreSQL migration, lock-barrier, replay, restart, and
   source-pinned conformance suites.
4. **Process:** standalone listener, serverless handler, graceful shutdown, and fresh-process
   recovery under an explicitly disposable environment.
5. **Deployment:** platform identity, environment, migration history, health/readiness, rollback,
   and authenticated workflow readback.
6. **Consumer:** consumer-owned mapping, page capability, effect, and human-consequence evidence.

Passing a lower layer never raises a higher layer's status. A frontend screen, source interface,
green build, or synthetic fixture cannot claim hosted admission or end-to-end continuation.

## Required evidence record

For a retained release or runtime claim, record the exact Receiver and Core source identities, runtime
versions, database scope, command, result count, environment boundary, skipped layers, and reopen
gate. Never include credentials, raw tokens, connection strings, row dumps, or mutable logs.

## Open evidence rows

- Accepted Core source identity and local shared/process scenarios pass on Receiver commit
  `1ed853b481bb1b2b12f440b7172d3df89c22d822`; deployment and release remain open under
  [CR-ISSUE-001](../Issues/CR-ISSUE-001-core-pin-does-not-match-current-checkout.md).
- Clean Docker image builds fail to resolve the private workspace package; see
  [CR-ISSUE-003](../Issues/CR-ISSUE-003-docker-workspace-package-install.md).
- The current container entrypoint runs migrations at startup despite the intended separate release
  boundary; see [CR-ISSUE-002](../Issues/CR-ISSUE-002-container-startup-runs-migrations.md).
- The portable fixture, complete existing aggregate, and exact-source upgrade now pass on the
  integrated commit. Deployment and release remain open. See
  [CR-ISSUE-004](../Issues/CR-ISSUE-004-database-verification-fixture-drift.md).
- Focused standing renderer and mocked HTTP-boundary tests cover bounded pending/terminal output,
  Connector availability, Host-controlled field escaping, login continuation mapping, standing
  dispatch mapping, expiry response mapping, same-user decision field mapping, Receiver-origin
  rejection, and exact popup-origin/session renderer messaging. The shared `/consent?token=...` route
  now has 13 real HTTP/database integration cases, described below; real-browser and hosted
  continuation remain pending under [CR-TASK-005](../Tasks/CR-TASK-005-cover-standing-consent-handoff.md).
- The expanded control-plane shell proposal has no accepted lifetime, redaction, custody, or
  public revocation contract.
- No current deployment readback in this repository proves a public release or consumer continuation.


## Standing Consent HTTP/database evidence — 2026-09-07

Receiver working changes based on `f1dc869a7c6e6056d4f9e9972f275770885b0c0b`, branch `Re-Entry`,
add `backend/src/modules/consent/test/standing-consent-http.integration.test.ts` with SHA-256
`0504ffc255ac0739d0d894affc4558678de462f5a7f3f49abc1f04874b5908da`. This test is not part of the earlier 121-file upgrade snapshot; that snapshot's
identity and 190-test baseline above retain their original scope.

With Node v24.20.0, npm 10.9.2, and an owned PostgreSQL 16.12 loopback cluster at port 56159,
database `cr_test_2894fc4c4ced6b08f7959665601a4207`, all nine migrations applied successfully.
`npm test -w backend -- --runInBand` passed **28 suites / 203 tests**, including the new **13 cases**.
The focused 13-case run and backend/frontend `npm run type-check` also passed. Production source,
dependencies, schema, and migrations were not changed by this test increment; the prior build and
upgrade results are retained, not represented as rerun for this increment.

The first aggregate attempt passed 202/203; the durable pairing-budget test failed. The new suite's
fixed source IP could collide with the existing suite's source range. It now uses a random isolated
IPv6 documentation address; the complete aggregate passed on a freshly provisioned cluster. No
rate-limit rule or assertion was weakened, and neither cluster's data was deleted.

Real HTTP coverage includes signed v0.1/v0.2 enrollment and namespace dispatch, real login cookies,
Connector eligibility, token non-echo, persisted expiry, Origin checks, approval replay/conflicts,
and decline without Grant creation. Pending tokens are not User-prebound; wrong-account coverage
means foreign Connector selection and terminal decision replay. The served popup script executes
with simulated browser objects and real decision HTTP/database effects, asserting the exact public
session/status payload and Host origin. This is not a real-browser, hosted, runtime-admission,
same-task wake, or Sleepless Kingdom continuation claim. Primary-session review/integration were
required at execution time; Receiver commit `1ed853b481bb1b2b12f440b7172d3df89c22d822` now
integrates this increment. No deployment or public release was performed.

## Integrated Receiver commit readback — 2026-09-15

The reviewed working changes were integrated as Receiver commit
`1ed853b481bb1b2b12f440b7172d3df89c22d822` on branch `Re-Entry`. The commit carries the accepted Core
pin `339acbcd664374235a4ab49b9152bf834b43c210`, the selected source inventory, the portable fixture,
the migration guards, and the real Consent HTTP/persistence coverage. It is a committed local
integration result, not a deployment or published release.

With Node `v24.20.0`, npm `11.19.0`, and PostgreSQL `16.12`, a newly provisioned loopback fixture
applied all nine migrations and the full backend aggregate passed **28 suites / 203 tests**. The
shared standing scenario and fresh-process recovery passed **2/2**, and the production backend and
frontend build passed. The source, fixture, and migration guard suites passed **26/26**; backend and
frontend type-check also passed. No runtime or hosted database was used.

The exact-source upgrade then ran against the same Receiver commit with dependency lock SHA-256
`3f4354370ec3fa4a965c8434c6e8dd3c80be238dcb6fa7c42747719ac8275314`. It passed on Node `v24.20.0`
and PostgreSQL `16.12`: all nine migration checksums matched, 13 original tables and 10 baseline
rows were preserved before post-upgrade probes, the reviewed additive pairing-budget table remained
empty, and all six constraint tests passed. The result explicitly reports
`release_conformance_verified: false` and `production_migration: false`.

This readback closes the Receiver source/integration and local database evidence gates. It does not
prove deployment, live migration authority, public package publication, provider-owned admission,
real Browser/Agent continuation, or Sleepless Kingdom consumer continuation.
