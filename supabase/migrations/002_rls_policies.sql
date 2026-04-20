-- Kairo Time Series Platform - Row Level Security Policies
-- Migration: 002_rls_policies.sql
-- Dependencies: 001_initial_schema.sql must be applied first

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.set_current_org(org_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_org_id', org_id::TEXT, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'app';

CREATE OR REPLACE FUNCTION app.current_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_org_id', true), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'app';

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_data ENABLE ROW LEVEL SECURITY;

ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
ALTER TABLE signals FORCE ROW LEVEL SECURITY;
ALTER TABLE signal_data FORCE ROW LEVEL SECURITY;

CREATE POLICY org_select ON organizations
  FOR SELECT USING (id = app.current_org_id() OR id IS NULL);

CREATE POLICY org_update ON organizations
  FOR UPDATE USING (id = app.current_org_id())
  WITH CHECK (id = app.current_org_id());

CREATE POLICY users_select ON users
  FOR SELECT USING (org_id = app.current_org_id() OR app.current_org_id() IS NULL);

CREATE POLICY users_insert ON users
  FOR INSERT WITH CHECK (org_id = app.current_org_id() OR app.current_org_id() IS NULL);

CREATE POLICY users_update ON users
  FOR UPDATE USING (org_id = app.current_org_id())
  WITH CHECK (org_id = app.current_org_id());

CREATE POLICY users_delete ON users
  FOR DELETE USING (org_id = app.current_org_id());

CREATE POLICY signals_select ON signals
  FOR SELECT USING (org_id = app.current_org_id() OR app.current_org_id() IS NULL);

CREATE POLICY signals_insert ON signals
  FOR INSERT WITH CHECK (org_id = app.current_org_id() OR app.current_org_id() IS NULL);

CREATE POLICY signals_update ON signals
  FOR UPDATE USING (org_id = app.current_org_id())
  WITH CHECK (org_id = app.current_org_id());

CREATE POLICY signals_delete ON signals
  FOR DELETE USING (org_id = app.current_org_id());

CREATE POLICY signal_data_select ON signal_data
  FOR SELECT USING (
    signal_id IN (SELECT id FROM signals WHERE org_id = app.current_org_id())
    OR app.current_org_id() IS NULL
  );

CREATE POLICY signal_data_insert ON signal_data
  FOR INSERT WITH CHECK (
    signal_id IN (SELECT id FROM signals WHERE org_id = app.current_org_id())
    OR app.current_org_id() IS NULL
  );

CREATE POLICY signal_data_update ON signal_data
  FOR UPDATE USING (
    signal_id IN (SELECT id FROM signals WHERE org_id = app.current_org_id())
  ) WITH CHECK (
    signal_id IN (SELECT id FROM signals WHERE org_id = app.current_org_id())
  );

CREATE POLICY signal_data_delete ON signal_data
  FOR DELETE USING (
    signal_id IN (SELECT id FROM signals WHERE org_id = app.current_org_id())
  );

GRANT ALL ON organizations TO service_role;
GRANT ALL ON users TO service_role;
GRANT ALL ON signals TO service_role;
GRANT ALL ON signal_data TO service_role;

CREATE OR REPLACE FUNCTION app.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app.users WHERE id = NEW.id) THEN
    BEGIN
      INSERT INTO app.users (id, email, role, org_id)
      VALUES (NEW.id, NEW.email, 'viewer', NULL)
      ON CONFLICT (id) DO NOTHING;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not auto-create user entry: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'app';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION app.handle_new_user();

GRANT EXECUTE ON FUNCTION app.set_current_org(UUID) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.current_org_id() TO service_role, authenticated;

CREATE OR REPLACE VIEW app.current_org_context AS
SELECT 
  current_setting('app.current_org_id', true) as org_id,
  auth.uid() as user_id,
  current_user as pg_user;
