import { query, getOne, run } from "@/lib/db";
import { cache } from "@/lib/cache";

export interface PlaybookState {
  conversation_id: string;
  tenant_id: string;
  playbook_id: string;
  variables: Record<string, string>;
  turn_count: number;
  updated_at?: string;
}

const CACHE_TTL = 60; // short TTL — state changes every turn

function cacheKey(conversationId: string, tenantId: string): string {
  return `playbook_states:${tenantId}:${conversationId}`;
}

class PlaybookStateRepo {
  async load(conversationId: string, tenantId: string): Promise<PlaybookState | null> {
    const key = cacheKey(conversationId, tenantId);
    const cached = await cache.get<PlaybookState>(key);
    if (cached) return cached;

    const row = await getOne(
      "SELECT * FROM playbook_states WHERE conversation_id = $1 AND tenant_id = $2",
      [conversationId, tenantId]
    );
    if (!row) return null;

    const state: PlaybookState = {
      ...row,
      variables: typeof row.variables === "string"
        ? JSON.parse(row.variables)
        : (row.variables ?? {}),
    };
    await cache.set(key, state, CACHE_TTL);
    return state;
  }

  async upsert(state: PlaybookState): Promise<void> {
    const variables = JSON.stringify(state.variables ?? {});
    const now = new Date().toISOString();

    // PostgreSQL: ON CONFLICT upsert
    // SQLite: INSERT OR REPLACE
    try {
      await run(
        `INSERT INTO playbook_states (conversation_id, tenant_id, playbook_id, variables, turn_count, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (conversation_id, tenant_id) DO UPDATE SET
           playbook_id = EXCLUDED.playbook_id,
           variables   = EXCLUDED.variables,
           turn_count  = EXCLUDED.turn_count,
           updated_at  = EXCLUDED.updated_at`,
        [state.conversation_id, state.tenant_id, state.playbook_id, variables, state.turn_count, now]
      );
    } catch {
      // SQLite fallback — INSERT OR REPLACE
      await run(
        `INSERT OR REPLACE INTO playbook_states
         (conversation_id, tenant_id, playbook_id, variables, turn_count, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [state.conversation_id, state.tenant_id, state.playbook_id, variables, state.turn_count, now]
      );
    }

    // Bust cache so next load sees fresh state
    await cache.del(cacheKey(state.conversation_id, state.tenant_id));
  }

  async delete(conversationId: string, tenantId: string): Promise<void> {
    await run(
      "DELETE FROM playbook_states WHERE conversation_id = $1 AND tenant_id = $2",
      [conversationId, tenantId]
    );
    await cache.del(cacheKey(conversationId, tenantId));
  }
}

export const playbookStateRepo = new PlaybookStateRepo();
