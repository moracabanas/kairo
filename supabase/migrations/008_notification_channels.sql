CREATE TABLE notification_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    channel_type TEXT NOT NULL CHECK (channel_type IN ('email', 'webhook', 'telegram', 'mqtt', 'mcp')),
    name TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_channels_org_id ON notification_channels(org_id);
CREATE INDEX idx_notification_channels_channel_type ON notification_channels(channel_type);

CREATE TRIGGER update_notification_channels_updated_at BEFORE UPDATE ON notification_channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_channels FORCE ROW LEVEL SECURITY;

CREATE POLICY notification_channels_select ON notification_channels
    FOR SELECT USING (org_id = app.current_org_id());

CREATE POLICY notification_channels_insert ON notification_channels
    FOR INSERT WITH CHECK (org_id = app.current_org_id());

CREATE POLICY notification_channels_update ON notification_channels
    FOR UPDATE USING (org_id = app.current_org_id())
    WITH CHECK (org_id = app.current_org_id());

CREATE POLICY notification_channels_delete ON notification_channels
    FOR DELETE USING (org_id = app.current_org_id());

GRANT ALL ON notification_channels TO service_role;