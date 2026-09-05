# Cloud Receiver 2 — System Design

**Role:** Component topology, authority flow, persistence boundary, and compatibility composition
**Status:** Current implementation baseline

## Topology

```text
Host application
  -- signed Manifest / Event over bounded HTTP --> Receiver backend
                                                     |
                                                     +--> PostgreSQL (backend-only)
                                                     +--> User/Developer browser controls
                                                     +--> Connector lease and acknowledgement
                                                     +--> optional injected runtime-admission authority

User browser <--> Receiver frontend <--> Receiver backend
Connector      <--> Receiver backend
Consumer page  -- optional WebMCP capability; owns page workflow and human outcome
Re-entry Core  -- reviewed source contract consumed by conformance only
```

The backend is the only database client. The frontend, Connector, and consumer page use HTTP or
their own Host/runtime boundaries; none receives a database credential.

## Process and deployment composition

- `backend/src/index.ts` owns the standalone listener and graceful shutdown.
- `backend/api/index.ts` exports the same Express app for a serverless handler without calling
  `listen()`.
- `frontend/` is a separate Next.js application whose public backend origin is build-time
  configuration.
- `docker-compose.yml` composes PostgreSQL, backend, and frontend on an internal network with
  health-gated startup. The Dockerfiles run as an unprivileged user.
- The current Dockerfiles use backend/frontend subdirectories as build contexts although both
  workspaces depend on the private root `@saas/shared` package; clean image builds currently fail
  before compilation (see [CR-ISSUE-003](../Issues/CR-ISSUE-003-docker-workspace-package-install.md)).
- `supabase/` contains a prepared backend-only hardening migration; it is not automatically applied
  by build, request handling, or this documentation reset.

## Authority flow

1. Authentication creates or verifies a User or Developer session in its own account model.
2. A User creates a pairing session; a cookie-free Connector claims it with the pairing fields and
   receives its raw token once. Only the token digest is persisted.
3. An Organization API key registers a Host public key and submits a signed Manifest. The User
   decides through a Receiver-owned page; approval selects an eligible Connector and creates one
   target binding plus a Grant.
4. A Host signs the next Event for the Grant. The Receiver rechecks key, origin, scope, time,
   sequence, replay identity, and revocation under the database authority barrier, then creates one
   Event and one pending Delivery atomically.
5. A Connector claims a bounded lease. The Host/runtime effect is outside this repository; its
   verifier must attest the exact Delivery/Event context before acknowledgement commits.
6. Standing v0.2 repeats the authority flow with additive standing tables and ordered Event history;
   it does not reinterpret or silently upgrade v0.1 rows.

## Persistence groups

| Group | Current models | Invariant |
|---|---|---|
| Accounts | `UserAccount`, `DeveloperAccount` | Separate identity and session cookies |
| Pairing | `PairingSession`, `PairingClaimRateBucket`, `Connector` | Digest-only secrets, one consumed pairing, bounded source budget |
| Developer/Host | `Organization`, `OrganizationApiKey`, `HostKey` | Organization-scoped key and immutable Host-key registration |
| v0.1 authority | `ConsentSession`, `HostSubjectBinding`, `Grant` | One subject-to-target binding and finite run grant |
| v0.1 history | `Event`, `Delivery`, `DeliveryAttempt` | One Event/Delivery per Grant profile, bounded lease and effect state |
| Standing authority | `StandingConsentSession`, `StandingGrant` | Additive standing lifetime and account/Organization ownership |
| Standing history | `StandingEvent`, `StandingDelivery`, `StandingDeliveryAttempt` | Ordered sequence, one open activation slot, replay-safe delivery |

The Prisma schema and migrations are the persistence authority. Prose must not invent fields or
cardinalities that are absent from those sources.

## Transport composition

| Surface | Purpose | Authority profile |
|---|---|---|
| `/v1/auth/*` | User and Developer registration, login, session, logout | Typed httpOnly cookies and same-origin writes |
| `/v0.1/*` | Pairing, consent, signed Events, Delivery claims, acknowledgement | Retained finite-run profile |
| `/v0.2/*` | Standing Host enrollment, Event, Delivery, inspection, revocation, handoff | Exact origin-form transport and standing authority |
| `/health*`, `/readyz` | Liveness and readiness | Public bounded operational checks |
| `/api/organizations/*` | Developer organization, key, and redacted history controls | Developer session and ownership |

Protocol transport guards resolve exact standing targets before parsing, CORS, or dispatch. They
bound method, headers, body bytes, canonical responses, and no-store behavior. Unknown or unsupported
paths do not become an alternate parser or version negotiation surface.

## Cross-project boundary

The Receiver exposes and consumes generic protocol contracts. It does not document a permanent
consumer-specific mapping. A consuming project owns its adapter and page behavior; a request for a
new Receiver capability must enter this repository as an accepted contract change with its own tests
and evidence.
