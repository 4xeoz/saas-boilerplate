# Empty Next.js starter

This is the business-logic-free companion branch. It is a clean, one-commit
snapshot derived from the latest committed WeTrends `main` source
(`097a26f0045b9bc43dfd641577fbe52037343157`) and is independent of the
existing `saas-boilerplate/main` implementation.

## Included

- Generic landing, sign-in, registration, protected dashboard and settings UI.
- Real Auth.js credentials sessions with bcrypt password hashing.
- PostgreSQL/Supabase-compatible user, workspace, membership and login-lockout
  tables.
- Owner/admin/member role foundation and server-side workspace checks.
- `.env.example`, Supabase Postgres Docker setup, Dockerfile and health route.

There are no projects, files, billing plans, email providers, sample records or
business-specific workflows. Add those deliberately in your product branch.

## Local setup

```bash
cp .env.example .env.local
docker compose up -d db
npm install
npx prisma migrate deploy
npm run dev
```

The first account created at `/register` becomes the workspace owner. Keep
`.env.local`, database passwords and `AUTH_SECRET` out of Git.
