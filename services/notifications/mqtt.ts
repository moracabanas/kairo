interface MqttConfig {
  broker_url: string;
  username?: string;
  password?: string;
}

interface MqttMessage {
  topic: string;
  payload: string;
  qos?: 0 | 1 | 2;
  retain?: boolean;
}

function formatMqttAlertPayload(
  eventType: string,
  severity: string,
  signalId: string,
  value: number,
  timestamp: string
): string {
  return JSON.stringify({
    event_type: eventType,
    severity,
    signal_id: signalId,
    value,
    timestamp,
    source: "kairo",
  });
}

async function publishMqttMessage(config: MqttConfig, message: MqttMessage): Promise<boolean> {
  const mqtt = await import("mqtt");
  const client = mqtt.connect(config.broker_url, {
    username: config.username,
    password: config.password,
  });

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (client.connected) {
        client.end();
      }
      resolve(false);
    }, 10000);

    client.on("connect", () => {
      client.publish(
        message.topic,
        message.payload,
        { qos: message.qos || 1, retain: message.retain || false },
        (err) => {
          clearTimeout(timeout);
          client.end();
          resolve(!err);
        }
      );
    });

    client.on("error", () => {
      clearTimeout(timeout);
      client.end();
      resolve(false);
    });
  });
}

export { MqttConfig, MqttMessage, publishMqttMessage, formatMqttAlertPayload };