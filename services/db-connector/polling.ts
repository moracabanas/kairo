import { Pool, PoolConfig } from 'pg';
import { DatabaseSourceConfig, SignalDataRow } from './types';

export class PollingWorker {
  private config: DatabaseSourceConfig;
  private signalId: string;
  private pool: Pool | null = null;
  private intervalHandle: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
  private readonly baseReconnectDelay: number = 1000;

  constructor(config: DatabaseSourceConfig, signalId: string) {
    this.config = config;
    this.signalId = signalId;
  }

  private buildPoolConfig(): PoolConfig {
    const ssl: PoolConfig['ssl'] = this.config.sslmode && this.config.sslmode !== 'disable'
      ? true
      : undefined;

    return {
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  }

  private async connect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }

    this.pool = new Pool(this.buildPoolConfig());

    this.pool.on('error', (err) => {
      console.error(`[PollingWorker:${this.signalId}] Unexpected pool error:`, err.message);
    });

    try {
      const client = await this.pool.connect();
      client.release();
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error(`[PollingWorker:${this.signalId}] Failed to connect:`, error);
      throw error;
    }
  }

  private async executeQuery(): Promise<unknown[]> {
    if (!this.pool) {
      throw new Error('Pool not initialized');
    }

    const result = await this.pool.query(this.config.query);
    return result.rows;
  }

  private transformResult(rows: unknown[]): SignalDataRow[] {
    return rows.map((row: unknown) => {
      const record = row as Record<string, unknown>;
      const rawValue = record.value ?? record.val ?? record.data ?? record.amount;
      const value: SignalDataRow['value'] = typeof rawValue === 'object' && rawValue !== null ? null : rawValue as SignalDataRow['value'];
      const rawTimestamp = record.timestamp ?? record.created_at ?? record.time ?? record.ts ?? record._timestamp;
      const timestamp = rawTimestamp ? new Date(rawTimestamp as string | number) : new Date();
      return {
        signal_id: this.signalId,
        timestamp,
        value,
        metadata: record,
      };
    });
  }

  private async insertSignalData(data: SignalDataRow[]): Promise<void> {
    if (!this.pool || data.length === 0) return;

    const values = data.map((row, idx) => {
      const offset = idx * 4;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
    }).join(', ');

    const params: unknown[] = [];
    data.forEach((row) => {
      params.push(row.signal_id, row.timestamp, row.value, JSON.stringify(row.metadata || {}));
    });

    await this.pool.query(
      `INSERT INTO signal_data (signal_id, timestamp, value, metadata) VALUES ${values}`,
      params
    );
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const rows = await this.executeQuery();
      const signalData = this.transformResult(rows);

      if (signalData.length > 0) {
        await this.insertSignalData(signalData);
        console.log(`[PollingWorker:${this.signalId}] Inserted ${signalData.length} rows`);
      }
    } catch (error) {
      console.error(`[PollingWorker:${this.signalId}] Poll error:`, error);
      await this.handleError();
    }
  }

  private async handleError(): Promise<void> {
    this.reconnectAttempts++;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[PollingWorker:${this.signalId}] Max reconnection attempts reached. Stopping.`);
      this.stop();
      return;
    }

    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[PollingWorker:${this.signalId}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await this.connect();
      console.log(`[PollingWorker:${this.signalId}] Reconnected successfully`);
    } catch {
      await this.handleError();
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    await this.connect();
    this.isRunning = true;

    await this.poll();

    this.intervalHandle = setInterval(() => {
      this.poll();
    }, this.config.refreshInterval);

    console.log(`[PollingWorker:${this.signalId}] Started with interval ${this.config.refreshInterval}ms`);
  }

  stop(): void {
    this.isRunning = false;

    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }

    if (this.pool) {
      this.pool.end().catch((err) => {
        console.error(`[PollingWorker:${this.signalId}] Error ending pool:`, err.message);
      });
      this.pool = null;
    }

    console.log(`[PollingWorker:${this.signalId}] Stopped`);
  }
}
