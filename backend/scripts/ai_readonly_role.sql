-- Creates the read-only PostgreSQL role used by the ABAI assistant's MCP tools.
-- Run once as a superuser, adjusting the database name, role name, and password
-- to match AI_DB_USER / AI_DB_PASSWORD in backend/.env:
--
--   psql -U postgres -d simpl_db -f backend/scripts/ai_readonly_role.sql
--
-- The tools already scope every query to the caller's business and branch; this
-- role adds defense in depth so the AI connection can never write.

CREATE ROLE simpl_ai_readonly LOGIN PASSWORD 'choose_a_strong_password';

GRANT CONNECT ON DATABASE simpl_db TO simpl_ai_readonly;
GRANT USAGE ON SCHEMA public TO simpl_ai_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO simpl_ai_readonly;

-- Apply the SELECT grant to tables created later (for example by AutoMigrate).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO simpl_ai_readonly;
