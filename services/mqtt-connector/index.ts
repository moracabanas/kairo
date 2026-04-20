import { Pool } from 'pg';
import { Signal, MqttSourceConfig } from './types';
import { MqttSubscriber } from './subscriber';

interface ServiceConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
}

class MqttConnectorService {
  private config: ServiceConfig;
  private pool: Pool | null = null;
  private subscribers: Map<string, MqttSubscriber> = new Map();
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
        console.error('[MqttConnectorService] Pool error:', err.message);
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
       WHERE source_type = 'mqtt'`
    );

    return result.rows.map((row) => ({
      ...row,
      source_config: row.source_config as unknown as MqttSourceConfig,
    }));
  }

  private spawnSubscriber(signal: Signal): void {
    if (this.subscribers.has(signal.id)) {
      console.log(`[MqttConnectorService] Subscriber for signal ${signal.id} already exists, skipping`);
      return;
    }

    const subscriber = new MqttSubscriber(signal.source_config, signal.id, this.pool!);
    this.subscribers.set(signal.id, subscriber);

    subscriber.on('message', (message) => {
      console.log(`[MqttConnectorService] Received message for signal ${signal.id}:`, message);
    });

    subscriber.start().catch((err) => {
      console.error(`[MqttConnectorService] Failed to start subscriber for signal ${signal.id}:`, err);
      this.subscribers.delete(signal.id);
    });
  }

  private async refreshSubscribers(): Promise<void> {
    try {
      const signals = await this.loadSignals();
      const currentSignalIds = new Set(signals.map((s) => s.id));

      for (const [signalId, subscriber] of this.subscribers) {
        if (!currentSignalIds.has(signalId)) {
          console.log(`[MqttConnectorService] Stopping subscriber for removed signal ${signalId}`);
          subscriber.stop();
          this.subscribers.delete(signalId);
        }
      }

      for (const signal of signals) {
        if (!this.subscribers.has(signal.id)) {
          this.spawnSubscriber(signal);
        }
      }
    } catch (error) {
      console.error('[MqttConnectorService] Error refreshing subscribers:', error);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[MqttConnectorService] Starting...');

    await this.getPool();
    await this.refreshSubscribers();

    setInterval(() => {
      this.refreshSubscribers();
    }, 60000);

    console.log('[MqttConnectorService] Started');
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    console.log('[MqttConnectorService] Stopping...');

    for (const [signalId, subscriber] of this.subscribers) {
      subscriber.stop();
    }
    this.subscribers.clear();

    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }

    console.log('[MqttConnectorService] Stopped');
  }
}

export { MqttConnectorService };
export type { ServiceConfig };
