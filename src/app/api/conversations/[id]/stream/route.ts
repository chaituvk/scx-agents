import { NextRequest } from "next/server";
import { messageRepo } from "@/lib/repositories";
import { getTenantFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Long-poll SSE stream for a single conversation's messages.
// Clients connect and receive new messages as they are persisted.
// Heartbeat every 15s keeps the connection alive through proxies.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = await params;
  const tenantId = await getTenantFromRequest(req);
  const url = new URL(req.url);
  const afterParam = url.searchParams.get("after");

  const encoder = new TextEncoder();
  let lastMessageId = afterParam ?? null;
  let closed = false;

  req.signal.addEventListener("abort", () => { closed = true; });

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(line));
      };

      send("connected", { conversationId, ts: new Date().toISOString() });

      while (!closed) {
        try {
          const messages = await messageRepo.findByConversation(conversationId);
          const fresh = lastMessageId
            ? messages.filter((m) => m.id > lastMessageId!)
            : messages;

          if (fresh.length > 0) {
            for (const msg of fresh) {
              send("message", msg);
            }
            lastMessageId = fresh[fresh.length - 1].id;
          }

          // Heartbeat
          send("heartbeat", { ts: new Date().toISOString() });

          await sleep(3000);
        } catch {
          if (!closed) send("error", { message: "poll_error" });
          break;
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "X-Accel-Buffering": "no",
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
