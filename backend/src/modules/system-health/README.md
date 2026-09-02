# system-health

Public health endpoints for the Express/Prisma service.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Readiness: runs `SELECT 1` through Prisma/Postgres. |
| `GET` | `/health/live` | Liveness: checks only that the process is running. |

Readiness returns `503 DB_UNAVAILABLE` when the database cannot be reached.
