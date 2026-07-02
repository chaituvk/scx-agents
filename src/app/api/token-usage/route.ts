import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";
import { tokenUsageRepo } from "@/lib/repositories/token-usage";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "token_usage", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);

  const url = new URL(req.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") ?? "30", 10) || 30, 1), 365);

  try {
    const summary = await tokenUsageRepo.summary(tenantId, days);
    return NextResponse.json({ summary, period_days: days });
  } catch (err) {
    console.error("[token-usage] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch token usage" }, { status: 500 });
  }
}
