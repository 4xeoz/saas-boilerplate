# Development Process Runbook

**Role:** CANONICAL AI-facing current-state, change, verification, and closure loop
**Status:** Active
**Last updated:** 2026-09-06

Use this sequence for each bounded increment:

1. Confirm the repository root, branch, status, ownership, and active source of truth.
2. Read the current status, the narrowest Core/module contract, and the relevant task or issue.
3. Classify the increment as documentation-only, static, database, contract, deployment, or
   cross-project work. Stop at a durable decision boundary before changing authority.
4. Inventory the exact files and claims affected. Identify code, tests, schema, runtime, and
   historical recovery evidence needed to resolve contradictions.
5. Make the smallest reversible change. For documentation, extract current value into its one
   owner and remove only exact reviewed obsolete targets.
6. Run the narrowest meaningful checks, then expand for every changed contract or claim.
7. Re-read the affected Core/module/status/index documents and run link, language, and stale-claim
   scans. Review whether the change introduced duplicated authority or new drift.
8. Inspect the exact diff and status, stage only owned paths, and commit with a scoped message.
9. Record the achieved evidence level, residual unknowns, and one executable next gate in Current
   Status, Roadmap, Task, Issue, or Verification as appropriate.

## Stop conditions

Stop and ask the owner when evidence cannot distinguish an obsolete document from a current contract,
when a proposed fix changes identity/security/data/deployment authority, when ownership or recovery
source is uncertain, or when a required external/session seam is unavailable. Preserve the unknown;
do not fill it with a historical assumption or a silent fallback.

## Module closure

After a coherent module is complete, review all files in that module together, validate every link and
claim against its owning source, and re-read the project entrypoint and Current Status. A module is not
closed because its files are shorter; it is closed when scope, authority, claims, and reopen gates are
unambiguous.
