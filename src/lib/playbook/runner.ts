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

  // Build system prompt
  const baseSystemPrompt = buildSystemPrompt(playbook, context.knowledge)
  const toolInstructions = buildToolInstructions(playbook.actions)
  const systemPrompt = `${baseSystemPrompt}\n\n${toolInstructions}`

  // Build initial message history
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
        variables: context.variables,
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
        return {
          response: text,
          toolCalls,
          variables: context.variables,
          done: false,
          escalated: false,
          thinkingSteps,
        }
      }

      const { tool: toolName, input: toolInput } = toolCallData

      // escalate_to_human called as a tool is treated as escalation
      if (toolName === 'escalate_to_human') {
        const reason = (toolInput?.reason as string) ?? 'Agent requested escalation'
        return {
          response: `I'm transferring you to a human agent who can better assist you. Reason: ${reason}`,
          toolCalls,
          variables: context.variables,
          done: true,
          escalated: true,
          escalationReason: reason,
          thinkingSteps,
        }
      }

      // Execute the tool
      const callId = `call_${Date.now()}_${iterations}`
      let result: unknown
      try {
        result = await executeTool(toolName, toolInput as Record<string, unknown>)
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) }
      }

      const toolCall: PlaybookToolCall = {
        id: callId,
        name: toolName,
        input: toolInput,
        result,
      }
      toolCalls.push(toolCall)

      // Append the assistant's TOOL_CALL message and the tool result
      messages.push({ role: 'assistant', content: text })
      messages.push({
        role: 'user',
        content: `Tool result for ${toolName}:\n${JSON.stringify(result, null, 2)}`,
      })

      // Loop again with the tool result injected
      continue
    }

    // Normal text response — return it
    return {
      response: text,
      toolCalls,
      variables: context.variables,
      done: false,
      escalated: false,
      thinkingSteps,
    }
  }

  // Exceeded max iterations — return a safe fallback
  return {
    response: "I'm sorry, I wasn't able to fully resolve your request. Let me transfer you to a human agent for further assistance.",
    toolCalls,
    variables: context.variables,
    done: true,
    escalated: true,
    escalationReason: 'Exceeded maximum reasoning iterations',
    thinkingSteps,
  }
}
