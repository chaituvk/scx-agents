export interface OidcConfig {
  clientId: string;
  clientSecret: string;
  discoveryUrl: string; // e.g. https://accounts.google.com/.well-known/openid-configuration
  redirectUri: string;
  scopes: string[];
}

export interface SsoMapping {
  tenantId: string;
  provider: 'oidc' | 'saml';
  config: OidcConfig;
  claimMapping: {
    email: string; // claim name for email
    name: string;  // claim name for name
    role?: string; // claim name for role (optional)
  };
}

export interface OidcTokens {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresIn: number;
}
