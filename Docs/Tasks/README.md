# Cloud Receiver 2 Active Tasks

**Role:** Current bounded outcomes and next gates
**Status:** Active register

Tasks here are not a chronological work log. Each item has one outcome, one owner boundary, and one
reopen gate. Completed work is extracted into the owning Core, contract, or evidence document and
removed.

## Current tasks

| ID | Outcome | Next gate |
|---|---|---|
| CR-TASK-001 | Resolve the reviewed Re-entry Core source identity used by standing conformance. | Choose historical recovery or a new current pin; pass source inventory/bytes, then rerun conformance. |
| CR-TASK-002 | Complete disposable PostgreSQL and standing migration/recovery verification. | Provision an explicitly disposable loopback database and run the documented suites serially. |
| CR-TASK-003 | Accept or reject a public standing control-plane contract. | Decide lifetime, custody, CSRF, redaction, revocation, and snapshot semantics before implementation. |
| CR-TASK-004 | Close deployment and database-hardening release evidence. | Perform named preflight, migration, health/readiness, rollback, secret-custody, and platform readback. |

See [Current status](../00-current-status.md) and [Roadmap](../Core/06-roadmap.md) for the claim
ceiling and dependency order. Do not add a task for a completed historical increment.
