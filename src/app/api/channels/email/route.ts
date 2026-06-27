// Inbound email webhook — SendGrid Inbound Parse format.
// Configure SendGrid's Inbound Parse webhook URL to:
//   https://your-app.com/api/channels/email?tenantId=YOUR_TENANT_ID
//
// SendGrid POSTs multipart/form-data with fields: from, subject, text,
// html, envelope (JSON string), headers, etc.
// We must respond 200 or SendGrid will retry the delivery.

import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/orchestrator";
import { sendEmail } from "@/lib/integrations/adapters/email";

export const runtime = "nodejs";

function ok200(): NextResponse {
  return new NextResponse("OK", { status: 200 });
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get("tenantId") ?? "r-mobile";

  // SendGrid Inbound Parse always sends multipart/form-data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    console.error("[email] failed to parse multipart body:", err);
    return ok200(); // must 200 so SendGrid doesn't retry forever
  }

  const fromRaw = (formData.get("from") as string | null) ?? "";
  const subject = (formData.get("subject") as string | null) ?? "(no subject)";
  const textBody = (formData.get("text") as string | null) ?? "";
  const envelopeRaw = (formData.get("envelope") as string | null) ?? "{}";

  // Extract sender email — SendGrid provides "Display Name <email@host>" format
  const fromEmail = extractEmail(fromRaw);

  if (!fromEmail || !textBody) {
    console.warn("[email] missing from or body — dropping message");
    return ok200();
  }

  // Parse envelope for additional metadata (optional, best-effort)
  let envelopeTo: string | undefined;
  try {
    const env = JSON.parse(envelopeRaw) as { to?: string[] };
    envelopeTo = Array.isArray(env.to) ? env.to[0] : undefined;
  } catch {
    // ignore
  }

  // Stable conversation ID from sender email — one thread per sender
  const sanitizedEmail = fromEmail.toLowerCase().replace(/[^a-z0-9@._-]/g, "_");
  const conversationId = `email:${sanitizedEmail}`;

  let replyText = "Sorry, I could not process your request right now.";
  let replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

  try {
    const result = await orchestrator.runTurn({
      conversationId,
      tenantId,
      message: textBody.trim(),
      channel: "email",
      customerId: fromEmail,
    });
    replyText = result.response;
  } catch (err) {
    console.error("[email] orchestrator error:", err);
  }

  // Send reply — fire-and-forget; a send failure must not cause a non-200 response
  sendEmail({
    to: fromEmail,
    subject: replySubject,
    htmlBody: `<div style="font-family:Arial,sans-serif;max-width:600px">${plainToHtml(replyText)}</div>`,
    textBody: replyText,
    replyTo: envelopeTo,
  }).catch((err) => console.error("[email] sendEmail error:", err));

  // Always return 200 — SendGrid interprets anything else as a delivery failure
  return ok200();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract bare email address from "Name <addr>" or "addr" strings. */
function extractEmail(raw: string): string {
  const angleMatch = raw.match(/<([^>]+)>/);
  if (angleMatch) return angleMatch[1].trim().toLowerCase();
  const bare = raw.trim().toLowerCase();
  // Basic sanity check
  return bare.includes("@") ? bare : "";
}

/** Convert plain text to minimal HTML (preserve line breaks). */
function plainToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>\n");
}
