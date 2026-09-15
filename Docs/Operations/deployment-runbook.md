# Cloud Receiver 2 Deployment Runbook

**Role:** Canonical route-selection and execution procedure for hosted Receiver deployments
**Version:** `v0.1`
**Status:** Initial baseline; release closure open
**Owner:** Receiver Operations and the backend/frontend release boundary

This runbook selects a deployment route, names the gates that must pass, and defines the required
post-deployment writeback. It does not record the current deployment or a chronological work log.

## Start here

- [Current Deployment](current-deployment.md) — the one mutable hosted snapshot.
- [Deployment Change Register](deployment-history.md) — the append-only record of material changes.
- [Runtime, Deployment, and Recovery](01-runtime-deployment-recovery.md) — process shapes,
  migration order, health, and recovery controls.
- [Database Hardening](02-database-hardening.md) — prepared hardening migration and live-change gate.
- [CR-TASK-004](../Tasks/CR-TASK-004-close-deployment-release-evidence.md) — active release outcome
  and next gate.

## Ownership boundary

| Surface | This runbook covers | Owning implementation |
|---|---|---|
| Frontend console | Hosted build, alias, backend target, and browser smoke | `frontend/` |
| Backend API | Hosted handler, source identity, migrations, health, and rollback | `backend/` |
| Database | Target identity, migration authority, backup/preflight, and recovery boundary | `backend/prisma/` and Operations |

Re-entry Core, Host SDK, Local Connector, Agent Adapter, and Sleepless Kingdom remain sibling
boundaries. This runbook records only the Receiver deployment facts they consume; it does not publish
their packages or qualify their consumer continuation.

## Route selection

| Situation | Route | Required boundary | Deployment record |
|---|---|---|---|
| Local development or procedure rehearsal | Local process or Docker Compose | Explicitly disposable database and local-only credentials | Do not update the hosted snapshot |
| Branch integration check | Vercel Preview for the named branch | Current source identity, isolated database, frontend-to-backend target, and bounded smoke checks | Record only if the hosted mapping or claim changes |
| Production candidate | Vercel Production or an explicitly selected container target | All release gates below, approved migration order, rollback, and consumer scope | Update Current Deployment after verification |
| Container release | Docker/Compose | Clean-context package resolution and accepted migration authority | Blocked while CR-ISSUE-002 or CR-ISSUE-003 remains open |
| Rollback or recovery | Last verified artifact on the named target | Known database state, approved rollback, health/readiness, and duplicate-effect check | Record the material change and residual risk |

The initial baseline keeps Vercel and Docker as separate candidate routes. A Vercel `Ready` status
does not select Vercel as the release target and does not qualify a release.

## Preflight gates

Before changing a hosted target, record or verify each item against the exact environment:

1. **Source:** repository, branch or ref, full commit SHA, build root, and deployment ID. A short or
   unresolvable platform label is an unresolved source identity.
2. **Platform:** project, environment, alias, region/runtime where relevant, and the intended target.
3. **Configuration:** required environment-variable names, target environments, and public URL
   wiring. For a browser-backed Preview check, prove that the built public bundle points to the
   named Preview backend and that the backend allows the exact Preview frontend origin. If either
   side points at Production or the origins do not match, stop before submitting credentials or
   mutating requests. Never copy secret values into this repository.
4. **Database:** target identity, Preview/Production separation, backup or disposable scope, and
   the migration role and order.
5. **Packaging:** clean Vercel build or clean container context, including every private workspace
   dependency required by the selected route.
6. **Access and health:** liveness, readiness, one protected authentication check, and one approved
   workflow at the declared evidence level.
7. **Rollback:** exact previous artifact, target scope, rollback action, and a way to verify that no
   duplicate Event, Delivery, effect, or migration transition was introduced.

If any item is unknown, leave the target unchanged and route the gap to the relevant Task or Issue.

## Execution and writeback

1. Capture the existing [Current Deployment](current-deployment.md) snapshot before the change.
2. Build or deploy the selected artifact without changing an unrelated environment.
3. Run migrations only through the accepted migration boundary, before routing traffic.
4. Verify source, configuration, database scope, health/readiness, authentication, and the approved
   workflow on the named target.
5. If the external state materially changed, append one entry to the [Deployment Change Register](deployment-history.md)
   describing the previous and new state.
6. Replace the affected values in [Current Deployment](current-deployment.md) in the same
   documentation commit. Update Current Status or the active Task only when its claim or next gate
   changes.
7. Fetch, inspect the exact diff, run the repository documentation and affected verification checks,
   then commit and push the owning repository through the normal Git closure procedure.

An unsuccessful retry is not a history entry unless it changed an external target, left a durable
artifact, or changed a release decision.

## Stop conditions and claim ceiling

Stop before routing traffic when source identity, environment wiring, database separation, migration
authority, rollback, or authentication is unknown; when a current contract fails on the target; or
when a deployment is only supported by a platform `Ready` badge, a health response, a local test, or
a frontend screen. Those observations remain bounded evidence and must not be promoted to a release
claim.

Keep credentials, tokens, connection strings, private task identifiers, row data, and raw logs out of
all three deployment documents. Link to a redacted evidence record when the result changes a claim.

## Maintenance rule

The runbook owns route and gate rules. The Current Deployment file owns only the latest verified
snapshot. The Deployment Change Register owns only material external changes. Do not copy either
record into this runbook, a README, or a second status ledger.
