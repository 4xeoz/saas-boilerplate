# Test Design, Selection, and Execution Runbook

**Role:** CANONICAL AI-facing test design and execution procedure
**Status:** Active
**Last updated:** 2026-09-06

This runbook tells an AI agent how to apply the [Testing and Verification policy](../Engineering/02-testing-and-verification.md)
to one bounded Cloud Receiver 2 change. It obtains evidence; it does not define product or HTTP
contracts, database authority, deployment state, or release permission.

## 1. Define the falsifiable question

Before writing or running a test:

1. identify the owning Core, Contract, module, Task, Issue, ADR, or verified defect;
2. state one observable behavior and the smallest result that could falsify it;
3. name affected API, identity, database, migration, delivery, runtime, and external-effect boundaries;
4. select the highest claim the evidence is intended to support; and
5. choose the causal path rather than a private helper as the test unit.

Use the policy's evidence ladder and claim limits. A type check, build, source interface, or green
focused test does not prove database behavior, deployment, hosted admission, or consumer continuation.

## 2. Select the narrowest sufficient check

Start with the smallest check that can fail, then expand only when the changed contract requires it:

| Changed surface | Minimum procedure |
|---|---|
| Type or frontend/backend consistency | `npm run type-check` |
| Production bundle | `npm run build` |
| Backend module or database transition | `npm test -w backend -- --runInBand` with a newly provisioned disposable PostgreSQL database |
| Standing source identity | `node --test backend/conformance/standing-v0.2/source-pin.test.mjs` against the named pinned sibling source |
| Migration, health, deployment, or recovery claim | The applicable Verification and Operations procedure with exact target identity |
| Documentation only | Link, language, stale-claim, diff, and affected-module reread |

Before a complete aggregate, record the affected surfaces, selected suites, database scope, reusable
evidence, minimum reproducer, intentionally skipped checks, and the condition that reopens the aggregate.

## 3. Build safe, causal fixtures

- Use a newly provisioned, explicitly disposable PostgreSQL database for database-backed suites.
- Set `NODE_ENV=test` and isolate credentials, accounts, organizations, connectors, events, and files.
- Inject transaction, transport, replay, lease, expiry, migration, and unavailable-service failures at
  explicit boundaries.
- Never use production credentials, production rows, or an unknown remote database in lower-level tests.

## 4. Execute and interpret

1. Run focused positive, negative, authorization, duplicate, stale, replay, ordering, and migration
   cases that the changed contract can affect.
2. Run affected transitive checks, type/build checks, and the complete applicable local baseline when
   the intended claim requires it.
3. Record exact command, source revision, runtime, database scope, environment, result, and evidence level.
4. Classify failure as implementation defect, expectation drift, environment constraint, unsupported
   capability, external failure, partial outcome, or unknown outcome.
5. Return to the narrowest failing reproducer after each diagnostic edit; do not weaken checks, hide a
   migration discrepancy, or silently substitute a fixture for a real database or deployment claim.

## 5. Evidence and closure

The runbook does not store raw output or chronological history. Write the result to Verification,
Tasks, Issues, or the owning evidence record with:

- exact command or replayable procedure;
- source revision, runtime, database and target scope;
- pass, fail, skip, gated, expected-fail, or flaky status;
- highest justified evidence level and claim ceiling;
- reusable evidence and invalidation conditions; and
- residual risk and one executable next gate.

Re-read the affected module, its README, current status, roadmap, task or issue, and this runbook before
closure. Reopen when code, tests, schema, migration, authority, deployment evidence, or a new consumer
changes the claim.
