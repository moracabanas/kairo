-- Kairo Time Series Platform - Role-Based Access Control (RBAC)
-- Migration: 004_rbac.sql
-- Dependencies: 001_initial_schema.sql, 002_rls_policies.sql must be applied first

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Role hierarchy: owner > admin > analyst > viewer
-- Higher roles inherit all permissions of lower roles

CREATE OR REPLACE FUNCTION app.has_role(user_role TEXT, required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN CASE required_role
    WHEN 'owner' THEN user_role = 'owner'
    WHEN 'admin' THEN user_role IN ('owner', 'admin')
    WHEN 'analyst' THEN user_role IN ('owner', 'admin', 'analyst')
    WHEN 'viewer' THEN TRUE
    ELSE FALSE
  END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'app';

CREATE OR REPLACE FUNCTION app.can_manage_signals(user_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN app.has_role(user_role, 'analyst');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'app';

CREATE OR REPLACE FUNCTION app.can_manage_users(user_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN app.has_role(user_role, 'admin');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'app';

CREATE OR REPLACE FUNCTION app.can_view_audit(user_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN app.has_role(user_role, 'admin');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'app';

CREATE OR REPLACE FUNCTION app.can_train_models(user_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN app.has_role(user_role, 'analyst');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'app';

CREATE OR REPLACE FUNCTION app.is_owner(user_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN user_role = 'owner';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'app';

-- Drop existing policies before recreating with RBAC
DROP POLICY IF EXISTS signals_select ON signals CASCADE;
DROP POLICY IF EXISTS signals_insert ON signals CASCADE;
DROP POLICY IF EXISTS signals_update ON signals CASCADE;
DROP POLICY IF EXISTS signals_delete ON signals CASCADE;
DROP POLICY IF EXISTS signal_data_select ON signal_data CASCADE;
DROP POLICY IF EXISTS signal_data_insert ON signal_data CASCADE;
DROP POLICY IF EXISTS signal_data_update ON signal_data CASCADE;
DROP POLICY IF EXISTS signal_data_delete ON signal_data CASCADE;

-- Helper function to get user's role in current org
CREATE OR REPLACE FUNCTION app.get_user_role(p_org_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM app.users
  WHERE id = auth.uid() AND org_id = p_org_id;
  RETURN COALESCE(v_role, 'viewer');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'app';

-- Signals policies with RBAC
CREATE POLICY signals_select ON signals
  FOR SELECT USING (
    org_id = app.current_org_id()
    AND (
      current_setting('request.jwt.claim_role', true) = 'service_role'
      OR app.can_manage_signals(app.get_user_role(org_id))
    )
  );

CREATE POLICY signals_insert ON signals
  FOR INSERT WITH CHECK (
    org_id = app.current_org_id()
    AND (
      current_setting('request.jwt.claim_role', true) = 'service_role'
      OR app.can_manage_signals(app.get_user_role(org_id))
    )
  );

CREATE POLICY signals_update ON signals
  FOR UPDATE USING (
    org_id = app.current_org_id()
    AND (
      current_setting('request.jwt.claim_role', true) = 'service_role'
      OR app.can_manage_signals(app.get_user_role(org_id))
    )
  ) WITH CHECK (
    org_id = app.current_org_id()
    AND (
      current_setting('request.jwt.claim_role', true) = 'service_role'
      OR app.can_manage_signals(app.get_user_role(org_id))
    )
  );

CREATE POLICY signals_delete ON signals
  FOR DELETE USING (
    org_id = app.current_org_id()
    AND (
      current_setting('request.jwt.claim_role', true) = 'service_role'
      OR app.is_owner(app.get_user_role(org_id))
    )
  );

-- Signal data policies with RBAC
CREATE POLICY signal_data_select ON signal_data
  FOR SELECT USING (
    signal_id IN (SELECT id FROM signals WHERE org_id = app.current_org_id())
    AND (
      current_setting('request.jwt.claim_role', true) = 'service_role'
      OR app.can_manage_signals(app.get_user_role((SELECT org_id FROM signals WHERE id = signal_id)))
    )
  );

CREATE POLICY signal_data_insert ON signal_data
  FOR INSERT WITH CHECK (
    signal_id IN (SELECT id FROM signals WHERE org_id = app.current_org_id())
    AND (
      current_setting('request.jwt.claim_role', true) = 'service_role'
      OR app.can_manage_signals(app.get_user_role((SELECT org_id FROM signals WHERE id = signal_id)))
    )
  );

CREATE POLICY signal_data_update ON signal_data
  FOR UPDATE USING (
    signal_id IN (SELECT id FROM signals WHERE org_id = app.current_org_id())
    AND (
      current_setting('request.jwt.claim_role', true) = 'service_role'
      OR app.can_manage_signals(app.get_user_role((SELECT org_id FROM signals WHERE id = signal_id)))
    )
  ) WITH CHECK (
    signal_id IN (SELECT id FROM signals WHERE org_id = app.current_org_id())
    AND (
      current_setting('request.jwt.claim_role', true) = 'service_role'
      OR app.can_manage_signals(app.get_user_role((SELECT org_id FROM signals WHERE id = signal_id)))
    )
  );

CREATE POLICY signal_data_delete ON signal_data
  FOR DELETE USING (
    signal_id IN (SELECT id FROM signals WHERE org_id = app.current_org_id())
    AND (
      current_setting('request.jwt.claim_role', true) = 'service_role'
      OR app.is_owner(app.get_user_role((SELECT org_id FROM signals WHERE id = signal_id)))
    )
  );

-- Grant execute on permission functions
GRANT EXECUTE ON FUNCTION app.has_role(TEXT, TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.can_manage_signals(TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.can_manage_users(TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.can_view_audit(TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.can_train_models(TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.is_owner(TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION app.get_user_role(UUID) TO service_role, authenticated;

-- Create audit log table for permission denied events
CREATE TABLE IF NOT EXISTS app.permission_denied_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  org_id UUID NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  action TEXT NOT NULL,
  denied_role TEXT NOT NULL,
  required_role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permission_denied_log_user_id ON app.permission_denied_log(user_id);
CREATE INDEX IF NOT EXISTS idx_permission_denied_log_org_id ON app.permission_denied_log(org_id);
CREATE INDEX IF NOT EXISTS idx_permission_denied_log_created_at ON app.permission_denied_log(created_at);

ALTER TABLE app.permission_denied_log ENABLE ROW LEVEL SECURITY;

-- Only service_role can view permission denied logs (for security audits)
CREATE POLICY permission_denied_select ON app.permission_denied_log
  FOR SELECT USING (current_setting('request.jwt.claim_role', true) = 'service_role');

CREATE POLICY permission_denied_insert ON app.permission_denied_log
  FOR INSERT WITH CHECK (current_setting('request.jwt.claim_role', true) = 'service_role');

GRANT ALL ON app.permission_denied_log TO service_role;

-- Function to log permission denied events (called by API endpoints)
CREATE OR REPLACE FUNCTION app.log_permission_denied(
  p_user_id UUID,
  p_org_id UUID,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_action TEXT,
  p_denied_role TEXT,
  p_required_role TEXT
)
RETURNS BIGINT AS $$
DECLARE
  v_log_id BIGINT;
BEGIN
  INSERT INTO app.permission_denied_log (
    user_id, org_id, resource_type, resource_id, action, denied_role, required_role
  ) VALUES (
    p_user_id, p_org_id, p_resource_type, p_resource_id, p_action, p_denied_role, p_required_role
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'app';

GRANT EXECUTE ON FUNCTION app.log_permission_denied(UUID, UUID, TEXT, UUID, TEXT, TEXT, TEXT) TO service_role;
