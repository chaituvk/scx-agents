import { NextRequest, NextResponse } from "next/server";
import { webhookRepo } from "@/lib/repositories/webhook";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const webhooks = await webhookRepo.findAll(tenantId);
  // Never expose the secret in list responses
  return NextResponse.json({ webhooks: webhooks.map(({ secret: _s, ...w }) => w) });
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const body = await req.json();
    if (!body.url) return NextResponse.json({ error: "url is required" }, { status: 400 });

    const webhook = await webhookRepo.create(tenantId, {
      url: body.url,
      events: body.events,
      description: body.description,
    });

    return NextResponse.json({ webhook }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
