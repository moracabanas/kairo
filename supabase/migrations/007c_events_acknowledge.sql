ALTER TABLE events ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS acknowledged_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_events_acknowledged ON events(org_id, acknowledged) WHERE acknowledged = FALSE;