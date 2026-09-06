# Cloud Receiver 2 — Current Status

**Role:** Canonical service-state and claim ledger
**As of:** 2026-09-06, Europe/London
**Status:** Active Receiver development; static/build checks pass, while database, source-pin,
deployment, and cross-project release gates remain open

## Current verified state

The service is a separately deployable Express/Prisma backend with a Next.js frontend, PostgreSQL
persistence, typed user/developer sessions, Connector pairing, consent and target binding, signed
Event ingress, Delivery leases and acknowledgement, service health, and an additive standing
authorization v0.2 path.

- The v0.1 compatibility surface remains distinct; v0.2 routes do not negotiate or silently fall
  back to v0.1.
- Standing Event acceptance, sequence/replay rules, Delivery claim/reclaim limits, effect-backed
  acknowledgement, and notification-handoff authority are implemented behind explicit boundaries.
- The source-pinned conformance runner selects Core commit
  `1446d73aa3e66533547471728ad8fa5344d51f9e` through
  `backend/conformance/standing-v0.2/core-pin.json`. The source readback used the active sibling
  checkout at `90d75e5efa8d8ac403552abc2bda464d823c56ae` as its implementation baseline; the current
  sibling checkout readback is `e3db7d58e511f88a96f2cce13f699505398727a2`, and the intervening
  changes are documentation-only. Neither checkout contains the selected pin. The source verifier
  therefore fails closed with `conformance_pin_commit_unavailable`; see
  [CR-ISSUE-001](Issues/CR-ISSUE-001-core-pin-does-not-match-current-checkout.md) for the exact
  inventory, historical source evidence, and `CODE-AHEAD` classification.
- Database hardening is prepared as an explicit migration and has a disposable local proof; a live
  Supabase change requires a separate preflight and migration authority.
- Receiver implementation source baseline: commit
  `4fa4ba312902d9ae70734e8b82305ba2e4924987`; all later commits through the current checkout are
  documentation-only.
- Current local baseline checks passed `npm run type-check`, `npm run build`, and the 16 synthetic
  source-pin guard tests under Node `v26.5.0` and npm `11.17.0`. Database-backed Jest tests were not
  runnable because no disposable PostgreSQL URL was configured.

These statements describe implementation boundaries. They do not assert a public release, hosted
availability, or complete external continuation.

## Active gates

| Gate | Owner/surface | Current boundary |
|---|---|---|
| Core-pinned conformance | `backend/conformance/standing-v0.2/` | Historical pin and fixed selected inventory are unresolved against the active sibling checkout; no source-identity claim |
| Runtime admission and handoff | Standing module | Default application has no production admission authority and fails closed |
| Standing Consent page coverage | Consent and Standing modules | Focused standing renderer and mocked HTTP-boundary coverage pass; real `/consent?token=...` token lookup/persistence, Connector projection, and same-user decision integration remain open under [CR-TASK-005](Tasks/CR-TASK-005-cover-standing-consent-handoff.md) |
| Control-plane policy | Standing control-plane proposal | Expanded account-facing shell: lifetime, public summaries, revocation UX, and snapshot consistency need accepted policy before implementation |
| Database hardening | `supabase/` | Local disposable proof exists; live migration is not implied |
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
