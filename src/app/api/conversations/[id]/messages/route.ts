import { NextRequest, NextResponse } from "next/server";
import { messageRepo } from "@/lib/repositories";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const messages = await messageRepo.findByConversation(id);
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 400 });
  }
}

// POST — allow human agents to send a message directly (not via orchestrator).
// Used by the handover UI to inject human replies into the conversation.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const auth = await requireAuth(req, "conversations", "write");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  const caller = (auth as { user: { userId: string } }).user;

  let body: { role?: string; content?: string } = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const role = body.role === "user" ? "user" : "assistant";

  const message = await messageRepo.create({
    conversation_id: id,
    tenant_id: tenantId,
    role,
    content: body.content.trim(),
    agent_id: role === "assistant" ? caller.userId : undefined,
  });

  return NextResponse.json({ message }, { status: 201 });
}
