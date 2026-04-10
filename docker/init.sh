#!/usr/bin/env bash
# =============================================================================
# DCO CMS — PostgreSQL initialization script
# =============================================================================
# Mounted to /docker-entrypoint-initdb.d/01-init.sh in the db container.
#
# IMPORTANT: This script runs ONCE on first database container initialization.
# It will NOT re-run while the dco_postgres_data Docker volume exists.
# To re-run it you must delete the volume (destroying all data).
# Take a full backup before doing so.
#
# What this script does:
#   1. Creates the dco_app restricted role (password from DB_APP_PASSWORD env).
#   2. Grants schema-level access and sets default table/sequence privileges
#      so that any table dco_owner creates is automatically accessible to dco_app.
#   3. Installs a PostgreSQL event trigger that enforces AuditLog immutability:
#      when Prisma's migrate deploy creates the audit_logs table, the trigger
#      automatically revokes UPDATE and DELETE from dco_app.  This survives
#      container restarts and application upgrades.
#
# Environment variables (set by docker-compose):
#   POSTGRES_USER     — dco_owner (the owner/migration role, also the PG superuser)
#   POSTGRES_DB       — dco_cms
#   DB_APP_PASSWORD   — password for the restricted dco_app runtime role
# =============================================================================

set -euo pipefail

echo "[init] Creating dco_app runtime role…"

# Use -c for the password line so DB_APP_PASSWORD is expanded by bash (not SQL)
psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname   "$POSTGRES_DB"   \
     -c "CREATE ROLE dco_app WITH LOGIN PASSWORD '$DB_APP_PASSWORD';"

echo "[init] Applying schema grants and AuditLog enforcement trigger…"

# Single-quoted heredoc — no bash substitution inside.
# $$ is safe here: bash does not interpret it because the heredoc is quoted.
psql -v ON_ERROR_STOP=1 \
     --username "$POSTGRES_USER" \
     --dbname   "$POSTGRES_DB"   \
<<'ENDSQL'

-- ─── Schema access ───────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO dco_app;

-- ─── Default privileges ──────────────────────────────────────────────────────
-- When dco_owner (the migration role) creates a table or sequence, dco_app is
-- automatically granted SELECT / INSERT / UPDATE / DELETE.  The event trigger
-- below then strips UPDATE and DELETE specifically from audit_logs.

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES    TO dco_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT                  ON SEQUENCES TO dco_app;

-- ─── AuditLog immutability (DB-level enforcement) ────────────────────────────
--
-- This event trigger fires when Prisma's `prisma migrate deploy` issues
-- CREATE TABLE for the audit_logs table.  It immediately revokes UPDATE and
-- DELETE from dco_app, so the running application process is physically unable
-- to modify or delete audit entries.
--
-- SECURITY DEFINER ensures the REVOKE executes with superuser privileges
-- regardless of which role created the table.
--
-- The trigger survives container restarts and application upgrades.
-- It is only removed if the dco_postgres_data volume is deleted.

CREATE OR REPLACE FUNCTION fn_revoke_audit_log_mutate()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_ddl_commands() LOOP
    IF obj.object_type = 'table'
       AND obj.object_identity = 'public.audit_logs' THEN
      REVOKE UPDATE, DELETE ON TABLE public.audit_logs FROM dco_app;
      RAISE NOTICE 'DCO CMS: AuditLog immutability enforced — UPDATE + DELETE revoked from dco_app';
    END IF;
  END LOOP;
END;
$$;

CREATE EVENT TRIGGER trg_revoke_audit_log_mutate
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE FUNCTION fn_revoke_audit_log_mutate();

ENDSQL

echo "[init] PostgreSQL initialization complete."
