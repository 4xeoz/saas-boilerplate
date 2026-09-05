# Development Standard

**Role:** Safe implementation and documentation change controls
**Status:** Current baseline

## Source of truth

Before changing behavior, identify the owning Core document, module contract, schema/migration,
focused tests, and current runtime or release evidence. Code and tests describe implemented behavior;
Core and module documents describe intended authority. Do not silently resolve a conflict by making
the prose match an unreviewed implementation.

## Change boundaries

- Keep User, Developer, Organization, Host, Connector, Grant, Event, Delivery, and runtime-admission
  authority in their owning module.
- Do not add consumer-specific mapping or a copied Re-entry contract to this repository.
- Do not change identity, Event order, Delivery effects, secret custody, database lifecycle, or
  public standing controls without an accepted decision and focused verification.
- Documentation cleanup may delete only reviewed documentation targets. It must not delete source,
  tests, migrations, deployment configuration, assets, or recovery material.
- Never commit secrets, raw tokens, connection strings, row dumps, or generated output.

## Implementation shape

Prefer one explicit boundary and one real consumer over speculative abstractions, hidden fallbacks,
or compatibility shims. Unsupported capability fails visibly. Keep validation before mutation and
make scope, idempotency, expiry, and failure behavior explicit in the owning contract.

## Closure

Every increment names its changed authority and evidence level, runs the narrowest meaningful check,
re-reads the affected Core/module/status documents, scans for stale links and claim drift, and commits
only exact owned paths. A commit or green check is not deployment or release proof.
