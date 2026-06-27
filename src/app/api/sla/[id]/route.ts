import { NextRequest, NextResponse } from "next/server";
import { slaRepo } from "@/lib/repositories/sla";
import { getTenantFromRequest } from "@/lib/tenant";
import { requireAuth } from "@/lib/api-auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req, "sla", "write");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);

  try {
    const body = await req.json();
    const ok = await slaRepo.updateConfig(id, tenantId, body);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated = await slaRepo.findConfigById(id, tenantId);
    return NextResponse.json({ config: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req, "sla", "write");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);
  const ok = await slaRepo.deleteConfig(id, tenantId);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
