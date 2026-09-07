# Cloud Receiver 2

**Role:** Standalone Receiver service and operator-facing web application
**Status:** Active Receiver repository; current claims and open gates live in
[Current Status](Docs/00-current-status.md)

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
- [AI development](Docs/AI-Development/README.md) — AI-facing development and closure procedure.
- [Engineering](Docs/Engineering/README.md) — technical engineering policy and change control.
- [Verification](Docs/Verification/README.md) — reproducible checks and claim limits.
- [Operations](Docs/Operations/README.md) — local, migration, deployment, health, and recovery boundary.
- [Active tasks](Docs/Tasks/README.md) — only current outcomes and next gates.
- [Backend deployment boundary](backend/README.md) — runtime variables, migration order, and process shape.
- [Standing module contract](backend/src/modules/standing/README.md) — additive v0.2 routes and authority.
- [Conformance procedure](Docs/Verification/01-standing-conformance.md) — source pin and reproducible checks.
- [Supabase hardening](Docs/Operations/02-database-hardening.md) — preflight, verification, and live-change boundary.

## Service surface

The service exposes versioned authentication, finite-run v0.1 compatibility, standing v0.2, and
health/readiness surfaces. Exact routes, methods, envelopes, compatibility rules, and module owners
live in [Contracts](Docs/Contracts/README.md) and its linked module documents. This README does not
duplicate the HTTP contract.

## Security and data rules

The service is server-authoritative for identity, consent, Grant, Event, Delivery, and persistence
state. It keeps secret-bearing values out of raw persistence and logs and fails closed where runtime
admission or public policy is unsupported. See [Trust, Security, and Reliability](Docs/Core/04-trust-security-reliability.md)
for the binding rules and data lifecycle.

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

Use [Verification](Docs/Verification/README.md) for the command matrix, source identity, database
requirements, and evidence ceilings. Run the narrowest relevant check first and record the exact
runtime, database scope, source, result, and claim limit. A local build, test, or source interface
does not prove deployment or an external end-to-end continuation.

## Maintenance

Use [Docs/README.md](Docs/README.md) as the authority map. Keep this README bounded to repository
orientation and stable contracts. Put current state in `Docs/00-current-status.md`, procedures in
module/conformance documents, and fresh results in the owning evidence record. Never append dated
execution logs or raw database output here.
