import { query, getOne, run } from "@/lib/db";
import { cache, Cache } from "@/lib/cache";

export interface BaseEntity {
  id: string;
  created_at?: string;
}

export abstract class Repository<T extends BaseEntity> {
  protected table: string;
  protected cache: Cache;
  protected cachePrefix: string;
  protected cacheTtl: number;

  constructor(table: string, cacheTtl: number = 300) {
    this.table = table;
    this.cache = cache;
    this.cachePrefix = table;
    this.cacheTtl = cacheTtl;
  }

  protected cacheKey(id: string): string {
    return `${this.cachePrefix}:${id}`;
  }

  protected listCacheKey(suffix: string = "all"): string {
    return `${this.cachePrefix}:list:${suffix}`;
  }

  protected async invalidate(id?: string): Promise<void> {
    if (id) {
      await this.cache.del(this.cacheKey(id));
    }
    await this.cache.delPattern(`${this.cachePrefix}:list:`);
  }

  protected parseJsonFields(row: any, fields: string[]): any {
    if (!row) return row;
    const parsed = { ...row };
    for (const field of fields) {
      if (parsed[field] && typeof parsed[field] === "string") {
        try {
          parsed[field] = JSON.parse(parsed[field]);
        } catch {
          // leave as string
        }
      }
    }
    return parsed;
  }

  protected stringifyJsonFields(data: any, fields: string[]): any {
    const result = { ...data };
    for (const field of fields) {
      if (result[field] !== undefined && result[field] !== null) {
        result[field] = JSON.stringify(result[field]);
      }
    }
    return result;
  }

  abstract findById(id: string): Promise<T | null>;
  abstract findAll(): Promise<T[]>;
  abstract create(data: Omit<T, "id" | "created_at">): Promise<T>;
  abstract update(id: string, data: Partial<T>): Promise<T | null>;
  abstract delete(id: string): Promise<boolean>;
}
