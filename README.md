# Next.js SaaS starter

This branch is a clean, one-commit generic SaaS foundation derived from the
latest committed WeTrends `main` snapshot (`097a26f0045b9bc43dfd641577fbe52037343157`).
It is intentionally independent of the existing `saas-boilerplate/main` code.

## Included

- Next.js App Router with a generic landing page, real sign-in and registration.
- Auth.js credentials sessions, bcrypt password hashing, five-attempt login
  lockout, protected dashboard routes, and owner/admin/member roles.
- Prisma against PostgreSQL, compatible with a hosted Supabase Postgres
  database or the included local Supabase Postgres Docker image.
- Workspace, project, member, invitation, file metadata, email-log and
  subscription models.
- Stripe Checkout plus signature-verified subscription webhooks.
- Resend welcome and invitation email boundaries.
- Server-only Google Drive uploads with a 25 MB guardrail.
- `.env.example`, Dockerfile, health endpoint, and readable server actions.

## Local setup

```bash
cp .env.example .env.local
# Set AUTH_SECRET and the local database password.
docker compose up -d db
npm install
npx prisma migrate deploy
npm run dev
```

For the full self-hosted Supabase stack, use the Supabase CLI (`npx supabase
start`) and point `DATABASE_URL` at its Postgres connection. The app uses the
normal PostgreSQL wire protocol, so a managed Supabase project works too.

The first account created at `/register` becomes the workspace owner. Add
Stripe, Resend and Google Drive credentials only when those providers are
needed. Missing optional providers fail closed with a useful UI message.

## Checks

```bash
npm run type-check
npm run build
GET /api/health
```

Never commit `.env.local`, service-role keys, Stripe secrets, or Google service
account JSON.
