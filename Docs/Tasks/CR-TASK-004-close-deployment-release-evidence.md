# CR-TASK-004 — Close deployment release evidence

**Status:** Open
**Owner:** Backend/frontend release boundary

## Outcome

Produce a reproducible release record for clean container images, migration authority, runtime health,
rollback, secret custody, and platform identity.

## Current boundary

Both current Dockerfiles fail clean-context installation of private `@saas/shared`; the backend
entrypoint also runs migrations during startup. See [CR-ISSUE-002](../Issues/CR-ISSUE-002-container-startup-runs-migrations.md)
and [CR-ISSUE-003](../Issues/CR-ISSUE-003-docker-workspace-package-install.md).

The 2026-09-15 Vercel readback shows both Production projects as `Ready`, but their dashboard source
label is the older, currently unresolvable `Eyad/Full-Integration:03be040`; the `Re-Entry` Preview
uses the reviewed Receiver source. Frontend-to-backend targeting and Preview/Production database
separation remain unverified. The bounded readback and contract-drift smoke result are in
[Current Deployment](../Operations/current-deployment.md); route selection and claim gates are in
the [Deployment Runbook](../Operations/deployment-runbook.md). The latest public Preview readback
also shows the frontend bundle targeting the Production backend while the Preview backend allows
only the Production frontend origin; no authenticated or mutating Preview browser check is safe
until the environment scopes are corrected.

## Next gate

First regain authenticated Vercel control-plane readback, correct the Preview frontend/backend
origin wiring, and prove Preview/Production database separation without submitting a mutating
request. Then choose the release target, resolve the packaging and migration-boundary issues, build
the selected artifact from a clean context, verify health/readiness and one approved workflow on a
named target, and record rollback and residual unknowns in [Current Deployment](../Operations/current-deployment.md),
the [Deployment Change Register](../Operations/deployment-history.md), and Current Status.
