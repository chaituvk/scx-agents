import { LRUCache } from "lru-cache";

let redis: any = null;
let redisAvailable = false;
let redisInitPromise: Promise<void> | null = null;

async function initRedis(): Promise<void> {
  if (redisInitPromise) return redisInitPromise;
  redisInitPromise = (async () => {
    try {
      const { Redis } = await import("ioredis");
      redis = new Redis({
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: parseInt(process.env.REDIS_PORT || "6379"),
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
      });
      redis.on("error", () => {}); // suppress connection errors
      await redis.connect().catch(() => {});
      redisAvailable = redis.status === "ready" || redis.status === "connecting";
      if (!redisAvailable) {
        redis.disconnect();
        redis = null;
      }
    } catch {
      redis = null;
      redisAvailable = false;
    }
  })();
  return redisInitPromise;
}

const memoryCache = new LRUCache<string, any>({
  max: 1000,
  ttl: 1000 * 60 * 5, // 5 minutes
  updateAgeOnGet: true,
  updateAgeOnHas: true,
});

export class Cache {
  private prefix: string;

  constructor(prefix: string = "sierra") {
    this.prefix = prefix;
  }

  private key(k: string): string {
    return `${this.prefix}:${k}`;
  }

  async get<T>(key: string): Promise<T | null> {
    await initRedis();
    const k = this.key(key);

    if (redisAvailable && redis) {
      try {
        const val = await redis.get(k);
        if (val) return JSON.parse(val);
      } catch {
        // fall through
      }
    }

    const mem = memoryCache.get(k);
    return mem ?? null;
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    await initRedis();
    const k = this.key(key);
    const serialized = JSON.stringify(value);

    memoryCache.set(k, value, { ttl: ttlSeconds * 1000 });

    if (redisAvailable && redis) {
      try {
        await redis.setex(k, ttlSeconds, serialized);
      } catch {
        // redis failed but memory cache has it
      }
    }
  }

  async del(key: string): Promise<void> {
    await initRedis();
    const k = this.key(key);
    memoryCache.delete(k);

    if (redisAvailable && redis) {
      try {
        await redis.del(k);
      } catch {
        // ignore
      }
    }
  }

  async delPattern(pattern: string): Promise<void> {
    await initRedis();
    const fullPattern = this.key(pattern);

    // Clear from memory cache
    for (const key of memoryCache.keys()) {
      if (key.startsWith(fullPattern) || key.includes(pattern)) {
        memoryCache.delete(key);
      }
    }

    if (redisAvailable && redis) {
      try {
        const keys = await redis.keys(`${fullPattern}*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } catch {
        // ignore
      }
    }
  }

  async flush(): Promise<void> {
    await initRedis();
    memoryCache.clear();

    if (redisAvailable && redis) {
      try {
        const keys = await redis.keys(`${this.prefix}:*`);
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } catch {
        // ignore
      }
    }
  }

  async status(): Promise<{ redis: boolean; memory: number }> {
    await initRedis();
    return {
      redis: redisAvailable,
      memory: memoryCache.size,
    };
  }
}

export const cache = new Cache("sierra");
