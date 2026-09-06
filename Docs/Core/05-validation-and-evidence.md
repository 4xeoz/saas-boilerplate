# Cloud Receiver 2 — Validation and Evidence

**Role:** Verification matrix and claim ceiling
**Status:** Current baseline; database-backed and cross-project release rows remain open

## Current local checks

The following checks were run against the current `Re-Entry` branch during this documentation reset:

| Check | Result | Claim supported |
|---|---|---|
| `npm run type-check` | Passed (backend and frontend) | Type-level consistency for the checked workspaces |
| `npm run build` | Passed (backend and frontend) | Production build compilation; not deployment proof |
| `node --test backend/conformance/standing-v0.2/source-pin.test.mjs` | Passed, 16 tests | Source-pin guard behavior in synthetic fixtures |
| `npm test -w backend -- --runInBand src/modules/standing/test/standing-consent-page.test.ts` | Passed, 6 tests | Standing Consent renderer behavior only; no HTTP, database, or hosted claim |
| Pinned source readback against current sibling checkout | Failed with `conformance_pin_commit_unavailable` | Confirms a real compatibility gate is open; no pinned conformance claim |
| `npm test -w backend -- --runInBand` | Not run to completion; configuration exits because no database URL is configured | No database-backed test or release claim |

The executed runtime versions were Node `v26.5.0`, npm `11.17.0`, Next.js `16.3.0` in the frontend
build, and the repository package manager declaration is npm `10.9.2`. Node 24 remains the intended
reproducible conformance baseline; a different local runtime must not be silently presented as that
baseline.

The focused renderer suite was supplied a PostgreSQL-shaped local placeholder solely because the
shared Jest setup validates `DATABASE_URL`; the renderer test does not open a database connection.

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

- Current Core pin cannot be resolved from the active sibling checkout; see
  [CR-ISSUE-001](../Issues/CR-ISSUE-001-core-pin-does-not-match-current-checkout.md).
- Clean Docker image builds fail to resolve the private workspace package; see
  [CR-ISSUE-003](../Issues/CR-ISSUE-003-docker-workspace-package-install.md).
- The current container entrypoint runs migrations at startup despite the intended separate release
  boundary; see [CR-ISSUE-002](../Issues/CR-ISSUE-002-container-startup-runs-migrations.md).
- Database-backed suites require a verified disposable PostgreSQL URL; none was configured for the
  baseline check above.
- A focused standing page renderer test covers bounded pending/terminal output, Connector
  availability, Host-controlled field escaping, and exact popup-origin/session messaging. The shared
  `/consent?token=...` route still has no dedicated HTTP integration test; login continuation,
  v0.1/standing dispatch, expiry response, token redaction across HTTP, same-user decision, and
  HTTP-level popup-origin behavior remain source-level evidence until
  [CR-TASK-005](../Tasks/CR-TASK-005-cover-standing-consent-handoff.md) closes.
- The expanded control-plane shell proposal has no accepted lifetime, redaction, custody, or
  public revocation contract.
- No current deployment readback in this repository proves a public release or consumer continuation.
