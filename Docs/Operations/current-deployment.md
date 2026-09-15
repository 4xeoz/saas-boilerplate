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
| Production | Backend API | Vercel / `cloud-receiver` | `https://cloud-receiver-delta.vercel.app` | Dashboard label `4xeoz/saas-boilerplate@Eyad/Full-Integration:03be040`; abbreviated commit is not reproducible through the repository/GitHub readback | Migration authority and database mapping unverified | Hosted artifact; not release-qualified |
| Preview / `Re-Entry` | Frontend console | Vercel / `re-entry-cloud` | `https://re-entry-cloud-git-re-entry-eyads-projects-b54e035a.vercel.app` | Branch `Re-Entry`; reviewed Receiver source `fff93ebd81644904f28d24ab60d0ee587839fc02` | Preview isolation and frontend backend target unverified | Preview readback only |
| Preview / `Re-Entry` | Backend API | Vercel / `cloud-receiver` | `https://cloud-receiver-git-re-entry-eyads-projects-b54e035a.vercel.app` | Branch `Re-Entry`; reviewed Receiver source `fff93ebd81644904f28d24ab60d0ee587839fc02` | Preview isolation and migration authority unverified | Preview readback only |

Vercel reports the listed deployments as `Ready`. That platform state does not prove source
equivalence, database separation, migration safety, rollback, or consumer continuation.

## Latest bounded checks

| Check | Result | Evidence boundary |
|---|---|---|
| Frontend Production root | HTTP `200` | Hosted page availability only |
| Frontend `Re-Entry` Preview root | HTTP `200` | Hosted page availability only |
| Backend Production `/readyz` | HTTP `200` | Process/database readiness at that alias |
| Backend `Re-Entry` Preview `/readyz` | HTTP `200` | Process/database readiness at that alias |
| Anonymous protected pairing creation | HTTP `401` on Production and Preview | Authentication guard responds; no authenticated workflow claim |
| Current pairing-claim payload | Production `400 http_body_invalid`; Preview `404 pairing_not_found` with disposable authenticated accounts | Contract-drift evidence; not release qualification |

## Unresolved release fields

| Field | Current value |
|---|---|
| Frontend `NEXT_PUBLIC_BACKEND_URL` target | Unverified |
| Preview versus Production database separation | Unverified |
| Vercel environment-variable names and values | Not inspected; verify target and presence without recording secrets |
| Exact platform deployment IDs | Not captured in the current dashboard readback |
| Migration authority | Open; startup migration still conflicts with the intended release sequence |
| Container route | Blocked by clean-context private `@saas/shared` resolution and migration-boundary issues |
| First release target | Undecided: Vercel serverless versus Docker/Compose |

## Update rule

Update this file only after the selected deployment has been verified on its named target. Replace
the affected current values; do not append dated snapshots here. Before replacement, add one concise
material change entry to the [Deployment Change Register](deployment-history.md). Update
[Current Status](../00-current-status.md) only when the claim ceiling or active gate changes.
