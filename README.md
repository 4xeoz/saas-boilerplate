# Cloud Receiver 2

**Role:** Standalone Receiver service and operator-facing web application
**Status:** Active development; local static/build checks pass, while database, source-pin, deployment,
and cross-project release gates remain open

Cloud Receiver is an Express/Prisma service with a Next.js frontend. It receives signed events,
holds target-scoped delivery work, and exposes bounded consent, Connector, and account controls.
PostgreSQL is the persistence authority; the backend is the only database client.

## Repository boundary

- `backend/` owns HTTP transport, authentication, domain modules, Prisma schema, migrations,
  conformance runners, health/readiness, and the independently deployable API.
- `frontend/` owns user/developer pages and browser-side calls to the backend.
- `shared/` owns TypeScript declarations shared by workspaces.
- `supabase/` contains a separately reviewed database-hardening migration and preflight procedure.

Re-entry Core is the reusable protocol authority and is consumed through the pinned source under
`backend/conformance/standing-v0.2/core-pin.json`. A consumer application owns its event mapping,
adapter, product workflow, and human outcome. This repository does not own a permanent consumer
integration specification.

## Start here

- [Documentation map](Docs/README.md) — authority, module boundaries, and maintenance rules.
- [Core documentation](Docs/Core/README.md) — product definition, requirements, system design,
  trust policy, validation, and roadmap.
- [Contracts](Docs/Contracts/README.md) — HTTP versioning and module contract owners.
- [Current status](Docs/00-current-status.md) — verified state, active gates, and non-claims.
- [Engineering](Docs/Engineering/README.md) — development and verification procedure.
- [Verification](Docs/Verification/README.md) — reproducible checks and claim limits.
- [Operations](Docs/Operations/README.md) — local, migration, deployment, health, and recovery boundary.
- [Active tasks](Docs/Tasks/README.md) — only current outcomes and next gates.
- [Backend deployment boundary](backend/README.md) — runtime variables, migration order, and process shape.
- [Standing module contract](backend/src/modules/standing/README.md) — additive v0.2 routes and authority.
- [Conformance procedure](backend/conformance/standing-v0.2/README.md) — source pin and reproducible checks.
- [Supabase hardening](supabase/README.md) — preflight, local proof, and live-change boundary.

## Public API families

| Family | Owner | Boundary |
|---|---|---|
| `/v1/auth/users` and `/v1/auth/developers` | Users, developers, authentication | Separate account models and typed httpOnly session cookies |
| `/v0.1/account/*` | Connectors and consent | Pairing, account-scoped device metadata, consent decisions, and target binding |
| `/v0.1/events`, `/v0.1/delivery-claims`, `/v0.1/delivery-acknowledgements` | Events, deliveries, acknowledgements | Retained compatibility surface with exact replay/lease/effect rules |
| `/v0.2/events`, `/v0.2/delivery-*` | Standing module | Signed standing Event ingress, claims, acknowledgement, and notification handoff |
| `/health`, `/health/live`, `/healthz`, `/readyz` | System health | Public liveness/readiness only |

The v0.2 transport has exact target, method, header, body, size, canonical-response, and no-store
guards. It never negotiates or silently falls back to v0.1.

## Security and data rules

- Passwords, pairing codes, Connector tokens, Consent tokens, Host credentials, Grant control values,
  and source fingerprints are never returned or persisted as raw bearer values.
- User and developer sessions are separate cookies and separate database models.
- Account, Organization, Host subject, Connector target, Grant, Event, and Delivery ownership is
  resolved server-side; client-selected identity cannot override it.
- State mutation, event creation, and eligible Delivery creation are atomic within the owning transaction.
- Leases are bounded and replay-safe; acknowledgement requires independently injected effect authority.
- Unsupported runtime admission and unaccepted public control surfaces fail closed.

## Local development

```sh
npm install
cp .env.example .env.local
npm run db:migrate -w backend
npm run dev
```

Set only local credentials in `.env.local`. Do not commit it or place production values in tracked
files. Use a dedicated disposable PostgreSQL database for tests and migration rehearsal.

## Verification

| Command | Purpose |
|---|---|
| `npm run type-check` | Backend and frontend TypeScript checks |
| `npm run build` | Backend and frontend production builds |
| `npm test -w backend -- --runInBand` | Backend Jest aggregate against an explicitly disposable database |
| `node --test backend/conformance/standing-v0.2/source-pin.test.mjs` | Source-pin guard |
| `node --test backend/conformance/standing-v0.2/receiver.test.mjs` | Pinned Receiver/Core scenario |
| `node --test backend/conformance/standing-v0.2/fresh-process.test.mjs` | Fresh-process persistence/recovery boundary |
| `node --test backend/conformance/standing-v0.2/migration-upgrade.test.mjs` | Exact-source migration upgrade guard |

Record the exact Node, npm, PostgreSQL, source identity, database scope, and claim limit for every result.
A build, local test, or source interface does not prove deployment or an external end-to-end continuation.

## Maintenance

Use [Docs/README.md](Docs/README.md) as the authority map. Keep this README bounded to repository
orientation and stable contracts. Put current state in `Docs/00-current-status.md`, procedures in
module/conformance documents, and fresh results in the owning evidence record. Never append dated
execution logs or raw database output here.
