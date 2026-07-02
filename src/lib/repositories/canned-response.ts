import { query, run, getOne, isPostgres } from "@/lib/db";

export interface CannedResponse {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  shortcut: string | null;
  use_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function parseCannedResponse(row: Record<string, unknown>): CannedResponse {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    title: row.title as string,
    content: row.content as string,
    category: (row.category as string) ?? "general",
    tags: typeof row.tags === "string" ? JSON.parse(row.tags) : ((row.tags as string[]) ?? []),
    shortcut: (row.shortcut as string) ?? null,
    use_count: (row.use_count as number) ?? 0,
    created_by: (row.created_by as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export const cannedResponseRepo = {
  async create(
    tenantId: string,
    data: {
      title: string;
      content: string;
      category?: string;
      tags?: string[];
      shortcut?: string | null;
      created_by?: string | null;
    },
  ): Promise<CannedResponse> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const category = data.category ?? "general";
    const tags = JSON.stringify(data.tags ?? []);
    const shortcut = data.shortcut ?? null;
    const createdBy = data.created_by ?? null;

    await run(
      `INSERT INTO canned_responses (id, tenant_id, title, content, category, tags, shortcut, use_count, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10)`,
      [id, tenantId, data.title, data.content, category, tags, shortcut, createdBy, now, now],
    );

    return {
      id,
      tenant_id: tenantId,
      title: data.title,
      content: data.content,
      category,
      tags: data.tags ?? [],
      shortcut,
      use_count: 0,
      created_by: createdBy,
      created_at: now,
      updated_at: now,
    };
  },

  async findAll(tenantId: string, category?: string): Promise<CannedResponse[]> {
    let sql: string;
    let params: unknown[];

    if (category) {
      sql = `SELECT * FROM canned_responses WHERE tenant_id = $1 AND category = $2 ORDER BY use_count DESC, title ASC`;
      params = [tenantId, category];
    } else {
      sql = `SELECT * FROM canned_responses WHERE tenant_id = $1 ORDER BY use_count DESC, title ASC`;
      params = [tenantId];
    }

    const res = await query(sql, params as string[]);
    return res.rows.map(parseCannedResponse);
  },

  async findById(id: string, tenantId: string): Promise<CannedResponse | null> {
    const row = await getOne(
      `SELECT * FROM canned_responses WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return row ? parseCannedResponse(row) : null;
  },

  async findByShortcut(tenantId: string, shortcut: string): Promise<CannedResponse | null> {
    const row = await getOne(
      `SELECT * FROM canned_responses WHERE tenant_id = $1 AND shortcut = $2`,
      [tenantId, shortcut],
    );
    return row ? parseCannedResponse(row) : null;
  },

  async search(tenantId: string, searchQuery: string, limit = 20): Promise<CannedResponse[]> {
    // Full-text search on title + content using LIKE for SQLite compatibility.
    // PostgreSQL uses ILIKE for case-insensitive matching.
    const pattern = `%${searchQuery}%`;
    const likeOp = isPostgres() ? "ILIKE" : "LIKE";
    const sql = `
      SELECT * FROM canned_responses
      WHERE tenant_id = $1
        AND (title ${likeOp} $2 OR content ${likeOp} $2)
      ORDER BY use_count DESC, title ASC
      LIMIT $3
    `;
    const res = await query(sql, [tenantId, pattern, limit]);
    return res.rows.map(parseCannedResponse);
  },

  async update(
    id: string,
    tenantId: string,
    data: Partial<Pick<CannedResponse, "title" | "content" | "category" | "tags" | "shortcut">>,
  ): Promise<boolean> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (data.title !== undefined) {
      sets.push(`title = $${i++}`);
      vals.push(data.title);
    }
    if (data.content !== undefined) {
      sets.push(`content = $${i++}`);
      vals.push(data.content);
    }
    if (data.category !== undefined) {
      sets.push(`category = $${i++}`);
      vals.push(data.category);
    }
    if (data.tags !== undefined) {
      sets.push(`tags = $${i++}`);
      vals.push(JSON.stringify(data.tags));
    }
    if ("shortcut" in data) {
      sets.push(`shortcut = $${i++}`);
      vals.push(data.shortcut ?? null);
    }

    if (!sets.length) return false;

    sets.push(`updated_at = $${i++}`);
    vals.push(new Date().toISOString());
    vals.push(id);
    vals.push(tenantId);

    const r = await run(
      `UPDATE canned_responses SET ${sets.join(", ")} WHERE id = $${i} AND tenant_id = $${i + 1}`,
      vals as string[],
    );
    return (r.changes ?? 0) > 0;
  },

  async delete(id: string, tenantId: string): Promise<boolean> {
    const r = await run(
      `DELETE FROM canned_responses WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    return (r.changes ?? 0) > 0;
  },

  async incrementUseCount(id: string): Promise<void> {
    await run(
      `UPDATE canned_responses SET use_count = use_count + 1, updated_at = $1 WHERE id = $2`,
      [new Date().toISOString(), id],
    );
  },
};
