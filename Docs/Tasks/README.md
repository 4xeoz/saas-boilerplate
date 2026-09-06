# Cloud Receiver 2 Active Tasks

**Role:** Current bounded outcomes and next gates
**Status:** Active register

Tasks here are not a chronological work log. Each item has one outcome, one owner boundary, and one
reopen gate. Completed work is extracted into the owning Core, contract, or evidence document and
removed.

## Current tasks

| ID | Outcome | Next gate |
|---|---|---|
| [CR-TASK-001](CR-TASK-001-reconcile-core-source-identity.md) | Resolve the reviewed Re-entry Core source identity used by standing conformance. | Choose historical recovery or a new current pin; pass source inventory/bytes, then rerun conformance. |
| [CR-TASK-002](CR-TASK-002-run-disposable-database-verification.md) | Complete disposable PostgreSQL and standing migration/recovery verification. | Provision an explicitly disposable loopback database and run the documented suites serially. |
| [CR-TASK-003](CR-TASK-003-decide-standing-control-plane.md) | Accept or reject the expanded standing account-facing shell. | Decide lifetime, custody, CSRF, redaction, revocation, and snapshot semantics before shell implementation. |
| [CR-TASK-004](CR-TASK-004-close-deployment-release-evidence.md) | Close deployment and database-hardening release evidence. | Resolve image packaging and migration authority, then perform named preflight, health/readiness, rollback, secret-custody, and platform readback. |
| [CR-TASK-005](CR-TASK-005-cover-standing-consent-handoff.md) | Cover the implemented standing Consent handoff at the renderer and HTTP boundaries. | Renderer and mocked HTTP-boundary coverage now pass; add disposable-DB-backed namespace, login, expiry, redaction, same-user decision, and popup-origin integration coverage before treating the page contract as independently verified. |

See [Current status](../00-current-status.md) and [Roadmap](../Core/06-roadmap.md) for the claim
ceiling and dependency order. Do not add a task for a completed historical increment.
