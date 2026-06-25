import { NextRequest, NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/tenant";
import type { AuditEvent } from "@/lib/agents/types";

interface TurnTrace {
  turnId: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  subAgent: string | null;
  intent: string | null;
  events: AuditEvent[];
}

const TURN_INTERIOR_TYPES = new Set([
  "route_decision",
  "tool_call",
  "policy_event",
  "supervisor_check",
  "slot_write",
]);

function groupIntoTurns(events: AuditEvent[]): TurnTrace[] {
  const traces: TurnTrace[] = [];
  let current: TurnTrace | null = null;

  for (const event of events) {
    if (event.type === "turn_start") {
      // Close any open turn that lacked a turn_end
      if (current) {
        traces.push(current);
      }
      current = {
        turnId: event.id,
        startedAt: event.ts,
        endedAt: null,
        durationMs: null,
        subAgent: null,
        intent: null,
        events: [event],
      };
    } else if (event.type === "turn_end") {
      if (current) {
        current.endedAt = event.ts;
        const startMs = new Date(current.startedAt).getTime();
        const endMs = new Date(event.ts).getTime();
        current.durationMs = endMs - startMs;
        current.events.push(event);
        traces.push(current);
        current = null;
      }
    } else if (TURN_INTERIOR_TYPES.has(event.type)) {
      if (current) {
        current.events.push(event);
        // Extract subAgent and intent from route_decision payload
        if (event.type === "route_decision") {
          if (!current.subAgent && event.payload.subAgent) {
            current.subAgent = event.payload.subAgent as string;
          }
          if (!current.intent && event.payload.intent) {
            current.intent = event.payload.intent as string;
          }
        }
      }
    }
  }

  // Push any unclosed turn
  if (current) {
    traces.push(current);
  }

  return traces;
}

export async function GET(req: NextRequest) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const conversationId = req.nextUrl.searchParams.get("conversationId");
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }

    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 10, 100) : 10;

    const { auditStore } = await import("@/lib/audit");
    const events = await auditStore.listByConversation(conversationId, limit * 20);

    // Security: only return events belonging to this tenant
    const tenantEvents = events.filter((e) => e.tenantId === tenantId);

    const traces = groupIntoTurns(tenantEvents).slice(0, limit);

    return NextResponse.json({ traces, conversationId, tenantId });
  } catch {
    return NextResponse.json({ error: "Failed to fetch traces" }, { status: 500 });
  }
}
