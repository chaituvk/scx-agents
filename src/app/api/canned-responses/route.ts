import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";
import { cannedResponseRepo } from "@/lib/repositories/canned-response";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "canned-responses", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;
  const q = searchParams.get("q");

  try {
    const items = q
      ? await cannedResponseRepo.search(tenantId, q)
      : await cannedResponseRepo.findAll(tenantId, category);

    return NextResponse.json({ canned_responses: items });
  } catch (err) {
    console.error("[canned-responses] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch canned responses" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "canned-responses", "write");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { title, content, category, tags, shortcut } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  try {
    const item = await cannedResponseRepo.create(tenantId, {
      title: title.trim(),
      content: content.trim(),
      category: typeof category === "string" ? category : undefined,
      tags: Array.isArray(tags) ? (tags as string[]) : undefined,
      shortcut: typeof shortcut === "string" ? shortcut : null,
      created_by: auth.user.userId,
    });

    return NextResponse.json({ canned_response: item }, { status: 201 });
  } catch (err) {
    console.error("[canned-responses] POST error:", err);
    return NextResponse.json({ error: "Failed to create canned response" }, { status: 500 });
  }
}
