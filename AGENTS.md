# Cloud Receiver 2 Contributor Guide

## Repository and authority boundary

This file is the self-contained contributor instruction surface for the Cloud Receiver 2
repository. Establish the Git root from the current checkout; do not infer it from an editor tab or
the surrounding workspace. Preserve unrelated tracked, untracked, ignored, and collaborator-owned
work, and stage exact paths owned by the current increment.

A clean clone must be operable from this file and the repository's canonical documents; it must not
depend on a parent-workspace or machine-local AGENTS.md. The parent workspace can provide
coordination context only.

Any nested package-generated `AGENTS.md` is additive and package-local. It can govern that generated
tooling surface, but it never replaces this repository guide or the canonical `Docs/` authorities.

The repository owns the Receiver API, authentication, consent and Grant state, Event ingress,
Delivery settlement, persistence, migrations, health/readiness, deployment configuration, and
frontend surfaces. Re-entry Core owns reusable protocol contracts; a consumer owns its mapping and
product outcome. Do not create a permanent consumer-specific integration specification here.

## Start and route work

For every non-trivial task:

1. confirm the actual repository root, branch, upstream, status, and ownership boundary;
2. read [`Docs/README.md`](Docs/README.md) and [`Docs/00-current-status.md`](Docs/00-current-status.md);
3. read the owning Core, Contract, module, Task, Issue, or ADR and only the evidence required by the
   affected claim;
4. read [`Docs/Engineering/`](Docs/Engineering/README.md) for technical policy and
   [`Docs/AI-Development/README.md`](Docs/AI-Development/README.md) to route AI-facing execution,
   testing, handoff, and closure procedure; and
5. read [`Docs/Verification/`](Docs/Verification/README.md) or [`Docs/Operations/`](Docs/Operations/README.md)
   when the intended claim requires those layers.

Classify the increment as Fast, Standard, or Assured through the AI-Development procedure. The
profile changes control depth and evidence effort; it never changes product or contract authority.

An owner request is intent to evaluate, not permission to override an accepted contract. Stop at a
decision boundary before changing identity, secret custody, authority, data lifecycle, migrations,
deployment, compatibility, or a cross-project contract.

## Documentation and change boundaries

- README files are bounded orientation and authority maps, not work logs, transcripts, status ledgers,
  or evidence archives.
- Core and Contracts own product and HTTP behavior; Engineering owns technical policy;
  AI-Development owns repeatable AI-facing procedure; Verification owns reproducible scenarios;
  Core/05 and owning evidence records own executed proof;
  Operations owns runtime and release controls; Tasks and Issues own current work and blockers.
- Implement the smallest coherent outcome with one real consumer. Avoid speculative abstractions,
  hidden fallbacks, silent migration changes, and unbounded dependency or generated-file edits.
- Keep project-authored artifacts in English and secrets out of source, logs, evidence, and docs.

## Git and collaboration

- At session start or resume, and again before any push, fetch the intended remote and inspect the
  actual root, branch, upstream, status, ownership, and divergence.
- Integrate remote work deliberately on a clean tree; a blind pull is not a review step.
- Stage exact task-owned paths, inspect the full staged diff, and keep the primary session in control
  of authority reconciliation, commit, push, deployment, publication, and closure claims.
- Never use force-push, shared-history rewriting, destructive checkout, `git clean`, or
  `git reset --hard` to manufacture a clean result. External actions require separate authorization.

## Verification and closure

Start with the narrowest meaningful check, then expand for every changed contract or claim. Name the
exact source revision, Node runtime, database scope, environment, result, skipped layers, and claim
ceiling. A type check, build, source interface, local test, or health response does not by itself
prove deployment, hosted admission, or consumer continuation.

Before closure, re-read the affected module, current status, task/issue, and index; review for stale
claims or duplicated authority; inspect the exact diff; and record one executable next gate. The
primary session owns authority reconciliation, staging, commit, and any separately authorized push,
deployment, publication, or external action. Supporting agents may run bounded checks or review but
may not change decisions, touch the Git index, commit, push, deploy, publish, or claim closure.
