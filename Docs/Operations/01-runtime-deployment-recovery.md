# Runtime, Deployment, and Recovery

**Role:** Executable operational boundary and release checklist
**Status:** Current topology; release closure open

**Last readback:** 2026-09-15, Vercel dashboard and bounded HTTP smoke checks

## Local runtime

From the repository root, copy the relevant example environment file to an ignored local file, use
an explicitly disposable PostgreSQL database, apply the reviewed Prisma migrations, and start the
backend and frontend through the root workspace scripts. The backend listens locally on `PORT` and
the frontend calls only `NEXT_PUBLIC_BACKEND_URL`.

```sh
npm install
npm run db:migrate -w backend
npm run dev
```

Never place production values in `.env`, `.env.local`, or tracked examples. The backend requires a
PostgreSQL URL and validates production JWT, frontend-origin, and pairing-source configuration at
startup.

## Process shapes

The current backend and frontend Dockerfiles build on `node:22-alpine`. This is the present image
base, not a release-compatibility claim: the conformance and local verification baseline is Node 24,
so an image release must run its required checks on the exact image runtime before deployment claims
are made.

| Shape | Entry | Current boundary |
|---|---|---|
| Local backend | `backend/src/index.ts` | Owns `listen()`, graceful shutdown, and Prisma disconnect |
| Serverless backend | `backend/api/index.ts` | Exports the Express app and does not listen |
| Frontend | Next.js standalone build | Browser-side API calls with public backend URL only |
| Docker Compose | `docker-compose.yml` | PostgreSQL, backend, and frontend with health-gated startup |

The Dockerfiles currently build from `backend/` and `frontend/` contexts although both workspaces
depend on private `@saas/shared`; clean builds fail with registry `E404`. Resolve
[CR-ISSUE-003](../Issues/CR-ISSUE-003-docker-workspace-package-install.md) before treating a
container image as a release artifact.

## Current hosted naming and deployment readback

The user-facing console is branded **Re-entry Cloud**. The deployable service is **Cloud Receiver 2**.
In this repository they are the frontend and backend surfaces of one Receiver product boundary; the
two names do not represent separate authorities or databases.

| Surface | Repository path | Vercel project | Production alias | Current Preview (`Re-Entry`) | Production source label read back 2026-09-15 | Platform state |
|---|---|---|---|---|---|---|
| Frontend console | `frontend/` | `re-entry-cloud` | `re-entry-weld.vercel.app` | `re-entry-cloud-git-re-entry-eyads-projects-b54e035a.vercel.app` | `4xeoz/saas-boilerplate@Eyad/Full-Integration:03be040` | Vercel `Ready`; not release-qualified |
| Backend API | `backend/` | `cloud-receiver` | `cloud-receiver-delta.vercel.app` | `cloud-receiver-git-re-entry-eyads-projects-b54e035a.vercel.app` | `4xeoz/saas-boilerplate@Eyad/Full-Integration:03be040` | Vercel `Ready`; not release-qualified |

The current reviewed Receiver source is branch `Re-Entry` at commit
`fff93ebd81644904f28d24ab60d0ee587839fc02`. It is the source of the current Preview readback, not
the source shown for the listed Production deployments. The dashboard's abbreviated Production
commit `03be040` is not currently resolvable through the repository/GitHub readback, so the label is
not an independently reproducible source identity. “Ready” is Vercel's deployment status; it does
not establish source equivalence, migration safety, configuration, rollback, or consumer
continuation.

| Required cross-environment check | Current readback |
|---|---|
| Frontend `NEXT_PUBLIC_BACKEND_URL` target | Unverified |
| Preview versus Production database separation | Unverified |
| Vercel environment-variable names and values | Not inspected; verify target and presence without recording secrets |
| Release target | Undecided: Vercel serverless versus Docker/Compose |

A bounded smoke check on 2026-09-15 returned `/readyz` `200` and anonymous `401` for protected
routes on both Production and the `Re-Entry` Preview. The current pairing-claim shape was rejected by
Production with `400 http_body_invalid`, while Preview reached business lookup with
`404 pairing_not_found`; this is contract-drift evidence, not a release qualification.

## Migration order and discrepancy

The intended release sequence is: verify target and backup/preflight, run the exact Prisma migration
set as a separately authorized step, verify schema and health, then route traffic. The current
`backend/entrypoint.sh` instead runs `npx prisma migrate deploy` before starting the backend.
Resolve [CR-ISSUE-002](../Issues/CR-ISSUE-002-container-startup-runs-migrations.md) before claiming
that the intended sequence is implemented.

The prepared Supabase hardening migration is a separate backend-only change. Follow
`supabase/README.md`; it is not permission to apply a live change and is not run by the normal local
or container path.

## Health and shutdown

- `/health/live` and `/healthz` answer process liveness without a database query.
- `/health` and `/readyz` verify database readiness and return bounded failure when unavailable.
- Container health checks must test readiness for traffic admission, not just process existence.
- SIGTERM/SIGINT stop new connections, allow bounded in-flight completion, disconnect Prisma, and
  force exit after ten seconds.

## Recovery checklist

For a restart or release rehearsal, record the exact image/source identity and target scope, verify
the database migration inventory, start one backend instance, check liveness and readiness, exercise
only an approved authenticated path, and confirm no duplicate Event, Delivery, effect, or Grant
transition. Test rollback only against a disposable or explicitly approved target; never reset or
repair an unknown database from this document.

No current readback proves a public deployment, multi-instance ownership, backup restore, power-loss
recovery, or complete consumer continuation.
