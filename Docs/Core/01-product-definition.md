# Cloud Receiver 2 — Product Definition

**Role:** Stable product purpose, ownership, actors, and scope
**Status:** Current baseline

## Purpose

Cloud Receiver 2 is an independently deployable service that receives authenticated, signed
continuation Events from a Host, records the accepted authority and history, and delivers bounded
work to an account-owned Connector. A separately verified effect may acknowledge one Delivery. The
service also provides the User and Developer account surfaces required to establish and inspect those
boundaries.

The value is durable, target-scoped continuation: a Host can request a later bounded continuation
without handing its database, credentials, or business authority to the Connector or the Receiver
frontend. The Receiver makes admission, scope, ordering, retry, and revocation explicit rather than
turning a signal into an unbounded automation promise.

## Actors and ownership

| Actor or surface | Responsibility | Not its authority |
|---|---|---|
| User | Owns account, Connector pairing, consent decisions, and own Grant controls | Developer organization or Host identity |
| Developer | Owns organizations, API keys, and redacted organization history | User consent or Delivery effect |
| Organization | Server-side owner of Host keys and enrollment requests | User approval or Connector credentials |
| Host | Signs its Manifest and Events and owns domain state and human consequences | Receiver admission or another account's scope |
| Connector | Claims one target-scoped Delivery and presents effect evidence | Grant creation, Event admission, or human outcome |
| Receiver backend | Validates, persists, leases, fences, and exposes bounded HTTP contracts | Host business rules or arbitrary runtime admission |
| Receiver frontend | Provides browser-facing account, consent, and developer controls | Database access, secret custody, or protocol authority |
| Runtime admission authority | Optional explicitly injected authority for standing handoff | A caller boolean, token alone, or process exit |

## Product promise

- Accepted authority is explicit, scoped to an account, Host subject, Connector target, Event, and
  protocol version.
- Event acceptance, durable history, and eligible Delivery creation are one transaction.
- Delivery is at-least-once; domain effects are once-only by Event/Delivery identity and verified
  effect context.
- Retries, expiry, revocation, and unsupported capability produce bounded visible outcomes.
- Raw pairing codes, API keys, Connector tokens, consent tokens, lease tokens, effect credentials,
  and private account or Grant fields remain inside their owning boundary.

## Product boundary

This repository owns the Receiver service, database schema and migrations, operator-facing frontend,
health/readiness behavior, and its reproducible conformance procedure. A consuming application owns
its domain Event mapping, adapter, page workflow, WebMCP registration, and human consequence. Re-entry
Core owns reusable protocol contracts; this repository consumes a reviewed source identity rather than
becoming the Core authority.

WebMCP may be used by a consumer page as an optional browser capability. Cloud Receiver 2 remains an
HTTP, persistence, and authority service; WebMCP is never a substitute for backend admission,
consent, delivery, acknowledgement, or human review.

## Non-goals

- a combined User/Developer role model or OAuth provider;
- direct browser or Connector access to PostgreSQL/Supabase;
- unbounded standing authority, hidden retries, or automatic human-consequence execution;
- consumer-specific gameplay, UI, event vocabulary, or deployment policy;
- an expanded account-facing standing control plane before its lifetime, redaction, CSRF, custody,
  and revocation decisions are accepted; or
- a production or end-to-end claim based only on local source, tests, or a frontend screen.

## Ownership changes

Changing identity scope, Event ordering, Delivery effects, Grant authority, secret custody, public
control surfaces, or the Re-entry compatibility profile is a durable contract change. It requires an
accepted decision and updates to the owning contract, tests, migration review, and current status.
