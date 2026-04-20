export interface DatabaseSourceConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  sslmode?: 'disable' | 'require' | 'verify-ca' | 'verify-full';
  query: string;
  refreshInterval: number;
}

export interface Signal {
  id: string;
  org_id: string;
  name: string;
  source_type: string;
  source_config: DatabaseSourceConfig;
  created_at: Date;
  updated_at: Date;
}

export interface SignalDataRow {
  signal_id: string;
  timestamp: Date;
  value: number | string | boolean | null;
  metadata?: Record<string, unknown>;
}
