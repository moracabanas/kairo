-- Migration: app_users_table
-- Creates app.users table for auth trigger sync
-- Dependency: 002_rls_policies.sql (creates app.handle_new_user trigger)

CREATE TABLE IF NOT EXISTS app.users (
    id UUID NOT NULL PRIMARY KEY,
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'viewer',
    org_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index on email
CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_key ON app.users(email);

-- Index for org_id lookups
CREATE INDEX IF NOT EXISTS app_users_org_id_idx ON app.users(org_id);

-- Grant permissions for auth service
GRANT USAGE ON SCHEMA app TO supabase_auth_admin;
GRANT ALL ON app.users TO supabase_auth_admin;

-- Trigger for updated_at
CREATE OR REPLACE TRIGGER update_app_users_updated_at
    BEFORE UPDATE ON app.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();