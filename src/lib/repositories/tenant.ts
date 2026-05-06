import { getOne } from "@/lib/db";
import { Repository } from "./base";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  primary_color?: string;
  accent_color?: string;
  welcome_message?: string;
  tone?: string;
  off_limit_topics?: string[] | null;
  off_limit_phrases?: string[] | null;
  approval_threshold?: number;
  require_approval?: number;
  config?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

const JSON_FIELDS = ["off_limit_topics", "off_limit_phrases", "config"];

class TenantRepo extends Repository<Tenant> {
  constructor() {
    super("tenants", 600);
  }

  async findById(id: string): Promise<Tenant | null> {
    const cached = await this.cache.get<Tenant>(this.cacheKey(id));
    if (cached) return cached;
    const row = await getOne("SELECT * FROM tenants WHERE id = $1", [id]);
    if (!row) return null;
    const parsed = this.parseJsonFields(row, JSON_FIELDS) as Tenant;
    await this.cache.set(this.cacheKey(id), parsed, this.cacheTtl);
    return parsed;
  }

  async findAll(): Promise<Tenant[]> {
    return [];
  }

  async create(_data: Omit<Tenant, "id" | "created_at">): Promise<Tenant> {
    throw new Error("TenantRepo.create not implemented — tenants are seeded externally");
  }

  async update(_id: string, _data: Partial<Tenant>): Promise<Tenant | null> {
    throw new Error("TenantRepo.update not implemented");
  }

  async delete(_id: string): Promise<boolean> {
    throw new Error("TenantRepo.delete not implemented");
  }
}

export const tenantRepo = new TenantRepo();
