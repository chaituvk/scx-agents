import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";
import { cannedResponseRepo } from "@/lib/repositories/canned-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req, "canned-responses", "read");
  if (auth instanceof NextResponse) return auth;

  const [tenantId, { id }] = await Promise.all([getTenantFromRequest(req), params]);

  try {
    const item = await cannedResponseRepo.findById(id, tenantId);
    if (!item) {
      return NextResponse.json({ error: "Canned response not found" }, { status: 404 });
    }
    return NextResponse.json({ canned_response: item });
  } catch (err) {
    console.error("[canned-responses/:id] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch canned response" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req, "canned-responses", "write");
  if (auth instanceof NextResponse) return auth;

  const [tenantId, { id }] = await Promise.all([getTenantFromRequest(req), params]);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Ensure the resource exists and belongs to this tenant
  const existing = await cannedResponseRepo.findById(id, tenantId);
  if (!existing) {
    return NextResponse.json({ error: "Canned response not found" }, { status: 404 });
  }

  const update: Parameters<typeof cannedResponseRepo.update>[2] = {};
  if ("title" in body && typeof body.title === "string") update.title = body.title.trim();
  if ("content" in body && typeof body.content === "string") update.content = body.content.trim();
  if ("category" in body && typeof body.category === "string") update.category = body.category;
  if ("tags" in body && Array.isArray(body.tags)) update.tags = body.tags as string[];
  if ("shortcut" in body) {
    update.shortcut = typeof body.shortcut === "string" ? body.shortcut : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  try {
    await cannedResponseRepo.update(id, tenantId, update);
    const updated = await cannedResponseRepo.findById(id, tenantId);
    return NextResponse.json({ canned_response: updated });
  } catch (err) {
    console.error("[canned-responses/:id] PUT error:", err);
    return NextResponse.json({ error: "Failed to update canned response" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth(req, "canned-responses", "write");
  if (auth instanceof NextResponse) return auth;

  const [tenantId, { id }] = await Promise.all([getTenantFromRequest(req), params]);

  try {
    const deleted = await cannedResponseRepo.delete(id, tenantId);
    if (!deleted) {
      return NextResponse.json({ error: "Canned response not found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[canned-responses/:id] DELETE error:", err);
    return NextResponse.json({ error: "Failed to delete canned response" }, { status: 500 });
  }
}
