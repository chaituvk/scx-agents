// Smart priority queue for the agent inbox.
// Returns open conversations ranked by urgency score.
// Factors: priority field, sentiment, wait time, escalation status, CSAT history.
//
// GET /api/conversations/priority-queue?limit=50

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";
import { getTenantFromRequest } from "@/lib/tenant";

export const runtime = "nodejs";

interface PrioritizedConversation {
  id: string;
  customer_name?: string;
  customer_email?: string;
  channel: string;
  status: string;
  sentiment: string;
  priority: string;
  assigned_to?: string;
  topic?: string;
  created_at: string;
  updated_at: string;
  urgency_score: number;
  wait_minutes: number;
  message_count: number;
}

function calcUrgencyScore(row: {
  priority: string;
  sentiment: string;
  status: string;
  created_at: string;
  message_count: number;
}): number {
  let score = 0;

  // Priority weight
  if (row.priority === "urgent") score += 50;
  else if (row.priority === "high") score += 25;
  else score += 0;

  // Sentiment weight (negative sentiment = more urgent)
  if (row.sentiment === "negative") score += 30;
  else if (row.sentiment === "neutral") score += 0;
  else score += -5; // positive sentiment slightly deprioritized

  // Escalation status
  if (row.status === "escalated") score += 40;

  // Wait time (minutes since last update, capped at 120 min)
  const waitMs = Date.now() - new Date(row.created_at).getTime();
  const waitMins = Math.min(waitMs / 60000, 120);
  score += waitMins * 0.3; // up to 36 points for 2-hour wait

  // High message count suggests complex ongoing issue
  if (row.message_count > 10) score += 10;
  else if (row.message_count > 5) score += 5;

  return Math.round(score * 10) / 10;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "conversations", "read");
  if (auth instanceof NextResponse) return auth;

  const tenantId = await getTenantFromRequest(req);
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200);
  const assignedTo = searchParams.get("assigned_to") ?? "";

  const params: unknown[] = [tenantId];
  let assignFilter = "";
  if (assignedTo) {
    params.push(assignedTo);
    assignFilter = `AND c.assigned_to = $${params.length}`;
  }
  params.push(limit);

  const result = await query(
    `SELECT c.id, c.customer_name, c.customer_email, c.channel, c.status,
            c.sentiment, c.priority, c.assigned_to, c.topic, c.created_at, c.updated_at,
            COUNT(m.id) AS message_count
     FROM conversations c
     LEFT JOIN messages m ON m.conversation_id = c.id AND m.role != 'note'
     WHERE c.tenant_id = $1 AND c.status IN ('open', 'escalated') ${assignFilter}
     GROUP BY c.id
     ORDER BY c.updated_at DESC
     LIMIT $${params.length}`,
    params
  );

  const conversations: PrioritizedConversation[] = result.rows.map((row) => {
    const waitMs = Date.now() - new Date(row.created_at as string).getTime();
    const urgency = calcUrgencyScore({
      priority: row.priority as string,
      sentiment: row.sentiment as string,
      status: row.status as string,
      created_at: row.created_at as string,
      message_count: Number(row.message_count),
    });
    return {
      id: row.id as string,
      customer_name: row.customer_name as string | undefined,
      customer_email: row.customer_email as string | undefined,
      channel: row.channel as string,
      status: row.status as string,
      sentiment: row.sentiment as string,
      priority: row.priority as string,
      assigned_to: row.assigned_to as string | undefined,
      topic: row.topic as string | undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      urgency_score: urgency,
      wait_minutes: Math.round(waitMs / 60000),
      message_count: Number(row.message_count),
    };
  });

  // Sort by urgency score descending
  conversations.sort((a, b) => b.urgency_score - a.urgency_score);

  return NextResponse.json({
    conversations,
    total: conversations.length,
    generated_at: new Date().toISOString(),
  });
}
