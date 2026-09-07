# Supabase Hardening Source

This directory contains the prepared backend-only hardening migration
[`20260902190000_harden_backend_internal_tables.sql`](migrations/20260902190000_harden_backend_internal_tables.sql).
It is not automatically applied and does not authorize a live database change.

- [Hardening runbook](../Docs/Operations/02-database-hardening.md): target preflight, ordering,
  transaction verification, and recovery.
- [Evidence boundary](../Docs/Core/05-validation-and-evidence.md#hardening-evidence-boundary):
  retained local observation, missing provenance, and the fresh proof required.

The Receiver backend remains the only database client; frontend, Connector, and Host SDK use HTTP.
