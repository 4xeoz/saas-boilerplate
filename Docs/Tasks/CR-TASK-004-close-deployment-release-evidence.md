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

## Next gate

Resolve the packaging and migration-boundary issues, build both images from a clean context, run
health/readiness and one approved workflow on a named target, and record rollback and residual
unknowns in [Operations](../Operations/01-runtime-deployment-recovery.md) and Current Status.
