// Typing indicator SSE endpoint.
// GET /api/conversations/[id]/typing
//
// Streams Server-Sent Events indicating when the AI is "typing".
// The orchestrator sets a typing flag in Redis/memory; this endpoint
// reads it. For now uses a simple in-memory store shared within a process.
//
// For multi-replica deployments, replace TYPING_STATE with Redis pub/sub.
//
// Client usage:
//   const es = new EventSource(`/api/conversations/${id}/typing`);
//   es.onmessage = (e) => { const { typing } = JSON.parse(e.data); ... };

import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Shared in-process typing state — not durable across restarts or replicas.
// Key: conversationId, Value: timestamp when typing started (ms since epoch)
export const TYPING_STATE = new Map<string, number>();
const TYPING_TIMEOUT_MS = 10_000; // auto-clear after 10s (safety valve)

export function setTyping(conversationId: string, isTyping: boolean): void {
  if (isTyping) {
    TYPING_STATE.set(conversationId, Date.now());
  } else {
    TYPING_STATE.delete(conversationId);
  }
}

export function isTyping(conversationId: string): boolean {
  const ts = TYPING_STATE.get(conversationId);
  if (!ts) return false;
  if (Date.now() - ts > TYPING_TIMEOUT_MS) {
    TYPING_STATE.delete(conversationId);
    return false;
  }
  return true;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      function send(data: object) {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* connection closed */ }
      }

      // Send current state immediately
      send({ typing: isTyping(id) });

      // Poll every 500ms
      const interval = setInterval(() => {
        send({ typing: isTyping(id) });
      }, 500);

      // Clean up when client disconnects
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
