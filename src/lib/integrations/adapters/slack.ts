// Slack integration adapter — send notifications and alerts.
// Configure with env: SLACK_BOT_TOKEN, SLACK_DEFAULT_CHANNEL
// Or use Incoming Webhooks: SLACK_WEBHOOK_URL

export interface SlackSendResult {
  ok: boolean;
  ts?: string;
  error?: string;
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  fields?: Array<{ type: string; text: string }>;
}

export async function sendSlackMessage(
  channel: string,
  text: string,
  blocks?: SlackBlock[]
): Promise<SlackSendResult> {
  // Prefer Incoming Webhook
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, blocks }),
    });
    const body = await res.text();
    return res.ok ? { ok: true } : { ok: false, error: body };
  }

  // Fall back to Bot Token API
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return { ok: false, error: "Slack not configured. Set SLACK_BOT_TOKEN or SLACK_WEBHOOK_URL." };

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, text, blocks }),
  });

  const data = await res.json() as { ok: boolean; ts?: string; error?: string };
  return data.ok ? { ok: true, ts: data.ts } : { ok: false, error: data.error };
}

// Pre-built notification: escalation alert to a Slack channel
export async function notifyEscalation(opts: {
  conversationId: string;
  customerName: string;
  reason: string;
  channel?: string;
}): Promise<SlackSendResult> {
  const ch = opts.channel ?? process.env.SLACK_DEFAULT_CHANNEL ?? "#escalations";
  return sendSlackMessage(ch, `Escalation needed: ${opts.customerName}`, [
    {
      type: "section",
      text: { type: "mrkdwn", text: `*Escalation Required* — <${process.env.NEXT_PUBLIC_APP_URL}/inbox|Open Inbox>` },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Customer*\n${opts.customerName}` },
        { type: "mrkdwn", text: `*Reason*\n${opts.reason}` },
        { type: "mrkdwn", text: `*Conversation ID*\n\`${opts.conversationId}\`` },
      ],
    },
  ]);
}

export function isSlackAvailable(): boolean {
  return !!(process.env.SLACK_BOT_TOKEN || process.env.SLACK_WEBHOOK_URL);
}
