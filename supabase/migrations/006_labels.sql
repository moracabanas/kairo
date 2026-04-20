CREATE TABLE label_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6b7280',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_label_tags_org_id ON label_tags(org_id);

CREATE TABLE labels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    label_type TEXT NOT NULL CHECK (label_type IN ('normal', 'anomaly', 'custom')),
    tag_id UUID REFERENCES label_tags(id) ON DELETE SET NULL,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_labels_signal_id ON labels(signal_id);
CREATE INDEX idx_labels_time_range ON labels(signal_id, start_time, end_time);

CREATE TRIGGER update_labels_updated_at BEFORE UPDATE ON labels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS for label_tags
ALTER TABLE label_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_tags FORCE ROW LEVEL SECURITY;

CREATE POLICY label_tags_select ON label_tags
    FOR SELECT USING (org_id = app.current_org_id() OR app.current_org_id() IS NULL);
CREATE POLICY label_tags_insert ON label_tags
    FOR INSERT WITH CHECK (org_id = app.current_org_id() OR app.current_org_id() IS NULL);
CREATE POLICY label_tags_update ON label_tags
    FOR UPDATE USING (org_id = app.current_org_id())
    WITH CHECK (org_id = app.current_org_id());
CREATE POLICY label_tags_delete ON label_tags
    FOR DELETE USING (org_id = app.current_org_id());

GRANT ALL ON label_tags TO service_role;

-- RLS for labels
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels FORCE ROW LEVEL SECURITY;

CREATE POLICY labels_select ON labels
    FOR SELECT USING (
        signal_id IN (SELECT id FROM signals WHERE org_id = app.current_org_id())
        OR app.current_org_id() IS NULL
    );
CREATE POLICY labels_insert ON labels
    FOR INSERT WITH CHECK (
        signal_id IN (SELECT id FROM signals WHERE org_id = app.current_org_id())
        OR app.current_org_id() IS NULL
    );
CREATE POLICY labels_update ON labels
    FOR UPDATE USING (
        signal_id IN (SELECT id FROM signals WHERE org_id = app.current_org_id())
    ) WITH CHECK (
        signal_id IN (SELECT id FROM signals WHERE org_id = app.current_org_id())
    );
CREATE POLICY labels_delete ON labels
    FOR DELETE USING (
        signal_id IN (SELECT id FROM signals WHERE org_id = app.current_org_id())
    );

GRANT ALL ON labels TO service_role;
