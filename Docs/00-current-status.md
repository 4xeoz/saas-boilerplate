# Cloud Receiver 2 — Current Status

**Role:** Canonical service-state and claim ledger
**As of:** 2026-09-15, Europe/London
**Status:** Active Receiver development; the reviewed Core source identity, shared standing scenario,
fresh-process recovery, all 203 backend tests including Consent HTTP/persistence, exact-source
nine-migration upgrade, and static/build checks pass on the integrated local commit; deployment,
runtime, and release remain open

## Current verified state

The service is a separately deployable Express/Prisma backend with a Next.js frontend, PostgreSQL
persistence, typed user/developer sessions, Connector pairing, consent and target binding, signed
Event ingress, Delivery leases and acknowledgement, service health, and an additive standing
authorization v0.2 path.

- The v0.1 compatibility surface remains distinct; v0.2 routes do not negotiate or silently fall
  back to v0.1.
- Standing Event acceptance, sequence/replay rules, Delivery claim/reclaim limits, effect-backed
  acknowledgement, and notification-handoff authority are implemented behind explicit boundaries.
- The owner accepted the current Core source boundary. Receiver commit
  `1ed853b481bb1b2b12f440b7172d3df89c22d822` carries the reviewed pin and governing inventory;
  exact source verification, the shared standing scenario over Express/PostgreSQL, and the
  fresh-process rollback/recovery scenario pass against that committed source. This is an
  integrated local Receiver result, not a deployment or public release claim.
  [CR-ISSUE-001](Issues/CR-ISSUE-001-core-pin-does-not-match-current-checkout.md) owns the source
  decision; [Validation and Evidence](Core/05-validation-and-evidence.md) records exact identities
  and results.
- The portable fixture verifies private provisioning proof, equal aliases, and live cluster identity.
  All 28 backend suites / 203 tests pass on a new loopback cluster. The exact-source nine-migration
  upgrade passes against the same Receiver commit, preserving the original catalog and rows before
  post-upgrade probes. [CR-ISSUE-004](Issues/CR-ISSUE-004-database-verification-fixture-drift.md)
  records the fixture boundary; deployment and release remain separate gates.
- Database hardening is prepared, but its retained local observation lacks exact source and run
  provenance. Fresh rehearsal and any live change remain separate gates.
- Source-bound local type/build and focused test results, actual runtimes, skipped database checks,
  and hardening evidence limits are recorded once in
  [Validation and Evidence](Core/05-validation-and-evidence.md).

These statements describe implementation boundaries. They do not assert a public release, hosted
availability, or complete external continuation.

## Active gates

| Gate | Owner/surface | Current boundary |
|---|---|---|
| Core-pinned conformance | `backend/conformance/standing-v0.2/` | Integrated source identity, shared scenario, recovery, and exact-source upgrade pass; release remains open |
| Existing database verification | Backend tests and migration rehearsal | 28 suites / 203 tests and exact nine-migration upgrade pass on Receiver commit `1ed853b`; deployed-database verification remains open |
| Runtime admission and handoff | Standing module | Default application has no production admission authority and fails closed |
| Standing Consent page coverage | Consent and Standing modules | 13 real HTTP/database cases pass, including token lookup, Connector projection, decisions, and served popup script; real-browser and hosted continuation remain open under [CR-TASK-005](Tasks/CR-TASK-005-cover-standing-consent-handoff.md) |
| Control-plane policy | Standing control-plane proposal | Expanded account-facing shell: lifetime, public summaries, revocation UX, and snapshot consistency need accepted policy before implementation |
| Database hardening | `supabase/` | Historical local observation only; fresh source-bound rehearsal and live authority required |
| Container build | `backend/Dockerfile`, `frontend/Dockerfile` | Both clean-context builds fail to resolve private `@saas/shared`; see CR-ISSUE-003 |
| Migration authority | `backend/entrypoint.sh` and deployment docs | Startup migration conflicts with the separately authorized release contract; see CR-ISSUE-002 |
| Deployment/release | Backend/frontend release owner | Environment, packaging, migration order, rollback, and hosted readback must be verified together |

## Source of truth

- Protocol and authority: Re-entry Core pin plus the Receiver module contract.
- Implemented behavior: current TypeScript, Prisma schema/migrations, and tests.
- Runtime behavior: actual Express/Prisma process and database readback.
- Deployment truth: platform configuration, migration readback, health/readiness, and release evidence.
- Consumer integration: consumer repository owns event mapping, adapter, and product workflow; this
  service exposes only the accepted generic boundary.

A report, fixture, stub, source interface, or local green test cannot claim a layer it does not run.

## Non-claims

- no complete production standing-mode release or mandatory CI/release enforcement;
- no default production runtime-admission authority, Connector capability selection, or quota policy;
- no expanded public Grant listing/management shell beyond the explicitly accepted authenticated `/v0.2` control routes;
- no live Supabase hardening change from the prepared migration;
- no verified Docker image build or container release because the workspace package is unavailable in
  both current image contexts;
- no accepted migration execution boundary because the backend entrypoint currently runs migrations
  during startup;
- no consumer-specific event mapping, application workflow, or end-to-end external continuation;
- no deployment, rollback, or public availability claim without fresh platform readback.

## Update rule

Update this ledger only when a current contract, code/migration, test result, runtime readback,
source identity, or release decision changes. Keep detailed procedures in module/conformance/migration
documents. After each coherent docs increment, reread this file and the affected README, then scan
for stale status, duplicate authority, old product names, and historical log language.
