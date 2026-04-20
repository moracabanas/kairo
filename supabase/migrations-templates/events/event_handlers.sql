-- Event handling functions

DROP FUNCTION IF EXISTS events.record_signal_event;
CREATE FUNCTION events.record_signal_event(
    p_signal_id UUID,
    p_event_type TEXT,
    p_event_data JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO events (signal_id, event_type, event_data)
    VALUES (p_signal_id, p_event_type, p_event_data)
    RETURNING id INTO v_event_id;
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS events.get_signal_events;
CREATE FUNCTION events.get_signal_events(
    p_signal_id UUID,
    p_limit INT DEFAULT 100
) RETURNS TABLE(id UUID, event_type TEXT, event_data JSONB, created_at TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT e.id, e.event_type, e.event_data, e.created_at
    FROM events e
    WHERE e.signal_id = p_signal_id
    ORDER BY e.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TODO: Add event aggregation triggers
