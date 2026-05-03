import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { userRepo } from "@/lib/repositories";
import { createToken } from "@/lib/auth";
import { z } from "zod";
import { TENANTS } from "@/lib/tenant";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenant: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, tenant } = loginSchema.parse(body);

    const tenantId = tenant && TENANTS[tenant] ? tenant : "r-mobile";

    const user = await userRepo.findByEmail(email, tenantId);

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isSuperAdmin = user.role === "superadmin";

    const token = await createToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      isSuperAdmin,
    });

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenant_id, isSuperAdmin },
    });

    response.cookies.set({
      name: "sierra_token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    response.cookies.set({
      name: "tenant",
      value: user.tenant_id,
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    if (isSuperAdmin) {
      response.cookies.set({
        name: "view_tenant",
        value: user.tenant_id,
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    }

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
