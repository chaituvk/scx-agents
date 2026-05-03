import { NextRequest, NextResponse } from "next/server";
import { conversationRepo } from "@/lib/repositories";

const ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"];

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-tenant-id",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"));
  try {
    const body = await req.json();
    const tenantId = body.tenant || req.headers.get("x-tenant-id") || "r-mobile";
    const conversation = await conversationRepo.create({
      tenant_id: tenantId,
      customer_name: body.customerName || "Visitor",
      customer_email: body.customerEmail || "",
      channel: body.channel || "web_widget",
      status: "open",
      sentiment: "neutral",
      agent_id: body.agentId || null,
      assigned_to: null,
    });
    return NextResponse.json({ conversation }, { status: 201, headers });
  } catch {
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 400, headers });
  }
}
