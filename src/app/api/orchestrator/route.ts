import { NextRequest, NextResponse } from "next/server";
import { orchestrator } from "@/lib/orchestrator";
import { getTenantFromRequest } from "@/lib/tenant";
import { conversationRepo } from "@/lib/repositories";
import { registerHttpAdapters } from "@/lib/tools/http-adapter";

// Register real HTTP tool adapters once at cold-start (idempotent).
registerHttpAdapters();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { conversationId, message, customerId, variables } = body;

    if (!conversationId || typeof conversationId !== "string") {
      return NextResponse.json({ error: "conversationId required" }, { status: 400 });
    }
    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    const tenantId = await getTenantFromRequest(req);

    const result = await orchestrator.runTurn({
      conversationId,
      tenantId,
      customerId,
      message,
      variables: variables ?? {},
    });

    if (result.actions.some((a) => a.type === "transfer" || a.type === "escalate")) {
      await conversationRepo
        .update(conversationId, { status: "escalated", updated_at: new Date().toISOString() })
        .catch(() => undefined);
    } else if (result.done) {
      await conversationRepo
        .update(conversationId, { status: "resolved", updated_at: new Date().toISOString() })
        .catch(() => undefined);
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
