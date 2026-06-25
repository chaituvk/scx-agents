// PlaybookAgent — Sierra AI-inspired playbook-driven sub-agent.
//
// Loads an active Playbook for the tenant, runs the ReAct loop via
// runPlaybook(), and maps the output to SubAgentRunOutput.

import { runPlaybook } from '../playbook'
import type { Playbook, PlaybookRunContext } from '../playbook'
import type {
  SubAgent,
  SubAgentRunInput,
  SubAgentRunOutput,
  SkillContext,
  TriageOutput,
} from './types'

// ── Playbook loading ─────────────────────────────────────────────────

// The repo's Playbook type has slightly looser types (policies: object[],
// model_tier?: string), so we cast to our Playbook type after loading.
async function loadPlaybook(
  tenantId: string,
  triage: TriageOutput & { playbookId?: string },
): Promise<Playbook | null> {
  let playbook: Playbook | null = null
  try {
    const { playbookRepo } = await import('../repositories/playbook')
    if (triage.playbookId) {
      const found = await playbookRepo.findById(triage.playbookId)
      if (found) playbook = found as unknown as Playbook
    }
    if (!playbook) {
      const all = await playbookRepo.findAll(tenantId)
      const active = all.find((p) => p.status === 'active')
      if (active) playbook = active as unknown as Playbook
    }
  } catch {
    // repo not ready yet
  }
  return playbook
}

// ── Agent ────────────────────────────────────────────────────────────

export const playbookAgent: SubAgent = {
  // Cast needed because SubAgentName union doesn't yet include "playbook"
  name: 'playbook' as SubAgent['name'],

  canHandle(triage: TriageOutput): boolean {
    return (triage.subAgent as string) === 'playbook'
  },

  async run(input: SubAgentRunInput, ctx: SkillContext): Promise<SubAgentRunOutput> {
    // Load the playbook
    const triage = input.triage as TriageOutput & { playbookId?: string }
    const playbook = await loadPlaybook(ctx.tenantId, triage)

    if (!playbook) {
      return {
        response:
          "I'm sorry, I don't have a playbook configured for this topic yet. Let me connect you with a human agent.",
        variables: input.variables,
        done: true,
        actions: [
          {
            type: 'transfer',
            payload: { reason: 'No active playbook found for tenant' },
          },
        ],
      }
    }

    // Build the run context from SubAgentRunInput + SkillContext
    const knowledge = input.context.knowledge.map((k) => ({
      title: k.title,
      content: k.content,
      source: k.source,
    }))

    const history = input.context.history.map((h) => ({
      role: h.role,
      content: h.content,
    }))

    const runContext: PlaybookRunContext = {
      conversationId: ctx.conversationId,
      tenantId: ctx.tenantId,
      customerId: input.context.profile?.id,
      message: input.message,
      history,
      knowledge,
      variables: input.variables,
    }

    // Run the ReAct loop
    const output = await runPlaybook(playbook, runContext)

    // Emit audit events for each tool call
    for (const tc of output.toolCalls) {
      await ctx.audit.emit('tool_call', {
        tool: tc.name,
        input: tc.input,
        result: tc.result,
        callId: tc.id,
        playbookId: playbook.id,
      })
    }

    // Build actions list
    const actions: SubAgentRunOutput['actions'] = []
    if (output.escalated) {
      await ctx.audit.emit('escalation_handoff', {
        reason: output.escalationReason ?? 'Playbook escalation',
        playbookId: playbook.id,
        conversationId: ctx.conversationId,
        tenantId: ctx.tenantId,
      })
      actions.push({
        type: 'transfer',
        payload: { reason: output.escalationReason ?? 'Playbook escalation' },
      })
    }

    // Map tool calls to the SubAgentRunOutput shape
    const toolCalls = output.toolCalls.map((tc) => ({
      tool: tc.name,
      params: tc.input,
      result: tc.result,
    }))

    return {
      response: output.response,
      variables: output.variables,
      done: output.done,
      actions,
      toolCalls,
    }
  },
}
