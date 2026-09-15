# Cloud Receiver 2 Active Tasks

**Role:** Current bounded outcomes and next gates
**Status:** Active register

Tasks here are not a chronological work log. Each item has one outcome, one owner boundary, and one
reopen gate. Completed work is extracted into the owning Core, contract, or evidence document and
removed.

## Current tasks

| ID | Outcome | Next gate |
|---|---|---|
| [CR-TASK-001](CR-TASK-001-reconcile-core-source-identity.md) | Integrate the accepted Core source boundary and complete its compatibility evidence. | Source identity and local standing/process scenarios pass; the existing database matrix passes; integrated-source and release verification remain open. |
| [CR-TASK-002](CR-TASK-002-run-disposable-database-verification.md) | Integrate the verified existing PostgreSQL baseline and complete missing coverage. | 203 backend tests and prior snapshot upgrade pass; rerun upgrade on the integrated Receiver commit. |
| [CR-TASK-003](CR-TASK-003-decide-standing-control-plane.md) | Accept or reject the expanded standing account-facing shell. | Decide lifetime, custody, CSRF, redaction, revocation, and snapshot semantics before shell implementation. |
| [CR-TASK-004](CR-TASK-004-close-deployment-release-evidence.md) | Close deployment and database-hardening release evidence. | Resolve image packaging and migration authority, then perform named preflight, health/readiness, rollback, secret-custody, and platform readback. |
| [CR-TASK-005](CR-TASK-005-cover-standing-consent-handoff.md) | Cover the implemented standing Consent handoff at the renderer and HTTP boundaries. | 13 real HTTP/database integration cases pass, including namespace, login, expiry, decisions, and served popup script; primary-session review and integration remain pending. |

See [Current status](../00-current-status.md) and [Roadmap](../Core/06-roadmap.md) for the claim
ceiling and dependency order. Do not add a task for a completed historical increment.
