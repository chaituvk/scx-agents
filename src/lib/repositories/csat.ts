import { query, run, getOne } from "../db";

export interface CsatRating {
  id: string;
  tenant_id: string;
  conversation_id: string;
  score: number; // 1-5
  comment: string | null;
  agent_id: string | null;
  submitted_at: string;
}

export interface CsatSummary {
  average_score: number;
  total_ratings: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  recent: CsatRating[];
}

export const csatRepo = {
  async submit(data: {
    tenantId: string;
    conversationId: string;
    score: number;
    comment?: string;
    agentId?: string;
  }): Promise<CsatRating> {
    const id = crypto.randomUUID();
    await run(
      `INSERT INTO csat_ratings (id, tenant_id, conversation_id, score, comment, agent_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (conversation_id) DO UPDATE SET score = $4, comment = $5, submitted_at = (datetime('now'))`,
      [id, data.tenantId, data.conversationId, data.score, data.comment ?? null, data.agentId ?? null]
    );
    return {
      id, tenant_id: data.tenantId, conversation_id: data.conversationId,
      score: data.score, comment: data.comment ?? null,
      agent_id: data.agentId ?? null, submitted_at: new Date().toISOString(),
    };
  },

  async findByConversation(conversationId: string): Promise<CsatRating | null> {
    const row = await getOne(`SELECT * FROM csat_ratings WHERE conversation_id = $1`, [conversationId]);
    return row ? parseRow(row) : null;
  },

  async summary(tenantId: string, days = 30): Promise<CsatSummary> {
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const res = await query(
      `SELECT score, COUNT(*) as cnt FROM csat_ratings
       WHERE tenant_id = $1 AND submitted_at >= $2 GROUP BY score`,
      [tenantId, since]
    );
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    let sum = 0;
    for (const row of res.rows) {
      const s = Number(row.score);
      const c = Number(row.cnt);
      dist[s] = c;
      total += c;
      sum += s * c;
    }
    const recent = await query(
      `SELECT * FROM csat_ratings WHERE tenant_id = $1 ORDER BY submitted_at DESC LIMIT 10`,
      [tenantId]
    );
    return {
      average_score: total > 0 ? Math.round((sum / total) * 100) / 100 : 0,
      total_ratings: total,
      distribution: dist as Record<1 | 2 | 3 | 4 | 5, number>,
      recent: recent.rows.map(parseRow),
    };
  },
};

function parseRow(row: Record<string, unknown>): CsatRating {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    conversation_id: row.conversation_id as string,
    score: Number(row.score),
    comment: (row.comment as string) ?? null,
    agent_id: (row.agent_id as string) ?? null,
    submitted_at: row.submitted_at as string,
  };
}
