# Testing and Verification

**Role:** Check selection, environment boundaries, and claim limits
**Status:** Current baseline

## Check layers

| Layer | Command or source | Maximum claim |
|---|---|---|
| Type consistency | `npm run type-check` | Backend/frontend TypeScript compiles |
| Build | `npm run build` | Production bundles compile; no runtime or deployment proof |
| Focused behavior | `npm test -w backend -- --runInBand` with an explicit disposable PostgreSQL URL | Named module behavior and database transitions |
| Source identity | `node --test backend/conformance/standing-v0.2/source-pin.test.mjs` plus the pinned sibling checkout | Selected source identity only when the pin and bytes pass |
| Conformance | Standing Receiver/Core runner and migration/fresh-process suites | The named protocol/database scenario, not release by itself |
| Deployment | Platform and database readback | Named deployment identity, health, migration, rollback, and workflow scope |
| Consumer | Consumer-owned adapter/page/effect evidence | The consumer vertical slice only |

## Environment safety

Database-backed suites require `NODE_ENV=test` and a newly provisioned, explicitly disposable
loopback PostgreSQL database. Never use a runtime or shared database, and never allow a missing
database URL to fall back to one. Record Node, npm, PostgreSQL, Prisma, source identities, fixture
scope, counts, skips, and failure boundaries without secrets.

Node 24 is the intended reproducible conformance baseline. If another runtime is used, report the
actual runtime and do not relabel it as the baseline.

## Interpretation

Classify failures as static, contract, database, process, deployment, or consumer scope. Keep an
open issue or task when a failure changes a release or authority claim. Do not convert a passing
lower-layer test into a higher-layer promise.
