// Public widget endpoint — returns active proactive triggers for a tenant.
// Called by the web chat widget JS to decide when to proactively open the
// chat window or send an automated greeting.
//
// GET /api/widget/triggers?tenant_id=<id>&trigger_type=<type>
//
// No auth required — tenant_id is the public identifier.
// Response is intentionally minimal (no internal IDs that could be used for
// enumeration attacks).

import { NextRequest, NextResponse } from "next/server";
import { proactiveTriggerRepo } from "@/lib/repositories/proactive-trigger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenant_id");
  const filterType = searchParams.get("trigger_type");

  if (!tenantId) {
    return NextResponse.json({ error: "tenant_id is required" }, { status: 400 });
  }

  let triggers = await proactiveTriggerRepo.findActive(tenantId);

  if (filterType) {
    triggers = triggers.filter(t => t.trigger_type === filterType);
  }

  // Return only fields the widget needs — omit playbook_id etc.
  const publicTriggers = triggers.map(t => ({
    id: t.id,
    trigger_type: t.trigger_type,
    conditions: t.conditions,
    message: t.message,
    delay_seconds: t.delay_seconds,
    cooldown_hours: t.cooldown_hours,
    priority: t.priority,
  }));

  return NextResponse.json({ triggers: publicTriggers });
}
