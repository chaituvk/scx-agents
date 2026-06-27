import { NextRequest, NextResponse } from "next/server";
import { apiKeyRepo } from "@/lib/repositories/api-key";
import { getTenantFromRequest } from "@/lib/tenant";
import { requireAuth } from "@/lib/api-auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req, "api_keys", "write");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const tenantId = await getTenantFromRequest(req);
  const ok = await apiKeyRepo.revoke(id, tenantId);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
