import { NextRequest, NextResponse } from "next/server";
import { customerProfileRepo } from "@/lib/repositories/customer-profile";
import type { CustomerMemory } from "@/lib/repositories/customer-profile";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = await getTenantFromRequest(req);
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "20", 10);
    const memories = await customerProfileRepo.getMemories(id, tenantId, limit);
    return NextResponse.json({ memories });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: customerId } = await params;
    const tenantId = await getTenantFromRequest(req);
    const body = await req.json() as {
      memory_type: CustomerMemory["memory_type"];
      content: string;
      importance?: number;
      conversation_id?: string;
      expires_at?: string;
    };

    if (!body.memory_type || !body.content) {
      return NextResponse.json(
        { error: "memory_type and content are required" },
        { status: 400 },
      );
    }

    const validTypes: CustomerMemory["memory_type"][] = [
      "preference", "complaint", "fact", "goal", "purchase", "interaction",
    ];
    if (!validTypes.includes(body.memory_type)) {
      return NextResponse.json(
        { error: `memory_type must be one of: ${validTypes.join(", ")}` },
        { status: 400 },
      );
    }

    const memory = await customerProfileRepo.addMemory({
      tenantId,
      customerId,
      conversationId: body.conversation_id,
      memory_type: body.memory_type,
      content: body.content,
      importance: body.importance,
      expires_at: body.expires_at,
    });

    return NextResponse.json({ memory }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
