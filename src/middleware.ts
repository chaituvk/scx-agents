import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/login",
  "/chat",
  "/widget-demo",
  "/widget-iframe",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/journeys",
  "/api/conversations",
  "/api/dialog/execute",
  "/api/dialog/stream",
  "/api/orchestrator",
  "/api/widget",
  "/api/health",
  "/api/ready",
  "/api/csat",
  "/api/channels/sms",
  "/api/channels/whatsapp",
  "/api/channels/email",
  "/api/v1/channels/sms",
  "/api/v1/channels/whatsapp",
  "/api/v1/channels/email",
  "/api/openapi",
  "/widget.js",
];

// ── In-memory rate limiter (sliding window per IP) ──────────────────
// Runs in the Edge runtime — no shared state across replicas in production.
// For multi-replica deployments, replace with a Redis-backed store (Upstash, etc.).
const RATE_WINDOWS = new Map<string, number[]>();
const RATE_LIMIT = 120;     // max requests
const RATE_WINDOW_MS = 60_000; // per 60 s window

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = RATE_WINDOWS.get(ip) ?? [];
  const trimmed = window.filter((t) => now - t < RATE_WINDOW_MS);
  trimmed.push(now);
  RATE_WINDOWS.set(ip, trimmed);
  // Prevent unbounded memory growth
  if (RATE_WINDOWS.size > 10_000) {
    const oldest = [...RATE_WINDOWS.keys()][0];
    RATE_WINDOWS.delete(oldest);
  }
  return trimmed.length > RATE_LIMIT;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets before any processing
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // Attach request ID to every response for distributed tracing
  const requestId = crypto.randomUUID();

  // Rate limiting for API routes
  if (pathname.startsWith("/api/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many requests", retry_after: 60 },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-Request-Id": requestId,
            "X-RateLimit-Limit": String(RATE_LIMIT),
            "X-RateLimit-Window": "60",
          },
        }
      );
    }
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const res = NextResponse.next();
    res.headers.set("X-Request-Id", requestId);
    return res;
  }

  const token = request.cookies.get("sierra_token")?.value;
  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "X-Request-Id": requestId } }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "X-Request-Id": requestId } }
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const res = NextResponse.next();
  res.headers.set("X-Request-Id", requestId);
  res.headers.set("X-Tenant-Id", payload.tenantId);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
