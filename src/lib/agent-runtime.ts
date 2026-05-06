import { chat } from "./llm";
import { retrieveKnowledge, type KnowledgeDoc } from "./rag";
import { getToolDescriptions, executeTool } from "./tools/registry";
import type { Message } from "./repositories/message";

export interface AgentConfig {
  name: string;
  goals: string[];
  guardrails: string[];
  skills: string[];
  tone?: string;
  welcome_message?: string;
  off_limit_topics?: string[];
  off_limit_phrases?: string[];
  approval_threshold?: number;
}

export interface AgentContext {
  conversationId: string;
  /** Required since Stage 8 — RAG retrieval is tenant-scoped. */
  tenantId: string;
  customerName?: string;
  customerEmail?: string;
  variables: Record<string, string>;
  history: Message[];
}

export interface AgentStep {
  response: string;
  toolCalls?: Array<{ tool: string; params: Record<string, any>; result: any }>;
  knowledgeUsed?: KnowledgeDoc[];
  guardrailTriggered?: string;
  variables?: Record<string, string>;
  done: boolean;
  actions: Array<{ type: string; payload: Record<string, unknown> }>;
}

function buildSystemPrompt(config: AgentConfig, toolsDesc: string): string {
  const guardrails = config.guardrails?.length
    ? config.guardrails.map((g) => `- ${g}`).join("\n")
    : "- Be helpful and professional";

  const offLimits = config.off_limit_phrases?.length
    ? config.off_limit_phrases.map((p) => `- NEVER say: "${p}"`).join("\n")
    : "";

  const topics = config.off_limit_topics?.length
    ? config.off_limit_topics.map((t) => `- NEVER discuss: ${t}`).join("\n")
    : "";

  return `You are ${config.name}, an AI customer support agent.

YOUR GOALS:
${config.goals?.map((g) => `- ${g}`).join("\n") || "- Resolve customer issues efficiently"}

YOUR GUARDRAILS:
${guardrails}
${offLimits ? "\nFORBIDDEN PHRASES:\n" + offLimits : ""}
${topics ? "\nFORBIDDEN TOPICS:\n" + topics : ""}

TONE: ${config.tone || "empathetic and professional"}

AVAILABLE TOOLS:
${toolsDesc}

TOOL USE FORMAT:
When you need to use a tool, output JSON in this exact format on its own line:
TOOL_CALL: {"tool": "tool_name", "params": {"param1": "value1"}}

You may use multiple tools in sequence. After each tool result, continue the conversation naturally.

KNOWLEDGE GROUNDING:
Ground your responses in the provided knowledge context. If you don't know something, use search_knowledge or admit you don't know — never make up information.

VARIABLE TRACKING:
Track important information in variables. When you learn something, output:
SET_VAR: {"name": "variable_name", "value": "value"}

Keep responses concise (2-3 sentences max). Always close by asking if there's anything else you can help with.`;
}

export async function runAgentStep(
  config: AgentConfig,
  context: AgentContext,
  userMessage: string
): Promise<AgentStep> {
  // 1. Retrieve relevant knowledge (tenant-scoped; Stage 8)
  const knowledge = await retrieveKnowledge(userMessage, 3, context.tenantId);
  const knowledgeContext = knowledge.length
    ? `RELEVANT KNOWLEDGE:\n${knowledge.map((k) => `[${k.source}] ${k.title}: ${k.content}`).join("\n")}\n\n`
    : "";

  // 2. Build conversation history
  const recentMessages = context.history.slice(-10);
  const historyContext = recentMessages
    .map((m) => `${m.role === "user" ? "Customer" : "Agent"}: ${m.content}`)
    .join("\n");

  // 3. Build variables context
  const varsContext = Object.keys(context.variables).length
    ? `KNOWN VARIABLES:\n${Object.entries(context.variables).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\n`
    : "";

  // 4. Build tool descriptions
  const toolsDesc = getToolDescriptions(config.skills || []);

  // 5. Call LLM
  const systemPrompt = buildSystemPrompt(config, toolsDesc);
  const userPrompt = `${knowledgeContext}${varsContext}CONVERSATION HISTORY:\n${historyContext}\n\nCustomer: ${userMessage}\n\nAgent:`;

  const llmResponse = await chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  let content = llmResponse.content;

  // Graceful fallback if no LLM provider available
  if (llmResponse.model === "mock" || content.startsWith('{"error"')) {
    const hasRefund = userMessage.toLowerCase().includes("return") || userMessage.toLowerCase().includes("refund");
    const hasShipping = userMessage.toLowerCase().includes("ship") || userMessage.toLowerCase().includes("deliver");
    const hasOrder = userMessage.toLowerCase().includes("order");

    if (hasRefund) {
      content = "I understand you'd like to return an item. To help you with that, I'll need your order number. Can you provide that?";
    } else if (hasShipping) {
      content = "I can help you track your shipment. Could you provide your order number or tracking ID?";
    } else if (hasOrder) {
      content = "I'd be happy to help with your order. What specifically do you need assistance with?";
    } else {
      content = "I'm here to help. Could you tell me more about what you need assistance with today?";
    }
  }

  // 6. Parse tool calls
  const toolCalls: Array<{ tool: string; params: Record<string, any>; result: any }> = [];
  const toolCallRegex = /TOOL_CALL:\s*(\{[^}]+\})/g;
  let match;
  while ((match = toolCallRegex.exec(content)) !== null) {
    try {
      const call = JSON.parse(match[1]);
      if (config.skills?.includes(call.tool)) {
        const result = await executeTool(call.tool, call.params);
        toolCalls.push({ tool: call.tool, params: call.params, result });

        // Inject tool result back into content for display
        content = content.replace(match[0], `[Used ${call.tool}: ${JSON.stringify(result)}]`);
      }
    } catch {
      // invalid tool call, ignore
    }
  }

  // 7. Parse variable sets
  const newVars: Record<string, string> = { ...context.variables };
  const setVarRegex = /SET_VAR:\s*(\{[^}]+\})/g;
  while ((match = setVarRegex.exec(content)) !== null) {
    try {
      const v = JSON.parse(match[1]);
      if (v.name && v.value !== undefined) {
        newVars[v.name] = String(v.value);
      }
      content = content.replace(match[0], "");
    } catch {
      // ignore
    }
  }

  // 8. Check guardrails
  let guardrailTriggered: string | undefined;
  for (const phrase of config.off_limit_phrases || []) {
    if (content.toLowerCase().includes(phrase.toLowerCase())) {
      guardrailTriggered = `Off-limit phrase detected: "${phrase}"`;
      content = `I apologize, but I'm not able to respond that way. Let me help you with your request.`;
      break;
    }
  }

  // 9. Check for escalation triggers
  const actions: Array<{ type: string; payload: Record<string, unknown> }> = [];
  if (content.toLowerCase().includes("transfer") || content.toLowerCase().includes("human agent") || content.toLowerCase().includes("manager")) {
    actions.push({ type: "transfer", payload: { reason: "Agent-initiated escalation" } });
  }

  // Clean up response
  content = content.replace(/\[Used [^\]]+\]/g, "").trim();
  if (!content) {
    content = "I'm here to help. What can I do for you?";
  }

  return {
    response: content,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    knowledgeUsed: knowledge.length > 0 ? knowledge : undefined,
    guardrailTriggered,
    variables: newVars,
    done: false,
    actions,
  };
}

export async function runAgentWelcome(config: AgentConfig): Promise<string> {
  if (config.welcome_message) return config.welcome_message;

  const systemPrompt = buildSystemPrompt(config, getToolDescriptions(config.skills || []));
  const response = await chat([
    { role: "system", content: systemPrompt },
    { role: "user", content: "Generate a brief, friendly welcome message for a customer support conversation." },
  ]);

  return response.content.trim() || "Hello! How can I help you today?";
}
