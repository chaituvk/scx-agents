import { NextRequest, NextResponse } from "next/server";
import { campaignRepo } from "@/lib/repositories/campaign";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenantId = await getTenantFromRequest(req);
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const campaign = await campaignRepo.findById(id, tenantId);
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const contacts = await campaignRepo.getContacts(id, tenantId, limit, offset);
  return NextResponse.json({ contacts, limit, offset });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = await params;
    const body = await req.json();

    if (!Array.isArray(body.contacts) || body.contacts.length === 0) {
      return NextResponse.json({ error: "contacts array is required and must not be empty" }, { status: 400 });
    }

    const campaign = await campaignRepo.findById(id, tenantId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const added = await campaignRepo.addContacts(id, tenantId, body.contacts);
    return NextResponse.json({ added });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
