# Cloud Receiver 2 Engineering

**Role:** Technical engineering policy and change-control authority
**Status:** Active baseline

## Routing

- [Development standard](01-development-standard.md) — safe implementation and documentation rules.
- [Testing and verification](02-testing-and-verification.md) — check selection and claim limits.
- [AI development procedures](../AI-Development/README.md) — AI-facing current-state, change,
  verification, handoff, and closure loop.
- [Legacy runbook path](03-primary-development-runbook.md) — compatibility pointer only; do not add
  new procedure or status here.
- [Core](../Core/README.md) — product and authority, not procedure.
- [Operations](../Operations/README.md) — runtime and release controls.

## Boundary

Engineering documents define repeatable technical controls and policy. They do not become a product
backlog, a status ledger, a transcript, or a second protocol contract. Step-by-step AI execution
belongs in [`AI-Development/`](../AI-Development/README.md). Update the smallest owning document
when a control changes and re-read the affected Core or module owner before closure.
