// Proactive chat triggers — fires a message to website visitors based on
// behavioral signals (page dwell, exit intent, scroll depth, return visits).
// GET  /api/proactive-triggers  — list all triggers for the tenant
// POST /api/proactive-triggers  — create a new trigger

import { NextRequest, NextResponse } from "next/server";
import { proactiveTriggerRepo } from "@/lib/repositories/proactive-trigger";
import { getTenantFromRequest } from "@/lib/tenant";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "conversations", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") === "true";

  const triggers = activeOnly
    ? await proactiveTriggerRepo.findActive(tenantId)
    : await proactiveTriggerRepo.findAll(tenantId);

  return NextResponse.json({ triggers, total: triggers.length });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "conversations", "write");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!body.message || typeof body.message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const VALID_TRIGGER_TYPES = ["page_dwell", "exit_intent", "scroll_depth", "return_visitor", "custom"];
  const triggerType = (body.trigger_type as string) ?? "page_dwell";
  if (!VALID_TRIGGER_TYPES.includes(triggerType)) {
    return NextResponse.json({
      error: `trigger_type must be one of: ${VALID_TRIGGER_TYPES.join(", ")}`,
    }, { status: 400 });
  }

  const trigger = await proactiveTriggerRepo.create(tenantId, {
    name: body.name as string,
    status: (body.status as "active" | "inactive") ?? "active",
    trigger_type: triggerType as "page_dwell" | "exit_intent" | "scroll_depth" | "return_visitor" | "custom",
    conditions: (body.conditions as Record<string, unknown>) ?? {},
    message: body.message as string,
    playbook_id: body.playbook_id as string | undefined,
    delay_seconds: Number(body.delay_seconds ?? 30),
    cooldown_hours: Number(body.cooldown_hours ?? 24),
    priority: Number(body.priority ?? 100),
  });

  return NextResponse.json({ trigger }, { status: 201 });
}
