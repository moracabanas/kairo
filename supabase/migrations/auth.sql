CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS app.handle_new_user();

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

CREATE OR REPLACE FUNCTION app.get_oauth_callback_url(provider TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE provider
    WHEN 'google' THEN format('%s/auth/v1/callback?provider=google', current_setting('app.settings.site_url', true))
    WHEN 'github' THEN format('%s/auth/v1/callback?provider=github', current_setting('app.settings.site_url', true))
    WHEN 'microsoft' THEN format('%s/auth/v1/callback?provider=microsoft', current_setting('app.settings.site_url', true))
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'app';

GRANT USAGE ON SCHEMA auth TO service_role, authenticated;
GRANT ALL ON SCHEMA auth TO service_role;
GRANT ALL ON auth.users TO service_role;

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth.users(email);
CREATE INDEX IF NOT EXISTS idx_auth_users_created_at ON auth.users(created_at);

COMMENT ON TABLE auth.users IS 'Auth users table managed by GoTrue';
COMMENT ON FUNCTION app.handle_new_user IS 'Sync auth.users to app.users on signup';
