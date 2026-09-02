-- Cloud Receiver v2 hardening for the active Supabase PostgreSQL database.
--
-- These tables are backend-only. No anon/authenticated policies are created on
-- purpose: the Receiver uses the database owner or service_role, while the
-- browser and Connector use the HTTP API and never query Supabase directly.
-- Run this migration as the same database role that owns and creates the
-- Receiver tables (the current re-entry project reports postgres).

BEGIN;

DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN
    SELECT format('%I.%I', namespace.nspname, relation.relname)
    FROM pg_class AS relation
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE %s FROM anon, authenticated, PUBLIC',
      table_name
    );
    EXECUTE format('GRANT ALL PRIVILEGES ON TABLE %s TO service_role', table_name);
  END LOOP;
END
$$;

-- Prevent schema discovery and object access through the Supabase client
-- roles. Keep the migration/runtime roles explicit.
REVOKE ALL PRIVILEGES ON SCHEMA public FROM anon, authenticated, PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO service_role;

-- Keep future backend-owned objects private by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON FUNCTIONS FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

COMMIT;
