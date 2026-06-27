import { NextRequest, NextResponse } from "next/server";
import { userRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { requireAuth } from "@/lib/api-auth";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "team", "read");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);
  const users = await userRepo.findAll(tenantId);
  const safe = users.map(({ password: _pw, ...u }) => u);
  return NextResponse.json({ team: safe });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "team", "write");
  if (auth instanceof NextResponse) return auth;
  const tenantId = await getTenantFromRequest(req);

  try {
    const body = await req.json();
    if (!body.email || !body.name) {
      return NextResponse.json({ error: "email and name are required" }, { status: 400 });
    }

    const existing = await userRepo.findByEmail(body.email, tenantId);
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const password = await bcrypt.hash(body.password || crypto.randomUUID(), 10);
    const user = await userRepo.create({
      tenant_id: tenantId,
      email: body.email,
      name: body.name,
      password,
      role: body.role ?? "agent",
    });

    const { password: _pw, ...safe } = user;
    return NextResponse.json({ user: safe }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
