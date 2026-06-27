import { NextRequest, NextResponse } from "next/server";
import { apiKeyRepo } from "@/lib/repositories/api-key";
import { getTenantFromRequest } from "@/lib/tenant";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "api_keys", "read");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);
  const keys = await apiKeyRepo.findAll(tenantId);
  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "api_keys", "write");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const key = await apiKeyRepo.create(
    tenantId,
    body.name,
    body.scopes ?? ["read", "write"],
    auth.user.userId,
    body.expiresAt,
  );

  return NextResponse.json({ key }, { status: 201 });
}
