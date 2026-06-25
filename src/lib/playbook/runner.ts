// ReAct tool-calling loop for playbook agents.
// Uses text-based tool invocation compatible with any LLM.

import { callModel } from '../model-router'
import { executeTool, getToolDefinitions } from '../tools/registry'
import { buildSystemPrompt } from './builder'
import type { Playbook, PlaybookRunContext, PlaybookRunOutput, PlaybookToolCall } from './types'
import type { LLMMessage } from '../llm'

const MAX_ITERATIONS = 8

const TOOL_CALL_REGEX = /TOOL_CALL:\s*(\{[\s\S]*?\})/
const ESCALATE_REGEX = /ESCALATE:\s*(.+)/

/** Build the tool-use instruction block appended to the system prompt. */
function buildToolInstructions(allowedActions: string[]): string {
  const allDefs = getToolDefinitions()
  const relevant = allowedActions.length > 0
    ? allDefs.filter((d) => allowedActions.includes(d.name))
    : allDefs

  const toolList = relevant
    .map((d) => {
      const params = Object.entries(d.parameters)
        .map(([k, v]) => `  ${k} (${v.type}${v.required === false ? ', optional' : ''}): ${v.description}`)
        .join('\n')
      return `- ${d.name}: ${d.description}\n${params}`
    })
    .join('\n\n')

  return [
    '## Available tools',
    toolList || 'No tools available.',
    '',
    '## How to call tools',
    'When you need to use a tool, output EXACTLY:',
    'TOOL_CALL: {"tool": "<tool_name>", "input": {<parameters>}}',
    '',
    'When you need to escalate to a human agent, output EXACTLY:',
    'ESCALATE: <reason for escalation>',
    '',
    'Otherwise just respond naturally to the customer.',
  ].join('\n')
}

export async function runPlaybook(
  playbook: Playbook,
  context: PlaybookRunContext,
): Promise<PlaybookRunOutput> {
  const tier = playbook.model_tier ?? 'reasoning'
  const toolCalls: PlaybookToolCall[] = []
  const thinkingSteps: string[] = []

  // Mutable variable map — starts from persisted prior-turn variables,
  // updated in-loop by set_variable tool calls, returned at end so the
  // caller can persist the updated state.
  const variables: Record<string, string> = { ...context.variables }

  // Build system prompt — inject known variables so the LLM doesn't ask
  // for information it already has from a prior turn.
  const baseSystemPrompt = buildSystemPrompt(playbook, context.knowledge)
  const toolInstructions = buildToolInstructions(playbook.actions)
  const variableContext = Object.keys(variables).length > 0
    ? `\n\n## Already known from this conversation\n${Object.entries(variables).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`
    : ''
  const systemPrompt = `${baseSystemPrompt}${variableContext}\n\n${toolInstructions}`

  // Build message history — prior turns give the LLM full context of
  // where the conversation is without needing an explicit node pointer.
  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...context.history.map((h) => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
    { role: 'user', content: context.message },
  ]

  let iterations = 0

  while (iterations < MAX_ITERATIONS) {
    iterations++

    const response = await callModel(messages, { tier })
    const text = response.content.trim()

    thinkingSteps.push(`[iteration ${iterations}] ${text.slice(0, 200)}${text.length > 200 ? '...' : ''}`)

    // Check for escalation signal
    const escalateMatch = ESCALATE_REGEX.exec(text)
    if (escalateMatch) {
      const reason = escalateMatch[1].trim()
      return {
        response: `I'm transferring you to a human agent who can better assist you. Reason: ${reason}`,
        toolCalls,
        variables,
        done: true,
        escalated: true,
        escalationReason: reason,
        thinkingSteps,
      }
    }

    // Check for tool call signal
    const toolCallMatch = TOOL_CALL_REGEX.exec(text)
    if (toolCallMatch) {
      let toolCallData: { tool: string; input: Record<string, unknown> }
      try {
        toolCallData = JSON.parse(toolCallMatch[1])
      } catch {
        // Malformed JSON — treat as a regular response
        return { response: text, toolCalls, variables, done: false, escalated: false, thinkingSteps }
      }

      const { tool: toolName, input: toolInput } = toolCallData
      const callId = `call_${Date.now()}_${iterations}`

      // ── Intercepted tools (no external call) ──────────────────────

      if (toolName === 'escalate_to_human') {
        const reason = (toolInput?.reason as string) ?? 'Agent requested escalation'
        return {
          response: `I'm transferring you to a human agent who can better assist you. Reason: ${reason}`,
          toolCalls,
          variables,
          done: true,
          escalated: true,
          escalationReason: reason,
          thinkingSteps,
        }
      }

      if (toolName === 'set_variable') {
        const name = (toolInput?.name as string) ?? ''
        const value = String(toolInput?.value ?? '')
        if (name) variables[name] = value
        const result = { stored: true, name, value }
        toolCalls.push({ id: callId, name: toolName, input: toolInput, result })
        messages.push({ role: 'assistant', content: text })
        messages.push({ role: 'user', content: `Tool result for set_variable:\n${JSON.stringify(result)}` })
        continue
      }

      if (toolName === 'get_variable') {
        const name = (toolInput?.name as string) ?? ''
        const value = name ? (variables[name] ?? null) : null
        const result = { name, value, found: value !== null }
        toolCalls.push({ id: callId, name: toolName, input: toolInput, result })
        messages.push({ role: 'assistant', content: text })
        messages.push({ role: 'user', content: `Tool result for get_variable:\n${JSON.stringify(result)}` })
        continue
      }

      if (toolName === 'request_approval') {
        const reason = (toolInput?.reason as string) ?? 'Approval required'
        const action = (toolInput?.action as string) ?? 'unknown'
        toolCalls.push({ id: callId, name: toolName, input: toolInput, result: { status: 'pending' } })
        return {
          response: `This action requires supervisor approval before I can proceed. Reason: ${reason}`,
          toolCalls,
          variables,
          done: false,
          escalated: false,
          pendingApproval: { reason, action },
          thinkingSteps,
        }
      }

      // ── External tool call ─────────────────────────────────────────

      let result: unknown
      try {
        result = await executeTool(toolName, toolInput as Record<string, unknown>)
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) }
      }

      toolCalls.push({ id: callId, name: toolName, input: toolInput, result })
      messages.push({ role: 'assistant', content: text })
      messages.push({
        role: 'user',
        content: `Tool result for ${toolName}:\n${JSON.stringify(result, null, 2)}`,
      })
      continue
    }

    // Normal text response — conversation continues next turn
    return { response: text, toolCalls, variables, done: false, escalated: false, thinkingSteps }
  }

  // Exceeded max iterations
  return {
    response: "I'm sorry, I wasn't able to fully resolve your request. Let me transfer you to a human agent for further assistance.",
    toolCalls,
    variables,
    done: true,
    escalated: true,
    escalationReason: 'Exceeded maximum reasoning iterations',
    thinkingSteps,
  }
}
