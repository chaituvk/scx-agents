// Conversation transcript export.
// GET /api/conversations/[id]/transcript?format=html|json|text
//
// Exports the full conversation including metadata, all messages, and notes.
// - json: full structured export (default)
// - text: plain-text readable transcript
// - html: styled HTML page suitable for printing / sharing

import { NextRequest, NextResponse } from "next/server";
import { conversationRepo, messageRepo } from "@/lib/repositories";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAuth(req, "conversations", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);

  const conversation = await conversationRepo.findById(id);
  if (!conversation || (conversation as { tenant_id?: string }).tenant_id !== tenantId) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "json";

  const messagesResult = await messageRepo.findByConversation(id);
  const messages = Array.isArray(messagesResult) ? messagesResult : [];

  // Fetch notes
  const notesResult = await query(
    `SELECT id, agent_id, content, is_private, created_at
     FROM conversation_notes WHERE conversation_id = $1 AND tenant_id = $2 ORDER BY created_at ASC`,
    [id, tenantId]
  ).catch(() => ({ rows: [] }));
  const notes = notesResult.rows;

  if (format === "json") {
    return NextResponse.json({ conversation, messages, notes, exported_at: new Date().toISOString() });
  }

  if (format === "text") {
    const lines: string[] = [
      `CONVERSATION TRANSCRIPT`,
      `ID: ${conversation.id}`,
      `Customer: ${(conversation as { customer_name?: string }).customer_name ?? "Unknown"}`,
      `Channel: ${(conversation as { channel?: string }).channel ?? "web"}`,
      `Status: ${(conversation as { status?: string }).status}`,
      `Created: ${(conversation as { created_at?: string }).created_at}`,
      ``,
      `--- MESSAGES ---`,
    ];
    for (const m of messages) {
      const role = (m as { role?: string }).role === "user" ? "Customer" : "Assistant";
      lines.push(`[${(m as { created_at?: string }).created_at}] ${role}: ${(m as { content?: string }).content}`);
    }
    if (notes.length > 0) {
      lines.push(``, `--- INTERNAL NOTES ---`);
      for (const n of notes) {
        lines.push(`[${n.created_at}] Agent ${n.agent_id}: ${n.content}`);
      }
    }
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="transcript-${id}.txt"`,
      },
    });
  }

  if (format === "html") {
    const conv = conversation as unknown as Record<string, string | undefined>;
    const messageRows = messages.map(m => {
      const msg = m as unknown as Record<string, string | undefined>;
      const isUser = msg.role === "user";
      const bgColor = isUser ? "#f0f4ff" : "#f9fafb";
      const label = isUser ? "Customer" : "AI Assistant";
      return `
        <div style="margin: 12px 0; padding: 12px 16px; background: ${bgColor}; border-radius: 8px;">
          <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">${label} · ${msg.created_at ?? ""}</div>
          <div style="white-space: pre-wrap; line-height: 1.5;">${escapeHtml(msg.content ?? "")}</div>
        </div>`;
    }).join("");

    const noteRows = notes.map((n: Record<string, string>) => `
      <div style="margin: 8px 0; padding: 10px 14px; background: #fef9c3; border-left: 3px solid #eab308; border-radius: 4px;">
        <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">Note by ${n.agent_id} · ${n.created_at}</div>
        <div style="white-space: pre-wrap;">${escapeHtml(n.content ?? "")}</div>
      </div>`).join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Transcript — ${conv.id}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 24px; color: #111827; max-width: 780px; margin: 0 auto; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: 13px; color: #6b7280; margin-bottom: 24px; }
    h2 { font-size: 14px; font-weight: 600; color: #374151; margin: 24px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>Conversation Transcript</h1>
  <div class="meta">
    ID: ${conv.id} &nbsp;·&nbsp;
    Customer: ${escapeHtml(conv.customer_name ?? "Unknown")} &nbsp;·&nbsp;
    Channel: ${conv.channel ?? "web"} &nbsp;·&nbsp;
    Status: ${conv.status} &nbsp;·&nbsp;
    Sentiment: ${conv.sentiment ?? "neutral"}
    <br>Created: ${conv.created_at} &nbsp;·&nbsp; Exported: ${new Date().toISOString()}
  </div>
  <h2>Messages</h2>
  ${messageRows}
  ${notes.length > 0 ? `<h2>Internal Notes</h2>${noteRows}` : ""}
</body>
</html>`;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="transcript-${id}.html"`,
      },
    });
  }

  return NextResponse.json({ error: `Unknown format: ${format}. Use json, text, or html.` }, { status: 400 });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
