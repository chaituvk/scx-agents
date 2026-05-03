import { NextRequest, NextResponse } from "next/server";
import { integrationRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const integrations = await integrationRepo.findAll(tenantId);
  return NextResponse.json({ integrations });
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    const updated = await integrationRepo.update(id, { status });

    if (!updated) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    return NextResponse.json({ integration: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update integration" }, { status: 400 });
  }
}
