// Inbound WhatsApp webhook via Twilio WhatsApp Business API.
// Configure your Twilio WhatsApp sender's webhook URL to:
//   https://your-app.com/api/channels/whatsapp?tenantId=YOUR_TENANT_ID
//
// Twilio sends POST with application/x-www-form-urlencoded payload.
// The same TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN credentials are used;
// the API prefix differs (whatsapp: in From/To fields).
// We respond with TwiML targeting the WhatsApp number.

import { NextRequest, NextResponse } from "next/server";
import { parseTwilioInbound } from "@/lib/integrations/adapters/twilio";
import { orchestrator } from "@/lib/orchestrator";
import { formatResponse } from "@/lib/formatters/channel";

export const runtime = "nodejs";

function emptyTwiml(): NextResponse {
  return new NextResponse(`<?xml version="1.0"?><Response></Response>`, {
    headers: { "Content-Type": "text/xml" },
  });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId") ?? "r-mobile";

  const text = await req.text();
  const params = new URLSearchParams(text);

  const { from, body, messageSid } = parseTwilioInbound(params);
  // WaId is the WhatsApp-specific numeric ID (digits only, no country code prefix symbol)
  const waId = params.get("WaId") ?? "";

  if (!body || !from) {
    return emptyTwiml();
  }

  // Use WaId (pure digits) when available, otherwise strip non-digits from From
  const stableId = waId || from.replace(/\D/g, "");
  const conversationId = `whatsapp:${stableId}`;

  // Determine the reply-to address. Twilio WhatsApp inbound sets From to
  // "whatsapp:+DIGITS"; use it directly for the TwiML <Message to="...">.
  const replyTo = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;

  let replyText = "Sorry, I could not process your request right now.";
  try {
    const result = await orchestrator.runTurn({
      conversationId,
      tenantId,
      message: body,
      channel: "whatsapp",
      customerId: from,
    });
    replyText = formatResponse(result.response, { channel: "whatsapp" });
  } catch (err) {
    console.error("[whatsapp] orchestrator error:", err);
  }

  // TwiML for WhatsApp: <Message> must include the to="whatsapp:+NUMBER" attribute
  const twiml = `<?xml version="1.0"?>
<Response>
  <Message to="${escapeXml(replyTo)}"><Body>${escapeXml(replyText)}</Body></Message>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}
