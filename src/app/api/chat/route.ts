// /api/chat — DEPRECATED. As of Stage 4 this endpoint proxies to
// orchestrator.runTurn and returns a legacy response shape with
// Deprecation + Sunset headers. The previous canned-response demo (lib/ai.ts
// generateAgentResponse) is retired. Callers must migrate to /api/orchestrator
// before the sunset date below.

import { NextRequest } from "next/server";
import { conversationRepo, messageRepo } from "@/lib/repositories";
import { orchestrator } from "@/lib/orchestrator";
import { getTenantFromRequest } from "@/lib/tenant";

function deprecationHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Deprecation: "true",
    Sunset: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString(),
    Link: '</api/orchestrator>; rel="successor-version"',
  };
}

export async function POST(req: NextRequest) {
  const DEPRECATION_HEADERS = deprecationHeaders();
  try {
    const { message, conversationId } = await req.json();
    const tenantId = await getTenantFromRequest(req);

    const conversation = await conversationRepo.findByIdForTenant(conversationId, tenantId);
    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: DEPRECATION_HEADERS },
      );
    }

    await messageRepo.create({ tenant_id: tenantId, conversation_id: conversationId, role: "user", content: message });

    const turn = await orchestrator.runTurn({
      tenantId,
      conversationId,
      message,
    });

    const assistantMessage = await messageRepo.create({
      tenant_id: tenantId,
      conversation_id: conversationId,
      role: "assistant",
      content: turn.response,
      intent: turn.intent,
    });

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        agent: {
          id: turn.subAgent,
          name: turn.subAgent,
          intent: turn.intent,
        },
      }),
      { headers: DEPRECATION_HEADERS },
    );
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Failed to process message", details: detail }),
      { status: 400, headers: DEPRECATION_HEADERS },
    );
  }
}
