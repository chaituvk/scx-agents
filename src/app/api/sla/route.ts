import { NextRequest, NextResponse } from "next/server";
import { slaRepo } from "@/lib/repositories/sla";
import { getTenantFromRequest } from "@/lib/tenant";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "sla", "read");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);

  const [configs, recent_breaches, open_conversations_at_risk] = await Promise.all([
    slaRepo.findConfigs(tenantId),
    slaRepo.listBreaches(tenantId, 7),
    slaRepo.openConversationsAtRisk(tenantId),
  ]);

  return NextResponse.json({ configs, recent_breaches, open_conversations_at_risk });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "sla", "write");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);

  try {
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const config = await slaRepo.createConfig(tenantId, {
      name: body.name,
      priority: body.priority ?? "normal",
      first_response_minutes: body.first_response_minutes ?? 60,
      resolution_minutes: body.resolution_minutes ?? 480,
      status: body.status ?? "active",
    });

    return NextResponse.json({ config }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
