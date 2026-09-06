# Cloud Receiver 2 Core

**Role:** Product, requirements, architecture, trust, proof, and roadmap authority
**Status:** Current baseline; release and cross-project gates remain open

This directory defines what Cloud Receiver 2 is responsible for and the strongest claim that the
repository may make about it. It is not an execution log, a copied Re-entry specification, or a
consumer application's integration guide.

## Reading order

1. [Current status](../00-current-status.md) — current verified state and claim ceiling.
2. [Product definition](01-product-definition.md) — purpose, actors, ownership, and non-goals.
3. [Product requirements](02-product-requirements.md) — stable behavior and reliability requirements.
4. [System design](03-system-design.md) — topology, authority, flow, and persistence boundaries.
5. [Trust, security, and reliability](04-trust-security-reliability.md) — custody, isolation, and
   failure rules.
6. [Validation and evidence](05-validation-and-evidence.md) — reproducible checks and what they prove.
7. [Roadmap](06-roadmap.md) — ordered open outcomes and gates.

## Authority order

| Question | Strongest source |
|---|---|
| Intended product boundary | Core documents in this directory |
| Implemented HTTP or persistence behavior | Current backend/frontend code, schema, migrations, and tests |
| Runtime or deployment truth | Fresh process, database, platform, and release readback |
| Re-entry compatibility | Receiver pin and the reviewed Core source identity |
| Consumer behavior | The consuming application; this repository does not own its mapping or UI |

When these sources disagree, classify the conflict, update the owning document, and leave the
uncertainty open until the evidence or owner decision resolves it. A local test or interface does not
prove a hosted or consumer end-to-end result.

## Maintenance

Keep Core documents compact and normative. Put mutable progress in `../00-current-status.md`, active
work in `../Tasks/`, verified contradictions in `../Issues/`, AI-facing execution procedures in
`../AI-Development/`, technical policy in `../Engineering/`, executed proof in `../Verification/`
or module evidence, and deployment controls in `../Operations/`. Do not add session logs,
completed-task histories, or copied sibling contracts here.
