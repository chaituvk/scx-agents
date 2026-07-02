import { NextRequest, NextResponse } from "next/server";
import { tenantRepo } from "@/lib/repositories";
import { verifyToken } from "@/lib/auth";

async function requireSuperAdmin(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get("sierra_token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return !!(payload?.isSuperAdmin);
}

export async function GET(req: NextRequest) {
  if (!(await requireSuperAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenants = await tenantRepo.findAll();
  return NextResponse.json({ tenants });
}

export async function POST(req: NextRequest) {
  if (!(await requireSuperAdmin(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();

    if (!body.name || !body.slug) {
      return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
    }

    const tenant = await tenantRepo.create({
      name: body.name,
      slug: body.slug,
      primary_color: body.primary_color ?? "#c4a574",
      accent_color: body.accent_color ?? "#0a0a0a",
      welcome_message: body.welcome_message ?? null,
      tone: body.tone ?? "empathetic",
      off_limit_topics: body.off_limit_topics ?? null,
      off_limit_phrases: body.off_limit_phrases ?? null,
      approval_threshold: body.approval_threshold ?? 500,
      require_approval: body.require_approval ?? 1,
      config: body.config ?? null,
    });

    return NextResponse.json({ tenant }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create tenant" }, { status: 400 });
  }
}
