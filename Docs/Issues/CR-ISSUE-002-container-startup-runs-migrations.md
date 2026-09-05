# CR-ISSUE-002 — Container startup owns an unaccepted migration step

**Status:** Open
**Owner:** Deployment and database release boundary
**Observed:** 2026-09-05, Europe/London

## Evidence

- `backend/entrypoint.sh` executes `npx prisma migrate deploy` before `node dist/index.js`.
- `backend/Dockerfile` uses that entrypoint as its container command.
- `docker-compose.yml` starts the backend after PostgreSQL health, so the migration is part of
  normal container startup.
- `backend/README.md`, `Docs/Operations/README.md`, and Core trust policy describe migrations as a
  separately authorized step that must not run during cold start.

## Impact

The intended migration authority, rollout ordering, and rollback boundary conflict with the current
Docker process. A container restart can acquire migration authority without a separately observed
release step. Deployment safety and zero-downtime claims must remain open until this is resolved.

## Resolution gate

Accept one explicit deployment contract:

1. move migration execution into a separately authorized release job and remove it from the runtime
   entrypoint; or
2. explicitly accept startup migration, then document its lock, backup, failure, rollback, and
   multi-instance behavior as the release authority.

Update the entrypoint, Operations, backend boundary, and deployment verification together. Do not
close this issue by changing prose alone.
