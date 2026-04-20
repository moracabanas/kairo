-- Notification channel helpers

DROP FUNCTION IF EXISTS notifications.create_channel;
CREATE FUNCTION notifications.create_channel(
    p_org_id UUID,
    p_channel_type TEXT,
    p_config JSONB
) RETURNS UUID AS $$
DECLARE
    v_channel_id UUID;
BEGIN
    INSERT INTO notification_channels (org_id, channel_type, config)
    VALUES (p_org_id, p_channel_type, p_config)
    RETURNING id INTO v_channel_id;
    RETURN v_channel_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS notifications.list_channels;
CREATE FUNCTION notifications.list_channels(p_org_id UUID)
RETURNS TABLE(id UUID, channel_type TEXT, enabled BOOLEAN, created_at TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY
    SELECT nc.id, nc.channel_type, nc.enabled, nc.created_at
    FROM notification_channels nc
    WHERE nc.org_id = p_org_id
    ORDER BY nc.created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS notifications.send_notification;
CREATE FUNCTION notifications.send_notification(
    p_channel_id UUID,
    p_message TEXT,
    p_metadata JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
    v_sent BOOLEAN;
BEGIN
    -- TODO: Implement actual notification sending based on channel type
    -- email: send via SMTP/SendGrid
    -- webhook: POST to configured URL
    -- slack: POST to Slack webhook
    INSERT INTO notification_log (channel_id, message, metadata, status)
    VALUES (p_channel_id, p_message, p_metadata, 'sent');
    RETURN TRUE;
EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO notification_log (channel_id, message, metadata, status, error)
        VALUES (p_channel_id, p_message, p_metadata, 'failed', SQLERRM);
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- TODO: Add notification templates
