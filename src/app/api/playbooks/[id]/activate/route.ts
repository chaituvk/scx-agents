import { NextRequest, NextResponse } from "next/server";
import { playbookRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = await params;

    const current = await playbookRepo.findById(id);
    if (!current || current.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
    }

    // Archive all other active playbooks for this tenant
    await query(
      "UPDATE playbooks SET status = 'archived', updated_at = $1 WHERE tenant_id = $2 AND status = 'active' AND id != $3",
      [new Date().toISOString(), tenantId, id]
    );

    // Activate the target playbook
    const playbook = await playbookRepo.update(id, { status: "active" });
    return NextResponse.json({ playbook });
  } catch {
    return NextResponse.json({ error: "Failed to activate playbook" }, { status: 400 });
  }
}
