-- @depends-on: ../auth/org_users.sql
-- Auth helpers for Kairo

DROP FUNCTION IF EXISTS auth.get_user_role;
CREATE FUNCTION auth.get_user_role(p_org_id UUID, p_user_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT role FROM users WHERE id = p_user_id AND org_id = p_org_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS auth.can_manage_users;
CREATE FUNCTION auth.can_manage_users(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users
        WHERE id = p_user_id
        AND org_id = p_org_id
        AND role IN ('owner', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TODO: Add org_users_audit trigger function
