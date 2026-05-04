import { NextRequest, NextResponse } from "next/server";
import { runtimeProfileRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { runtimeProfileSchema } from "@/lib/runtime/profiles";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const profiles = await runtimeProfileRepo.findAll(tenantId);
  return NextResponse.json({ profiles });
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const body = await req.json();
    const parsed = runtimeProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        error: "Runtime profile validation failed",
        issues: parsed.error.issues,
      }, { status: 422 });
    }

    const profile = await runtimeProfileRepo.create({
      tenant_id: tenantId,
      ...parsed.data,
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create runtime profile" }, { status: 400 });
  }
}

