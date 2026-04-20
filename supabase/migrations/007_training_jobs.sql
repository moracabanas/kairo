CREATE TABLE IF NOT EXISTS training_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    signal_ids UUID[] NOT NULL,
    model_type TEXT NOT NULL CHECK (model_type IN ('anomaly_detection', 'timesfm_finetune')),
    hyperparameters JSONB NOT NULL DEFAULT '{}',
    schedule_type TEXT NOT NULL CHECK (schedule_type IN ('now', 'scheduled')),
    scheduled_time TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'running', 'completed', 'failed', 'cancelled')),
    clearml_task_id TEXT,
    clearml_queue TEXT DEFAULT 'training',
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_jobs_org_id ON training_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_training_jobs_user_id ON training_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_training_jobs_status ON training_jobs(status);
CREATE INDEX IF NOT EXISTS idx_training_jobs_clearml_task_id ON training_jobs(clearml_task_id);
CREATE INDEX IF NOT EXISTS idx_training_jobs_scheduled_time ON training_jobs(scheduled_time) WHERE schedule_type = 'scheduled';

ALTER TABLE training_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY training_jobs_select ON training_jobs
    FOR SELECT USING (org_id = app.current_org_id() OR app.current_org_id() IS NULL);

CREATE POLICY training_jobs_insert ON training_jobs
    FOR INSERT WITH CHECK (org_id = app.current_org_id() OR app.current_org_id() IS NULL);

CREATE POLICY training_jobs_update ON training_jobs
    FOR UPDATE USING (org_id = app.current_org_id())
    WITH CHECK (org_id = app.current_org_id());

CREATE POLICY training_jobs_delete ON training_jobs
    FOR DELETE USING (org_id = app.current_org_id());

GRANT ALL ON training_jobs TO service_role;

CREATE OR REPLACE FUNCTION app.submit_training_job(
    p_org_id UUID,
    p_user_id UUID,
    p_signal_ids UUID[],
    p_model_type TEXT,
    p_hyperparameters JSONB,
    p_schedule_type TEXT,
    p_scheduled_time TIMESTAMPTZ DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_job_id UUID;
    v_status TEXT;
BEGIN
    v_status := CASE WHEN p_schedule_type = 'now' THEN 'pending' ELSE 'scheduled' END;

    INSERT INTO training_jobs (
        org_id,
        user_id,
        signal_ids,
        model_type,
        hyperparameters,
        schedule_type,
        scheduled_time,
        status
    ) VALUES (
        p_org_id,
        p_user_id,
        p_signal_ids,
        p_model_type,
        p_hyperparameters,
        p_schedule_type,
        p_scheduled_time,
        v_status
    ) RETURNING id INTO v_job_id;

    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'app';

GRANT EXECUTE ON FUNCTION app.submit_training_job(UUID, UUID, UUID[], TEXT, JSONB, TEXT, TIMESTAMPTZ) TO service_role, authenticated;

CREATE OR REPLACE FUNCTION app.update_training_job_status(
    p_job_id UUID,
    p_status TEXT,
    p_clearml_task_id TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE training_jobs
    SET
        status = p_status,
        clearml_task_id = COALESCE(p_clearml_task_id, clearml_task_id),
        error_message = p_error_message,
        started_at = CASE WHEN p_status = 'running' THEN NOW() ELSE started_at END,
        completed_at = CASE WHEN p_status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'app';

GRANT EXECUTE ON FUNCTION app.update_training_job_status(UUID, TEXT, TEXT, TEXT) TO service_role;

CREATE TRIGGER update_training_jobs_updated_at BEFORE UPDATE ON training_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();