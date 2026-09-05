# CR-TASK-002 — Run disposable database verification

**Status:** Open
**Owner:** Backend verification boundary

## Outcome

Run the backend module, migration, race, restart, and standing conformance suites against one newly
provisioned disposable loopback PostgreSQL database and retain only redacted claim-level evidence.

## Current boundary

The local TypeScript and build checks pass, but the aggregate Jest command exits before tests because
no database URL is configured. The conformance procedure requires all named database aliases to point
to the same verified disposable target.

## Next gate

Provision the disposable database, apply the reviewed migration set, run the suites serially, record
runtime/source/database identities and counts, and update [Validation and evidence](../Core/05-validation-and-evidence.md).
