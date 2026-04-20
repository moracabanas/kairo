-- Audit logging helpers

DROP FUNCTION IF EXISTS audit.log_change;
CREATE FUNCTION audit.log_change(
    p_table_name TEXT,
    p_record_id UUID,
    p_operation TEXT,
    p_old_data JSONB,
    p_new_data JSONB,
    p_user_id UUID
) RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO audit_log (table_name, record_id, operation, old_data, new_data, user_id)
    VALUES (p_table_name, p_record_id, p_operation, p_old_data, p_new_data, p_user_id)
    RETURNING id INTO v_audit_id;
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS audit.get_table_changes;
CREATE FUNCTION audit.get_table_changes(
    p_table_name TEXT,
    p_record_id UUID DEFAULT NULL,
    p_since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days'
) RETURNS TABLE(
    id UUID,
    record_id UUID,
    operation TEXT,
    old_data JSONB,
    new_data JSONB,
    user_id UUID,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT a.id, a.record_id, a.operation, a.old_data, a.new_data, a.user_id, a.created_at
    FROM audit_log a
    WHERE a.table_name = p_table_name
    AND (p_record_id IS NULL OR a.record_id = p_record_id)
    AND a.created_at >= p_since
    ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS audit.get_user_activity;
CREATE FUNCTION audit.get_user_activity(
    p_user_id UUID,
    p_since TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days'
) RETURNS TABLE(id UUID, table_name TEXT, operation TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT a.id, a.table_name, a.operation, a.created_at
    FROM audit_log a
    WHERE a.user_id = p_user_id
    AND a.created_at >= p_since
    ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TODO: Add audit report generation functions
