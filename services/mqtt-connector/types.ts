export interface MqttSourceConfig {
  brokerUrl: string;
  topic: string;
  qos: 0 | 1 | 2;
  payloadSchema: {
    timestampField: string;
    valueField: string;
    metadataFields?: string[];
  };
}

export interface Signal {
  id: string;
  org_id: string;
  name: string;
  source_type: string;
  source_config: MqttSourceConfig;
  created_at: Date;
  updated_at: Date;
}

export interface SignalDataRow {
  signal_id: string;
  timestamp: Date;
  value: number | string | boolean | null;
  metadata?: Record<string, unknown>;
}

export interface ParsedMessage {
  signalId: string;
  timestamp: Date;
  value: number | string | boolean | null;
  metadata: Record<string, unknown>;
}

export type MessageHandler = (message: ParsedMessage) => void;
