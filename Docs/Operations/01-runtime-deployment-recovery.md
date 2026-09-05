# Runtime, Deployment, and Recovery

**Role:** Executable operational boundary and release checklist
**Status:** Current topology; release closure open

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
