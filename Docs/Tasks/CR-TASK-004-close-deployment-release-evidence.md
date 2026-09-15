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
uses the reviewed Receiver source. Browser control-plane readback has now staged Preview-only
frontend/backend origin values while preserving the Production values and aliases; those values are
not active in the currently served Preview artifacts until a new deployment. Authenticated Supabase
MCP readback identifies the `re-entry` Production project as healthy but with no development
branches, six initial Receiver migrations visible, and RLS disabled on 36 public tables. The live
database therefore remains unsuitable for Preview writes, and Preview/Production separation,
migration authority, and hardening remain unverified. The bounded readback and contract-drift smoke
result are in
[Current Deployment](../Operations/current-deployment.md); route selection and claim gates are in
the [Deployment Runbook](../Operations/deployment-runbook.md). The latest public Preview readback
also shows the frontend bundle targeting the Production backend while the Preview backend allows
only the Production frontend origin; no authenticated or mutating Preview browser check is safe
until the environment scopes are corrected.

## Next gate

First identify or provision an approved isolated Preview database without changing the Production
project, split the runtime database scope without changing the Production secret, and separately
resolve the live migration/RLS policy decision. Then redeploy the Preview frontend/backend with the
staged origin wiring and prove database separation without submitting a mutating request. After
that, choose the release target, resolve the packaging and migration-boundary issues, and build
the selected artifact from a clean context, verify health/readiness and one approved workflow on a
named target, and record rollback and residual unknowns in [Current Deployment](../Operations/current-deployment.md),
the [Deployment Change Register](../Operations/deployment-history.md), and Current Status.
