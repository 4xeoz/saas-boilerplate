# Standing v0.2 Receiver verification

This directory adapts one shared Re-entry Core scenario to the active Receiver.
It does not copy the scenario or import Core authority into the production
Receiver. The scenario, Host SDK, Connector, and Agent Adapter are test-only
imports from the explicitly selected Core checkout.

## Receiver source and upgrade closure: 2026-09-03

Status: **Receiver source committed locally; exact-commit upgrade rehearsal
and minimum Core-pinned trace passed; full release conformance remains open**.
This section supersedes the earlier source-status snapshots below. The user
authorized review, bounded corrections, disposable migration verification, and
local Git closure on the existing `Re-Entry` branch, without push or deployment.

The later [post-writeback exact-pin refresh](#post-writeback-exact-pin-refresh-2026-09-03)
records the current Core pin and rerun after parent documentation commits.

Receiver implementation commit:
`9156e68fe9b988f2ec7423d1c93930da3a105d4e` (28 exact owned paths).
The subsequent evidence-only update changes no executable, schema, migration,
dependency, or Core-pin bytes. The shared Express/PostgreSQL trace was rerun
after the source commit and reported that exact Receiver identity, verified Core
identity, and explicitly unverified release conformance.

The source review found and corrected two P2 issues:

- Absolute-form HTTP request targets could bypass the standing pre-parser,
  pre-CORS, and no-store boundary. The raw target allowlist is unchanged;
  Express's parsed path now selects rejection policy only. Two regressions
  initially failed, then passed across six absolute-form aliases each; the
  focused transport suite passes 18/18. Independent raw HTTP probes confirmed
  valid v0.2 and retained v0.1 behavior.
- The ordinary migration suite upserted its v0.1 fixture before checking it.
  That checks post-migration compatibility, not preservation across an upgrade.
  The new [exact-source upgrade rehearsal](migration-upgrade.mjs) seeds once
  between the six baseline migrations and the seventh standing migration, then
  compares all existing v0.1 rows and catalog definitions before any further
  fixture setup. The shared seeder is test-only, not a production repair path.

Node `v24.20.0` / npm `10.9.2` verification passed 21 backend suites / 156 tests,
root type-check and build, source-pin fixtures 16/16, and the real pinned
Express/PostgreSQL shared trace 1/1. The trace still reports
`release_conformance_verified: false`. Core pin
`28d74e589b16e43f167aa82652220b7b182502d1` and selected-source SHA-256
`5eb4c8c2a94e79b4da68616c921f7d996f53545ce18d559424a908e6b480b73b`
are unchanged. An isolated exact-commit Core checkout avoids the unrelated Game
commit now present on shared `main`; no source check was weakened.

The actual exact-commit upgrade rehearsal passed on a new, independently
verified disposable PostgreSQL `16.14` instance at
`127.0.0.1:55433/reentry_closure`, using only task-owned tmpfs state:

- six committed baseline migrations applied, then the v0.1 fixture was seeded;
- the seventh committed migration applied; all seven stored checksums matched;
- 13 existing table definitions and all 10 fixture rows matched before/after,
  checked before any post-upgrade seeding and again after the constraint probes;
- all six reused migration constraint tests passed, without skipped tests;
- baseline snapshot SHA-256:
  `5b3521a28cd21d395436c7c14a6fc7c3851967ccc98f5f0737f35b5cc0daf292`;
- migration SQL SHA-256:
  `e707a57e7b7330428ba96d0212bfc75516df26ea583904674996d739f70843c1`;
- upgrade guard/record tests passed 5/5; Prisma schema validation passed; and
- 28 staged files passed scoped Markdown/link, English, sensitive-pattern,
  committed-byte, and whitespace checks. The dependency lock was unchanged.

Local migration workspaces, regression fixtures, and the two disposable
databases are retained; no reset or deletion was performed. Fixture snapshots
and credentials are not tracked. The existing Next.js middleware deprecation
warning remains outside this backend increment.

No schema SQL, dependency, lifetime policy, accepted protocol, public control,
Game, or production deployment change was required by review. An internal
inspection can read Grant and active-Delivery state across different instants;
its public snapshot contract remains an explicit control-plane design/test item
in [the proposal](../../src/modules/standing/CONTROL-PLANE-PROPOSAL.md).

### Post-writeback exact-pin refresh: 2026-09-03

Parent documentation commits after the original pin changed three files inside
the selected Core/spec inventory. The first pinned Receiver run therefore
stopped before database access with the expected
`conformance_source_commit_mismatch`. After reviewing those bytes, the fixed
pin was advanced to Core commit `84f5082c5701c7a2bb4d233b511134898434a249`.

The refreshed pinned checks passed as follows:

| Check | Result | Claim limit |
| --- | --- | --- |
| Source-pin fixture suite | 16/16 passed | Fixed Core source identity and drift fencing |
| Upgrade guard/record suite | 5/5 passed | Exact endpoint, source/lock inputs, and migration-record failures |
| Pinned real Express/PostgreSQL standing trace | 1/1 passed | Core source identity plus the minimum shared two-signal trace |
| Full backend aggregate | 21 suites / 158 tests passed, no skips | Local Receiver regression and standing profile; not full release conformance |

The trace ran on Node `v26.5.0` against the task-owned loopback baseline and
reported:

```json
{
  "mode": "pinned",
  "profile": "standing-authorization-v0.2",
  "core_commit": "84f5082c5701c7a2bb4d233b511134898434a249",
  "core_source_sha256": "6c7688a074c3d99bca6cba1945b79200db4b8f4b0455edef55f2f3659095cb65",
  "source_identity_verified": true,
  "release_conformance_verified": false,
  "receiver_commit": "7faf527aca7710a26ee03c2c4beec0e2c7edf8c0",
  "node": "v26.5.0"
}
```

Receiver commit `7faf527` contains the browser logout protection increment;
the subsequent pin-only commit is `1368741`. The logout change does not alter
the standing protocol, schema, migration, or conformance implementation. The
full aggregate and pinned trace are local evidence only; public controls,
fresh-process recovery, release enforcement, production effect authority,
deployment, and hosted readback remain open.

### Rehearsal command and limits

Provision and verify a **new empty disposable PostgreSQL database** at exactly
`127.0.0.1:55433/reentry_closure`. It is separate from the retained regression
database at port 55432. Set `NODE_ENV=test`, provide its credential only through
`STANDING_UPGRADE_DATABASE_URL`, select the full reviewed Receiver commit in
`STANDING_MIGRATION_RECEIVER_COMMIT`, and set
`STANDING_MIGRATION_LOCK_SHA256` to the reviewed dependency-lock SHA-256 below.
Run with Node 24 from this repository:

```sh
node --test backend/conformance/standing-v0.2/migration-upgrade.test.mjs
node backend/conformance/standing-v0.2/migration-upgrade.mjs
```

The rehearsal refuses a populated database; it never resets, deletes, or repairs
existing data. It validates selected source bytes against the named commit,
applies committed SQL through Prisma in two stages, verifies all seven applied
checksums, compares v0.1 data/catalog before any post-upgrade seeding, and then
runs the six constraint probes. It retains its temporary migration workspace
and local fixture snapshots for inspection. On failure, preserve that evidence
and diagnose the named stage rather than retrying against populated state.

The v0.1 catalog comparison excludes internal triggers added by the intended new
foreign keys. Standing `RESTRICT` references can prevent deletion of referenced
existing accounts, organizations, or Connectors; unchanged old rows/DDL does not
mean unchanged parent-deletion behavior. Actual deployed-role access, tested
application rollback, forced multi-row failure, fresh-process crash recovery,
the full shared v0.1/v0.2 matrix, and CI/release enforcement remain open under
TASK-028. Public controls and lifetime remain separate TASK-027/TASK-033 gates.

## Prior local source-pin result: 2026-09-03

Status: **Core source identity and minimum real-store trace locally verified;
Receiver source closure and full release conformance remain open**.

The fixed [Core pin](core-pin.json) now selects
`28d74e589b16e43f167aa82652220b7b182502d1`. Parent local commits are:

- `abcbbaa6df8168e8d62f6cb95aca700968759df9`: 36 documentation/accepted-contract files;
- `58d8d71b2508084cf749e3d618d5ce5ae3feec51`: 31 Core/compatibility-consumer files; and
- `28d74e589b16e43f167aa82652220b7b182502d1`: eight owning evidence/status files.

The last commit changes no selected Core/spec bytes. The pin was explicitly
advanced after that commit and the actual `pinned` runner was rerun, not assumed
green from the preceding source commit. At final HEAD it passed 1/1 through real
Express/PostgreSQL and reported:

```json
{
  "mode": "pinned",
  "profile": "standing-authorization-v0.2",
  "core_commit": "28d74e589b16e43f167aa82652220b7b182502d1",
  "core_source_sha256": "5eb4c8c2a94e79b4da68616c921f7d996f53545ce18d559424a908e6b480b73b",
  "source_identity_verified": true,
  "release_conformance_verified": false,
  "receiver_commit": "6b4826f68bb3634d004c49259d9c5311c660d997",
  "node": "v24.20.0"
}
```

The Core loopback/SQLite shared scenario also passed 1/1 at the final commit.
Fresh pre-commit verification passed Core 153/153, Connector 49 with 12 explicit
external-suite skips, reference-system 2/2, application-demo 2/2, and source-pin
fixtures 16/16 on Node 24 / npm 10.9.2. Core package checks retained zero runtime
dependencies and 19 files. The earlier backend 154-test, type-check/build, and
migration-test results remain prior evidence, not reruns in this pin-only step.

Receiver `Re-Entry` remains based on `6b4826f68bb3634d004c49259d9c5311c660d997`.
Its standing implementation, migration, conformance tooling, pin, and this record
remain local and uncommitted. The bounded source delta is the four tracked files
`backend/prisma/schema.prisma`, `backend/src/app.ts`,
`backend/src/middleware/protocol-transport.ts`, `backend/src/routes/index.ts`, plus
`backend/src/modules/standing/`, `backend/conformance/standing-v0.2/`, and the
standing migration directory. The Core pin does not attest this Receiver delta.

Dependency lock SHA-256 remains
`3f4354370ec3fa4a965c8434c6e8dd3c80be238dcb6fa7c42747719ac8275314`;
standing migration SQL SHA-256 is
`e707a57e7b7330428ba96d0212bfc75516df26ea583904674996d739f70843c1`.
Readback of the verified disposable PostgreSQL 16 instance at
`127.0.0.1:55432/reentry_baseline` showed all seven migrations finished:

- `20260902000000_init_cloud_receiver_2_auth`;
- `20260902010000_pairing`;
- `20260902020000_consent_targeting`;
- `20260902030000_signed_event_ingress`;
- `20260902040000_delivery_claim_lease`;
- `20260902050000_delivery_acknowledgement`; and
- `20260903193000_standing_authorization_v02`.

No production database, branch creation, push, publication, or deployment was
performed. Parent commits include no Game/RightSpot paths. Staged documentation
and source governance checks passed after fixing TASK-033's filename/headings;
the full parent scanner still reports 21 pre-existing Game artifact-name matches.
No clean CI or whole-repository security gate is claimed. TASK-028 owns Receiver
source/migration closure and the full matrix/release gate; TASK-027/TASK-033 own
the separate lifetime and public-control decisions.

The verifier requires checkout HEAD to equal this exact pin. A later Game-only
commit on shared `main` also changes HEAD and intentionally fails that check;
use an exact-commit source checkout or a separately reviewed updated pin, never
a floating branch or a weakened check. The evidence above remains for the named
commit. Shared-main pushes would publish these local-only ancestors and require
separate user authorization.

The snapshots below are historical. Their missing-pin and uncommitted-Core
statements describe earlier steps, superseded by this section; their Receiver
working-tree and broader non-production limits still apply.

## Historical local verification snapshot: 2026-09-03

Status: **locally verified working-tree increment, not release closure**.

- Runtime: Node `v24.20.0`, npm `10.9.2`, disposable PostgreSQL 16.
- Receiver branch: `Re-Entry`; base commit:
  `6b4826f68bb3634d004c49259d9c5311c660d997`. The standing increment is uncommitted.
- Core HEAD observed for the final shared run:
  `4a71866ac1a5735b22d4931b0d7f555fa2ba306d`.
- Core source fingerprint:
  `4562c7f6ff34883add69b3794cd73c82fa66ef228806ebf51556cd566c1b0ce0`.
  This covers the shared scenario and sorted Core `src/*.mjs` files. Relevant
  standing source files are untracked in that checkout, so HEAD alone does not
  reproduce the tested source. The runner checks the fingerprint before and
  after that development scenario. The source-preflight increment below now
  refuses an unpinned run by default; this historical hash is not an accepted pin.
- Dependency lock SHA-256, unchanged from the baseline:
  `3f4354370ec3fa4a965c8434c6e8dd3c80be238dcb6fa7c42747719ac8275314`.

| Check | Result | Boundary |
| --- | --- | --- |
| Baseline backend | 14 suites / 56 tests passed | Existing behavior before the standing increment |
| Final backend | 21 suites / 154 tests passed; no skips | Existing 56 tests plus 98 standing tests |
| Root type-check | Passed | Backend and frontend |
| Root build | Passed | Backend TypeScript and frontend production build |
| Prisma validation and migration | Passed | Six baseline migrations, then the additive seventh migration, on the disposable database only |
| Shared standing scenario | 1 passed | Actual Express and PostgreSQL; one human Consent decision and two acknowledged signals |
| Dependency audit at baseline | 8 findings: 3 moderate, 5 high | Retained dependency debt; no dependency upgrades or audit-fix command in this increment |

The migration suite checks retained v0.1 rows, schema isolation, constraints,
backend-only access, and actual rejection of a Grant key-pin update. Deterministic
lock-barrier suites cover expiry during waits, Host-key replacement/revocation,
Connector loss, concurrent approvals and Event acceptance, and ACK/revocation
ordering. The active delivery profile covers three attempts, retired claim
tokens, terminal exhaustion, and a subsequent Event without a fourth attempt.

## Reproduction

Use Node 24 and the repository's pinned npm version. From the Receiver repository
root, first provision and verify a dedicated disposable PostgreSQL instance; do
not use the application runtime database or an existing shared local database.
The Jest fixture guards require `127.0.0.1:55432/reentry_baseline`. Supply the
connection credential through the local environment, never a tracked file.

Set `NODE_ENV=test`, then explicitly assign all of the following URL variables
to that same verified disposable database before migration or tests:

- `DATABASE_URL`
- `DIRECT_URL`
- `CLOUD_RECEIVER_RUNTIME_DATABASE_URL`
- `STANDING_MIGRATION_TEST_DATABASE_URL`
- `STANDING_RACE_TEST_DATABASE_URL`
- `STANDING_CONSENT_CONCURRENCY_TEST_DATABASE_URL`

Also set `REENTRY_CONFORMANCE_ROOT` to the absolute Git root of the intended Core
checkout containing `reentry-core/conformance/standing-v0.2/scenario.mjs`.
The shared runner rejects missing configuration, non-loopback URLs, and URL
query/fragment overrides; the caller still owns verifying that the database is
disposable. It fences all runtime database aliases before loading the app.

```sh
npx --yes npm@10.9.2 ci
npx --yes npm@10.9.2 run db:migrate -w backend
npx --yes npm@10.9.2 run test -w backend -- --runInBand
npx --yes npm@10.9.2 run type-check
npx --yes npm@10.9.2 run build
node --test backend/conformance/standing-v0.2/source-pin.test.mjs
node --test backend/conformance/standing-v0.2/receiver.test.mjs
REENTRY_CONFORMANCE_MODE=development node --test backend/conformance/standing-v0.2/receiver.test.mjs
```

Do not run another database-writing test process against this instance while the
Consent concurrency suite is active: a short table lock is part of its proof.
Standing tests retain their uniquely named fixture rows. Migration constraint
probes roll back their own transactions; they do not reset the database.

## Committed-source preflight

The runner defaults to `pinned` mode. Before importing Core or Receiver code or
opening a database connection, it requires a fixed repository-local pin at
`backend/conformance/standing-v0.2/core-pin.json` with exactly these fields:

- `schema_version`: `1`;
- `profile`: `standing-authorization-v0.2`;
- `core_commit`: the complete 40-character lowercase Git commit identity.

The current fixed pin names the reviewed Core commit above, which contains the
entire required source and governing contract. Do not replace it with an
unreviewed observed HEAD, branch/tag, package version, or content digest. Every
pin change requires review of the exact source followed by a new pinned run.

The verifier checks the full recursive `reentry-core` inventory plus ADR-0043,
ADR-0044, ADR-0045, and Mechanisms 01-03. It verifies required files exist in the
commit and actual file bytes equal the committed blobs, rejects unexpected or
missing source and symlinks, and repeats verification after the scenario. Git
replace objects and inherited repository-routing environment variables cannot
redefine the selected source. Keep generated/ignored files out of this exact
source checkout; the verifier does not delete or hide them.

`REENTRY_CONFORMANCE_MODE=development` is an explicit local-development mode,
never a fallback. It fingerprints the same scope before and after the run but
reports both `source_identity_verified: false` and
`release_conformance_verified: false`. Its expanded source fingerprint is not
directly comparable to the earlier flat-source historical hash above.

In pinned mode a successful preflight reports only `source_identity_verified`.
The complete v0.1/v0.2 matrix, real reference and active stores, production lease
profile, exact Receiver commit/lock/migration identities, and mandatory CI/release
enforcement are separate remaining gates. An explicitly green development run or
pure source-verifier test cannot satisfy them. No workflow, branch protection,
package publication, or deployment setting is changed by this increment.

### Source-preflight verification: 2026-09-03

- Node `v24.20.0`: `source-pin.test.mjs` passed 16/16 tests. Fixtures include
  missing/malformed pins, an uncommitted scenario at a real HEAD, changed/missing
  source, symlinks, replacement objects, post-run drift, and actual entry-point
  refusal before database configuration or imports.
- The actual default runner exited with `conformance_pin_missing` before
  database setup. This is the expected blocking result, not a conformance pass.
- Explicit development mode passed the real Express/PostgreSQL shared scenario
  (1/1). Its expanded source fingerprint was
  `11aa6b70ac66f268e43570482226f92e87e536a51af32a456573e390571c2910`;
  Core and Receiver HEADs remained the identities recorded above.
- Native syntax checks passed for the verifier, its test, and the Receiver
  wrapper. The dependency lock is unchanged. No production code, schema, or
  migration changed in this source-preflight increment; the earlier 154-test,
  type-check, and build results are retained evidence, not newly rerun counts.
- Parent governance validator/scanner unit tests passed 6/6 and 3/3; repository
  documentation/link/shape validation passed without staging owner-held work. The full
  parent secret scanner still reports the 21 previously recorded Game artifact
  filename matches; no scanner or Game file was changed to suppress them.

All sources remain local and uncommitted. Synthetic Git repositories and standing
database fixtures are retained for inspection; this increment performs no
production migration, source commit, push, publication, or deployment.

### Source-owner review rerun: 2026-09-03

Core review corrected reference time/authority resolution before the SQLite
writer lock and tightened the shared scenario's exact approval, acceptance, and
acknowledgement responses. Core verification passed 153/153 tests, including
20 deterministic transaction-boundary regressions and 21 response-oracle tests;
the real reference transport trace also passed. Oracle fixtures do not count as
an independent Receiver implementation.

The active Receiver backend was rerun on the same verified disposable
PostgreSQL instance: 21 suites / 154 tests passed, no skips. The strengthened
shared scenario then passed 1/1 in explicit development mode with:

- Core observed HEAD: `694f8450bcb65b2d70c5f82d365a9ff50effc10d`;
- selected-source SHA-256:
  `5eb4c8c2a94e79b4da68616c921f7d996f53545ce18d559424a908e6b480b73b`;
- Receiver HEAD: `6b4826f68bb3634d004c49259d9c5311c660d997`; and
- `source_identity_verified: false`, `release_conformance_verified: false`.

No production Receiver code, migration, or dependency lock changed in this
review. The earlier type-check/build results are retained, not newly rerun.
The parent source and mixed standing/application-selection documents are still
uncommitted while their exact local commit scope is resolved. The fixed pin
remains absent. Neither the moved parent HEAD nor the working-source hash is
substituted for a reviewed committed source. Parent CLOUD-023 owns that gate;
public controls and deployment remain out of scope.

The source-pin fixture suite was rerun at 16/16 passed; the real default runner
again refused `conformance_pin_missing` before database setup. All 24 modified
or untracked Receiver candidates passed scoped markdown/link, English, and
sensitive-pattern checks; whitespace and the recorded lock identity were
unchanged. Parent candidate validation additionally found a TASK-033 filename
grammar violation not covered by the normal index-only check; exact rename and
mixed-document commit scope remain pending. The full parent scanner retains the
same 21 Game artifact filename findings. No full repository gate pass is claimed.

## What the shared run does and does not prove

The adapter seeds only prerequisite account, organization, pairing, Connector,
and Host-key records. It does not pre-seed standing Consent, Grant, Event,
Delivery, or attempt rows. Consent and control calls use the same-account typed
service seam because a public standing Consent/control shell is not implemented.
Event, claim, and acknowledgement use the real `/v0.2` HTTP surface.

The Host-effect authority is a separate deterministic test authority, not the
production game or an Agent's self-report. The restart step reconstructs the app
and reconnects Prisma in the same process; it is not fresh-process crash,
power-loss, or deployment recovery evidence. Lock-barrier and delivery-profile
tests provide additional implementation checks, not a substitute for the full
mandatory cross-repository failure and release gate.

No new public consent/control routes, lifetime policy, production effect
authority, Connector capability selection, rate/quota policy, Game integration,
or deployment is included. TASK-027, TASK-028, and TASK-033 remain open in the
owning project. Parent canonical status and remote release records must be
reconciled at the cross-repository integration gate; this local test record does
not close or overwrite those collaborator-owned surfaces.
