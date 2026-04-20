CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    job_id UUID REFERENCES training_jobs(id) ON DELETE SET NULL,
    signal_ids UUID[] NOT NULL DEFAULT '{}',
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
    event_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_org_id ON events(org_id);
CREATE INDEX IF NOT EXISTS idx_events_job_id ON events(job_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;

CREATE POLICY events_select ON events
    FOR SELECT USING (org_id = app.current_org_id() OR app.current_org_id() IS NULL);

CREATE POLICY events_insert ON events
    FOR INSERT WITH CHECK (org_id = app.current_org_id() OR app.current_org_id() IS NULL);

CREATE POLICY events_delete ON events
    FOR DELETE USING (org_id = app.current_org_id());

GRANT ALL ON events TO service_role;

CREATE OR REPLACE FUNCTION app.record_anomaly_event(
    p_org_id UUID,
    p_job_id UUID,
    p_signal_ids UUID[],
    p_severity TEXT,
    p_anomaly_scores JSONB,
    p_threshold DOUBLE PRECISION DEFAULT 0.7
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
    v_high_score_count INT;
    v_max_score DOUBLE PRECISION;
BEGIN
    v_high_score_count := jsonb_array_length(p_anomaly_scores);
    v_max_score := (SELECT MAX(value) FROM jsonb_array_elements_text(p_anomaly_scores)::jsonb);

    INSERT INTO events (
        org_id,
        job_id,
        signal_ids,
        event_type,
        severity,
        event_data
    ) VALUES (
        p_org_id,
        p_job_id,
        p_signal_ids,
        'anomaly_detected',
        CASE
            WHEN v_max_score >= 0.9 THEN 'critical'
            ELSE 'warning'
        END,
        jsonb_build_object(
            'threshold', p_threshold,
            'anomaly_scores', p_anomaly_scores,
            'max_score', v_max_score,
            'high_score_count', v_high_score_count
        )
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'app';

GRANT EXECUTE ON FUNCTION app.record_anomaly_event(UUID, UUID, UUID[], TEXT, JSONB, DOUBLE PRECISION) TO service_role;