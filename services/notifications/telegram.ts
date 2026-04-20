interface TelegramConfig {
  bot_token: string;
  chat_id: string;
}

interface TelegramMessage {
  text: string;
  parse_mode?: "Markdown" | "HTML";
}

async function sendTelegramMessage(config: TelegramConfig, message: TelegramMessage): Promise<boolean> {
  const url = `https://api.telegram.org/bot${config.bot_token}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: config.chat_id,
        text: message.text,
        parse_mode: message.parse_mode || "Markdown",
      }),
    });

    const data = await response.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

function formatAlertMessage(
  eventType: string,
  severity: string,
  signalName: string,
  value: number,
  timestamp: string
): string {
  const emoji = severity === "critical" ? "🚨" : severity === "warning" ? "⚠️" : "ℹ️";
  return `${emoji} *Kairo Alert*

*Type:* ${eventType}
*Severity:* ${severity.toUpperCase()}
*Signal:* ${signalName}
*Value:* ${value.toFixed(2)}
*Time:* ${timestamp}`;
}

export { TelegramConfig, TelegramMessage, sendTelegramMessage, formatAlertMessage };