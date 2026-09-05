# Cloud Receiver — Current Status

**Role:** Canonical service-state and claim ledger
**As of:** 2026-09-05, Europe/London
**Status:** Active Receiver development; release and cross-project gates remain open

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
  `backend/conformance/standing-v0.2/core-pin.json` and refuses an unpinned default run.
- Database hardening is prepared as an explicit migration and has a disposable local proof; a live
  Supabase change requires a separate preflight and migration authority.

These statements describe implementation boundaries. They do not assert a public release, hosted
availability, or complete external continuation.

## Active gates

| Gate | Owner/surface | Current boundary |
|---|---|---|
| Core-pinned conformance | `backend/conformance/standing-v0.2/` | Source identity is pinned; full release conformance and enforcement remain open |
| Runtime admission and handoff | Standing module | Default application has no production admission authority and fails closed |
| Control-plane policy | Standing control-plane proposal | Lifetime, public summaries, revocation UX, and snapshot consistency need accepted policy before implementation |
| Database hardening | `supabase/` | Local disposable proof exists; live migration is not implied |
| Deployment/release | Backend/frontend release owner | Environment, migration order, rollback, and hosted readback must be verified together |

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
- no public Grant inspection/revocation contract beyond explicitly accepted routes;
- no live Supabase hardening change from the prepared migration;
- no consumer-specific event mapping, application workflow, or end-to-end external continuation;
- no deployment, rollback, or public availability claim without fresh platform readback.

## Update rule

Update this ledger only when a current contract, code/migration, test result, runtime readback,
source pin, or release decision changes. Keep detailed procedures in module/conformance/migration
documents. After each coherent docs increment, reread this file and the affected README, then scan
for stale status, duplicate authority, old product names, and historical log language.
