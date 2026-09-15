# Standing v0.2 Conformance Runner

This directory contains the Receiver/Core scenario, source-identity guard, and process/migration
fixtures. It is not a release or protocol authority.

| File | Responsibility |
| --- | --- |
| `core-pin.json` | Reviewed Core commit selection |
| `source-pin.mjs` | Actual pre-import source verification |
| `source-pin.test.mjs` | Guard regression tests using synthetic repositories |
| `receiver-process.mjs`, `receiver.test.mjs` | Shared scenario wrapper and execution |
| `fresh-process.test.mjs` | Process recovery verification |
| `migration-upgrade.mjs`, `migration-upgrade.test.mjs` | Exact-source nine-migration upgrade preservation and guard tests |
| `disposable-postgres.py` | Provision, run against, and stop an owned local test cluster without deletion |
| `disposable-database.cjs`, `disposable-database.test.mjs` | Private fixture proof, alias checks, live cluster identity, and negative tests |

Use the [conformance procedure](../../../Docs/Verification/01-standing-conformance.md) for
source preflight, disposable-database safety, commands, modes, and evidence limits. Current blockers
remain in [CR-ISSUE-001](../../../Docs/Issues/CR-ISSUE-001-core-pin-does-not-match-current-checkout.md).
