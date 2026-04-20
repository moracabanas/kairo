-- Organization and Users combined helpers

DROP FUNCTION IF EXISTS auth.get_org_id_for_user;
CREATE FUNCTION auth.get_org_id_for_user(p_user_id UUID)
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT org_id FROM users WHERE id = p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS auth.list_org_users;
CREATE FUNCTION auth.list_org_users(p_org_id UUID)
RETURNS TABLE(id UUID, email TEXT, role TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email, u.role, u.created_at
    FROM users u
    WHERE u.org_id = p_org_id
    ORDER BY u.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TODO: Add user_Invitation functions
