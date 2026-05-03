import { NextRequest, NextResponse } from "next/server";
import { agentRepo } from "@/lib/repositories";
import { getTenantFromRequest, getTenant } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const tenantId = await getTenantFromRequest(req);
  const tenant = await getTenant(tenantId);
  const agents = await agentRepo.findAll(tenantId);
  const agent = agents[0];

  if (!agent) {
    return NextResponse.json({
      agentName: tenant.name,
      welcomeMessage: tenant.welcomeMessage,
      logo: "",
      primaryColor: tenant.primaryColor,
      accentColor: tenant.accentColor,
      tone: tenant.tone,
      offLimitTopics: tenant.offLimitTopics,
      offLimitPhrases: tenant.offLimitPhrases,
      requireApproval: tenant.requireApproval,
      approvalThreshold: tenant.approvalThreshold,
    });
  }

  return NextResponse.json({
    agentName: agent.name,
    welcomeMessage: agent.welcome_message || tenant.welcomeMessage,
    logo: "",
    primaryColor: agent.primary_color || tenant.primaryColor,
    accentColor: agent.accent_color || tenant.accentColor,
    tone: agent.tone || tenant.tone,
    offLimitTopics: agent.off_limit_topics || tenant.offLimitTopics,
    offLimitPhrases: agent.off_limit_phrases || tenant.offLimitPhrases,
    requireApproval: !!(agent.require_approval ?? tenant.requireApproval),
    approvalThreshold: agent.approval_threshold || tenant.approvalThreshold,
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = await getTenantFromRequest(req);
    const agents = await agentRepo.findAll(tenantId);
    const agent = agents[0];
    if (!agent) {
      return NextResponse.json({ error: "No agent found for tenant" }, { status: 404 });
    }

    const updated = await agentRepo.update(agent.id, {
      name: body.agentName,
      welcome_message: body.welcomeMessage,
      primary_color: body.primaryColor,
      accent_color: body.accentColor,
      tone: body.tone,
      off_limit_topics: body.offLimitTopics,
      off_limit_phrases: body.offLimitPhrases,
      require_approval: body.requireApproval ? 1 : 0,
      approval_threshold: body.approvalThreshold,
    });
    if (!updated) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    return NextResponse.json({ success: true, agent: updated });
  } catch {
    return NextResponse.json({ error: "Failed to save config" }, { status: 400 });
  }
}
