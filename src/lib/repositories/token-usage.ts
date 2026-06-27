// Track LLM token consumption per tenant/conversation
import { query, run, getOne } from "../db";
import { randomUUID } from "crypto";

// Approximate cost per 1K tokens (update as needed)
const COST_PER_1K: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 0.015, output: 0.075 },
  "claude-sonnet-4-6": { input: 0.003, output: 0.015 },
  "claude-haiku-4-5": { input: 0.00025, output: 0.00125 },
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  default: { input: 0.001, output: 0.003 },
};

function calcCost(model: string, promptTokens: number, completionTokens: number): number {
  const rates = COST_PER_1K[model] ?? COST_PER_1K["default"];
  return (promptTokens / 1000) * rates.input + (completionTokens / 1000) * rates.output;
}

export interface TokenUsageRecord {
  id: string;
  tenant_id: string;
  conversation_id?: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  agent_type?: string;
  created_at: string;
}

export interface TokenUsageSummary {
  total_tokens: number;
  total_cost_usd: number;
  by_model: Record<string, { tokens: number; cost_usd: number }>;
  by_day: Array<{ date: string; tokens: number; cost_usd: number }>;
}

export const tokenUsageRepo = {
  async record(data: {
    tenantId: string;
    conversationId?: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    agentType?: string;
  }): Promise<TokenUsageRecord> {
    const id = randomUUID();
    const totalTokens = data.promptTokens + data.completionTokens;
    const costUsd = calcCost(data.model, data.promptTokens, data.completionTokens);
    const now = new Date().toISOString();

    await run(
      `INSERT INTO token_usage
         (id, tenant_id, conversation_id, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, agent_type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        data.tenantId,
        data.conversationId ?? null,
        data.model,
        data.promptTokens,
        data.completionTokens,
        totalTokens,
        costUsd,
        data.agentType ?? null,
        now,
      ]
    );

    return {
      id,
      tenant_id: data.tenantId,
      conversation_id: data.conversationId,
      model: data.model,
      prompt_tokens: data.promptTokens,
      completion_tokens: data.completionTokens,
      total_tokens: totalTokens,
      cost_usd: costUsd,
      agent_type: data.agentType,
      created_at: now,
    };
  },

  async summary(tenantId: string, days = 30): Promise<TokenUsageSummary> {
    // Calculate the cutoff date for the requested window
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString();

    const rows = await query(
      `SELECT model, prompt_tokens, completion_tokens, total_tokens, cost_usd, created_at
       FROM token_usage
       WHERE tenant_id = $1 AND created_at >= $2
       ORDER BY created_at ASC`,
      [tenantId, cutoffIso]
    );

    let totalTokens = 0;
    let totalCostUsd = 0;
    const byModel: Record<string, { tokens: number; cost_usd: number }> = {};
    const byDayMap: Record<string, { tokens: number; cost_usd: number }> = {};

    for (const row of rows.rows) {
      const tokens = Number(row.total_tokens) || 0;
      const cost = Number(row.cost_usd) || 0;
      const model = row.model as string;

      totalTokens += tokens;
      totalCostUsd += cost;

      if (!byModel[model]) {
        byModel[model] = { tokens: 0, cost_usd: 0 };
      }
      byModel[model].tokens += tokens;
      byModel[model].cost_usd += cost;

      // Extract date portion (works for both ISO strings and datetime() output)
      const dateStr = (row.created_at as string).slice(0, 10);
      if (!byDayMap[dateStr]) {
        byDayMap[dateStr] = { tokens: 0, cost_usd: 0 };
      }
      byDayMap[dateStr].tokens += tokens;
      byDayMap[dateStr].cost_usd += cost;
    }

    const byDay = Object.entries(byDayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, tokens: v.tokens, cost_usd: v.cost_usd }));

    return {
      total_tokens: totalTokens,
      total_cost_usd: totalCostUsd,
      by_model: byModel,
      by_day: byDay,
    };
  },
};
