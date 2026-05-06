import { runtimeProfileRepo } from "@/lib/repositories";
import { executeTool } from "@/lib/tools/registry";
import { evaluateRuntimeProfile, type RuntimeDecision, type RuntimeProfile } from "./profiles";

export interface RuntimeToolMock {
  result: unknown;
}

export type RuntimeToolMocks = Record<string, unknown | RuntimeToolMock>;

export interface TenantRuntime {
  tenantId: string;
  profiles: RuntimeProfile[];
  toolMocks?: RuntimeToolMocks;
}

export async function loadTenantRuntime(tenantId: string): Promise<TenantRuntime> {
  const profiles = await runtimeProfileRepo.findActiveByTenant(tenantId);
  return {
    tenantId,
    profiles: profiles.map((profile) => ({
      id: profile.id,
      tenant_id: profile.tenant_id,
      name: profile.name,
      kind: profile.kind || "specialist",
      status: profile.status || "active",
      description: profile.description || "",
      allowed_journeys: profile.allowed_journeys || [],
      allowed_tools: profile.allowed_tools || [],
      allowed_slots: profile.allowed_slots || [],
      guardrails: profile.guardrails || [],
      policies: profile.policies || [],
      config: profile.config || {},
    })),
  };
}

export function findRuntimeProfile(runtime: TenantRuntime, profileIdOrName: string): RuntimeProfile | null {
  return runtime.profiles.find((profile) => {
    const sameProfile = profile.id === profileIdOrName || profile.name === profileIdOrName;
    return sameProfile && profile.tenant_id === runtime.tenantId;
  }) || null;
}

export function checkRuntimeProfile(
  runtime: TenantRuntime,
  profileIdOrName: string,
  request: {
    journeyId?: string;
    toolName?: string;
    slotWrites?: string[];
    variables?: Record<string, unknown>;
  }
): RuntimeDecision {
  const profile = findRuntimeProfile(runtime, profileIdOrName);
  if (!profile) {
    return { allowed: false, effect: "deny", reason: `Runtime profile "${profileIdOrName}" was not found` };
  }
  return evaluateRuntimeProfile(profile, request);
}

function cloneMockResult(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value));
}

export function withRuntimeOverrides(
  runtime: TenantRuntime,
  overrides: { toolMocks?: RuntimeToolMocks }
): TenantRuntime {
  return {
    ...runtime,
    toolMocks: {
      ...(runtime.toolMocks || {}),
      ...(overrides.toolMocks || {}),
    },
  };
}

export async function executeProfileTool(
  runtime: TenantRuntime,
  profileIdOrName: string,
  toolName: string,
  params: Record<string, unknown>,
  variables: Record<string, unknown> = {}
): Promise<{ decision: RuntimeDecision; result?: unknown }> {
  const decision = checkRuntimeProfile(runtime, profileIdOrName, {
    toolName,
    variables: { ...variables, ...params },
  });

  if (!decision.allowed) {
    return { decision };
  }

  const mocked = runtime.toolMocks?.[toolName];
  if (mocked !== undefined) {
    if (mocked && typeof mocked === "object" && "result" in mocked) {
      return { decision, result: cloneMockResult((mocked as RuntimeToolMock).result) };
    }
    return { decision, result: cloneMockResult(mocked) };
  }

  const result = await executeTool(toolName, params);
  return { decision, result };
}
