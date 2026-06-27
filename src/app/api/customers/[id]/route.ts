import { NextRequest, NextResponse } from "next/server";
import { customerProfileRepo } from "@/lib/repositories/customer-profile";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = await getTenantFromRequest(req);
    const customer = await customerProfileRepo.findById(id, tenantId);
    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const memories = await customerProfileRepo.getMemories(id, tenantId, 10);
    return NextResponse.json({ customer, memories });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const tenantId = await getTenantFromRequest(req);
    const body = await req.json();
    const updated = await customerProfileRepo.update(id, tenantId, body);
    if (!updated) return NextResponse.json({ error: "Not found or no changes" }, { status: 404 });
    const customer = await customerProfileRepo.findById(id, tenantId);
    return NextResponse.json({ customer });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
