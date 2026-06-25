import { NextRequest, NextResponse } from "next/server";
import { tenantRepo } from "@/lib/repositories";
import { verifyToken } from "@/lib/auth";

async function requireSuperAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("sierra_token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return !!(payload?.isSuperAdmin);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireSuperAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const tenant = await tenantRepo.findById(id);
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ tenant });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireSuperAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await req.json();

    const updated = await tenantRepo.update(id, {
      name: body.name,
      slug: body.slug,
      primary_color: body.primary_color,
      accent_color: body.accent_color,
      welcome_message: body.welcome_message,
      tone: body.tone,
      off_limit_topics: body.off_limit_topics,
      off_limit_phrases: body.off_limit_phrases,
      approval_threshold: body.approval_threshold,
      require_approval: body.require_approval,
      config: body.config,
    });

    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ tenant: updated });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update tenant" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireSuperAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const ok = await tenantRepo.delete(id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
