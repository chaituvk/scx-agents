// GET/PUT/DELETE /api/proactive-triggers/[id]

import { NextRequest, NextResponse } from "next/server";
import { proactiveTriggerRepo } from "@/lib/repositories/proactive-trigger";
import { getTenantFromRequest } from "@/lib/tenant";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAuth(req, "conversations", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  const trigger = await proactiveTriggerRepo.findById(id);

  if (!trigger || trigger.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  return NextResponse.json({ trigger });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAuth(req, "conversations", "write");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  const trigger = await proactiveTriggerRepo.findById(id);

  if (!trigger || trigger.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updated = await proactiveTriggerRepo.update(id, body as Parameters<typeof proactiveTriggerRepo.update>[1]);
  return NextResponse.json({ trigger: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAuth(req, "conversations", "write");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  const trigger = await proactiveTriggerRepo.findById(id);

  if (!trigger || trigger.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
  }

  await proactiveTriggerRepo.delete(id);
  return NextResponse.json({ ok: true });
}
