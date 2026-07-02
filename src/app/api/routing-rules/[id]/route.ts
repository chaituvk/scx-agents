import { NextRequest, NextResponse } from "next/server";
import { routingRuleRepo } from "@/lib/repositories/routing-rule";
import { getTenantFromRequest } from "@/lib/tenant";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req, "routing_rules", "read");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);
  const rule = await routingRuleRepo.findById(id, tenantId);
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ rule });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req, "routing_rules", "write");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);

  try {
    const body = await req.json();
    const ok = await routingRuleRepo.update(id, tenantId, body);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated = await routingRuleRepo.findById(id, tenantId);
    return NextResponse.json({ rule: updated });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await requireAuth(req, "routing_rules", "write");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);
  const ok = await routingRuleRepo.delete(id, tenantId);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
