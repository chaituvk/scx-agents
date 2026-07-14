import { SignJWT, jwtVerify } from "jose";

const DEV_FALLBACK_SECRET = "sierra-super-secret-key-2026-change-in-production";

let cachedSecret: Uint8Array | null = null;

// Resolved lazily (on first sign/verify), not at import time, so a build
// step that imports this module without JWT_SECRET set does not fail.
function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim()) {
    cachedSecret = new TextEncoder().encode(secret);
    return cachedSecret;
  }
  // Never sign tokens with the published fallback outside development —
  // it would let anyone forge a superadmin session.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET is required in production. Set it to a strong random value " +
        "(e.g. `openssl rand -base64 48`)."
    );
  }
  console.warn("[auth] JWT_SECRET not set — using an insecure dev fallback. Do NOT use in production.");
  cachedSecret = new TextEncoder().encode(DEV_FALLBACK_SECRET);
  return cachedSecret;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
  isSuperAdmin: boolean;
}

export async function createToken(payload: TokenPayload) {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { clockTolerance: 60 });
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}
