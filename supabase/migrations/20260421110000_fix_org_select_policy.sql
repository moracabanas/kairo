-- Migration: fix_org_select_policy
-- Fixes org_select and users_update RLS policies for onboarding flow
-- Problem: INSERT + SELECT after signup failed because current_org_id() is NULL
-- Solution: Allow SELECT when current_org_id is NULL (user has no org yet)
-- Also fix users_update to allow users to update their own record during onboarding

DROP POLICY IF EXISTS org_select ON organizations;

CREATE POLICY org_select ON organizations
  FOR SELECT USING (
    id = app.current_org_id()
    OR app.current_org_id() IS NULL
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.org_id = organizations.id
      AND users.id = auth.uid()
    )
  );

-- Fix users_update to allow users to update their own record (e.g., set org_id during onboarding)
DROP POLICY IF EXISTS users_update ON users;

CREATE POLICY users_update ON users
  FOR UPDATE USING (
    id = auth.uid()
  )
  WITH CHECK (
    id = auth.uid()
  );