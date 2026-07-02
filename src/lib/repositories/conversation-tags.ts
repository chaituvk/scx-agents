import { query, run } from "../db";

export const conversationTagsRepo = {
  async addTag(conversationId: string, tenantId: string, tag: string): Promise<void> {
    await run(
      `INSERT INTO conversation_tags (conversation_id, tenant_id, tag, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (conversation_id, tag) DO NOTHING`,
      [conversationId, tenantId, tag, new Date().toISOString()],
    );
  },

  async removeTags(conversationId: string, tenantId: string, tags: string[]): Promise<void> {
    if (!tags.length) return;
    // Build a parameterised IN list
    const placeholders = tags.map((_, i) => `$${i + 3}`).join(", ");
    await run(
      `DELETE FROM conversation_tags
       WHERE conversation_id = $1 AND tenant_id = $2 AND tag IN (${placeholders})`,
      [conversationId, tenantId, ...tags],
    );
  },

  async getTags(conversationId: string, tenantId: string): Promise<string[]> {
    const res = await query(
      `SELECT tag FROM conversation_tags
       WHERE conversation_id = $1 AND tenant_id = $2
       ORDER BY tag`,
      [conversationId, tenantId],
    );
    return res.rows.map((r) => r.tag as string);
  },

  async setTags(conversationId: string, tenantId: string, tags: string[]): Promise<void> {
    // Remove all existing tags for this conversation+tenant, then insert the new set.
    await run(
      `DELETE FROM conversation_tags WHERE conversation_id = $1 AND tenant_id = $2`,
      [conversationId, tenantId],
    );
    const now = new Date().toISOString();
    for (const tag of tags) {
      await run(
        `INSERT INTO conversation_tags (conversation_id, tenant_id, tag, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (conversation_id, tag) DO NOTHING`,
        [conversationId, tenantId, tag, now],
      );
    }
  },

  async getConversationsByTag(
    tenantId: string,
    tag: string,
    limit = 50,
  ): Promise<string[]> {
    const res = await query(
      `SELECT conversation_id FROM conversation_tags
       WHERE tenant_id = $1 AND tag = $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [tenantId, tag, limit],
    );
    return res.rows.map((r) => r.conversation_id as string);
  },

  async getAllTags(tenantId: string): Promise<Array<{ tag: string; count: number }>> {
    const res = await query(
      `SELECT tag, COUNT(*) AS count
       FROM conversation_tags
       WHERE tenant_id = $1
       GROUP BY tag
       ORDER BY count DESC, tag`,
      [tenantId],
    );
    return res.rows.map((r) => ({
      tag: r.tag as string,
      count: Number(r.count),
    }));
  },
};
