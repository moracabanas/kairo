import { Pool } from 'pg';
import { Signal, DatabaseSourceConfig } from './types';
import { PollingWorker } from './polling';

interface ServiceConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
}

class DbConnectorService {
  private config: ServiceConfig;
  private pool: Pool | null = null;
  private workers: Map<string, PollingWorker> = new Map();
  private isRunning: boolean = false;

  constructor(config: ServiceConfig) {
    this.config = config;
  }

  private async getPool(): Promise<Pool> {
    if (!this.pool) {
      this.pool = new Pool({
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.username,
        password: this.config.password,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      this.pool.on('error', (err) => {
        console.error('[DbConnectorService] Pool error:', err.message);
      });
    }
    return this.pool;
  }

  private async loadSignals(): Promise<Signal[]> {
    const pool = await this.getPool();

    const result = await pool.query<{
      id: string;
      org_id: string;
      name: string;
      source_type: string;
      source_config: Record<string, unknown>;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, org_id, name, source_type, source_config, created_at, updated_at
       FROM signals
       WHERE source_type = 'database'`
    );

    return result.rows.map((row) => ({
      ...row,
      source_config: row.source_config as unknown as DatabaseSourceConfig,
    }));
  }

  private spawnWorker(signal: Signal): void {
    if (this.workers.has(signal.id)) {
      console.log(`[DbConnectorService] Worker for signal ${signal.id} already exists, skipping`);
      return;
    }

    const worker = new PollingWorker(signal.source_config, signal.id);
    this.workers.set(signal.id, worker);

    worker.start().catch((err) => {
      console.error(`[DbConnectorService] Failed to start worker for signal ${signal.id}:`, err);
      this.workers.delete(signal.id);
    });
  }

  private async refreshWorkers(): Promise<void> {
    try {
      const signals = await this.loadSignals();
      const currentSignalIds = new Set(signals.map((s) => s.id));

      for (const [signalId, worker] of this.workers) {
        if (!currentSignalIds.has(signalId)) {
          console.log(`[DbConnectorService] Stopping worker for removed signal ${signalId}`);
          worker.stop();
          this.workers.delete(signalId);
        }
      }

      for (const signal of signals) {
        if (!this.workers.has(signal.id)) {
          this.spawnWorker(signal);
        }
      }
    } catch (error) {
      console.error('[DbConnectorService] Error refreshing workers:', error);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[DbConnectorService] Starting...');

    await this.getPool();
    await this.refreshWorkers();

    setInterval(() => {
      this.refreshWorkers();
    }, 60000);

    console.log('[DbConnectorService] Started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    console.log('[DbConnectorService] Stopping...');

    for (const [signalId, worker] of this.workers) {
      worker.stop();
    }
    this.workers.clear();

    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }

    console.log('[DbConnectorService] Stopped');
  }
}

export { DbConnectorService };
export type { ServiceConfig };
