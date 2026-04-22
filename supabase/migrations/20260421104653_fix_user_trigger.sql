-- Migration: fix_user_trigger
-- Fixes user creation to populate both app.users and public.users
-- so that onboarding can properly link users to organizations

-- Make org_id nullable in public.users to allow signup without org
ALTER TABLE public.users ALTER COLUMN org_id DROP NOT NULL;

-- Update the handle_new_user trigger to also create entry in public.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS app.handle_new_user();

CREATE OR REPLACE FUNCTION app.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    -- Insert into app.users (for auth-triggered tracking)
    IF NOT EXISTS (SELECT 1 FROM app.users WHERE id = NEW.id) THEN
      BEGIN
        INSERT INTO app.users (id, email, role, org_id)
        VALUES (NEW.id, NEW.email, 'viewer', NULL)
        ON CONFLICT (id) DO NOTHING;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Could not auto-create app.users entry: %', SQLERRM;
      END;
    END IF;

    -- Insert into public.users (for app queries)
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
      BEGIN
        INSERT INTO public.users (id, email, role, org_id)
        VALUES (NEW.id, NEW.email, 'viewer', NULL)
        ON CONFLICT (id) DO NOTHING;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Could not auto-create public.users entry: %', SQLERRM;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'app';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION app.handle_new_user();