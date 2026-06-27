// Playbook version history.
// GET  /api/playbooks/[id]/versions — list all versions
// POST /api/playbooks/[id]/versions — snapshot current playbook as a new version

import { NextRequest, NextResponse } from "next/server";
import { playbookRepo } from "@/lib/repositories";
import { playbookVersionRepo } from "@/lib/repositories/playbook-version";
import { getTenantFromRequest } from "@/lib/tenant";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAuth(req, "playbooks", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);

  const playbook = await playbookRepo.findById(id);
  if (!playbook || playbook.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
  }

  const versions = await playbookVersionRepo.listByPlaybook(id);
  return NextResponse.json({ versions, total: versions.length });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAuth(req, "playbooks", "write");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  const caller = (auth as { user: { userId: string } }).user;

  const playbook = await playbookRepo.findById(id);
  if (!playbook || playbook.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
  }

  let body: { change_summary?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const version = await playbookVersionRepo.snapshot(tenantId, id, playbook, {
    changeSummary: body.change_summary,
    createdBy: caller.userId,
  });

  return NextResponse.json({ version }, { status: 201 });
}
