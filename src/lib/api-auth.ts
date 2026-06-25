import { verifyToken, type TokenPayload } from './auth';
import { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from './rbac';

export async function getAuthUser(req: NextRequest): Promise<TokenPayload | null> {
  const cookie = req.cookies.get('sierra_token')?.value;
  if (cookie) return verifyToken(cookie);

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return verifyToken(token);
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
  if (!hasPermission(user.role, resource, action)) {
    return NextResponse.json({ error: 'Forbidden', role: user.role, required: `${action}:${resource}` }, { status: 403 });
  }
  return { user };
}
