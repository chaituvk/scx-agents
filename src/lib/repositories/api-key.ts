import { query, run, getOne } from "../db";
import { randomBytes, createHash } from "crypto";

export interface ApiKey {
  id: string;
  tenant_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  scopes: string[];
  status: "active" | "revoked";
  last_used_at: string | null;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ApiKeyWithSecret extends ApiKey {
  plaintext: string; // only returned on creation
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export const apiKeyRepo = {
  async create(
    tenantId: string,
    name: string,
    scopes: string[],
    createdBy?: string,
    expiresAt?: string
  ): Promise<ApiKeyWithSecret> {
    const id = crypto.randomUUID();
    const raw = `sk_${randomBytes(32).toString("hex")}`;
    const prefix = raw.slice(0, 10);
    const hash = hashKey(raw);
    const scopesJson = JSON.stringify(scopes);

    await run(
      `INSERT INTO api_keys (id, tenant_id, name, key_hash, key_prefix, scopes, status, expires_at, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8)`,
      [id, tenantId, name, hash, prefix, scopesJson, expiresAt ?? null, createdBy ?? null]
    );

    return {
      id, tenant_id: tenantId, name,
      key_hash: hash, key_prefix: prefix,
      scopes, status: "active",
      last_used_at: null, expires_at: expiresAt ?? null,
      created_by: createdBy ?? null, created_at: new Date().toISOString(),
      plaintext: raw,
    };
  },

  async findAll(tenantId: string): Promise<ApiKey[]> {
    const res = await query(
      `SELECT id, tenant_id, name, key_prefix, scopes, status, last_used_at, expires_at, created_by, created_at
       FROM api_keys WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
    return res.rows.map(parseRow);
  },

  async revoke(id: string, tenantId: string): Promise<boolean> {
    const r = await run(
      `UPDATE api_keys SET status = 'revoked' WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    return r.changes > 0;
  },

  async verify(rawKey: string): Promise<ApiKey | null> {
    const hash = hashKey(rawKey);
    const row = await getOne(
      `SELECT * FROM api_keys WHERE key_hash = $1 AND status = 'active'`,
      [hash]
    );
    if (!row) return null;

    // Check expiry
    if (row.expires_at && new Date(row.expires_at) < new Date()) return null;

    // Update last_used_at
    run(`UPDATE api_keys SET last_used_at = $1 WHERE id = $2`, [new Date().toISOString(), row.id]).catch(() => {});

    return parseRow(row);
  },
};

function parseRow(row: Record<string, unknown>): ApiKey {
  return {
    id: row.id as string,
    tenant_id: row.tenant_id as string,
    name: row.name as string,
    key_hash: (row.key_hash as string) ?? "",
    key_prefix: row.key_prefix as string,
    scopes: typeof row.scopes === "string" ? JSON.parse(row.scopes) : (row.scopes as string[]) ?? ["read", "write"],
    status: row.status as "active" | "revoked",
    last_used_at: (row.last_used_at as string) ?? null,
    expires_at: (row.expires_at as string) ?? null,
    created_by: (row.created_by as string) ?? null,
    created_at: row.created_at as string,
  };
}
