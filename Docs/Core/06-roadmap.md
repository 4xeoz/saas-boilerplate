# Cloud Receiver 2 — Roadmap

**Role:** Ordered remaining outcomes, dependencies, and release gates
**Status:** Current target; dates are intentionally omitted until evidence supports them

The roadmap is outcome-based. A completed implementation increment is not a release until its
required evidence and deployment boundary are closed.

## Ordered outcomes

| Order | Outcome | Dependency and gate |
|---|---|---|
| 1 | Reconcile the Re-entry Core source identity used by conformance. | Owner chooses a reviewed historical recovery source or a new current pin; source inventory and bytes must pass before protocol claims are updated. |
| 2 | Complete disposable PostgreSQL verification for v0.1 and standing v0.2. | Run migrations, focused suites (including the shared Consent handoff HTTP coverage tracked by [CR-TASK-005](../Tasks/CR-TASK-005-cover-standing-consent-handoff.md)), race/restart suites, and pinned conformance on a named non-runtime database. |
| 3 | Decide whether and how to expose the expanded standing account-facing shell. | Accept lifetime, renewal, redaction, CSRF, token custody, login continuation, revocation, and snapshot semantics before shell implementation. |
| 4 | Complete database hardening and deployment closure. | Review Supabase preflight, apply only through the migration owner, verify health/readiness, rollback, secret custody, and platform identity. |
| 5 | Establish a supported consumer compatibility profile. | Consumer owns event mapping and page workflow; Receiver and Core pins, API vectors, and effect boundaries must be jointly read back. |
| 6 | Make a release decision for the service. | All required static, database, process, deployment, and consumer evidence rows are current; residual unknowns remain explicit. |

## Non-goals for this roadmap

Do not add speculative transports, hidden compatibility fallbacks, multi-instance ownership, Grant
listing/management beyond the accepted authenticated `/v0.2` controls, quota policy, consumer-specific
business rules, or production claims merely to make a roadmap look complete. Each would require a
separate accepted contract and evidence plan.

## Replanning rule

Change the order only when a dependency, authority boundary, or evidence result changes. Update
[Current status](../00-current-status.md) with the strongest supported claim and the next executable
gate; do not append a chronological project diary here.
