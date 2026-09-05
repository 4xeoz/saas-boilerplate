# Standing v0.2 Receiver Conformance

**Role:** Reproducible source-pin and Receiver/Core conformance procedure
**Status:** Active; release conformance remains open

## Purpose and boundary

This directory runs one shared standing-authorization scenario against the active Receiver. The
scenario and its reference implementation are imported from an explicitly selected Re-entry Core
checkout for test use; they do not become Receiver authority. The runner exercises real Express and
PostgreSQL state where the selected case requires it.

A passing scenario proves only the named test scope. It does not prove production deployment, public
control-plane policy, a runtime admission provider, consumer mapping, or an external continuation.

## Source pin

The default mode is `pinned`. Before importing Core or opening a database connection, the runner reads
`core-pin.json`, which must contain exactly:

- `schema_version: 1`;
- `profile: standing-authorization-v0.2`; and
- a complete lowercase 40-character `core_commit`.

The current pin is `1446d73aa3e66533547471728ad8fa5344d51f9e`. Every pin change requires review of the
selected Core source, a fresh source-pin run, and a new Receiver trace. A branch, tag, package version,
floating checkout, or content digest cannot replace the commit pin.

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
is not a fallback for a missing or changed pin.

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

## File map

- `core-pin.json` — reviewed Core commit selection.
- `source-pin.mjs` and `source-pin.test.mjs` — pre-import source identity guard.
- `receiver-process.mjs` and `receiver.test.mjs` — shared scenario wrapper and execution.
- `fresh-process.test.mjs` — committed-state and transaction-interruption recovery boundary.
- `migration-upgrade.mjs` and `migration-upgrade.test.mjs` — exact-source migration rehearsal.

## Maintenance

Keep this README procedural and bounded. Put module rules in the standing README, current claims in
`Docs/00-current-status.md`, and fresh results in the owning release/evidence record. When the Core pin
or Receiver contract changes, rerun source preflight and the affected scenario before updating any claim.
