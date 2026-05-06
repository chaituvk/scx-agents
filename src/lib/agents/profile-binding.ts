// Profile binding helpers for sub-agents (Stage 14).
//
// Stages 1-13 made the runtime profile system tenant-scoped, schema-
// validated, audit-emitting, and CRUD-able from /studio/profiles, but
// only the workflow-agent + escalation-agent paths actually evaluated
// profiles per turn (via the hybrid executor's checkRuntimeProfile).
// rag-agent / general-agent / tool-agent ran un-gated — meaning a
// tenant could author a specialist profile, see it listed in the
// studio, and yet have no effect on those three sub-agents.
//
// This module wires the binding cheaply: each sub-agent picks a
// specialist profile per turn (via the cached runtimeProfileRepo
// from Stage 12), applies guardrails to its system prompt, and the
// tool-agent additionally enforces allowed_tools. Failure modes:
//
//   triage.specialistId set, profile found       → applied, audited as allow
//   triage.specialistId set, profile not found   → fail-open + deny audit
//   triage.specialistId unset, default specialist found → applied, audited as allow
//   triage.specialistId unset, no specialist     → run un-gated (current behavior)

import { loadTenantRuntime } from "../runtime/tenant-runtime";
import type { RuntimeProfile } from "../runtime/profiles";
import type { AuditEmitter } from "./types";

/**
 * Resolve the runtime profile a sub-agent should run under for this turn.
 * Preference: explicit name from triage.specialistId > tenant's first
 * active specialist profile > null (un-gated).
 */
export async function loadSpecialistProfile(
  tenantId: string,
  preferredName?: string,
): Promise<RuntimeProfile | null> {
  const runtime = await loadTenantRuntime(tenantId);
  const specialists = runtime.profiles.filter(
    (p) => p.kind === "specialist" && p.status === "active",
  );
  if (preferredName) {
    const byName = specialists.find((p) => p.name === preferredName);
    if (byName) return byName;
  }
  return specialists[0] ?? null;
}

/**
 * Append the profile's guardrails to a base system prompt. No-op when
 * the profile is null or has no guardrails.
 */
export function applyGuardrailsToSystemPrompt(
  basePrompt: string,
  profile: RuntimeProfile | null,
): string {
  if (!profile?.guardrails || profile.guardrails.length === 0) return basePrompt;
  const block = profile.guardrails.map((g) => `- ${g}`).join("\n");
  return `${basePrompt}\n\nGuardrails (from runtime profile "${profile.name}"):\n${block}`;
}

/**
 * Audit the binding outcome so dashboards can see which sub-agent ran
 * under which profile, and which turns were un-gated. Emits a
 * policy_event with target=profile:<name> per Stage 1's payload shape.
 */
export async function auditProfileBinding(
  audit: AuditEmitter,
  subAgent: string,
  profile: RuntimeProfile | null,
  preferredName?: string,
): Promise<void> {
  if (profile) {
    await audit.emit("policy_event", {
      decision: "allow",
      target: `profile:${profile.name}`,
      subAgent,
      profile: profile.name,
    });
    return;
  }
  if (preferredName) {
    await audit.emit("policy_event", {
      decision: "deny",
      target: `profile:${preferredName}`,
      reason: "specialist profile not found for tenant; running un-gated",
      subAgent,
    });
  }
  // No preferred name + no default specialist → silent un-gated run
  // (current behavior pre-Stage 14). No audit emitted to avoid noise
  // for tenants that don't author specialist profiles at all.
}

/**
 * Check whether a tool name is permitted by the profile's allowed_tools
 * list. Empty / missing list = no restriction (fail-open). Returns
 * true when allowed, false when explicitly disallowed.
 */
export function isToolAllowedByProfile(
  profile: RuntimeProfile | null,
  toolName: string,
): boolean {
  if (!profile) return true;
  const allowed = profile.allowed_tools;
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  return allowed.includes(toolName);
}
