import { NextRequest, NextResponse } from "next/server";
import { runtimeProfileRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { runtimeProfileSchema } from "@/lib/runtime/profiles";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = await params;
    const guardrail = await runtimeProfileRepo.findById(id);
    if (!guardrail || guardrail.tenant_id !== tenantId || guardrail.kind !== "guardrail") {
      return NextResponse.json({ error: "Guardrail not found" }, { status: 404 });
    }
    return NextResponse.json({ guardrail });
  } catch {
    return NextResponse.json({ error: "Failed to fetch guardrail" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = await params;
    const current = await runtimeProfileRepo.findById(id);
    if (!current || current.tenant_id !== tenantId || current.kind !== "guardrail") {
      return NextResponse.json({ error: "Guardrail not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = runtimeProfileSchema.safeParse({
      name: body.name ?? current.name,
      kind: "policy", // validated enum placeholder; stored as 'guardrail'
      status: body.status ?? current.status,
      description: body.description ?? current.description ?? "",
      allowed_journeys: body.allowed_journeys ?? current.allowed_journeys ?? [],
      allowed_tools: body.allowed_tools ?? current.allowed_tools ?? [],
      allowed_slots: body.allowed_slots ?? current.allowed_slots ?? [],
      guardrails: body.guardrails ?? current.guardrails ?? [],
      policies: body.policies ?? current.policies ?? [],
      config: body.config ?? current.config ?? {},
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Guardrail validation failed", issues: parsed.error.issues },
        { status: 422 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const guardrail = await runtimeProfileRepo.update(id, {
      ...parsed.data,
      // Preserve the guardrail kind through the update
      kind: "guardrail",
    } as any);
    return NextResponse.json({ guardrail });
  } catch {
    return NextResponse.json({ error: "Failed to update guardrail" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = await params;
    const current = await runtimeProfileRepo.findById(id);
    if (!current || current.tenant_id !== tenantId || current.kind !== "guardrail") {
      return NextResponse.json({ error: "Guardrail not found" }, { status: 404 });
    }

    // Soft delete: set status = 'inactive' (treated as archived/disabled)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runtimeProfileRepo.update(id, { status: "inactive" } as any);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete guardrail" }, { status: 400 });
  }
}
