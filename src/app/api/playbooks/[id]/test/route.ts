// Playbook test endpoint — run a playbook against a mock conversation
// without affecting any real data. Useful for Studio operators to verify
// playbook behavior before activating it.
//
// POST /api/playbooks/[id]/test
// Body: {
//   messages: Array<{ role: "user" | "assistant"; content: string }>,
//   variables?: Record<string, string>,
//   knowledge?: Array<{ title: string; content: string; source: string }>
// }
// Returns: { response, tool_calls, variables, done, escalated, thinking_steps }

import { NextRequest, NextResponse } from "next/server";
import { playbookRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";
import { runPlaybook } from "@/lib/playbook/runner";
import { retrieveKnowledge } from "@/lib/rag";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenantId = await getTenantFromRequest(req);

  const playbook = await playbookRepo.findById(id);
  if (!playbook || playbook.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Playbook not found" }, { status: 404 });
  }

  let body: {
    messages?: Array<{ role: string; content: string }>;
    variables?: Record<string, string>;
    knowledge?: Array<{ title: string; content: string; source: string }>;
  } = {};

  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "messages array is required and must be non-empty" }, { status: 400 });
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== "user") {
    return NextResponse.json({ error: "Last message must be from user" }, { status: 400 });
  }

  const history = messages.slice(0, -1);
  const userMessage = lastMessage.content;

  // Use provided knowledge or fetch from RAG
  let knowledge = body.knowledge ?? [];
  if (knowledge.length === 0 && userMessage) {
    knowledge = await retrieveKnowledge(userMessage, 3, tenantId).catch(() => []);
  }

  const result = await runPlaybook(playbook as import("@/lib/playbook/types").Playbook, {
    conversationId: `test-${Date.now()}`,
    tenantId,
    message: userMessage,
    history,
    knowledge,
    variables: body.variables ?? {},
  });

  return NextResponse.json({
    response: result.response,
    tool_calls: result.toolCalls,
    variables: result.variables,
    done: result.done,
    escalated: result.escalated,
    escalation_reason: result.escalationReason,
    thinking_steps: result.thinkingSteps,
    playbook_id: id,
    playbook_name: playbook.name,
    tested_at: new Date().toISOString(),
  });
}
