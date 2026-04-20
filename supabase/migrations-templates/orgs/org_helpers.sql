-- Organization management helpers

DROP FUNCTION IF EXISTS orgs.get_organization;
CREATE FUNCTION orgs.get_organization(p_org_id UUID)
RETURNS TABLE(
  id UUID,
  name TEXT,
  plan TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.name, o.plan, o.stripe_customer_id, o.created_at, o.updated_at
  FROM organizations o
  WHERE o.id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS orgs.update_organization;
CREATE FUNCTION orgs.update_organization(p_org_id UUID, p_name TEXT)
RETURNS TABLE(id UUID, name TEXT, plan TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ) AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_user_role FROM users WHERE id = v_user_id AND org_id = p_org_id;
  
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'User not found in organization';
  END IF;
  
  IF v_user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only owners and admins can update organization';
  END IF;

  UPDATE organizations
  SET name = p_name, updated_at = NOW()
  WHERE id = p_org_id
  RETURNING id, name, plan, created_at, updated_at INTO id, name, plan, created_at, updated_at;
  
  RETURN QUERY SELECT id, name, plan, created_at, updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS orgs.get_organization_usage;
CREATE FUNCTION orgs.get_organization_usage(p_org_id UUID)
RETURNS TABLE(
  signal_count BIGINT,
  user_count BIGINT,
  storage_bytes BIGINT
) AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_user_role FROM users WHERE id = v_user_id AND org_id = p_org_id;
  
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'User not found in organization';
  END IF;

  RETURN QUERY SELECT
    COALESCE((SELECT COUNT(*) FROM signals WHERE org_id = p_org_id), 0)::BIGINT AS signal_count,
    COALESCE((SELECT COUNT(*) FROM users WHERE org_id = p_org_id), 0)::BIGINT AS user_count,
    0::BIGINT AS storage_bytes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS orgs.transfer_ownership;
CREATE FUNCTION orgs.transfer_ownership(p_org_id UUID, p_new_owner_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_user_id UUID;
  v_current_user_role TEXT;
  v_new_owner_role TEXT;
BEGIN
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_current_user_role FROM users WHERE id = v_current_user_id AND org_id = p_org_id;
  
  IF v_current_user_role IS NULL THEN
    RAISE EXCEPTION 'User not found in organization';
  END IF;

  IF v_current_user_role != 'owner' THEN
    RAISE EXCEPTION 'Only owners can transfer ownership';
  END IF;

  SELECT role INTO v_new_owner_role FROM users WHERE id = p_new_owner_user_id AND org_id = p_org_id;
  
  IF v_new_owner_role IS NULL THEN
    RAISE EXCEPTION 'New owner must be a member of the organization';
  END IF;
  
  IF v_new_owner_role != 'admin' THEN
    RAISE EXCEPTION 'New owner must be an admin';
  END IF;

  UPDATE users SET role = 'admin' WHERE id = v_current_user_id AND org_id = p_org_id;
  
  UPDATE users SET role = 'owner' WHERE id = p_new_owner_user_id AND org_id = p_org_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS orgs.list_admins;
CREATE FUNCTION orgs.list_admins(p_org_id UUID)
RETURNS TABLE(id UUID, email TEXT, role TEXT, created_at TIMESTAMPTZ) AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email, u.role, u.created_at
  FROM users u
  WHERE u.org_id = p_org_id AND u.role IN ('owner', 'admin')
  ORDER BY u.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
