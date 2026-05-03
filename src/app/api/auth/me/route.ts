import { NextRequest, NextResponse } from "next/server";
import { userRepo } from "@/lib/repositories";
import { verifyToken } from "@/lib/auth";
import { getTenant } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const token = req.cookies.get("sierra_token")?.value;
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const user = await userRepo.findById(payload.userId);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const tenant = await getTenant(user.tenant_id);
  const isSuperAdmin = payload.isSuperAdmin || user.role === "superadmin";

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenant_id, isSuperAdmin },
    tenant,
  });
}
