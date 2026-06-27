import { NextRequest, NextResponse } from "next/server";
import { integrationRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const integration = await integrationRepo.findById(id);
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ integration });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const updated = await integrationRepo.update(id, {
      status: body.status,
      config: body.config,
      name: body.name,
    });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ integration: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tenantId = await getTenantFromRequest(req);
  const existing = await integrationRepo.findById(id);
  if (!existing || existing.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await integrationRepo.delete(id);
  return NextResponse.json({ ok: true });
}
