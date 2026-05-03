import { SignJWT, jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "sierra-super-secret-key-2026-change-in-production"
);

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
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { clockTolerance: 60 });
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}
