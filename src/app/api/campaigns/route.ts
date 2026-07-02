import { NextRequest, NextResponse } from "next/server";
import { campaignRepo } from "@/lib/repositories/campaign";
import { getTenantFromRequest } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const campaigns = await campaignRepo.findAll(tenantId);
  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const body = await req.json();

    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    if (!body.channel || !["sms", "whatsapp", "email"].includes(body.channel)) {
      return NextResponse.json({ error: "channel must be sms, whatsapp, or email" }, { status: 400 });
    }

    const campaign = await campaignRepo.create(tenantId, {
      name: body.name,
      description: body.description,
      channel: body.channel,
      message_template: body.message_template,
      use_ai_personalization: !!body.use_ai_personalization,
      playbook_id: body.playbook_id,
      scheduled_at: body.scheduled_at,
      created_by: body.created_by,
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
