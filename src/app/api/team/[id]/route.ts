import { NextRequest, NextResponse } from "next/server";
import { userRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req, "team", "read");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);
  const user = await userRepo.findById(id);
  if (!user || user.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { password: _pw, ...safe } = user;
  return NextResponse.json({ user: safe });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req, "team", "write");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);

  const existing = await userRepo.findById(id);
  if (!existing || existing.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.role !== undefined) updates.role = body.role;
    if (body.email !== undefined) updates.email = body.email;

    const updated = await userRepo.update(id, updates);
    if (!updated) return NextResponse.json({ error: "Update failed" }, { status: 500 });
    const { password: _pw, ...safe } = updated;
    return NextResponse.json({ user: safe });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req, "team", "write");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);

  const existing = await userRepo.findById(id);
  if (!existing || existing.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await userRepo.delete(id);
  return new NextResponse(null, { status: 204 });
}
