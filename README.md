# Cloud Receiver 2

A deliberately small successor built from the SaaS boilerplate: Express +
Prisma + PostgreSQL on the backend, and Next.js on the frontend.

```
backend/    Express API, Prisma ORM, email/password sessions
frontend/   Next.js pages for users and developers
shared/     TypeScript API/domain declarations
```

## Auth surface

There are two independent account types and two independent database tables:

| Account | Page | API prefix | Cookie | Table |
|---|---|---|---|---|
| User | `/user-login` or `/user-register` (`/login` remains compatible) | `/v1/auth/users` | `user_session` | `cr2_user_accounts` |
| Developer | `/developer-login` or `/developer-register` | `/v1/auth/developers` | `developer_session` | `cr2_developer_accounts` |

Each API prefix supports `register`, `login`, `me`, and `logout`. Passwords are
hashed with bcrypt. Sessions are signed JWTs in httpOnly cookies. The user and
developer tables intentionally have separate email uniqueness, so the same
email can represent one account of each type.

Google OAuth, roles, refresh tokens, payments, email delivery, queues, and Redis
are not part of this clone. Feature 2 adds the small organization/API-key
fixture, Host-key validation, Consent, target binding, Grant status projection,
and a private configured-authority revocation fence. Feature 3 adds signed Event
ingress, Feature 4 adds target-scoped delivery claims and leases, Feature 5 adds
effect-backed acknowledgement, and Feature 6 adds bounded HTTP transport and
health/readiness routes. Public Grant inspection/revocation remains blocked
pending its separate authority decision.

## Pairing surface

The first v0.1 replacement surface is account-owned Connector pairing:

- `POST /v0.1/account/pairing-sessions` requires the `user_session` cookie and
  same-origin JSON `{}`; it returns one short-lived uppercase hexadecimal code.
- The authenticated `/user-dashboard` page exposes the `Pair this Mac` action;
  `/dashboard` remains compatible. It
  calls the pairing-session route with the browser session and shows the public
  pairing ID beside the code only after a successful response.
- `POST /v0.1/account/pairing-sessions/claim` accepts only
  `{ pairing_id, pairing_code, device_name }` without browser or Organization
  credentials. The direct Vercel path supplies a trusted client-IP header; a
  missing or invalid provider identity fails closed.
- Anonymous claims are covered by a durable thirty-request per ten-minute
  source budget. Five wrong codes for one pairing return the generic not-found
  response; the sixth is terminal and returns `410 pairing_expired`.
- The first claim returns the raw Connector token once. A duplicate replay
  returns the same metadata with `duplicate: true` and omits
  `connector_token` entirely.
- `GET /v0.1/account/connectors` requires the `user_session` cookie and returns
  only account-scoped device metadata (`device_name`, pairing and lifecycle
  timestamps, and revocation state); it never returns Connector tokens.
- `POST /v0.1/connectors/disconnect` accepts exactly the saved
  `connector_token`, stamps `revoked_at` once, and returns an exact replay-safe
  disconnected response without deleting the Connector row.

After a successful CLI claim, the dashboard polls this list for the active
`pairing_id`, changes the one-time code to `USED`, and identifies the paired
device. An unclaimed code changes to `EXPIRED` at its deadline. The device list
refreshes periodically and shows paired, expired, or disconnected lifecycle
state; it does not claim that a Mac is currently online.

Pairing codes and Connector tokens are stored only as SHA-256 digests. Consent,
Host credentials, signed Manifests, signed Events, target-scoped delivery
leases, Delivery Acknowledgement, and bounded transport/operations are enabled.
Public Grant inspection/revocation remains blocked pending its separate
authority decision. The current Vercel deployment is Preview-only, not a
production release; see [Current Vercel Preview](#current-vercel-preview-non-production).

## Consent and Target surface

Feature 2 adds these bounded routes:

- `POST /v0.1/host-keys` authenticates with an Organization API key and stores
  only the Host public key.
- `POST /v0.1/consent-sessions` authenticates with an Organization API key,
  validates a signed Manifest, and returns an opaque consent URL/session.
- `GET /consent?token=...` is the User-authenticated consent page.
- `POST /v0.1/account-consent-decisions` requires the User session, same-origin
  JSON, and an owned eligible Connector.
- `GET /v0.1/consent-sessions/:consentSessionId` returns the persisted decision
  and derived effective Grant status to the Organization.

The first approved Host subject is durably bound to one Connector target. A
different Connector for the same subject returns
`host_subject_binding_conflict`. A private service seam can revoke one Grant
through the configured authority for local verification; there is intentionally
no public Grant inspection/revocation route.

## Delivery Claim and Lease surface

Feature 4 adds `POST /v0.1/delivery-claims`. A cookie-free Local Connector sends
exactly `connector_token` and `claim_token` as JSON. A valid pending delivery
returns the canonical `200` lease envelope; no work and exhausted delivery both
return an empty `204` with no `Content-Type`. PostgreSQL stores the target-scoped
lease, digest-only claim attempts, and the bounded `retry_exhausted` state.

The accepted v2 defaults are three attempts, a 60-second lease, five-second
Connector polling, and a five-second delivery request timeout. Delivery
Acknowledgement and transport/operations are included. Public Grant routes
remain a later authority decision.

## Environment

Copy [`.env.example`](.env.example) to `.env.local` at the repository root.

The old Cloud Receiver variable names are accepted:

- `CLOUD_RECEIVER_RUNTIME_DATABASE_URL` is preferred at runtime. For Supabase,
  use the session-mode pooler URL.
- `DIRECT_URL` is preferred by Prisma migrations when provided.
- `DATABASE_URL` remains the local/generic fallback.
- `CLOUD_RECEIVER_CONNECTOR_TOKEN_SECRET` and
  `CLOUD_RECEIVER_VERIFICATION_ORIGIN` remain reserved for later Host/Connector
  composition and are not required by the pairing implementation.
- `CLOUD_RECEIVER_GRANT_CONTROL_TOKEN` configures the private local Grant
  revocation authority. It is never persisted or logged.
- `CLOUD_RECEIVER_PAIRING_SOURCE_HMAC_SECRET` is required in production and
  protects the durable anonymous pairing source fingerprint. Generate at least
  32 random characters; it is never returned or logged.
- `RECEIVER_PUBLIC_URL` sets the base used in consent URLs and defaults to the
  local backend URL.

Do not commit `.env.local` or copy production secret values into tracked files.
The prefixed table names avoid table collisions, but Prisma migration history
is still database-wide. Use a fresh Supabase database/project for Cloud
Receiver 2, or explicitly baseline the existing database before running
`prisma migrate deploy` against it; do not point the migration command at the
old Receiver database blindly.

### Exact local contract

Run the two deployable surfaces separately during local development:

| Surface | Required values |
|---|---|
| Backend | `PORT=4000`, `NODE_ENV=development`, `FRONTEND_URL=http://localhost:3000`, `RECEIVER_PUBLIC_URL=http://localhost:4000`, and either `DATABASE_URL` or `CLOUD_RECEIVER_RUNTIME_DATABASE_URL` plus `DIRECT_URL` when migrations use a separate URL |
| Frontend | `NEXT_PUBLIC_BACKEND_URL=http://localhost:4000` at build/dev-server start |
| Browser cookies | Leave `COOKIE_DOMAIN` unset on localhost |

The local API owns the `user_session` and `developer_session` httpOnly cookies.
The frontend never receives a database URL, JWT secret, Connector token, Grant
control token, or Supabase service-role key.

### Exact staging contract

The frontend and backend are independently deployable and must use the same
staging environment contract:

| Surface | Required values |
|---|---|
| Backend runtime | `NODE_ENV=production`, platform-provided `PORT`, `FRONTEND_URL=https://<frontend-staging-host>`, `RECEIVER_PUBLIC_URL=https://<backend-staging-host>`, `JWT_SECRET` with at least 32 characters, and `CLOUD_RECEIVER_RUNTIME_DATABASE_URL` for the Supabase session-mode pooler |
| Backend migrations | `DIRECT_URL` for the direct/session migration connection; run Prisma migrations separately from application startup |
| Frontend build | `NEXT_PUBLIC_BACKEND_URL=https://<backend-staging-host>` as a build-time public value |
| Cookies | The split-origin preview uses `SameSite=None; Secure`; set `COOKIE_DOMAIN` only when both hosts share the same parent domain; otherwise use a same-host reverse proxy |
| Client boundary | Do not set Supabase or service-role credentials in frontend variables; no browser client connects to the database |

Deployment protection, the target project, TLS termination, migration order,
rollback target, and health-readback command must be supplied by the release
owner. The historical root `docker-compose.yml` is a local reference, not a
production deployment declaration for the retired Receiver.

### Current Vercel Preview (non-production)

The current split-origin integration preview is:

| Surface | URL |
|---|---|
| Frontend | <https://re-entry-weld.vercel.app> |
| Backend | <https://cloud-receiver-delta.vercel.app> |

These are Vercel Preview aliases and are not a production release. The backend
must use the exact frontend origin in `FRONTEND_URL`; hosted session cookies use
`SameSite=None; Secure`, and credentialed CORS is limited to that origin.

The following read-only checks were replayed against the Preview on 2026-09-02:

- `OPTIONS /v1/auth/users/login` from the frontend origin returned `204` with
  the exact `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials:
  true`, and no `Location` header.
- `GET /health` returned database-up evidence.

This proves the original CORS-preflight boundary and database reachability. It
does not by itself prove a valid-account login, Connector pairing, or a complete
Host-to-Connector end-to-end run.

## Quick start

```bash
npm install
cp .env.example .env.local
# Set DATABASE_URL (or CLOUD_RECEIVER_RUNTIME_DATABASE_URL) in .env.local.
npm run db:migrate -w backend
npm run dev
```

The local Docker database can be started with `docker compose up --build` after
setting `DB_PASSWORD`, `JWT_SECRET`, `FRONTEND_URL`, and
`NEXT_PUBLIC_BACKEND_URL` in `.env`.

Useful commands:

| Command | Purpose |
|---|---|
| `npm run dev` | Run backend on `:4000` and frontend on `:3000` |
| `npm run type-check` | Typecheck all workspaces |
| `npm run build` | Build backend and frontend |
| `npm test -w backend` | Run backend tests; requires the migrated database |
| `npm run db:generate -w backend` | Generate the Prisma client |
| `npm run db:migrate -w backend` | Apply committed Prisma migrations |
| `npx prisma migrate dev --name <name>` | Create a development migration |
| `npm run db:studio -w backend` | Open Prisma Studio |

## Project shape

The backend keeps the two auth flows separate:

- `backend/src/modules/users/` owns user account queries and handlers.
- `backend/src/modules/developers/` owns developer account queries and
  handlers.
- `backend/src/modules/authentication/` owns only shared credential schemas
  and the cookie/JWT session primitive.
- `backend/src/modules/connectors/` owns the account pairing boundary.
- `backend/src/modules/deliveries/` owns target-scoped delivery claim and lease
  state; it is mounted at the existing v0.1 claim route.
- `backend/src/modules/consent/` owns Host-key validation, signed Consent
  sessions, User decisions, stable target binding, Grant status projection, and
  the private revocation fence.
- `backend/src/modules/events/` owns signed Event ingress and pending-delivery
  creation.
- `backend/prisma/schema.prisma` is the database source of truth.

Health endpoints remain public: `/health` checks Prisma/Postgres and
`/health/live` checks only process liveness.
