import { NextRequest, NextResponse } from "next/server";
import { conversationRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const conversations = await conversationRepo.findAll(100, tenantId);
  return NextResponse.json({ conversations });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = await getTenantFromRequest(req);
    const conversation = await conversationRepo.create({
      tenant_id: tenantId,
      customer_name: body.customerName || "Anonymous",
      customer_email: body.customerEmail || "",
      channel: body.channel || "web",
      status: "open",
      sentiment: "neutral",
      agent_id: body.agentId || null,
      assigned_to: null,
    });
    return NextResponse.json({ conversation }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 400 });
  }
}
