// Inbound Twilio SMS webhook.
// Configure your Twilio phone number's webhook URL to:
//   https://your-app.com/api/channels/sms?tenantId=YOUR_TENANT_ID
//
// Twilio sends POST with application/x-www-form-urlencoded payload.
// We respond with TwiML to echo the AI response as an SMS reply.

import { NextRequest, NextResponse } from "next/server";
import { parseTwilioInbound, sendSms } from "@/lib/integrations/adapters/twilio";
import { orchestrator } from "@/lib/orchestrator";
import { formatResponse } from "@/lib/formatters/channel";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId") ?? "r-mobile";

  const text = await req.text();
  const params = new URLSearchParams(text);
  const { from, body, messageSid } = parseTwilioInbound(params);

  if (!body || !from) {
    return new NextResponse(`<?xml version="1.0"?><Response></Response>`, {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Use the phone number as a stable conversation ID (one convo per number)
  const conversationId = `sms:${from.replace(/\D/g, "")}`;

  let replyText = "Sorry, I could not process your request right now.";
  try {
    const result = await orchestrator.runTurn({
      conversationId,
      tenantId,
      message: body,
      channel: "sms",
      customerId: from,
    });
    // Channel formatter enforces 160-char segmentation
    replyText = formatResponse(result.response, { channel: "sms" });
  } catch (err) {
    console.error("[sms] orchestrator error:", err);
  }

  // Respond with TwiML — Twilio will send the <Message> as an SMS reply
  const twiml = `<?xml version="1.0"?>
<Response>
  <Message>${replyText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Message>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
