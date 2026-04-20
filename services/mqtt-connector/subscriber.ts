import * as mqtt from 'mqtt';
import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { MqttSourceConfig, SignalDataRow, ParsedMessage, MessageHandler } from './types';

export class MqttSubscriber extends EventEmitter {
  private config: MqttSourceConfig;
  private signalId: string;
  private client: mqtt.MqttClient | null = null;
  private isRunning: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
  private readonly baseReconnectDelay: number = 1000;
  private pool: Pool | null = null;
  private messageHandler: MessageHandler | null = null;

  constructor(config: MqttSourceConfig, signalId: string, pool: Pool) {
    super();
    this.config = config;
    this.signalId = signalId;
    this.pool = pool;
  }

  private getJsonValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private parsePayload(payload: Buffer): ParsedMessage | null {
    try {
      const json = JSON.parse(payload.toString()) as Record<string, unknown>;
      if (typeof json !== 'object' || json === null) {
        console.error(`[MqttSubscriber:${this.signalId}] Payload is not a JSON object`);
        return null;
      }

      const timestampValue = this.getJsonValue(json, this.config.payloadSchema.timestampField);
      const timestamp = timestampValue
        ? new Date(timestampValue as string | number)
        : new Date();

      if (isNaN(timestamp.getTime())) {
        console.error(`[MqttSubscriber:${this.signalId}] Invalid timestamp: ${timestampValue}`);
        return null;
      }

      const rawValue = this.getJsonValue(json, this.config.payloadSchema.valueField);
      const value: number | string | boolean | null =
        typeof rawValue === 'object' || rawValue === undefined ? null : (rawValue as number | string | boolean | null);

      const metadata: Record<string, unknown> = {};
      if (this.config.payloadSchema.metadataFields) {
        for (const field of this.config.payloadSchema.metadataFields) {
          metadata[field] = this.getJsonValue(json, field);
        }
      }

      return {
        signalId: this.signalId,
        timestamp,
        value,
        metadata,
      };
    } catch (error) {
      console.error(`[MqttSubscriber:${this.signalId}] Failed to parse payload:`, error);
      return null;
    }
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

  private async handleMessage(message: ParsedMessage): Promise<void> {
    const row: SignalDataRow = {
      signal_id: message.signalId,
      timestamp: message.timestamp,
      value: message.value,
      metadata: message.metadata,
    };

    try {
      await this.insertSignalData([row]);
      console.log(`[MqttSubscriber:${this.signalId}] Inserted data point`);
    } catch (error) {
      console.error(`[MqttSubscriber:${this.signalId}] Failed to insert data:`, error);
    }

    this.emit('message', message);
  }

  private connect(): void {
    const options: mqtt.IClientOptions = {
      reconnectPeriod: 0,
    };

    this.client = mqtt.connect(this.config.brokerUrl, options);

    this.client.on('connect', () => {
      console.log(`[MqttSubscriber:${this.signalId}] Connected to broker`);
      this.reconnectAttempts = 0;

      this.client?.subscribe(this.config.topic, { qos: this.config.qos }, (err) => {
        if (err) {
          console.error(`[MqttSubscriber:${this.signalId}] Subscribe error:`, err);
        } else {
          console.log(`[MqttSubscriber:${this.signalId}] Subscribed to ${this.config.topic}`);
        }
      });
    });

    this.client.on('message', (topic, payload) => {
      const parsed = this.parsePayload(payload);
      if (parsed) {
        this.handleMessage(parsed).catch((err) => {
          console.error(`[MqttSubscriber:${this.signalId}] Message handler error:`, err);
        });
      }
    });

    this.client.on('error', (err) => {
      console.error(`[MqttSubscriber:${this.signalId}] Client error:`, err.message);
    });

    this.client.on('close', () => {
      console.log(`[MqttSubscriber:${this.signalId}] Connection closed`);
    });

    this.client.on('offline', () => {
      console.log(`[MqttSubscriber:${this.signalId}] Client offline`);
    });

    this.client.on('reconnect', () => {
      this.handleReconnect();
    });

    this.client.on('end', () => {
      console.log(`[MqttSubscriber:${this.signalId}] Connection ended`);
    });
  }

  private async handleReconnect(): Promise<void> {
    this.reconnectAttempts++;

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[MqttSubscriber:${this.signalId}] Max reconnection attempts reached. Stopping.`);
      this.stop();
      return;
    }

    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`[MqttSubscriber:${this.signalId}] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    await new Promise((resolve) => setTimeout(resolve, delay));

    if (this.isRunning && this.client) {
      try {
        this.client.reconnect();
      } catch (error) {
        console.error(`[MqttSubscriber:${this.signalId}] Reconnect error:`, error);
        await this.handleReconnect();
      }
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;
    this.connect();

    console.log(`[MqttSubscriber:${this.signalId}] Started`);
  }

  stop(): void {
    this.isRunning = false;

    if (this.client) {
      this.client.end(false, {}, () => {
        console.log(`[MqttSubscriber:${this.signalId}] Client ended gracefully`);
      });
      this.client = null;
    }

    console.log(`[MqttSubscriber:${this.signalId}] Stopped`);
  }
}
