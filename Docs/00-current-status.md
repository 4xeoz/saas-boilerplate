# Cloud Receiver 2 — Current Status

**Role:** Canonical service-state and claim ledger
**As of:** 2026-09-07, Europe/London
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
- Pinned conformance remains blocked by an unavailable historical commit and incompatible selected
  contract inventory. Explicit development mode also fails closed; it is not a fallback.
  [CR-ISSUE-001](Issues/CR-ISSUE-001-core-pin-does-not-match-current-checkout.md) owns the exact
  source baseline, errors, recovery evidence, and compatibility review gate.
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
| Core-pinned conformance | `backend/conformance/standing-v0.2/` | Historical pin and fixed selected inventory are unresolved against the active sibling checkout; no source-identity claim |
| Runtime admission and handoff | Standing module | Default application has no production admission authority and fails closed |
| Standing Consent page coverage | Consent and Standing modules | Focused standing renderer and mocked HTTP-boundary coverage pass; real `/consent?token=...` token lookup/persistence, Connector projection, and same-user decision integration remain open under [CR-TASK-005](Tasks/CR-TASK-005-cover-standing-consent-handoff.md) |
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
