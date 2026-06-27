import { NextRequest, NextResponse } from "next/server";
import { slaRepo } from "@/lib/repositories/sla";
import { getTenantFromRequest } from "@/lib/tenant";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "sla", "read");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);

  const daysParam = req.nextUrl.searchParams.get("days");
  const days = daysParam ? parseInt(daysParam, 10) : 30;

  const breaches = await slaRepo.listBreaches(tenantId, days);
  return NextResponse.json({ breaches });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "sla", "write");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);

  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const ok = await slaRepo.acknowledgeBreach(body.id, tenantId);
    if (!ok) return NextResponse.json({ error: "Breach not found" }, { status: 404 });
    return NextResponse.json({ acknowledged: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
