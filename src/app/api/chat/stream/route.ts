// /api/chat/stream — DEPRECATED. As of Stage 4 this proxies to
// orchestrator.runTurn and fake-streams the response back as text/event-stream
// with Deprecation + Sunset headers. The previous canned generator
// (lib/ai.ts streamAgentResponse) is retired. Callers must migrate to
// /api/orchestrator before the sunset date below.

import { NextRequest } from "next/server";
import { conversationRepo, messageRepo } from "@/lib/repositories";
import { orchestrator } from "@/lib/orchestrator";
import { getTenantFromRequest } from "@/lib/tenant";

function deprecationSseHeaders(): Record<string, string> {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    Deprecation: "true",
    Sunset: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString(),
    Link: '</api/orchestrator>; rel="successor-version"',
  };
}

export async function POST(req: NextRequest) {
  const DEPRECATION_SSE_HEADERS = deprecationSseHeaders();
  try {
    const { message, conversationId } = await req.json();
    const tenantId = await getTenantFromRequest(req);

    const conversation = await conversationRepo.findByIdForTenant(conversationId, tenantId);
    if (!conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    await messageRepo.create({ tenant_id: tenantId, conversation_id: conversationId, role: "user", content: message });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const turn = await orchestrator.runTurn({
          tenantId,
          conversationId,
          message,
        });

        await messageRepo.create({
          tenant_id: tenantId,
          conversation_id: conversationId,
          role: "assistant",
          content: turn.response,
          intent: turn.intent,
        });

        const words = turn.response.split(/(\s+)/);
        let acc = "";
        for (let i = 0; i < words.length; i++) {
          acc += words[i];
          const last = i === words.length - 1;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ chunk: acc, agentName: turn.subAgent, done: last })}\n\n`,
            ),
          );
          if (!last) await new Promise((r) => setTimeout(r, 60));
        }

        controller.close();
      },
    });

    return new Response(stream, { headers: DEPRECATION_SSE_HEADERS });
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Failed to stream", details: detail }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
}
