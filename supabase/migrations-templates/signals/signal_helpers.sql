-- Signal helpers for Kairo

DROP FUNCTION IF EXISTS signals.validate_source_config;
CREATE FUNCTION signals.validate_source_config(p_source_type TEXT, p_config JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- TODO: Implement source-specific validation
    -- database: requires connection_string
    -- mqtt: requires broker_url, topic
    -- file: requires file_path, format
    -- log: requires log_format, parser
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS signals.get_signal_schema;
CREATE FUNCTION signals.get_signal_schema(p_signal_id UUID)
RETURNS JSONB AS $$
BEGIN
    RETURN (SELECT schema FROM signals WHERE id = p_signal_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS signals.list_signals;
CREATE FUNCTION signals.list_signals(p_org_id UUID)
RETURNS TABLE(id UUID, name TEXT, source_type TEXT, created_at TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.name, s.source_type, s.created_at
    FROM signals s
    WHERE s.org_id = p_org_id
    ORDER BY s.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TODO: Add signal_data aggregation helpers
