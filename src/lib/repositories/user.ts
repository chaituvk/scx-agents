import { query, getOne, run } from "@/lib/db";
import { Repository } from "./base";
import bcrypt from "bcryptjs";

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  password: string;
  role: "admin" | "agent" | "viewer" | "superadmin";
  created_at?: string;
}

const JSON_FIELDS: string[] = [];

class UserRepo extends Repository<User> {
  constructor() {
    super("users", 600);
  }

  async findById(id: string): Promise<User | null> {
    const cached = await this.cache.get<User>(this.cacheKey(id));
    if (cached) return cached;

    const row = await getOne("SELECT * FROM users WHERE id = $1", [id]);
    if (!row) return null;

    const user = this.parseJsonFields(row, JSON_FIELDS) as User;
    await this.cache.set(this.cacheKey(id), user, this.cacheTtl);
    return user;
  }

  async findByEmail(email: string, tenantId?: string): Promise<User | null> {
    const cacheKey = tenantId ? `users:email:${tenantId}:${email}` : `users:email:${email}`;
    const cached = await this.cache.get<User>(cacheKey);
    if (cached) return cached;

    let row;
    if (tenantId) {
      row = await getOne("SELECT * FROM users WHERE tenant_id = $1 AND email = $2", [tenantId, email]);
    } else {
      row = await getOne("SELECT * FROM users WHERE email = $1", [email]);
    }
    if (!row) return null;

    const user = this.parseJsonFields(row, JSON_FIELDS) as User;
    await this.cache.set(cacheKey, user, this.cacheTtl);
    return user;
  }

  async findAll(tenantId?: string): Promise<User[]> {
    const cacheKey = tenantId ? this.listCacheKey(`tenant:${tenantId}`) : this.listCacheKey();
    const cached = await this.cache.get<User[]>(cacheKey);
    if (cached) return cached;

    const result = tenantId
      ? await query("SELECT * FROM users WHERE tenant_id = $1 ORDER BY created_at DESC", [tenantId])
      : await query("SELECT * FROM users ORDER BY created_at DESC");
    const users = result.rows.map((r) => this.parseJsonFields(r, JSON_FIELDS)) as User[];
    await this.cache.set(cacheKey, users, this.cacheTtl);
    return users;
  }

  async create(data: Omit<User, "id" | "created_at"> & { id?: string }): Promise<User> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();

    await run(
      `INSERT INTO users (id, tenant_id, email, name, password, role, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, data.tenant_id, data.email, data.name, data.password, data.role, now]
    );

    const user = { ...data, id, created_at: now } as User;
    await this.invalidate();
    return user;
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) {
        fields.push(`${k} = $${idx}`);
        values.push(v);
        idx++;
      }
    }
    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await run(`UPDATE users SET ${fields.join(", ")} WHERE id = $${idx}`, values);

    await this.invalidate(id);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await run("DELETE FROM users WHERE id = $1", [id]);
    await this.invalidate(id);
    return (result.changes || 0) > 0;
  }

  async verifyPassword(email: string, password: string, tenantId?: string): Promise<User | null> {
    const user = await this.findByEmail(email, tenantId);
    if (!user) return null;
    const valid = await bcrypt.compare(password, user.password);
    return valid ? user : null;
  }
}

export const userRepo = new UserRepo();
