// Webhook delivery service — signs payloads with HMAC-SHA256, delivers with
// exponential backoff retry (3 attempts: immediate, +30s, +5min).

import { createHmac } from "crypto";
import { webhookRepo } from "../repositories/webhook";

export type WebhookEventType =
  | "conversation.created"
  | "conversation.closed"
  | "conversation.assigned"
  | "message.sent"
  | "escalation.triggered"
  | "escalation.resolved"
  | "playbook.completed"
  | "csat.submitted"
  | "csat.requested";

export interface WebhookEvent {
  type: WebhookEventType;
  tenantId: string;
  payload: Record<string, unknown>;
}

function sign(secret: string, body: string): string {
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  return `t=${ts},v1=${sig}`;
}

async function deliverOnce(url: string, secret: string, eventType: string, body: string): Promise<{ ok: boolean; status: number; text: string }> {
  const signature = sign(secret, body);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sierra-Signature": signature,
        "X-Sierra-Event": eventType,
        "User-Agent": "Sierra-Webhooks/1.0",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text().catch(() => "");
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    return { ok: false, status: 0, text: err instanceof Error ? err.message : "network_error" };
  }
}

// Fire-and-forget: dispatch all active webhooks for a tenant that subscribe to this event type.
export async function dispatchWebhookEvent(event: WebhookEvent): Promise<void> {
  try {
    const hooks = await webhookRepo.findActiveByTenant(event.tenantId);
    const matching = hooks.filter((h) => h.events.includes(event.type) || h.events.includes("*"));
    if (!matching.length) return;

    const body = JSON.stringify({
      id: crypto.randomUUID(),
      type: event.type,
      created: new Date().toISOString(),
      data: event.payload,
    });

    await Promise.allSettled(
      matching.map(async (hook) => {
        const deliveryId = await webhookRepo.createDelivery({
          webhookId: hook.id,
          tenantId: event.tenantId,
          eventType: event.type,
          payload: JSON.parse(body),
        });

        // Attempt 1: immediate
        const result = await deliverOnce(hook.url, hook.secret, event.type, body);
        if (result.ok) {
          await webhookRepo.markDelivered(deliveryId, result.status, result.text);
          return;
        }

        // Schedule retry in 30s (fire-and-forget async retry)
        scheduleRetry(deliveryId, hook.url, hook.secret, event.type, body, result, 30_000);
      })
    );
  } catch (err) {
    console.error("[webhooks] dispatch error:", err);
  }
}

function scheduleRetry(
  deliveryId: string, url: string, secret: string, eventType: string, body: string,
  firstResult: { status: number; text: string }, delayMs: number
): void {
  const DELAYS = [30_000, 300_000]; // 30s, 5min
  let attempt = 0;

  const tryNext = async (): Promise<void> => {
    if (attempt >= DELAYS.length) {
      await webhookRepo.markFailed(deliveryId, firstResult.status, firstResult.text, null);
      return;
    }
    const delay = DELAYS[attempt++];
    await new Promise((r) => setTimeout(r, delay));
    const result = await deliverOnce(url, secret, eventType, body);
    if (result.ok) {
      await webhookRepo.markDelivered(deliveryId, result.status, result.text);
    } else {
      const next = attempt < DELAYS.length ? new Date(Date.now() + DELAYS[attempt]).toISOString() : null;
      await webhookRepo.markFailed(deliveryId, result.status, result.text, next);
      if (next) tryNext();
    }
  };

  setTimeout(tryNext, delayMs);
}
