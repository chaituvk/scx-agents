import { NextRequest, NextResponse } from "next/server";
import { runtimeProfileRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { runtimeProfileSchema } from "@/lib/runtime/profiles";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = await params;
    const profile = await runtimeProfileRepo.findById(id);
    if (!profile || profile.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Runtime profile not found" }, { status: 404 });
    }
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: "Failed to fetch runtime profile" }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = await params;
    const current = await runtimeProfileRepo.findById(id);
    if (!current || current.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Runtime profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = runtimeProfileSchema.safeParse({
      name: body.name ?? current.name,
      kind: body.kind ?? current.kind,
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
      return NextResponse.json({
        error: "Runtime profile validation failed",
        issues: parsed.error.issues,
      }, { status: 422 });
    }

    const profile = await runtimeProfileRepo.update(id, parsed.data);
    return NextResponse.json({ profile });
  } catch {
    return NextResponse.json({ error: "Failed to update runtime profile" }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = await params;
    const current = await runtimeProfileRepo.findById(id);
    if (!current || current.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Runtime profile not found" }, { status: 404 });
    }
    await runtimeProfileRepo.delete(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete runtime profile" }, { status: 400 });
  }
}

