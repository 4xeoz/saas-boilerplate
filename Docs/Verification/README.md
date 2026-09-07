# Cloud Receiver 2 Verification

**Role:** Reproducible checks and evidence-level routing
**Status:** Active baseline; database and deployment evidence remain open

## Check owners

| Scope | Procedure |
|---|---|
| TypeScript and production builds | Root `npm run type-check` and `npm run build` |
| Backend module and database behavior | `npm test -w backend -- --runInBand` with a named disposable PostgreSQL database |
| Source guard regression | `source-pin.test.mjs` against synthetic fixtures only |
| Standing source identity | [Actual source preflight](01-standing-conformance.md#source-preflight-without-a-database) |
| Standing Receiver/Core scenario | [Standing conformance procedure](01-standing-conformance.md) |
| Migration upgrade and recovery | The standing conformance migration/fresh-process procedures |
| Deployment and live hardening | [Operations](../Operations/README.md) and [hardening procedure](../Operations/02-database-hardening.md) |

A check records its exact source, runtime, database scope, result, skipped layers, and claim ceiling.
Green static checks do not prove database, deployment, or consumer continuation.

Executed results and known evidence gaps belong in [Core/05](../Core/05-validation-and-evidence.md)
or the owning issue. This index does not store test history.
