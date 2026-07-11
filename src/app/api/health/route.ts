import { NextResponse } from "next/server";
import { query, isPostgres } from "@/lib/db";
import { cache } from "@/lib/cache";
import { describeBackend } from "@/lib/providers/config";

// Deploy readiness / liveness probe. Reports the active backend provider
// and pings the database + cache. Public (no auth) so load balancers and
// container orchestrators (ECS/Cloud Run/K8s) can hit it.
export async function GET() {
  const backend = describeBackend();

  let dbOk = false;
  try {
    await query("SELECT 1");
    dbOk = true;
  } catch {
    dbOk = false;
  }

  let cacheStatus: { redis: boolean; memory: number };
  try {
    cacheStatus = await cache.status();
  } catch {
    cacheStatus = { redis: false, memory: 0 };
  }

  const healthy = dbOk;
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      provider: backend.provider,
      requested: backend.requested,
      database: { ...backend.database, engine: isPostgres() ? "postgres" : "sqlite", reachable: dbOk },
      cache: { ...backend.cache, redisConnected: cacheStatus.redis, memoryEntries: cacheStatus.memory },
    },
    { status: healthy ? 200 : 503 }
  );
}
