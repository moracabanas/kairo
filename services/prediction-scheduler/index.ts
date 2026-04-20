import { Pool } from 'pg';
import {
  PredictionSchedulerConfig,
  Signal,
  SignalDataPoint,
  TimesFMRequest,
  TimesFMResponse,
  SignalPrediction,
} from './types';

const DEFAULT_CONFIG: PredictionSchedulerConfig = {
  intervalMs: 5 * 60 * 1000,
  maxSignalsPerRun: 10,
  timesfmUrl: 'http://localhost:8001',
};

const DEFAULT_TIMESFM_CONFIG = {
  forecast_length: 128,
  context_length: 512,
  frequency: 3600,
};

const DEFAULT_CONTEXT_SIZE = 512;

class PredictionSchedulerService {
  private config: PredictionSchedulerConfig;
  private pool: Pool | null = null;
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private dbConfig: {
    host: string;
    port: number;
    database: string;
    username: string;
    password?: string;
  };

  constructor(
    dbConfig: {
      host: string;
      port: number;
      database: string;
      username: string;
      password?: string;
    },
    config: Partial<PredictionSchedulerConfig> = {}
  ) {
    this.dbConfig = dbConfig;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private async getPool(): Promise<Pool> {
    if (!this.pool) {
      this.pool = new Pool({
        host: this.dbConfig.host,
        port: this.dbConfig.port,
        database: this.dbConfig.database,
        user: this.dbConfig.username,
        password: this.dbConfig.password,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      this.pool.on('error', (err) => {
        console.error('[PredictionScheduler] Pool error:', err.message);
      });
    }
    return this.pool;
  }

  private async loadSignalsWithPredictionEnabled(): Promise<Signal[]> {
    const pool = await this.getPool();

    try {
      const result = await pool.query<{
        id: string;
        org_id: string;
        name: string;
        prediction_enabled: boolean;
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT id, org_id, name, prediction_enabled, created_at, updated_at
         FROM signals
         WHERE prediction_enabled = true`
      );

      return result.rows;
    } catch (error) {
      console.error('[PredictionScheduler] Error loading signals:', error);
      throw error;
    }
  }

  private async fetchRecentData(signalId: string, limit: number): Promise<SignalDataPoint[]> {
    const pool = await this.getPool();

    try {
      const result = await pool.query<{
        signal_id: string;
        timestamp: Date;
        value: number;
      }>(
        `SELECT signal_id, timestamp, value
         FROM signal_data
         WHERE signal_id = $1
         ORDER BY timestamp DESC
         LIMIT $2`,
        [signalId, limit]
      );

      return result.rows.reverse();
    } catch (error) {
      console.error(`[PredictionScheduler] Error fetching data for signal ${signalId}:`, error);
      throw error;
    }
  }

  private async callTimesFM(request: TimesFMRequest): Promise<TimesFMResponse> {
    const response = await fetch(`${this.config.timesfmUrl}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`TimesFM API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async storePredictions(predictions: SignalPrediction[]): Promise<void> {
    if (predictions.length === 0) return;

    const pool = await this.getPool();

    const values = predictions.map((pred, idx) => {
      const offset = idx * 7;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`;
    }).join(', ');

    const params: unknown[] = [];
    predictions.forEach((pred) => {
      params.push(
        pred.signal_id,
        pred.timestamp,
        pred.predicted_value,
        pred.lower_bound,
        pred.upper_bound,
        pred.confidence,
        pred.created_at
      );
    });

    await pool.query(
      `INSERT INTO signal_predictions (signal_id, timestamp, predicted_value, lower_bound, upper_bound, confidence, created_at)
       VALUES ${values}`,
      params
    );
  }

  private async processSignal(signal: Signal, attempt: number = 0): Promise<void> {
    const maxAttempts = 5;
    const baseDelay = 1000;

    try {
      const dataPoints = await this.fetchRecentData(signal.id, DEFAULT_CONTEXT_SIZE);

      if (dataPoints.length === 0) {
        console.log(`[PredictionScheduler:${signal.id}] No data points available, skipping`);
        return;
      }

      const context = dataPoints.map((dp) => dp.value);

      const request: TimesFMRequest = {
        signal_id: signal.id,
        context,
        forecast_length: DEFAULT_TIMESFM_CONFIG.forecast_length,
        context_length: DEFAULT_TIMESFM_CONFIG.context_length,
        frequency: DEFAULT_TIMESFM_CONFIG.frequency,
      };

      const response = await this.callTimesFM(request);

      const predictions: SignalPrediction[] = response.forecast.map((value, index) => {
        const lastTimestamp = dataPoints[dataPoints.length - 1].timestamp;
        const forecastInterval = 3600000 / DEFAULT_TIMESFM_CONFIG.frequency;
        const timestamp = new Date(lastTimestamp.getTime() + (index + 1) * forecastInterval);

        return {
          signal_id: signal.id,
          timestamp,
          predicted_value: value,
          lower_bound: response.lower_bound[index],
          upper_bound: response.upper_bound[index],
          confidence: response.confidence,
          created_at: new Date(),
        };
      });

      await this.storePredictions(predictions);

      console.log(
        `[PredictionScheduler:${signal.id}] Stored ${predictions.length} predictions`
      );
    } catch (error) {
      if (attempt < maxAttempts - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(
          `[PredictionScheduler:${signal.id}] Prediction failed (attempt ${attempt + 1}), retrying in ${delay}ms:`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        await this.processSignal(signal, attempt + 1);
      } else {
        console.error(
          `[PredictionScheduler:${signal.id}] Prediction failed after ${maxAttempts} attempts:`,
          error
        );
      }
    }
  }

  private async runPredictions(): Promise<void> {
    console.log('[PredictionScheduler] Starting prediction run');

    try {
      const signals = await this.loadSignalsWithPredictionEnabled();

      if (signals.length === 0) {
        console.log('[PredictionScheduler] No signals with prediction enabled');
        return;
      }

      console.log(`[PredictionScheduler] Found ${signals.length} signals with prediction enabled`);

      const signalsToProcess = signals.slice(0, this.config.maxSignalsPerRun);
      const skipped = signals.length - signalsToProcess.length;

      if (skipped > 0) {
        console.log(`[PredictionScheduler] Skipping ${skipped} signals (batch limit reached)`);
      }

      for (const signal of signalsToProcess) {
        await this.processSignal(signal);
      }

      console.log('[PredictionScheduler] Prediction run completed');
    } catch (error) {
      console.error('[PredictionScheduler] Error during prediction run:', error);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[PredictionScheduler] Starting...');
    console.log(`[PredictionScheduler] Configuration:`, {
      intervalMs: this.config.intervalMs,
      maxSignalsPerRun: this.config.maxSignalsPerRun,
      timesfmUrl: this.config.timesfmUrl,
    });

    await this.getPool();

    await this.runPredictions();

    this.intervalHandle = setInterval(() => {
      this.runPredictions();
    }, this.config.intervalMs);

    console.log(`[PredictionScheduler] Started with interval ${this.config.intervalMs}ms`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    console.log('[PredictionScheduler] Stopping...');

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }

    console.log('[PredictionScheduler] Stopped');
  }
}

export { PredictionSchedulerService };
export type { PredictionSchedulerConfig };