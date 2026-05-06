import { NextRequest, NextResponse } from "next/server";
import { journeyRepo, journeyScenarioRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { journeyScenarioSchema } from "@/lib/journey/scenario-runner";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = await params;
    const scenario = await journeyScenarioRepo.findById(id);
    if (!scenario || scenario.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }
    return NextResponse.json({ scenario });
  } catch {
    return NextResponse.json({ error: "Failed to fetch scenario" }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = await params;
    const current = await journeyScenarioRepo.findById(id);
    if (!current || current.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }

    const body = await req.json();
    const merged = {
      name: body.name ?? current.name,
      description: body.description ?? current.description ?? "",
      journey_id: body.journey_id ?? current.journey_id,
      status: body.status ?? current.status ?? "active",
      category: body.category ?? current.category ?? "behavior",
      turns: body.turns ?? current.turns,
      expectations: body.expectations ?? current.expectations ?? undefined,
      tags: body.tags ?? current.tags ?? [],
    };
    const parsed = journeyScenarioSchema.safeParse(merged);
    if (!parsed.success) {
      return NextResponse.json({
        error: "Scenario validation failed",
        issues: parsed.error.issues,
      }, { status: 422 });
    }

    const journey = await journeyRepo.findById(parsed.data.journey_id || current.journey_id);
    if (!journey || journey.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    const scenario = await journeyScenarioRepo.update(id, {
      journey_id: parsed.data.journey_id || current.journey_id,
      name: parsed.data.name,
      description: parsed.data.description || "",
      status: parsed.data.status || "active",
      category: parsed.data.category || "behavior",
      turns: parsed.data.turns,
      expectations: parsed.data.expectations || null,
      tags: parsed.data.tags || [],
    });

    return NextResponse.json({ scenario });
  } catch {
    return NextResponse.json({ error: "Failed to update scenario" }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = await params;
    const current = await journeyScenarioRepo.findById(id);
    if (!current || current.tenant_id !== tenantId) {
      return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
    }
    await journeyScenarioRepo.delete(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete scenario" }, { status: 400 });
  }
}

