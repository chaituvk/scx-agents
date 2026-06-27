import { NextRequest, NextResponse } from "next/server";
import { routingRuleRepo } from "@/lib/repositories/routing-rule";
import { getTenantFromRequest } from "@/lib/tenant";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "routing_rules", "read");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);
  const rules = await routingRuleRepo.findAll(tenantId);
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "routing_rules", "write");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);

  try {
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (!body.action_type) return NextResponse.json({ error: "action_type is required" }, { status: 400 });

    const rule = await routingRuleRepo.create(tenantId, {
      name: body.name,
      description: body.description,
      priority: body.priority ?? 100,
      status: body.status ?? "active",
      conditions: body.conditions ?? [],
      condition_logic: body.condition_logic ?? "any",
      action_type: body.action_type,
      action_payload: body.action_payload ?? {},
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
