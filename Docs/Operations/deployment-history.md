# Cloud Receiver 2 — Deployment Change Register

**Role:** Append-only record of material hosted deployment changes
**Version:** `v0.1`
**Status:** Initial baseline

This register preserves decisions that remain useful after the Current Deployment snapshot changes.
It is not a Git log, retry transcript, monitoring feed, or raw evidence archive.

## Register rules

- Add an entry only when an external deployment, URL, source identity, environment mapping,
  migration boundary, release qualification, rollback, or recovery decision materially changes.
- The first entry may establish the baseline when an existing hosted readback is moved into this
  register; it records the evidence boundary, not a deployment event.
- Each entry states the date, environment, surface, previous state, new state, reason, verification,
  rollback reference, and residual claim limit.
- Use a stable entry ID. Keep source revisions and deployment IDs exact when available; mark unknown
  values as unknown rather than reconstructing them.
- Do not record secrets, tokens, connection strings, private task identifiers, row data, raw logs, or
  every retry.
- Append the entry before replacing the corresponding values in [Current Deployment](current-deployment.md),
  in the same documentation commit.

## DCR-2026-09-15-001 — Establish the initial hosted baseline

- **Scope:** Vercel Production and `Re-Entry` Preview for the frontend console and backend API.
- **Previous state:** Hosted deployment facts were embedded in the runtime procedure without a
  dedicated current snapshot or change register.
- **New state:** The latest hosted facts now have one mutable owner and one bounded change register.
- **Reason:** Establish one current deployment owner and preserve the platform readback that was
  previously embedded in the runtime procedure.
- **Recorded change:** The current aliases, project names, platform source labels, bounded HTTP
  checks, and unresolved release fields now live in [Current Deployment](current-deployment.md).
- **Readback:** Production and Preview frontend roots returned HTTP `200`; both backend `/readyz`
  endpoints returned HTTP `200`; anonymous protected pairing creation returned HTTP `401`.
- **Material warning:** Production reports the abbreviated source label `03be040`, which is not
  currently reproducible through the repository/GitHub readback. The current reviewed Preview source
  is Receiver branch `Re-Entry` at `fff93ebd81644904f28d24ab60d0ee587839fc02`.
- **Residual claim limit:** The hosted artifacts are not release-qualified. Frontend backend target,
  Preview/Production database separation, migration authority, rollback, and consumer continuation
  remain open.

## DCR-2026-09-15-002 — Stage Preview-only origin wiring

- **Scope:** Vercel Preview environment configuration for `re-entry-cloud` and `cloud-receiver`.
- **Previous state:** The frontend Preview variable targeted the Production backend. The backend
  `FRONTEND_URL` value was shared by Production and Preview and pointed to the Production frontend.
- **New state:** The frontend Preview value targets
  `https://cloud-receiver-git-re-entry-eyads-projects-b54e035a.vercel.app`. The backend Production
  value remains `https://re-entry-weld.vercel.app`; a separate Preview-only value targets
  `https://re-entry-cloud-git-re-entry-eyads-projects-b54e035a.vercel.app`.
- **Reason:** Separate the Preview route while preserving the Production aliases and deployments
  used for the OpenAI WebMCP Challenge.
- **Readback:** Vercel Browser readback shows the expected environment scopes. The Production
  frontend root and backend `/readyz` remained HTTP `200`, and no Production deployment or alias
  was changed. A new Preview deployment is required before the saved values affect served bundles.
- **Residual claim limit:** Preview/Production database separation remains unverified. The
  `CLOUD_RECEIVER_RUNTIME_DATABASE_URL` secret is still scoped to Production and Preview, Vercel
  Storage reports no connected database, and no Preview redeploy or mutating browser check has run.
