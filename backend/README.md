# Cloud Receiver backend

**Role:** Independently deployable API and persistence boundary
**Status:** Active

## Ownership

This directory owns the Express application, Prisma schema and migrations, HTTP middleware, account
and Receiver modules, health/readiness routes, and backend verification. It does not own frontend
pages, consumer event mapping, reusable Core contracts, or permission to apply a live migration.

## Deployment shape

The Vercel deployment root, when Vercel is selected, is `saas-boilerplate/backend`. The handler in
`api/index.ts` exports the Express app and does not call `listen()`. The standalone local listener is
`src/index.ts`. Keep these process boundaries separate.

Production runtime configuration:

- `CLOUD_RECEIVER_RUNTIME_DATABASE_URL` or `DATABASE_URL` for request handling;
- `JWT_SECRET` with at least 32 characters;
- `FRONTEND_URL` for exact credentialed CORS and cookie origin checks;
- `RECEIVER_PUBLIC_URL` set to the public Receiver origin for Receiver-built consent URLs; and
- `CLOUD_RECEIVER_PAIRING_SOURCE_HMAC_SECRET` with at least 32 random characters.

The parser supplies local-only defaults for `FRONTEND_URL`, `JWT_SECRET`, the pairing-source HMAC
secret, and `RECEIVER_PUBLIC_URL`; those defaults are not a release configuration. In particular, a
production deployment must not allow the Receiver URL to fall back to `localhost`.

`DIRECT_URL` is for Prisma migration commands, not request handling. Set `COOKIE_DOMAIN` only when
frontend and backend share a parent domain. The frontend must receive only its public backend URL; it
must never receive database, JWT, Connector-token, Grant-control, or service-role credentials.

## Migration boundary

The intended release contract applies Prisma migrations as a separately authorized step before
routing traffic:

```sh
npx prisma migrate deploy
```

Supply the reviewed `DIRECT_URL` or approved migration fallback. The current Docker
[`entrypoint.sh`](entrypoint.sh) still runs `npx prisma migrate deploy` during container startup;
this is an open deployment discrepancy tracked in
[`CR-ISSUE-002`](../Docs/Issues/CR-ISSUE-002-container-startup-runs-migrations.md). Do not claim
that the separate-release boundary is implemented until that issue is resolved. Verify migration
order, target identity, health/readiness, and rollback before declaring a release.

## HTTP boundaries

- Cookie-authenticated POST mutations require the configured frontend Origin and JSON content type.
- Anonymous pairing claims accept exactly the pairing fields, use a trusted provider source identity,
  apply the durable source budget, and fail closed when the identity or limiter store is unavailable.
- Connector disconnect accepts only the saved token, revokes once, retains history, and is replay-safe.
- Standing v0.2 routes use exact raw-target, method, header, body, size, canonical-response, and
  no-store checks; they do not negotiate or fall back to v0.1.
- Health endpoints are public; readiness checks the database, while liveness checks process state only.

## Local process

From this directory's parent:

```sh
npm run dev -w backend
npm run build -w backend
npm test -w backend -- --runInBand
```

Use a dedicated disposable PostgreSQL database for database-backed tests. Record exact source, runtime,
database, and claim scope. A successful Vercel build or health response does not prove authenticated
workflow, delivery, or cross-project continuation.
