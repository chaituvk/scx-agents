import { NextRequest, NextResponse } from "next/server";
import { webhookRepo } from "@/lib/repositories/webhook";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getTenantFromRequest(req);
  const hook = await webhookRepo.findById(id, tenantId);
  if (!hook) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const deliveries = await webhookRepo.findDeliveries(id);
  return NextResponse.json({ deliveries });
}
