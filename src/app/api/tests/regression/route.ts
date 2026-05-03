import { NextRequest, NextResponse } from "next/server";
import { regressionTestRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const tests = await regressionTestRepo.findAll(tenantId);
  return NextResponse.json({ tests });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = await getTenantFromRequest(req);
    const test = await regressionTestRepo.create({
      tenant_id: tenantId,
      name: body.name || "New Test",
      description: body.description || "",
      category: body.category || "behavior",
      status: body.status || "pending",
    });
    return NextResponse.json({ test }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create test" }, { status: 400 });
  }
}
