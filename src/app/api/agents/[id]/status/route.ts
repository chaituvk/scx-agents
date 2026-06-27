// Agent availability status endpoint.
// GET /api/agents/[id]/status — get current availability status
// PUT /api/agents/[id]/status — set availability status
// Body: { status: "online" | "away" | "offline" | "busy" }
//
// In-memory for single-replica; replace with Redis for multi-replica.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";

export type AgentStatus = "online" | "away" | "offline" | "busy";

// In-process store: agentId → { status, updated_at }
const AGENT_STATUS = new Map<string, { status: AgentStatus; updated_at: string }>();
const VALID_STATUSES: AgentStatus[] = ["online", "away", "offline", "busy"];

export function getAgentStatus(agentId: string): { status: AgentStatus; updated_at: string } {
  return AGENT_STATUS.get(agentId) ?? { status: "offline", updated_at: new Date().toISOString() };
}

export function setAgentStatus(agentId: string, status: AgentStatus): void {
  AGENT_STATUS.set(agentId, { status, updated_at: new Date().toISOString() });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAuth(req, "agents", "read");
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({ agent_id: id, ...getAgentStatus(id) });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireAuth(req, "agents", "write");
  if (auth instanceof NextResponse) return auth;

  // Only allow agents to update their own status (or admins any status)
  const caller = (auth as { user: { userId: string; role: string } }).user;
  if (caller.userId !== id && caller.role !== "admin" && caller.role !== "superadmin") {
    return NextResponse.json({ error: "Cannot set status for another agent" }, { status: 403 });
  }

  let body: { status?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const status = body.status as AgentStatus;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({
      error: `status must be one of: ${VALID_STATUSES.join(", ")}`,
    }, { status: 400 });
  }

  setAgentStatus(id, status);
  return NextResponse.json({ agent_id: id, ...getAgentStatus(id) });
}
