interface McpConfig {
  server_url: string;
  api_key?: string;
}

interface McpNotification {
  type: string;
  severity: string;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

async function sendMcpNotification(config: McpConfig, notification: McpNotification): Promise<boolean> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.api_key) {
    headers["Authorization"] = `Bearer ${config.api_key}`;
  }

  try {
    const response = await fetch(config.server_url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/notify",
        params: {
          notification: {
            type: notification.type,
            severity: notification.severity,
            title: notification.title,
            body: notification.body,
            metadata: notification.metadata,
          },
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    return response.ok;
  } catch {
    return false;
  }
}

function createMcpAlertNotification(
  eventType: string,
  severity: string,
  signalId: string,
  value: number,
  timestamp: string
): McpNotification {
  return {
    type: "alert",
    severity,
    title: `Kairo Alert: ${eventType}`,
    body: `Signal ${signalId} triggered ${severity} alert with value ${value.toFixed(2)} at ${timestamp}`,
    metadata: {
      event_type: eventType,
      signal_id: signalId,
      value,
      timestamp,
      source: "kairo",
    },
  };
}

export { McpConfig, McpNotification, sendMcpNotification, createMcpAlertNotification };