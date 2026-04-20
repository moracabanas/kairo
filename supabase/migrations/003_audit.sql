-- Kairo ISO 27001 Audit Logging System
-- Migration: 003_audit.sql
-- Dependencies: 001_initial_schema.sql, 002_rls_policies.sql must be applied first

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS app.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    org_id UUID,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    table_name TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user_id ON app.audit_log(user_id);
CREATE INDEX idx_audit_log_org_id ON app.audit_log(org_id);
CREATE INDEX idx_audit_log_created_at ON app.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_table_name ON app.audit_log(table_name);
CREATE INDEX idx_audit_log_action ON app.audit_log(action);

CREATE OR REPLACE FUNCTION app.set_audit_context()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM set_config('app.audit_user_id', COALESCE(NEW.user_id::TEXT, auth.uid()::TEXT), true);
    PERFORM set_config('app.audit_org_id', COALESCE(NEW.org_id::TEXT, app.current_org_id()::TEXT), true);
    PERFORM set_config('app.audit_ip_address', COALESCE(NEW.ip_address::TEXT, ''), true);
    PERFORM set_config('app.audit_user_agent', COALESCE(NEW.user_agent::TEXT, ''), true);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'app';

CREATE OR REPLACE FUNCTION app.get_audit_context()
RETURNS TABLE (user_id UUID, org_id UUID, ip_address INET, user_agent TEXT) AS $$
BEGIN
    user_id := NULLIF(current_setting('app.audit_user_id', true), '')::UUID;
    org_id := NULLIF(current_setting('app.audit_org_id', true), '')::UUID;
    ip_address := NULLIF(current_setting('app.audit_ip_address', true), '')::INET;
    user_agent := NULLIF(current_setting('app.audit_user_agent', true), '');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'app';

CREATE OR REPLACE FUNCTION app.log_dml_event()
RETURNS TRIGGER AS $$
DECLARE
    audit_row app.audit_log;
    ctx_user_id UUID;
    ctx_org_id UUID;
    ctx_ip_address INET;
    ctx_user_agent TEXT;
    sensitive_fields TEXT[] := ARRAY['password', 'password_hash', 'token', 'secret', 'api_key', 'access_token', 'refresh_token', 'private_key'];
    old_data JSONB := NULL;
    new_data JSONB := NULL;
BEGIN
    SELECT * INTO ctx_user_id, ctx_org_id, ctx_ip_address, ctx_user_agent FROM app.get_audit_context();

    IF TG_OP = 'DELETE' THEN
        old_data := row_to_json(OLD)::JSONB;
        FOREACH sensitive_fields SLICE 1 IN ARRAY sensitive_fields
        LOOP
            IF old_data ? sensitive_fields[1] THEN
                old_data := jsonb_set(old_data, ARRAY[sensitive_fields[1]], 'null'::JSONB);
            END IF;
        END LOOP;
        INSERT INTO app.audit_log (user_id, org_id, action, table_name, old_values, new_values, ip_address, user_agent)
        VALUES (ctx_user_id, ctx_org_id, TG_OP, TG_TABLE_NAME, old_data, NULL, ctx_ip_address, ctx_user_agent);
    ELSIF TG_OP = 'UPDATE' THEN
        old_data := row_to_json(OLD)::JSONB;
        new_data := row_to_json(NEW)::JSONB;
        FOREACH sensitive_fields SLICE 1 IN ARRAY sensitive_fields
        LOOP
            IF old_data ? sensitive_fields[1] THEN
                old_data := jsonb_set(old_data, ARRAY[sensitive_fields[1]], 'null'::JSONB);
            END IF;
            IF new_data ? sensitive_fields[1] THEN
                new_data := jsonb_set(new_data, ARRAY[sensitive_fields[1]], 'null'::JSONB);
            END IF;
        END LOOP;
        INSERT INTO app.audit_log (user_id, org_id, action, table_name, old_values, new_values, ip_address, user_agent)
        VALUES (ctx_user_id, ctx_org_id, TG_OP, TG_TABLE_NAME, old_data, new_data, ctx_ip_address, ctx_user_agent);
    ELSIF TG_OP = 'INSERT' THEN
        new_data := row_to_json(NEW)::JSONB;
        FOREACH sensitive_fields SLICE 1 IN ARRAY sensitive_fields
        LOOP
            IF new_data ? sensitive_fields[1] THEN
                new_data := jsonb_set(new_data, ARRAY[sensitive_fields[1]], 'null'::JSONB);
            END IF;
        END LOOP;
        INSERT INTO app.audit_log (user_id, org_id, action, table_name, old_values, new_values, ip_address, user_agent)
        VALUES (ctx_user_id, ctx_org_id, TG_OP, TG_TABLE_NAME, NULL, new_data, ctx_ip_address, ctx_user_agent);
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'app';

DROP TRIGGER IF EXISTS audit_organizations ON organizations;
CREATE TRIGGER audit_organizations
    AFTER INSERT OR UPDATE OR DELETE ON organizations
    FOR EACH ROW EXECUTE FUNCTION app.log_dml_event();

DROP TRIGGER IF EXISTS audit_users ON users;
CREATE TRIGGER audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION app.log_dml_event();

DROP TRIGGER IF EXISTS audit_signals ON signals;
CREATE TRIGGER audit_signals
    AFTER INSERT OR UPDATE OR DELETE ON signals
    FOR EACH ROW EXECUTE FUNCTION app.log_dml_event();

DROP TRIGGER IF EXISTS audit_signal_data ON signal_data;
CREATE TRIGGER audit_signal_data
    AFTER INSERT OR UPDATE OR DELETE ON signal_data
    FOR EACH ROW EXECUTE FUNCTION app.log_dml_event();

DROP TRIGGER IF EXISTS audit_auth_users ON auth.users;
CREATE TRIGGER audit_auth_users
    AFTER INSERT OR UPDATE OR DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION app.log_dml_event();

CREATE OR REPLACE FUNCTION app.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log is append-only. UPDATE and DELETE operations are not permitted.';
END;
$$ LANGUAGE plpgsql SET search_path = 'app';

DROP TRIGGER IF EXISTS prevent_audit_update ON app.audit_log;
CREATE TRIGGER prevent_audit_update
    BEFORE UPDATE ON app.audit_log
    FOR EACH ROW EXECUTE FUNCTION app.prevent_audit_modification();

DROP TRIGGER IF EXISTS prevent_audit_delete ON app.audit_log;
CREATE TRIGGER prevent_audit_delete
    BEFORE DELETE ON app.audit_log
    FOR EACH ROW EXECUTE FUNCTION app.prevent_audit_modification();

ALTER TABLE app.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select ON app.audit_log
    FOR SELECT USING (
        org_id = app.current_org_id()
        OR user_id = auth.uid()
        OR app.current_org_id() IS NULL
    );

GRANT SELECT ON app.audit_log TO authenticated;
GRANT SELECT ON app.audit_log TO service_role;
GRANT ALL ON app.audit_log TO service_role;

GRANT EXECUTE ON FUNCTION app.set_audit_context() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.get_audit_context() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.log_dml_event() TO service_role;
GRANT EXECUTE ON FUNCTION app.prevent_audit_modification() TO service_role;
