import { NextRequest, NextResponse } from 'next/server';
import { getSsoConfig, exchangeCodeForTokens, loadSsoFromEnv } from '@/lib/sso';
import { createToken } from '@/lib/auth';
import { userRepo } from '@/lib/repositories';

// Ensure SSO configs are loaded from environment
loadSsoFromEnv();

/** Minimal JWT decode (base64url decode of the payload segment, no verification). */
function decodeIdToken(idToken: string): Record<string, unknown> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Invalid id_token format');
  const payload = parts[1];
  // base64url → base64
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const json = Buffer.from(base64, 'base64').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.json({ error: `IdP returned error: ${error}` }, { status: 400 });
  }

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state parameter' }, { status: 400 });
  }

  // Decode state to retrieve tenantId
  let tenantId: string;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    tenantId = decoded.tenantId as string;
    if (!tenantId) throw new Error('tenantId missing in state');
  } catch {
    return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
  }

  const config = getSsoConfig(tenantId);
  if (!config) {
    return NextResponse.json(
      { error: 'SSO not configured for this tenant' },
      { status: 404 }
    );
  }

  let claims: Record<string, unknown>;
  try {
    const tokens = await exchangeCodeForTokens(config, code);
    claims = decodeIdToken(tokens.idToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Token exchange failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // Extract user info from standard OIDC claims
  const email = (claims.email as string | undefined) ?? '';
  const name = (claims.name as string | undefined) ?? (claims.preferred_username as string | undefined) ?? email;
  const role = (claims.role as string | undefined) ?? 'agent';

  if (!email) {
    return NextResponse.json({ error: 'No email claim in id_token' }, { status: 400 });
  }

  // Look up or create the user in the DB
  let user = await userRepo.findByEmail(email, tenantId);
  if (!user) {
    user = await userRepo.create({
      tenant_id: tenantId,
      email,
      name,
      password: '', // SSO users have no local password
      role: role as 'agent' | 'admin' | 'viewer' | 'superadmin',
    });
  }

  const isSuperAdmin = user.role === 'superadmin';
  const token = await createToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenant_id,
    isSuperAdmin,
  });

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenant_id,
      isSuperAdmin,
    },
  });

  response.cookies.set({
    name: 'sierra_token',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  response.cookies.set({
    name: 'tenant',
    value: user.tenant_id,
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });

  return response;
}
