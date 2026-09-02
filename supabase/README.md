# Supabase database hardening

`migrations/20260902190000_harden_backend_internal_tables.sql` is a prepared,
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

Target project: `re-entry` (`vycutuvanimbndxykiih`). The migration must run as
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

The repository does not currently have the Supabase CLI installed or a
`supabase/config.toml`; the SQL file was therefore prepared manually and
proven with `psql` against a disposable local PostgreSQL fixture. Before a
live change, create/register it through the team's Supabase migration
workflow, review the generated migration, and take the preflight snapshot.

## Local proof

The local proof creates the active project's table/role shape, runs the
migration in one transaction, and verifies all of the following for the
pre-existing fixture tables:

- every fixture table has `relrowsecurity = true`;
- `anon` and `authenticated` have no schema or table privileges;
- `service_role` retains table access and bypasses RLS;
- a table created after the migration receives no client privileges; and
- the migration does not expose or log any secret or row value.

The migration is intentionally not applied to the live Supabase project in
this increment.

## Rollback

The migration is transactional: if preflight or verification fails before
commit, issue `ROLLBACK` and do not proceed. After a committed change, do not
run a generic inverse that grants public access. Restore the reviewed,
preflight ACL snapshot for the named target tables through the Supabase
migration workflow, then rerun the RLS/policy review. Re-enabling client access
requires a separate accepted authority decision and explicit row policies;
this file must not be treated as permission to expose internal Receiver data.
