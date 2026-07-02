import { NextRequest, NextResponse } from "next/server";
import { playbookRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { playbookVersionRepo } from "@/lib/repositories/playbook-version";
import { requireAuth } from "@/lib/api-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = await params;
    const playbook = await playbookRepo.findById(id);
    if (!playbook || playbook.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
    }
    return NextResponse.json({ playbook });
  } catch {
    return NextResponse.json({ error: "Failed to fetch playbook" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = await params;
    const current = await playbookRepo.findById(id);
    if (!current || current.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
    }

    const auth = await requireAuth(req, "playbooks", "write");
    const callerId = auth instanceof NextResponse
      ? undefined
      : (auth as { user: { userId: string } }).user.userId;

    const body = await req.json();
    const playbook = await playbookRepo.update(id, body);

    // Snapshot a version whenever the playbook is published (status → active)
    // or explicitly requested via ?version=true query param.
    const url = new URL(req.url);
    const forceVersion = url.searchParams.get("version") === "true";
    if (forceVersion || (body.status === "active" && current.status !== "active")) {
      const updated = await playbookRepo.findById(id);
      if (updated) {
        playbookVersionRepo.snapshot(tenantId, id, updated, {
          changeSummary: body.change_summary ?? (body.status === "active" ? "Published" : "Updated"),
          createdBy: callerId,
        }).catch(() => {});
      }
    }

    return NextResponse.json({ playbook });
  } catch {
    return NextResponse.json({ error: "Failed to update playbook" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = await params;
    const current = await playbookRepo.findById(id);
    if (!current || current.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
    }

    await playbookRepo.delete(id);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Failed to delete playbook" }, { status: 400 });
  }
}
