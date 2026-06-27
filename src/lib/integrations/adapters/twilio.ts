// Twilio SMS adapter — send and receive SMS messages.
// Configure with env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export interface SmsSendResult {
  ok: boolean;
  sid?: string;
  error?: string;
}

function getConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  if (!accountSid || !authToken || !fromNumber) return null;
  return { accountSid, authToken, fromNumber };
}

export async function sendSms(to: string, body: string): Promise<SmsSendResult> {
  const cfg = getConfig();
  if (!cfg) return { ok: false, error: "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER." };

  // Enforce SMS 160-char limit with segmentation
  const segments = body.match(/.{1,160}/g) ?? [body];

  let lastSid: string | undefined;
  for (const segment of segments) {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64")}`,
        },
        body: new URLSearchParams({ From: cfg.fromNumber, To: to, Body: segment }).toString(),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: "Unknown Twilio error" }));
      return { ok: false, error: (err as { message: string }).message };
    }

    const data = await res.json() as { sid: string };
    lastSid = data.sid;
  }

  return { ok: true, sid: lastSid };
}

// Parse incoming Twilio webhook payload (application/x-www-form-urlencoded)
export function parseTwilioInbound(params: URLSearchParams): {
  from: string;
  body: string;
  to: string;
  messageSid: string;
} {
  return {
    from: params.get("From") ?? "",
    body: params.get("Body") ?? "",
    to: params.get("To") ?? "",
    messageSid: params.get("MessageSid") ?? "",
  };
}

export function isTwilioAvailable(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}
