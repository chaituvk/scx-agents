import { NextRequest, NextResponse } from "next/server";
import { conversationTagsRepo } from "@/lib/repositories/conversation-tags";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = await getTenantFromRequest(req);
    const tags = await conversationTagsRepo.getTags(id, tenantId);
    return NextResponse.json({ tags });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = await getTenantFromRequest(req);
    const body = await req.json() as { tags: string[] };
    if (!Array.isArray(body.tags)) {
      return NextResponse.json({ error: "tags must be an array" }, { status: 400 });
    }
    await conversationTagsRepo.setTags(id, tenantId, body.tags);
    const tags = await conversationTagsRepo.getTags(id, tenantId);
    return NextResponse.json({ tags });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = await getTenantFromRequest(req);
    const body = await req.json() as { tag: string };
    if (!body.tag || typeof body.tag !== "string") {
      return NextResponse.json({ error: "tag is required" }, { status: 400 });
    }
    await conversationTagsRepo.addTag(id, tenantId, body.tag.trim());
    const tags = await conversationTagsRepo.getTags(id, tenantId);
    return NextResponse.json({ tags }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = await getTenantFromRequest(req);
    const body = await req.json() as { tags: string[] };
    if (!Array.isArray(body.tags)) {
      return NextResponse.json({ error: "tags must be an array" }, { status: 400 });
    }
    await conversationTagsRepo.removeTags(id, tenantId, body.tags);
    const tags = await conversationTagsRepo.getTags(id, tenantId);
    return NextResponse.json({ tags });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
