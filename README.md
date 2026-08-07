# SaaS Boilerplate

A TypeScript monorepo you can start a product from. Express + Drizzle +
Postgres on the back, Next.js + React Query on the front, with the auth and
operational plumbing already done.

```
backend/    Express 4, Drizzle ORM, Passport, JWT
frontend/   Next.js 16, React 19, Tailwind 4, React Query v5
shared/     types both sides import (declarations only, no build step)
```

---

## What is already built

**Auth**
- Google OAuth 2.0 sign-in
- Short-lived access token (15 min) in an httpOnly cookie
- **Rotating refresh tokens** — only the SHA-256 hash is stored, and replaying
  a used token revokes the user's entire token family as a theft signal
- Expired tokens are cleaned up hourly
- The frontend refreshes transparently, and concurrent 401s share one refresh
  instead of failing

**Authorization**
- Roles: `user` / `admin` / `superadmin`, rank-based so `superadmin` satisfies
  an `admin` check without being listed everywhere
- `requireRole(minimum)` middleware
- Ownership belongs in the `WHERE` clause, and unowned resources return 404
  rather than 403 so ids cannot be enumerated

**API**
- `/v1` versioning, with a deprecated unversioned mount for old clients
- One response envelope: `ok(data, message?)` / `err(code, message)`, typed as
  a discriminated union so TypeScript forces you to check `success`
- zod validation on request bodies; the parsed value replaces `req.body`
- Rate limiting on auth and public writes

**Operational**
- **Crash-safe**: every async handler is wrapped so a rejected promise becomes
  a 500 instead of killing the process, and the pg pool's `error` event is
  handled
- Readiness (`/health`, queries the DB) and liveness (`/health/live`) checks
- Config validated with zod at boot — production refuses to start without its
  secrets rather than falling back to insecure defaults
- Graceful shutdown on SIGTERM/SIGINT: stop accepting, drain, exit
- helmet, CORS locked to one origin
- Docker + compose with healthchecks

---

## Quick start

```bash
npm install
cp backend/.env.example backend/.env      # fill in DATABASE_URL + Google OAuth
createdb app                              # or use the compose Postgres

cd backend && npm run db:migrate && cd ..
npm run dev                               # backend :4000, frontend :3000
```

Google OAuth credentials come from the
[Google Cloud console](https://console.cloud.google.com/apis/credentials).
Set the redirect URI to `http://localhost:4000/v1/auth/google/callback`.

### Useful commands

| Command | Does |
|---|---|
| `npm run dev` | both apps with reload |
| `npm run type-check` | typecheck both workspaces |
| `npm test -w backend` | backend tests (needs a database) |
| `npm run db:generate -w backend` | schema → SQL migration |
| `npm run db:migrate -w backend` | apply migrations |
| `npm run db:studio -w backend` | browse data |
| `npm run token -w backend -- you@example.com` | print a JWT for Postman/curl |

---

## Adding a feature

Each feature is a folder under `backend/src/modules/<feature>/`:

| File | Holds |
|---|---|
| `<feature>.routes.ts` | Router and middleware order only |
| `<feature>.controller.ts` | request/response handling, zod schema |
| `<feature>.service.ts` | business logic and all database calls |
| `public.ts` | what other modules may import |

```ts
router.post(
  "/",
  jwtAuthGuard(),              // who are you
  requireRole("admin"),        // are you allowed
  validateBody(schema),        // is the input valid
  asyncHandler(handler),       // a rejection must not kill the process
);
```

**`asyncHandler` is not optional.** Express 4 wraps handlers in a `try/catch`,
but an async handler returns a pending promise before it fails, so the catch
never sees the error and Node terminates the process.

### Database changes

```bash
# 1. edit backend/src/db/schema.ts
npm run db:generate -w backend    # 2. read the SQL it writes
npm run db:migrate -w backend     # 3. apply it
```

Migrations are committed and applied automatically on deploy by
`entrypoint.sh`. Never edit an applied migration — generate a new one.

### Shared types

`shared/index.d.ts` is **declarations only**, so there is no build step and
both sides `import type` from it. If you need a runtime value there (a const,
an enum, a function), the package needs a build step — prefer keeping values
on one side and sharing only their type.

---

## Production notes

- Set `COOKIE_DOMAIN` to the shared parent domain (`.example.com`). Without it
  cookies set by the API subdomain are invisible to the frontend, and every
  logged-in user gets bounced off protected pages with no error anywhere.
- `JWT_SECRET` must be ≥32 characters; the app will not boot otherwise.
- Only loopback ports are published by compose. Put a reverse proxy in front to
  terminate TLS (Caddy handles certificates automatically).
- `/health` returns 503 when the database is unreachable — point your
  healthcheck and uptime monitor at it, not at `/health/live`.

---

## Not included

Deliberately absent so you can decide per project: payments, transactional
email, email/password auth, organizations/multi-tenancy, background job queue,
and Redis.
