interface WebhookConfig {
  url: string;
  secret?: string;
  headers?: Record<string, string>;
}

interface WebhookPayload {
  event_type: string;
  severity: string;
  timestamp: string;
  data: Record<string, unknown>;
}

async function sendWebhook(config: WebhookConfig, payload: WebhookPayload): Promise<boolean> {
  const { url, secret, headers = {} } = config;

  const body = JSON.stringify(payload);
  const fetchHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    fetchHeaders["X-Webhook-Signature"] = `sha256=${Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("")}`;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: fetchHeaders,
      body,
      signal: AbortSignal.timeout(10000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export { WebhookConfig, WebhookPayload, sendWebhook };