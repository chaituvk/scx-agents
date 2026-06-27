// Per-API-key rate limiting — sliding window, in-memory.
// Complements the IP-based rate limiter in middleware.ts.
// For multi-replica: replace with Redis INCR + EXPIRE.

const WINDOWS = new Map<string, number[]>(); // keyId → timestamps[]

// Default limits — override per-key via api_keys.metadata (future)
const DEFAULT_LIMIT = 300;   // requests
const WINDOW_MS = 60_000;    // per 60 seconds

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

export function checkApiKeyRateLimit(
  keyId: string,
  limit = DEFAULT_LIMIT,
): RateLimitResult {
  const now = Date.now();
  const window = WINDOWS.get(keyId) ?? [];
  const trimmed = window.filter(t => now - t < WINDOW_MS);
  trimmed.push(now);

  // Prevent unbounded memory growth
  if (WINDOWS.size > 50_000) {
    const oldest = [...WINDOWS.keys()][0];
    WINDOWS.delete(oldest);
  }
  WINDOWS.set(keyId, trimmed);

  const allowed = trimmed.length <= limit;
  const oldest = trimmed[0] ?? now;
  const resetMs = oldest + WINDOW_MS - now;

  return {
    allowed,
    remaining: Math.max(0, limit - trimmed.length),
    resetMs,
  };
}
