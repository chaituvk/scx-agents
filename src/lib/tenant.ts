import { cookies, headers } from "next/headers";
import { NextRequest } from "next/server";
import { verifyToken } from "./auth";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  accentColor: string;
  logo?: string;
  welcomeMessage: string;
  tone: string;
  offLimitTopics: string[];
  offLimitPhrases: string[];
  requireApproval: boolean;
  approvalThreshold: number;
}

export const TENANTS: Record<string, Tenant> = {
  "r-mobile": {
    id: "r-mobile",
    name: "R-Mobile",
    slug: "r-mobile",
    primaryColor: "#ef4444",
    accentColor: "#1e293b",
    welcomeMessage: "Welcome to R-Mobile! How can we help with your device or plan today?",
    tone: "professional",
    offLimitTopics: ["Competitor pricing", "Unlocking devices", "Third-party repairs"],
    offLimitPhrases: ["I don't know", "That's not my department", "Call back later"],
    requireApproval: true,
    approvalThreshold: 300,
  },
  ichiba: {
    id: "ichiba",
    name: "Ichiba",
    slug: "ichiba",
    primaryColor: "#f97316",
    accentColor: "#0f172a",
    welcomeMessage: "Konnichiwa! Welcome to Ichiba. What can we help you find today?",
    tone: "empathetic",
    offLimitTopics: ["Counterfeit items", "Illegal goods", "Tax evasion"],
    offLimitPhrases: ["Not my problem", "Figure it out yourself", "I am busy"],
    requireApproval: true,
    approvalThreshold: 500,
  },
  "r-travel": {
    id: "r-travel",
    name: "RTravel",
    slug: "r-travel",
    primaryColor: "#06b6d4",
    accentColor: "#0f172a",
    welcomeMessage: "Hello traveler! Ready to plan your next adventure?",
    tone: "enthusiastic",
    offLimitTopics: ["Visa fraud", "Illegal destinations", "Travel insurance scams"],
    offLimitPhrases: ["I don't care", "That's your fault", "Nothing I can do"],
    requireApproval: true,
    approvalThreshold: 1000,
  },
};

export async function getTenantId(): Promise<string> {
  try {
    const h = await headers();
    const tenantHeader = h.get("x-tenant-id");
    if (tenantHeader && TENANTS[tenantHeader]) return tenantHeader;

    const c = await cookies();
    const tenantCookie = c.get("tenant")?.value;
    if (tenantCookie && TENANTS[tenantCookie]) return tenantCookie;
  } catch {
    // headers()/cookies() throws in non-RSC contexts
  }
  return "r-mobile"; // default tenant
}

export async function getTenantFromRequest(req: NextRequest): Promise<string> {
  // 1. Try auth token first (most secure)
  const token = req.cookies.get("sierra_token")?.value;
  let isSuperAdmin = false;
  let authTenantId = "r-mobile";

  if (token) {
    const payload = await verifyToken(token);
    if (payload?.tenantId && TENANTS[payload.tenantId]) {
      authTenantId = payload.tenantId;
      isSuperAdmin = payload.isSuperAdmin || false;
    }
  }

  // 2. If superadmin, allow overriding tenant via view_tenant cookie/header
  if (isSuperAdmin) {
    const viewTenantHeader = req.headers.get("x-view-tenant");
    if (viewTenantHeader && TENANTS[viewTenantHeader]) return viewTenantHeader;

    const viewTenantCookie = req.cookies.get("view_tenant")?.value;
    if (viewTenantCookie && TENANTS[viewTenantCookie]) return viewTenantCookie;
  }

  // 3. Try header for unauthenticated routes
  const tenantHeader = req.headers.get("x-tenant-id");
  if (tenantHeader && TENANTS[tenantHeader]) return tenantHeader;

  // 4. Try cookie
  const tenantCookie = req.cookies.get("tenant")?.value;
  if (tenantCookie && TENANTS[tenantCookie]) return tenantCookie;

  return authTenantId;
}

export async function getTenant(id?: string): Promise<Tenant> {
  const tenantId = id || await getTenantId();
  return TENANTS[tenantId] || TENANTS["r-mobile"];
}

export function getTenantFromSlug(slug: string): Tenant | null {
  for (const t of Object.values(TENANTS)) {
    if (t.slug === slug) return t;
  }
  return null;
}

export function listTenants(): Tenant[] {
  return Object.values(TENANTS);
}
