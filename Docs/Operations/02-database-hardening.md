# Supabase database hardening

`supabase/migrations/20260902190000_harden_backend_internal_tables.sql` is a prepared,
backend-only hardening migration for the active `re-entry` Supabase database.

It enables RLS on every existing table in `public` at the time it is run, removes `anon`,
`authenticated`, and `PUBLIC` table/schema privileges, preserves explicit
`service_role` access, and makes future tables, sequences, and functions
private by default. Apply it after the Receiver Prisma schema migrations so the
new `cr2_*` tables are included. Any later table migration must repeat the RLS
step or receive a separately reviewed hardening migration. It intentionally creates no client policies. The browser,
Local Connector, and Host SDK call the Receiver HTTP API; none uses a
Supabase client or receives a database credential.

## Target and preflight

Previously named target: `re-entry` (`vycutuvanimbndxykiih`). Reconfirm live project identity and
explicit migration authority before use; this document is not a current deployment readback. The migration must run as
the database owner/migration role that creates the Receiver tables. Capture a
schema-and-ACL preflight before applying it; do not print connection strings,
passwords, service-role keys, or row data:

```sql
select current_user, current_database(), current_schema();
select n.nspname, c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r', 'p')
order by c.relname;
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
order by grantee, table_name, privilege_type;
```

No `supabase/config.toml` is checked in. The SQL was prepared manually; the retained local
observation and its provenance limits are in
[Validation and Evidence](../Core/05-validation-and-evidence.md#hardening-evidence-boundary).
Before a live change, register it through the team's accepted Supabase migration workflow,
review the generated migration, and take the preflight snapshot.

## Verification before commit

On the explicitly authorized target, verify the migration within its transaction before commit:

- all intended existing fixture/target tables have `relrowsecurity = true`;
- `anon` and `authenticated` have no schema/table privileges;
- `service_role` retains the required backend access and RLS bypass;
- future tables receive no client privileges by default; and
- no secret or row value enters logs or evidence.

Rehearse on a disposable database first. Expected assertions are not evidence that the procedure ran.

## Rollback

The migration is transactional: if preflight or verification fails before
commit, issue `ROLLBACK` and do not proceed. After a committed change, do not
run a generic inverse that grants public access. Restore the reviewed,
preflight ACL snapshot for the named target tables through the Supabase
migration workflow, then rerun the RLS/policy review. Re-enabling client access
requires a separate accepted authority decision and explicit row policies;
this file must not be treated as permission to expose internal Receiver data.
