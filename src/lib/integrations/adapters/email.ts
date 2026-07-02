// Email adapter — SendGrid primary, log-to-console fallback for dev.
// Env vars: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, SENDGRID_FROM_NAME

export interface EmailMessage {
  to: string;
  toName?: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  replyTo?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Core send
// ---------------------------------------------------------------------------

export async function sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? "noreply@example.com";
  const fromName = process.env.SENDGRID_FROM_NAME ?? "Support";

  // Dev fallback: no API key → log and return a synthetic success
  if (!apiKey) {
    console.log("[email:dev] Would send email:", {
      to: msg.to,
      subject: msg.subject,
      textBody: msg.textBody ?? "(html only)",
    });
    return { success: true, messageId: `dev-${Date.now()}` };
  }

  const payload = {
    personalizations: [
      {
        to: [{ email: msg.to, ...(msg.toName ? { name: msg.toName } : {}) }],
      },
    ],
    from: { email: fromEmail, name: fromName },
    ...(msg.replyTo ? { reply_to: { email: msg.replyTo } } : {}),
    subject: msg.subject,
    content: [
      ...(msg.textBody ? [{ type: "text/plain", value: msg.textBody }] : []),
      { type: "text/html", value: msg.htmlBody },
    ],
  };

  let res: Response;
  try {
    res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  if (res.status === 202) {
    const messageId = res.headers.get("x-message-id") ?? undefined;
    return { success: true, messageId };
  }

  let errorText = `SendGrid returned HTTP ${res.status}`;
  try {
    const body = await res.json() as { errors?: Array<{ message: string }> };
    if (Array.isArray(body.errors) && body.errors.length > 0) {
      errorText = body.errors.map((e) => e.message).join("; ");
    }
  } catch {
    // ignore JSON parse failure; keep the HTTP status message
  }
  return { success: false, error: errorText };
}

// ---------------------------------------------------------------------------
// Escalation notification
// ---------------------------------------------------------------------------

export async function sendEscalationEmail(opts: {
  to: string;
  toName?: string;
  conversationId: string;
  customerName: string;
  reason: string;
  summary: string;
}): Promise<EmailSendResult> {
  const { to, toName, conversationId, customerName, reason, summary } = opts;

  const subject = `[Escalation] Conversation ${conversationId} requires attention`;

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 24px; }
  h2 { color: #c0392b; }
  .detail { background: #f8f8f8; border-left: 4px solid #c0392b; padding: 12px 16px; margin: 16px 0; }
  .label { font-weight: bold; color: #555; }
  .summary { white-space: pre-wrap; background: #fff; border: 1px solid #ddd; padding: 12px; border-radius: 4px; }
</style></head>
<body>
  <h2>Escalation Alert</h2>
  <p>A conversation has been escalated and requires human review.</p>
  <div class="detail">
    <p><span class="label">Conversation ID:</span> ${escHtml(conversationId)}</p>
    <p><span class="label">Customer:</span> ${escHtml(customerName)}</p>
    <p><span class="label">Reason:</span> ${escHtml(reason)}</p>
  </div>
  <h3>Conversation Summary</h3>
  <div class="summary">${escHtml(summary)}</div>
  <p style="color:#888;font-size:12px;margin-top:32px;">This is an automated notification from your AI support system.</p>
</body>
</html>`;

  const textBody = [
    `ESCALATION ALERT`,
    ``,
    `Conversation ID : ${conversationId}`,
    `Customer        : ${customerName}`,
    `Reason          : ${reason}`,
    ``,
    `Summary`,
    `-------`,
    summary,
  ].join("\n");

  return sendEmail({ to, toName, subject, htmlBody, textBody });
}

// ---------------------------------------------------------------------------
// Transcript email
// ---------------------------------------------------------------------------

export async function sendTranscriptEmail(opts: {
  to: string;
  conversationId: string;
  messages: Array<{ role: string; content: string; created_at: string }>;
}): Promise<EmailSendResult> {
  const { to, conversationId, messages } = opts;

  const subject = `Conversation transcript — ${conversationId}`;

  const rows = messages
    .map((m) => {
      const label = m.role === "assistant" ? "Support Agent" : "Customer";
      const ts = new Date(m.created_at).toLocaleString();
      return `<tr>
      <td style="white-space:nowrap;color:#888;font-size:12px;padding:6px 12px;vertical-align:top">${escHtml(ts)}</td>
      <td style="font-weight:bold;padding:6px 8px;vertical-align:top;color:${m.role === "assistant" ? "#2980b9" : "#333"}">${escHtml(label)}</td>
      <td style="padding:6px 8px;vertical-align:top;white-space:pre-wrap">${escHtml(m.content)}</td>
    </tr>`;
    })
    .join("\n");

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Arial, sans-serif; color: #333; max-width: 700px; margin: 0 auto; padding: 24px; }
  h2 { color: #2c3e50; }
  table { border-collapse: collapse; width: 100%; }
  tr:nth-child(even) { background: #f9f9f9; }
  td { border-bottom: 1px solid #eee; }
</style></head>
<body>
  <h2>Conversation Transcript</h2>
  <p><strong>Conversation ID:</strong> ${escHtml(conversationId)}</p>
  <table>
    <thead>
      <tr>
        <th style="text-align:left;padding:6px 12px;background:#f0f0f0">Time</th>
        <th style="text-align:left;padding:6px 8px;background:#f0f0f0">From</th>
        <th style="text-align:left;padding:6px 8px;background:#f0f0f0">Message</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <p style="color:#888;font-size:12px;margin-top:32px;">This transcript was generated automatically.</p>
</body>
</html>`;

  const textBody = messages
    .map((m) => {
      const label = m.role === "assistant" ? "Agent" : "Customer";
      const ts = new Date(m.created_at).toLocaleString();
      return `[${ts}] ${label}: ${m.content}`;
    })
    .join("\n\n");

  return sendEmail({ to, subject, htmlBody, textBody });
}

// ---------------------------------------------------------------------------
// Availability check
// ---------------------------------------------------------------------------

export function isEmailAvailable(): boolean {
  return !!process.env.SENDGRID_API_KEY;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
