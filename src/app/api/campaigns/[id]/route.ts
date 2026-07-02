import { NextRequest, NextResponse } from "next/server";
import { campaignRepo } from "@/lib/repositories/campaign";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getTenantFromRequest(req);
  const { id } = await params;
  const campaign = await campaignRepo.findById(id, tenantId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  return NextResponse.json({ campaign });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = await params;
    const body = await req.json();

    const ok = await campaignRepo.update(id, tenantId, body);
    if (!ok) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const campaign = await campaignRepo.findById(id, tenantId);
    return NextResponse.json({ campaign });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getTenantFromRequest(req);
  const { id } = await params;
  const ok = await campaignRepo.delete(id, tenantId);
  if (!ok) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
