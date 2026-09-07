# AI Development

**Role:** CANONICAL AI-facing development execution and collaboration procedure
**Status:** Active
**Last updated:** 2026-09-06

This directory defines how an AI agent, or a human collaborator using the same controls, executes a
bounded Cloud Receiver 2 change. It owns repeatable development, test-execution, evidence-closure,
and agent-collaboration procedure. It does not define product or HTTP contracts, database authority,
deployment state, task status, or historical work logs.

## Read order

1. Establish the actual repository root, branch, ownership, and dirty-file boundary.
2. Read [`Docs/README.md`](../README.md) and [`00-current-status.md`](../00-current-status.md).
3. Identify the owning Core, Contract, module, Task, Issue, or ADR.
4. Read the applicable Engineering policy and the narrowest procedure in this directory.
5. Read Verification or Operations procedures only when the intended claim requires them.

The workspace Charter and continuous steward prompt coordinate documentation work but are not a
dependency of a clean repository clone. This directory cannot override system, developer, user,
accepted Core/Contract/ADR authority, or exact code, database, runtime, and release evidence.

## Canonical procedures

| Need | Owner |
|---|---|
| Development session, scope, implementation, failure triage, writeback, Git closure, and reopen | [Development Process Runbook](01-development-process-runbook.md) |
| Test design, selection, execution, interpretation, and claim limits | [Test Design, Selection, and Execution Runbook](02-test-design-selection-execution-runbook.md) |
| Engineering quality and change-control policy | [`Docs/Engineering/`](../Engineering/README.md) |
| Reproducible checks and evidence levels | [`Docs/Verification/`](../Verification/README.md) |
| Runtime, migration, deployment, health, and recovery | [`Docs/Operations/`](../Operations/README.md) |
| Product, service contracts, tasks, issues, and current truth | [`Docs/Core/`](../Core/README.md), [`Contracts/`](../Contracts/README.md), [`Tasks/`](../Tasks/README.md), and [`00-current-status.md`](../00-current-status.md) |

## Procedure and evidence boundary

Runbooks state how to obtain evidence; they must not become transcripts, command-output archives,
status ledgers, or completed-task histories. Record exact commands, source revisions, database
scope, environments, results, skipped checks, claim ceilings, and residual risks in
[Core/05](../Core/05-validation-and-evidence.md), Tasks, Issues, or the owning evidence record.
Verification owns reproducible scenarios, not a second results ledger.

The primary session owns substantive edits, authority reconciliation, final staging, commit, and
any separately authorized push or external action. Supporting agents may inspect bounded evidence,
run assigned checks, or provide review, but may not change decisions, touch the Git index, commit,
push, deploy, publish, or claim closure.

## Maintenance

Update a procedure only when repeated execution evidence shows that a control is missing, ambiguous,
too costly, or routinely bypassed. Keep one rule in one owner, preserve project-authored artifacts in
English, and reopen the increment when source, tests, database, deployment evidence, or a new
consumer changes the claim boundary.
