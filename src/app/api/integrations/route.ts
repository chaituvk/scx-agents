import { NextRequest, NextResponse } from "next/server";
import { integrationRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const integrations = await integrationRepo.findAll(tenantId);
  return NextResponse.json({ integrations });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = await getTenantFromRequest(req);
    const integration = await integrationRepo.create({
      tenant_id: tenantId,
      name: body.name,
      type: body.type,
      config: body.config ?? {},
      status: "active",
    });
    return NextResponse.json({ integration }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create integration" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status, config } = await req.json();
    const updated = await integrationRepo.update(id, { status, config });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ integration: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update integration" }, { status: 400 });
  }
}
