# Cloud Receiver 2 Verification

**Role:** Reproducible checks and evidence-level routing
**Status:** Active baseline; database and deployment evidence remain open

## Check owners

| Scope | Procedure |
|---|---|
| TypeScript and production builds | Root `npm run type-check` and `npm run build` |
| Backend module and database behavior | `npm test -w backend -- --runInBand` with a named disposable PostgreSQL database |
| Standing source identity | `backend/conformance/standing-v0.2/README.md` and `source-pin.test.mjs` |
| Standing Receiver/Core scenario | `backend/conformance/standing-v0.2/README.md` and its pinned runner |
| Migration upgrade and recovery | The standing conformance migration/fresh-process procedures |
| Deployment and live hardening | [Operations](../Operations/README.md) and `supabase/README.md` |

A check records its exact source, runtime, database scope, result, skipped layers, and claim ceiling.
Green static checks do not prove database, deployment, or consumer continuation.
