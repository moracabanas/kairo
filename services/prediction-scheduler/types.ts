export interface PredictionSchedulerConfig {
  intervalMs: number;
  maxSignalsPerRun: number;
  timesfmUrl: string;
}

export interface Signal {
  id: string;
  org_id: string;
  name: string;
  prediction_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SignalDataPoint {
  signal_id: string;
  timestamp: Date;
  value: number;
}

export interface TimesFMRequest {
  signal_id: string;
  context: number[];
  forecast_length: number;
  context_length: number;
  frequency: number;
}

export interface TimesFMResponse {
  signal_id: string;
  forecast: number[];
  lower_bound: number[];
  upper_bound: number[];
  confidence: number;
}

export interface SignalPrediction {
  signal_id: string;
  timestamp: Date;
  predicted_value: number;
  lower_bound: number;
  upper_bound: number;
  confidence: number;
  created_at: Date;
}