import type { OidcConfig, OidcTokens } from './types';

// SSO provider registry — loaded from environment / DB at startup
const ssoConfigs = new Map<string, OidcConfig>(); // keyed by tenantId

export function registerSsoConfig(tenantId: string, config: OidcConfig): void {
  ssoConfigs.set(tenantId, config);
}

export function getSsoConfig(tenantId: string): OidcConfig | null {
  return ssoConfigs.get(tenantId) ?? null;
}

export function buildAuthorizationUrl(config: OidcConfig, state: string): string {
  // In production, fetch the discovery URL to get the authorization_endpoint.
  // For now, compose it from common patterns.
  const baseUrl = config.discoveryUrl.replace('/.well-known/openid-configuration', '');
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
  });
  return `${baseUrl}/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  config: OidcConfig,
  code: string,
): Promise<OidcTokens> {
  const tokenUrl = config.discoveryUrl.replace('/.well-known/openid-configuration', '/oauth/token');
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }).toString(),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const data = await res.json();
  return {
    accessToken: data.access_token,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

// Load SSO configs from environment on startup
export function loadSsoFromEnv(): void {
  // Tenants can provide SSO via env vars:
  // SSO_<TENANT_ID>_CLIENT_ID, SSO_<TENANT_ID>_CLIENT_SECRET,
  // SSO_<TENANT_ID>_DISCOVERY_URL, SSO_<TENANT_ID>_REDIRECT_URI
  const tenantIds = ['r-mobile', 'ichiba', 'r-travel'];
  for (const tid of tenantIds) {
    const key = tid.toUpperCase().replace(/-/g, '_');
    const clientId = process.env[`SSO_${key}_CLIENT_ID`];
    const clientSecret = process.env[`SSO_${key}_CLIENT_SECRET`];
    const discoveryUrl = process.env[`SSO_${key}_DISCOVERY_URL`];
    const redirectUri = process.env[`SSO_${key}_REDIRECT_URI`];
    if (clientId && clientSecret && discoveryUrl && redirectUri) {
      registerSsoConfig(tid, { clientId, clientSecret, discoveryUrl, redirectUri, scopes: ['openid', 'email', 'profile'] });
    }
  }
}
