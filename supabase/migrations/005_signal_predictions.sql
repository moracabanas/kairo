CREATE TABLE IF NOT EXISTS signal_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_id UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    forecast DOUBLE PRECISION[] NOT NULL,
    lower_bound DOUBLE PRECISION[] NOT NULL,
    upper_bound DOUBLE PRECISION[] NOT NULL,
    confidence DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    forecast_length INTEGER NOT NULL,
    context_used INTEGER NOT NULL,
    frequency_used INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signal_predictions_signal_id ON signal_predictions(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_predictions_org_id ON signal_predictions(org_id);
CREATE INDEX IF NOT EXISTS idx_signal_predictions_created_at ON signal_predictions(created_at);

ALTER TABLE signal_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_predictions FORCE ROW LEVEL SECURITY;

CREATE POLICY signal_predictions_select ON signal_predictions
    FOR SELECT
    USING (
        org_id = app.current_org_id()
        OR app.can_manage_signals(app.get_user_role(org_id))
    );

CREATE POLICY signal_predictions_insert ON signal_predictions
    FOR INSERT
    WITH CHECK (
        org_id = app.current_org_id()
        OR app.can_manage_signals(app.get_user_role(org_id))
    );

CREATE POLICY signal_predictions_delete ON signal_predictions
    FOR DELETE
    USING (
        org_id = app.current_org_id()
        OR app.is_owner(app.get_user_role(org_id))
    );

GRANT ALL ON signal_predictions TO service_role;
