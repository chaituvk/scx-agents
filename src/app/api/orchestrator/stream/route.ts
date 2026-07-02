import { NextRequest } from 'next/server';
import { getTenantFromRequest } from '@/lib/tenant';
import { orchestrator } from '@/lib/orchestrator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const body = await req.json();

  const { conversationId, message, variables, channel } = body;

  if (!conversationId || !message) {
    return new Response(JSON.stringify({ error: 'conversationId and message required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(line));
      };

      try {
        sendEvent('start', { conversationId, message, ts: new Date().toISOString() });

        // Run the turn
        const result = await orchestrator.runTurn({
          conversationId,
          tenantId,
          message,
          variables,
          channel,
        });

        // Stream intermediate events from the audit trail
        sendEvent('route_decision', {
          intent: result.intent,
          subAgent: result.subAgent,
        });

        if (result.toolCalls?.length) {
          for (const tc of result.toolCalls) {
            sendEvent('tool_call', { tool: tc.tool, ok: true });
          }
        }

        sendEvent('supervisor', {
          pass: result.supervisor.pass,
          issues: result.supervisor.issues,
        });

        sendEvent('complete', {
          response: result.response,
          intent: result.intent,
          subAgent: result.subAgent,
          variables: result.variables,
          done: result.done,
          actions: result.actions,
          pendingApproval: result.pendingApproval,
        });
      } catch (err) {
        sendEvent('error', {
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
