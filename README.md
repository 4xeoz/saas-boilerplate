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
| User | `/login` | `/v1/auth/users` | `user_session` | `cr2_user_accounts` |
| Developer | `/developer-login` | `/v1/auth/developers` | `developer_session` | `cr2_developer_accounts` |

Each API prefix supports `register`, `login`, `me`, and `logout`. Passwords are
hashed with bcrypt. Sessions are signed JWTs in httpOnly cookies. The user and
developer tables intentionally have separate email uniqueness, so the same
email can represent one account of each type.

Google OAuth, roles, refresh tokens, payments, email delivery, queues, Redis,
Event ingress, and delivery business logic are not part of this clone. Feature 2
adds the small organization/API-key fixture, Host-key validation, Consent,
target binding, Grant status projection, and a private configured-authority
revocation fence. Public Grant inspection/revocation remains blocked pending
ADR-0013.

## Pairing surface

The first v0.1 replacement surface is account-owned Connector pairing:

- `POST /v0.1/account/pairing-sessions` requires the `user_session` cookie and
  same-origin JSON `{}`; it returns one short-lived uppercase hexadecimal code.
- `POST /v0.1/account/pairing-sessions/claim` accepts only
  `{ pairing_code, device_name }` without browser or Organization credentials.
- The first claim returns the raw Connector token once. A duplicate replay
  returns the same metadata with `duplicate: true` and omits
  `connector_token` entirely.

Pairing codes and Connector tokens are stored only as SHA-256 digests. Consent,
Host credentials, and signed Manifests are enabled for the Consent/Target
increment. Signed events, leases, acknowledgements, public Grant routes, and
deployment remain later gates.

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
no public Grant inspection/revocation route and no Event route.

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
- `RECEIVER_PUBLIC_URL` sets the base used in consent URLs and defaults to the
  local backend URL.

Do not commit `.env.local` or copy production secret values into tracked files.
The prefixed table names avoid table collisions, but Prisma migration history
is still database-wide. Use a fresh Supabase database/project for Cloud
Receiver 2, or explicitly baseline the existing database before running
`prisma migrate deploy` against it; do not point the migration command at the
old Receiver database blindly.

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
- `backend/src/modules/connectors/` owns the current pairing boundary and its
  delivery identity guard.
- `backend/src/modules/consent/` owns Host-key validation, signed Consent
  sessions, User decisions, stable target binding, Grant status projection, and
  the private revocation fence. Event ingress and public Grant control are not
  present.
- `backend/prisma/schema.prisma` is the database source of truth.

Health endpoints remain public: `/health` checks Prisma/Postgres and
`/health/live` checks only process liveness.
