import { verifyToken, type TokenPayload } from './auth';
import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from './rbac';
import { apiKeyRepo } from './repositories/api-key';
import { checkApiKeyRateLimit } from './rate-limit/api-key-limiter';

export async function getAuthUser(req: NextRequest): Promise<TokenPayload | null> {
  const cookie = req.cookies.get('sierra_token')?.value;
  if (cookie) return verifyToken(cookie);

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // Try JWT first, then API key
    const jwtUser = await verifyToken(token);
    if (jwtUser) return jwtUser;

    // API key path (sk_... prefix)
    if (token.startsWith('sk_')) {
      const apiKey = await apiKeyRepo.verify(token).catch(() => null);
      if (!apiKey) return null;

      // Per-key rate limiting
      const rateLimit = checkApiKeyRateLimit(apiKey.id);
      if (!rateLimit.allowed) {
        // Signal rate limit exceeded via a special payload
        return {
          userId: apiKey.id,
          email: `apikey:${apiKey.key_prefix}`,
          role: 'api',
          tenantId: apiKey.tenant_id,
          rateLimitExceeded: true,
          rateLimitResetMs: rateLimit.resetMs,
        } as TokenPayload & { rateLimitExceeded: true; rateLimitResetMs: number };
      }

      // Map API key to a TokenPayload — role 'api' gets read+write permissions
      return {
        userId: apiKey.id,
        email: `apikey:${apiKey.key_prefix}`,
        role: 'api',
        tenantId: apiKey.tenant_id,
      } as TokenPayload;
    }
  }
  return null;
}

export async function requireAuth(
  req: NextRequest,
  resource: string,
  action: string,
): Promise<{ user: TokenPayload } | NextResponse> {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // API key rate limit exceeded
  const rateLimited = user as TokenPayload & { rateLimitExceeded?: boolean; rateLimitResetMs?: number };
  if (rateLimited.rateLimitExceeded) {
    return NextResponse.json(
      { error: 'Rate limit exceeded for this API key' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimited.rateLimitResetMs ?? 60_000) / 1000)),
          'X-RateLimit-Reset': String(Date.now() + (rateLimited.rateLimitResetMs ?? 60_000)),
        },
      }
    );
  }

  if (!hasPermission(user.role, resource, action)) {
    return NextResponse.json({ error: 'Forbidden', role: user.role, required: `${action}:${resource}` }, { status: 403 });
  }
  return { user };
}
