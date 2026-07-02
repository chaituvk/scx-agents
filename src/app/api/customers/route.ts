import { NextRequest, NextResponse } from "next/server";
import { customerProfileRepo } from "@/lib/repositories/customer-profile";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10);
    const customers = q
      ? await customerProfileRepo.search(tenantId, q, limit)
      : await customerProfileRepo.list(tenantId, limit);
    return NextResponse.json({ customers });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const body = await req.json() as {
      email?: string;
      phone?: string;
      name?: string;
      channel?: string;
      external_id?: string;
    };

    if (!body.email && !body.phone) {
      return NextResponse.json(
        { error: "At least one of email or phone is required" },
        { status: 400 },
      );
    }

    const customer = await customerProfileRepo.upsertByContact(tenantId, {
      email: body.email,
      phone: body.phone,
      name: body.name,
      channel: body.channel,
      external_id: body.external_id,
    });

    return NextResponse.json({ customer }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
