# CR-ISSUE-003 — Dockerfiles cannot install the private workspace package

**Status:** Open
**Owner:** Container build and workspace packaging boundary
**Observed:** 2026-09-05, Europe/London
**Last verified:** 2026-09-06, Europe/London

## Evidence

- Root `package.json` defines the private workspace package `@saas/shared` from `shared/`.
- Both `backend/package.json` and `frontend/package.json` depend on `@saas/shared` as `*`.
- `backend/Dockerfile` and `frontend/Dockerfile` build with their own directory as context and copy
  neither the root workspace manifest nor `shared/`.
- `docker build --progress=plain -t cloud-receiver-docs-audit:local backend` fails at `npm install`
  with registry `E404 '@saas/shared@*' is not in this registry.`
- `docker build --progress=plain -t cloud-receiver-docs-audit-frontend:local frontend` fails with
  the same error.

## Impact

The checked Docker images cannot be built from their documented contexts. Docker Compose and any
deployment that relies on these Dockerfiles therefore remain unverified and cannot be called
release-ready. The local workspace build is not evidence that a clean container can resolve the
private package.

## Resolution gate

Choose and test one packaging boundary: build from the workspace root with the lockfile and `shared/`
included, publish an approved immutable shared package, or remove the runtime dependency through an
explicit contract change. Then build both images from a clean context, run their health checks, and
update Operations and Current Status with the exact image/source evidence.
