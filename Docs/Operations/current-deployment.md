# Cloud Receiver 2 — Current Deployment

**Role:** Canonical mutable snapshot of the latest hosted deployment state
**Version:** `v0.1`
**Status:** Initial baseline; no release-qualified deployment
**Last verified:** 2026-09-15, Europe/London

This file contains the latest verified state only. It is updated in place after a deployment is
verified; material previous values are recorded in the [Deployment Change Register](deployment-history.md).
It is not an automatic monitoring feed and does not contain secrets or raw runtime output.

## Hosted snapshot

The service has separate frontend and backend Vercel projects. The two rows per environment must be
checked together before a release claim is made.

| Environment | Surface | Platform / project | URL or alias | Source / deployment identity | Database and migration state | Claim ceiling |
|---|---|---|---|---|---|---|
| Production | Frontend console | Vercel / `re-entry-cloud` | `https://re-entry-weld.vercel.app` | Dashboard label `4xeoz/saas-boilerplate@Eyad/Full-Integration:03be040`; abbreviated commit is not reproducible through the repository/GitHub readback | Frontend backend target and database mapping unverified | Hosted artifact; not release-qualified |
| Production | Backend API | Vercel / `cloud-receiver` | `https://cloud-receiver-delta.vercel.app` | Dashboard label `4xeoz/saas-boilerplate@Eyad/Full-Integration:03be040`; abbreviated commit is not reproducible through the repository/GitHub readback | Supabase project `re-entry` is `ACTIVE_HEALTHY`; live readback shows six initial Receiver migrations and RLS disabled on 36 public tables; hardening and current-source upgrade remain open | Hosted artifact; not release-qualified |
| Preview / `Re-Entry` | Frontend console | Vercel / `re-entry-cloud` | `https://re-entry-cloud-git-re-entry-eyads-projects-b54e035a.vercel.app` | Branch `Re-Entry`; reviewed Receiver source `fff93ebd81644904f28d24ab60d0ee587839fc02` | Public bundle currently targets Production backend `https://cloud-receiver-delta.vercel.app`; Preview database isolation unverified | Preview artifact; browser write test blocked |
| Preview / `Re-Entry` | Backend API | Vercel / `cloud-receiver` | `https://cloud-receiver-git-re-entry-eyads-projects-b54e035a.vercel.app` | Branch `Re-Entry`; reviewed Receiver source `fff93ebd81644904f28d24ab60d0ee587839fc02` | Preview database isolation and migration authority unverified; CORS currently allows Production frontend origin only | Preview artifact; browser write test blocked |

Vercel reports the listed deployments as `Ready`. That platform state does not prove source
equivalence, database separation, migration safety, rollback, or consumer continuation.

On 2026-09-15, the Vercel Preview environment mappings were corrected without changing either
Production alias or its deployment. The frontend Preview variable now targets the named Preview
backend, and the backend keeps the Production frontend value while using a separate Preview-only
frontend value. These settings require a new Preview deployment before they affect the currently
served artifacts; the existing Preview artifacts therefore remain bounded by the checks below.

## Latest bounded checks

| Check | Result | Evidence boundary |
|---|---|---|
| Frontend Production root | HTTP `200` | Hosted page availability only |
| Frontend `Re-Entry` Preview root | HTTP `200` | Hosted page availability only |
| Backend Production `/readyz` | HTTP `200` | Process/database readiness at that alias |
| Backend `Re-Entry` Preview `/readyz` | HTTP `200` | Process/database readiness at that alias |
| Production Supabase project | `re-entry`, `ACTIVE_HEALTHY`, `eu-central-1` | Metadata, migration inventory, and table inventory read through authenticated Supabase MCP; no SQL or data mutation |
| Production Supabase migration inventory | Six initial Receiver migrations visible; three later current-source Prisma migrations are absent from the live inventory | Schema/version drift evidence; migration authority and upgrade safety remain open |
| Production Supabase RLS inventory | RLS disabled on 36 public tables | Critical security advisory; no remediation SQL or policy change was applied |
| Anonymous protected pairing creation | HTTP `401` on Production and Preview | Authentication guard responds; no authenticated workflow claim |
| Current pairing-claim payload | Production `400 http_body_invalid`; Preview `404 pairing_not_found` with disposable authenticated accounts | Contract-drift evidence; not release qualification |
| Preview frontend public bundle backend target | `https://cloud-receiver-delta.vercel.app` | Preview frontend is wired to the Production backend; do not run mutating browser tests |
| Preview backend CORS for Preview frontend origin | `Access-Control-Allow-Origin: https://re-entry-weld.vercel.app` | Exact Preview origin is not allowed; browser continuation is not qualified |

## Unresolved release fields

| Field | Current value |
|---|---|
| Frontend `NEXT_PUBLIC_BACKEND_URL` target | Preview scope is set to `https://cloud-receiver-git-re-entry-eyads-projects-b54e035a.vercel.app`; current Preview artifact still needs redeployment |
| Backend `FRONTEND_URL` target | Production remains `https://re-entry-weld.vercel.app`; a Preview-only value is set to `https://re-entry-cloud-git-re-entry-eyads-projects-b54e035a.vercel.app`; current Preview artifact still needs redeployment |
| Preview versus Production database separation | Unverified; `CLOUD_RECEIVER_RUNTIME_DATABASE_URL` remains scoped to Production and Preview, and no Vercel database is connected |
| Supabase Preview branch | None; the `re-entry` project has no development branches in the current MCP readback |
| Supabase RLS and hardening | RLS is disabled on 36 public tables; prepared hardening migration remains unapplied and requires policy review before any live change |
| Supabase migration level | Live inventory contains six initial Receiver migrations; current source contains three later Prisma migrations not present in the live inventory |
| Vercel environment-variable names and scopes | Browser readback complete; secret values were not inspected |
| Exact platform deployment IDs | Not captured in the current dashboard readback |
| Migration authority | Open; startup migration still conflicts with the intended release sequence |
| Container route | Blocked by clean-context private `@saas/shared` resolution and migration-boundary issues |
| First release target | Undecided: Vercel serverless versus Docker/Compose |

## Update rule

Update this file only after the selected deployment has been verified on its named target. Replace
the affected current values; do not append dated snapshots here. Before replacement, add one concise
material change entry to the [Deployment Change Register](deployment-history.md). Update
[Current Status](../00-current-status.md) only when the claim ceiling or active gate changes.
