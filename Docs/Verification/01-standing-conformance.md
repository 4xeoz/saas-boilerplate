# Standing v0.2 Receiver Conformance

**Role:** Reproducible source-pin and Receiver/Core conformance procedure
**Status:** Active; release conformance remains open

## Purpose and boundary

The conformance runner executes one shared standing-authorization scenario against the active Receiver. The
scenario and its reference implementation are imported from an explicitly selected Re-entry Core
checkout for test use; they do not become Receiver authority. The runner exercises real Express and
PostgreSQL state where the selected case requires it.

A passing scenario proves only the named test scope. It does not prove production deployment, public
control-plane policy, a runtime admission provider, consumer mapping, or an external continuation.

## Source pin

The default mode is `pinned`. Before importing Core or opening a database connection, the runner reads
`backend/conformance/standing-v0.2/core-pin.json`, which must contain exactly:

- `schema_version: 1`;
- `profile: standing-authorization-v0.2`; and
- a complete lowercase 40-character `core_commit`.

The selected pin and the source-layout blocker are recorded in
[CR-ISSUE-001](../Issues/CR-ISSUE-001-core-pin-does-not-match-current-checkout.md).
Every pin change requires review of the selected Core source, a fresh source-pin run, and a new
Receiver trace. A branch, tag, package version, floating checkout, or content digest cannot replace
the commit pin.

The source verifier checks the required recursive Core inventory, selected contract and mechanism
files, exact committed bytes, absence of unexpected source or symlinks, and post-run source identity.
It also rejects replacement objects and inherited routing variables that could redefine the source.

## What the procedure covers

- exact v0.2 target/method/header/body/size/canonical-response/no-store transport behavior;
- signed Manifest, Host-key pin, Consent/Grant authority, expiry, and target binding;
- positive contiguous Event sequence, duplicate identity, future sequence, conflict, and replay;
- atomic Event plus pending Delivery creation and injected transaction interruption;
- bounded claim/reclaim attempts, terminal exhaustion, and next-Event admission;
- effect-backed acknowledgement and its lease, Grant, Connector, and revocation fences; and
- fresh-process recovery of committed PostgreSQL state.

The Receiver module owns the implementation profile. This procedure verifies it against the pinned
shared oracle; it does not authorize changes to the public protocol or unresolved lifetime/control policy.

## Source preflight without a database

The guard unit suite creates synthetic repositories; it does not inspect the selected checkout:

```sh
node --test backend/conformance/standing-v0.2/source-pin.test.mjs
```

For actual source identity, run from the Receiver repository root with an explicitly selected
absolute Core Git root. This reads source only and must succeed before any database rehearsal:

```sh
REENTRY_CONFORMANCE_ROOT=/absolute/path/to/selected-core node --input-type=module <<'NODE'
import { verifyConformanceSource } from './backend/conformance/standing-v0.2/source-pin.mjs';
const verified = await verifyConformanceSource({
  coreRoot: process.env.REENTRY_CONFORMANCE_ROOT,
  receiverRoot: process.cwd(),
  mode: 'pinned',
});
console.log(verified.identity);
await verified.verifyUnchanged();
NODE
```

A failure is a source gate, not permission to repin, reconstruct missing contracts, or fall back to
development mode. Success proves source identity only; the scenario and release gates remain separate.

## Reproduction prerequisites

Use Node 24 and the repository's pinned npm version. Provision a new disposable PostgreSQL instance
on loopback, and never point these checks at a runtime or shared database. Set `NODE_ENV=test` and
provide all database aliases explicitly to the same verified disposable database:

- `DATABASE_URL`
- `DIRECT_URL`
- `CLOUD_RECEIVER_RUNTIME_DATABASE_URL`
- `STANDING_MIGRATION_TEST_DATABASE_URL`
- `STANDING_RACE_TEST_DATABASE_URL`
- `STANDING_CONSENT_CONCURRENCY_TEST_DATABASE_URL`

Set `REENTRY_CONFORMANCE_ROOT` to the absolute Git root of the selected Core checkout. The runner
rejects missing configuration, non-loopback URLs, query/fragment overrides, and an absent source pin.
The caller remains responsible for proving that the database is disposable.

Representative commands from the repository root:

```sh
npm ci
npm run db:migrate -w backend
npm run test -w backend -- --runInBand
npm run type-check
npm run build
node --test backend/conformance/standing-v0.2/source-pin.test.mjs
node --test backend/conformance/standing-v0.2/receiver.test.mjs
node --test backend/conformance/standing-v0.2/fresh-process.test.mjs
node --test backend/conformance/standing-v0.2/migration-upgrade.test.mjs
```

Run lock-barrier suites serially. Migration rehearsal refuses a populated database, never resets or
repairs existing data, and retains its temporary snapshots for diagnosis.

## Modes and claim limits

`pinned` is the only mode that can report `source_identity_verified: true`; it still does not imply
`release_conformance_verified`. The full v0.1/v0.2 matrix, exact Receiver/lock/migration identities,
mandatory CI/release enforcement, deployed-role access, production lease profile, and hosted readback
are separate gates.

`REENTRY_CONFORMANCE_MODE=development` is explicit local development mode. It fingerprints the selected
scope before and after the run, but reports source identity and release conformance as unverified. It
is not a fallback for a missing or changed pin. The selected checkout must still satisfy the
verifier's selected source inventory. A missing required contract file fails closed with
`conformance_source_missing`; see CR-ISSUE-001 for the recorded compatibility failure.

The shared scenario uses a deterministic test effect authority and typed service seams where public
control pages are not implemented. A process restart in a test is not proof of supervision, distributed
ownership, power-loss recovery, or hosted continuity.

## Evidence record

For every result retained outside the local session, record:

- Receiver and Core commit identities plus the selected source inventory;
- Node, npm, PostgreSQL, Prisma, and host versions;
- disposable database identity and fixture scope without credentials or row dumps;
- exact command, mode, test count, and pass/fail/skip result;
- migration and lock identities where applicable;
- the highest verification level and claim supported; and
- skipped or untested layers, residual risk, and the executable reopen gate.

A green source verifier, a focused suite, or a local trace is not a production release claim.

## Maintenance

Keep implementation contracts in the owning module and current results in
[Validation and Evidence](../Core/05-validation-and-evidence.md) or the owning issue.
Rerun source preflight and affected scenarios when their inputs change; do not append execution logs.
