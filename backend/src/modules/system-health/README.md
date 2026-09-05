# System Health

**Role:** Public liveness and database-readiness endpoints
**Status:** Active

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Database readiness through Prisma/PostgreSQL |
| GET | `/health/live` | Process liveness without a database query |
| GET | `/healthz` | Lightweight operational liveness |
| GET | `/readyz` | Operational readiness through Prisma/PostgreSQL |

Readiness returns a bounded 503 when the database is unavailable. Operational routes set
Cache-Control no-store. Health output does not expose credentials, row data, or internal state.
