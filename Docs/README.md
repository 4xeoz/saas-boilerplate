# Cloud Receiver Documentation Map

**Role:** Service documentation authority map
**Status:** Active
**Last updated:** 2026-09-06

## Purpose

This directory is the bounded documentation entrypoint for Cloud Receiver 2. It routes
service contracts, security boundaries, persistence and deployment controls, conformance evidence,
and open decisions without turning a README or report into a work log.

The repository owns Receiver HTTP behavior, account and Connector controls, consent and Grant
state, Event ingress, Delivery leases and acknowledgement, standing authorization, service health,
database migrations, and the frontend surfaces that operate those boundaries. Re-entry Core owns
the reusable protocol contracts. A consumer application owns its event mapping and adapter. No
permanent consumer-specific integration specification belongs here.

## Reading order

1. Read [00-current-status.md](00-current-status.md) for verified service state and active gates.
2. Read the module README that owns the question.
3. For an AI-assisted change, read [AI-Development](AI-Development/README.md) and the applicable
   [Engineering policy](Engineering/README.md).
4. Read the linked contract, decision, conformance, migration, or evidence source.
5. Check current code, tests, database state, and deployment readback for implementation or release
   claims.

When documents, code, tests, or runtime disagree, identify whether the question is intended
contract, implemented behavior, or deployment truth. Reconcile the owning source before closure.
Stop when the conflict affects authentication, secret custody, identity binding, Grant authority,
Event ordering, Delivery effects, migration safety, or cross-repository source identity.

## Authority map

| Area | Owns | Does not own |
|---|---|---|
| [00-current-status.md](00-current-status.md) | Current state, active gates, and non-claims | Module contracts or AI test procedure |
| [Core/](Core/README.md) | Product definition, requirements, system design, trust policy, validation, and roadmap | Mutable execution history or consumer-specific behavior |
| [Contracts/](Contracts/README.md) | HTTP versioning and module contract owners | Consumer mapping or a duplicate Core specification |
| [Engineering/](Engineering/README.md) | Technical engineering policy and change-control rules | Product authority or deployment state |
| [AI-Development/](AI-Development/README.md) | AI-facing development, test-execution, handoff, and closure procedure | Product authority, runtime truth, or release permission |
| [Verification/](Verification/README.md) | Reproducible checks and evidence levels | Intended behavior or release permission |
| [Operations/](Operations/README.md) | Local, migration, deployment, health, and recovery controls | Permission to apply a live change |
| [Tasks/](Tasks/README.md) | Current bounded outcomes and next gates | Completed work history or a second roadmap |
| [Issues/](Issues/README.md) | Open contradictions and blockers | General discussion or completed issue archive |
| [../README.md](../README.md) | Service entrypoint, repository boundary, quick start, and routing | Detailed implementation history |
| `backend/conformance/standing-v0.2/README.md` | Source-file map and route to Verification/01 | Reproduction procedure, results, or product authority |
| `supabase/README.md` | Migration-file map and route to Operations/02 | Hardening procedure, results, or live-change permission |
| `backend/src/modules/` | Bounded HTTP/domain module contracts | Cross-module release claims |
| `backend/src/modules/developer-portal/README.md` | Developer organization, API-key, and redacted event-history controls | Grant authority or delivery effects |
| `backend/src/modules/events/README.md` | Signed Event validation and atomic Event/Delivery creation | Connector claim or consumer mapping |
| `backend/src/modules/deliveries/README.md` | v0.1 Delivery lease, effect, and acknowledgement contract | Standing policy or deployment |
| `backend/src/modules/standing/README.md` | Standing v0.2 protocol and authority boundary | Expanded account-facing control-plane policy not yet accepted |
| `backend/prisma/schema.prisma` and migrations | Database schema and migration order | Runtime API behavior by themselves |
| Current tests and runtime readback | Executed behavior and deployment truth | Intended contract outside the tested scope |

### Shared semantic core map

The service implements the shared workspace model with a deployable-service operations layer:

| Semantic responsibility | Canonical owner |
|---|---|
| Product purpose and boundary | [`Core/01-product-definition.md`](Core/01-product-definition.md) |
| Requirements and service behavior | [`Core/02-product-requirements.md`](Core/02-product-requirements.md) and [`Contracts/`](Contracts/README.md) |
| Architecture and authority flow | [`Core/03-system-design.md`](Core/03-system-design.md) |
| Security, data, and reliability | [`Core/04-trust-security-reliability.md`](Core/04-trust-security-reliability.md) |
| Roadmap and release gates | [`Core/06-roadmap.md`](Core/06-roadmap.md) |
| Current status and claim ceiling | [`00-current-status.md`](00-current-status.md) |
| Engineering, AI development, and verification | [`Engineering/`](Engineering/README.md), [`AI-Development/`](AI-Development/README.md), and [`Verification/`](Verification/README.md) |
| Operations and release | [`Operations/`](Operations/README.md) |

This mapping is navigation only; module contracts, code, database state, and deployment readback
remain authoritative for their respective claims.

## Module boundaries

- Authentication owns typed session cookies and credential validation.
- Users and developers own their separate account models and routes.
- Connectors own pairing, token issuance, digest lookup, and disconnection.
- Consent owns Host keys, Manifest verification, account decisions, target binding, and Grant status.
- Events own signed ingress and pending Delivery creation.
- Deliveries and acknowledgements own lease, retry, effect, and settlement boundaries.
- Standing owns the additive v0.2 transport and standing authority composition.
- Developer Portal owns organization and API-key management; it must not expose private Grant or
  credential material.
- System health owns liveness/readiness endpoints.

## README and report discipline

A README is an orientation and authority map. It may route readers and state bounded rules, but it
must not accumulate commands, transcripts, dated execution history, or a second status ledger.
Implementation reports are temporary extraction inputs: promote durable conclusions to the owning
module or status file, then retire the report when its remaining content no longer changes a decision.

## Maintenance

Keep project-authored documentation in English. Update current truth in place, link to exact
evidence, and run type-check/build plus the relevant backend tests after contract-affecting changes.
Do not store secrets, production connection strings, raw tokens, or mutable database output in docs.
