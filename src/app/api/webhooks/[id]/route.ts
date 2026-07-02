import { NextRequest, NextResponse } from "next/server";
import { webhookRepo } from "@/lib/repositories/webhook";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getTenantFromRequest(req);
  const webhook = await webhookRepo.findById(id, tenantId);
  if (!webhook) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { secret: _s, ...safe } = webhook;
  return NextResponse.json({ webhook: safe });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getTenantFromRequest(req);
  const body = await req.json();
  const ok = await webhookRepo.update(id, tenantId, body);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await webhookRepo.findById(id, tenantId);
  const { secret: _s, ...safe } = updated!;
  return NextResponse.json({ webhook: safe });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getTenantFromRequest(req);
  const ok = await webhookRepo.delete(id, tenantId);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
