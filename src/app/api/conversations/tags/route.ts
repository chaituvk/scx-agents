import { NextRequest, NextResponse } from "next/server";
import { conversationTagsRepo } from "@/lib/repositories/conversation-tags";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const tags = await conversationTagsRepo.getAllTags(tenantId);
    return NextResponse.json({ tags });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
