import { NextRequest, NextResponse } from 'next/server';
import { getSsoConfig, buildAuthorizationUrl, loadSsoFromEnv } from '@/lib/sso';
import { TENANTS } from '@/lib/tenant';

// Ensure SSO configs are loaded from environment
loadSsoFromEnv();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;

  // Validate the tenant exists
  if (!TENANTS[tenantId]) {
    return NextResponse.json({ error: 'Unknown tenant' }, { status: 404 });
  }

  const config = getSsoConfig(tenantId);
  if (!config) {
    return NextResponse.json(
      { error: 'SSO not configured for this tenant' },
      { status: 404 }
    );
  }

  // Generate a state value for CSRF protection (encode tenantId so callback can look it up)
  const state = Buffer.from(JSON.stringify({ tenantId, nonce: crypto.randomUUID() })).toString('base64url');

  const authUrl = buildAuthorizationUrl(config, state);

  // Clients can pass ?redirect=false to receive the URL as JSON instead of a redirect
  const redirect = req.nextUrl.searchParams.get('redirect');
  if (redirect === 'false') {
    return NextResponse.json({ authorizationUrl: authUrl, state });
  }

  return NextResponse.redirect(authUrl);
}
