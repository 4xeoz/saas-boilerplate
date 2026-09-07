# Cloud Receiver 2 Operations

**Role:** Local runtime, database migration, deployment, health, and recovery routing
**Status:** Active baseline; live release remains unverified

## Current owners

- [Backend deployment boundary](../../backend/README.md) — process shape, variables, and migration
  order.
- [Database hardening](02-database-hardening.md) — prepared SQL, target preflight, transaction
  verification, and recovery; evidence is separately owned by Core/05.
- [Docker composition](../../docker-compose.yml) — local PostgreSQL, backend, frontend, health gates,
  resource limits, and internal network.
- [Runtime and deployment controls](01-runtime-deployment-recovery.md) — process shape, migration
  discrepancy, clean-image build boundary, health, and recovery checklist.
- [Current status](../00-current-status.md) — deployment claims and open release gates.

## Non-negotiables

The intended release contract runs migrations separately before traffic; however, the current
backend entrypoint runs them during container startup and remains an open issue. Verify the target
identity, environment, packaging, migration order, health/readiness, rollback, secret custody, and
recovery before claiming a release. Do not place production credentials or row data in this repository.
