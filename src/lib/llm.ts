// LLM abstraction supporting OpenAI, Anthropic, and local Ollama
//
// Set USE_MOCK_LLM=true in .env.local to get scripted responses for
// local testing without any API keys.

// ── Scripted mock (USE_MOCK_LLM=true) ──────────────────────────────
function callMock(messages: LLMMessage[]): LLMResponse {
  const sys = messages.find((m) => m.role === "system")?.content || "";
  const userMsgs = messages.filter((m) => m.role === "user");
  const lastUser = userMsgs[userMsgs.length - 1]?.content?.toLowerCase() || "";
  const turnCount = messages.filter((m) => m.role === "assistant").length;

  // Triage: respond with JSON classification
  if (sys.includes("triage classifier") || sys.includes("sub-agent")) {
    const isReturn = /return|refund|wrong item|exchange/i.test(lastUser);
    const isKyc = /kyc|verify|verification|identity|account activation/i.test(lastUser);
    const isSupport = /help|issue|problem|not working|broken|setup/i.test(lastUser);
    const isEscalate = /human|manager|agent|representative/i.test(lastUser);
    if (isEscalate) return { content: JSON.stringify({ intent: "escalate", subAgent: "escalation", confidence: 0.95, rationale: "explicit escalation request" }), model: "mock" };
    if (isReturn) return { content: JSON.stringify({ intent: "workflow", subAgent: "playbook", confidence: 0.9, rationale: "return/refund intent detected" }), model: "mock" };
    if (isKyc) return { content: JSON.stringify({ intent: "workflow", subAgent: "playbook", confidence: 0.9, rationale: "KYC intent detected" }), model: "mock" };
    if (isSupport) return { content: JSON.stringify({ intent: "workflow", subAgent: "playbook", confidence: 0.85, rationale: "product support intent" }), model: "mock" };
    return { content: JSON.stringify({ intent: "general_chat", subAgent: "general", confidence: 0.7, rationale: "general conversation" }), model: "mock" };
  }

  // Sentiment classification
  if (sys.includes("Classify customer message sentiment")) {
    const score = /thank|great|good|love|happy|yes|please/i.test(lastUser) ? "positive"
      : /angry|terrible|awful|hate|frustrated|worst/i.test(lastUser) ? "negative" : "neutral";
    return { content: JSON.stringify({ score, confidence: 0.75, signals: [] }), model: "mock" };
  }

  // Supervisor judge — "You are a response supervisor. Score the agent reply..."
  if (sys.includes("response supervisor")) {
    return { content: JSON.stringify({ grounded: true, on_topic: true, tone_ok: true, issues: [] }), model: "mock" };
  }

  // Supervisor rewrite — "You rewrite an agent reply to fix a specific supervisor-flagged issue."
  if (sys.includes("You rewrite an agent reply")) {
    const origMatch = lastUser.match(/ORIGINAL REPLY:\n([\s\S]+?)\n\nREWRITTEN/);
    return { content: origMatch?.[1]?.trim() || "I'm here to help! Could you tell me more about your issue?", model: "mock" };
  }

  // Playbook ReAct loop
  if (sys.includes("TOOL_CALL") || sys.includes("ESCALATE") || sys.includes("persona") || sys.includes("Instructions:")) {
    // Extract persona name from system prompt
    const nameMatch = sys.match(/You are (\w+)/);
    const agentName = nameMatch?.[1] || "the agent";

    // Simulate progressing through the playbook based on turn count and message content
    const hasOrderNum = /\d{4,}/.test(lastUser);
    const hasName = /my name is|i am|i'm/i.test(lastUser);
    const hasEmail = /@/.test(lastUser);
    const hasDob = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}/.test(lastUser) && /born|birth|dob/i.test(lastUser);

    if (sys.includes("return") || sys.includes("refund")) {
      if (turnCount === 0) {
        return { content: `Hi there! I'm ${agentName}, and I'm here to help with your return. I'm sorry to hear you received the wrong item — let's get that sorted right away!\n\nCould you please provide me with your **order number**?`, model: "mock" };
      }
      if (hasOrderNum || turnCount === 1) {
        return { content: `Thank you! I can see your order. Since you received the wrong item, you're absolutely entitled to a full return.\n\nWould you prefer:\n1. **Full refund** to your original payment method (5–7 business days)\n2. **Store credit** (applied instantly)\n\nWhich would you like?`, model: "mock" };
      }
      if (/refund|original|card|payment/i.test(lastUser)) {
        return { content: `TOOL_CALL: {"name": "create_return_label", "args": {"reason": "wrong_item", "refund_method": "original_payment"}}`, model: "mock" };
      }
      if (/credit|store/i.test(lastUser)) {
        return { content: `TOOL_CALL: {"name": "create_return_label", "args": {"reason": "wrong_item", "refund_method": "store_credit"}}`, model: "mock" };
      }
      return { content: `Your return has been processed! You'll receive a prepaid shipping label by email within the next few minutes. Your refund will be processed once we receive the item back.\n\nYour case reference is **REF-2026-78432**. Is there anything else I can help you with?`, model: "mock" };
    }

    if (sys.includes("KYC") || sys.includes("identity") || sys.includes("verification")) {
      if (turnCount === 0) {
        return { content: `Welcome! I'm ${agentName}. To activate your account, I'll need to complete a quick identity verification — this usually takes just a few minutes.\n\nCould you please provide your **full legal name** as it appears on your ID?`, model: "mock" };
      }
      if (hasName || turnCount === 1) {
        return { content: `Thank you! Now I'll need your **date of birth** (DD/MM/YYYY).`, model: "mock" };
      }
      if (hasDob || turnCount === 2) {
        return { content: `Great. Which type of ID do you have available?\n- **Passport**\n- **Driver's licence**\n- **National ID card**`, model: "mock" };
      }
      if (/passport|licence|license|national|id/i.test(lastUser) || turnCount === 3) {
        return { content: `TOOL_CALL: {"name": "generate_upload_link", "args": {"id_type": "passport"}}`, model: "mock" };
      }
      return { content: `Thank you for uploading your documents. I've submitted them for review.\n\nYou'll receive an email within **24 hours** with the result. Your data is encrypted and handled in full compliance with data protection regulations.\n\nIs there anything else I can help you with today?`, model: "mock" };
    }

    if (sys.includes("product") || sys.includes("support") || sys.includes("troubleshoot")) {
      if (turnCount === 0) {
        return { content: `Hi! I'm ${agentName}. I'd be happy to help you out.\n\nWhich product are you having issues with, and what seems to be the problem?`, model: "mock" };
      }
      if (turnCount === 1) {
        return { content: `Got it, thanks for the details. A few quick things to try:\n\n1. **Restart the device** and check if the issue persists\n2. **Check for firmware/software updates** in the settings menu\n3. **Reset to factory defaults** (hold the reset button for 10 seconds)\n\nDid any of those resolve the issue?`, model: "mock" };
      }
      if (/no|still|not working|doesn't|doesn't/i.test(lastUser)) {
        return { content: `I'm sorry to hear that didn't work. Since this sounds like a hardware defect and your purchase is within the 1-year warranty period, I can open a **warranty claim** for you.\n\nWould you like me to do that?`, model: "mock" };
      }
      if (/yes|please|sure|ok/i.test(lastUser)) {
        return { content: `TOOL_CALL: {"name": "create_warranty_claim", "args": {"issue": "hardware_defect", "resolution": "replacement"}}`, model: "mock" };
      }
      return { content: `Your warranty claim has been opened — reference **WC-2026-45521**. Our team will contact you within 2 business days to arrange a replacement.\n\nIs there anything else I can help you with?`, model: "mock" };
    }

    // Generic playbook fallback
    return { content: `I'm here to help! Could you provide a bit more detail so I can assist you better?`, model: "mock" };
  }

  // Generic fallback
  return { content: "Hello! I'm here to help. What can I do for you today?", model: "mock" };
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
}

// Model tier: fast (cheap), balanced (default), reasoning (complex tasks)
export type ModelTier = "fast" | "balanced" | "reasoning";

// Per-provider model selection per tier
const TIER_MODELS = {
  anthropic: {
    fast: "claude-haiku-4-5-20251001",
    balanced: "claude-sonnet-4-6",
    reasoning: "claude-opus-4-8",
  },
  openai: {
    fast: "gpt-4o-mini",
    balanced: "gpt-4o",
    reasoning: "gpt-4o",
  },
  openrouter: {
    fast: process.env.OPENROUTER_FAST_MODEL || "anthropic/claude-haiku-4-5",
    balanced: process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b",
    reasoning: process.env.OPENROUTER_REASONING_MODEL || "anthropic/claude-opus-4-8",
  },
} as const;

async function callOpenRouter(messages: LLMMessage[], tier: ModelTier = "balanced"): Promise<LLMResponse | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const model = TIER_MODELS.openrouter[tier];
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_REFERER || "http://localhost:3000",
      "X-Title": "Sierra AI",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: tier === "fast" ? 1500 : 4000,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    model: data.model,
    usage: data.usage
      ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens }
      : undefined,
  };
}

async function callOpenAI(messages: LLMMessage[], tier: ModelTier = "balanced"): Promise<LLMResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = TIER_MODELS.openai[tier];
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: tier === "fast" ? 1500 : 4000,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "",
    model: data.model,
    usage: data.usage
      ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens }
      : undefined,
  };
}

async function callAnthropic(messages: LLMMessage[], tier: ModelTier = "balanced"): Promise<LLMResponse | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const systemMsg = messages.find((m) => m.role === "system")?.content || "";
  const userMsgs = messages.filter((m) => m.role !== "system");

  const model = process.env.ANTHROPIC_MODEL || TIER_MODELS.anthropic[tier];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: tier === "fast" ? 1500 : 4000,
      system: systemMsg,
      messages: userMsgs.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    // Surface error details so callers can distinguish rate-limit vs auth vs model errors
    const err = await res.json().catch(() => ({}));
    console.error("[Anthropic] API error", res.status, err);
    return null;
  }
  const data = await res.json();
  // Claude Fable 5 / Claude 4: stop_reason "refusal" means the safety classifier
  // declined the request. Content array is empty on a pre-output refusal.
  if (data.stop_reason === "refusal") {
    console.warn("[Anthropic] Request refused by safety classifier", data.stop_details);
    return null;
  }
  return {
    content: data.content?.[0]?.text || "",
    model: data.model,
    usage: data.usage
      ? { promptTokens: data.usage.input_tokens, completionTokens: data.usage.output_tokens }
      : undefined,
  };
}

async function callOllama(messages: LLMMessage[]): Promise<LLMResponse | null> {
  const host = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.2";

  try {
    const res = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false,
        options: { temperature: 0.2, num_predict: 4000 },
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return {
      content: data.message?.content || "",
      model: data.model,
    };
  } catch {
    return null;
  }
}

// Infer appropriate tier from system prompt content when caller doesn't specify
function inferTier(messages: LLMMessage[]): ModelTier {
  const sys = messages.find((m) => m.role === "system")?.content || "";
  if (sys.includes("triage classifier") || sys.includes("Classify customer message sentiment")) {
    return "fast";
  }
  if (sys.includes("response supervisor") || sys.includes("You rewrite an agent reply")) {
    return "fast";
  }
  if (sys.includes("escalation") || sys.includes("legal") || sys.includes("compliance")) {
    return "reasoning";
  }
  return "balanced";
}

export interface ChatContext {
  tenantId?: string;
  conversationId?: string;
  agentType?: string;
}

export async function chat(
  messages: LLMMessage[],
  tier?: ModelTier,
  ctx?: ChatContext
): Promise<LLMResponse> {
  if (process.env.USE_MOCK_LLM === "true") return callMock(messages);

  const resolvedTier = tier ?? inferTier(messages);

  // Try OpenRouter first (user-provided), then Ollama (free local), then OpenAI, then Anthropic, then mock
  const providers: Array<(m: LLMMessage[], t: ModelTier) => Promise<LLMResponse | null>> = [
    callOpenRouter, callOpenAI, callAnthropic,
    // Ollama doesn't support tiers — wrap it
    async (m) => callOllama(m),
  ];

  for (const provider of providers) {
    const result = await provider(messages, resolvedTier);
    if (result) {
      // Track usage asynchronously — never blocks the response
      if (ctx?.tenantId && result.usage) {
        import("./repositories/token-usage").then(({ tokenUsageRepo }) => {
          tokenUsageRepo.record({
            tenantId: ctx.tenantId!,
            conversationId: ctx.conversationId,
            model: result.model,
            promptTokens: result.usage!.promptTokens,
            completionTokens: result.usage!.completionTokens,
            agentType: ctx.agentType,
          }).catch(() => {});
        }).catch(() => {});
      }
      return result;
    }
  }

  // Fallback: return a structured mock so the UI still works
  return {
    content: JSON.stringify({
      error: "No LLM provider available. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or run Ollama locally.",
    }),
    model: "mock",
  };
}

export function isLLMAvailable(): boolean {
  return !!(
    process.env.USE_MOCK_LLM === "true" ||
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OLLAMA_HOST
  );
}

// ── Streaming support ──────────────────────────────────────────────
// chatStream returns an AsyncIterable<string> of token chunks.
// Falls back to chunking the full response when the provider doesn't
// support streaming (e.g. mock mode, Ollama non-stream).

export async function* chatStream(messages: LLMMessage[]): AsyncIterable<string> {
  if (process.env.USE_MOCK_LLM === "true") {
    const r = callMock(messages);
    // Simulate streaming by yielding word-by-word
    for (const word of r.content.split(" ")) {
      yield word + " ";
      await new Promise((res) => setTimeout(res, 20));
    }
    return;
  }

  // Anthropic streaming
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    const systemMsg = messages.find((m) => m.role === "system")?.content || "";
    const userMsgs = messages.filter((m) => m.role !== "system");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || TIER_MODELS.anthropic.balanced,
        max_tokens: 4000,
        stream: true,
        system: systemMsg,
        messages: userMsgs.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));
            // Fable 5: safety refusal arrives as message_delta with stop_reason:"refusal"
            if (json?.type === "message_delta" && json?.delta?.stop_reason === "refusal") {
              console.warn("[Anthropic stream] Request refused by safety classifier");
              return;
            }
            const delta = json?.delta?.text;
            if (delta) yield delta;
          } catch { /* skip malformed */ }
        }
      }
      return;
    }
  }

  // OpenAI streaming
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages,
        stream: true,
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
          try {
            const json = JSON.parse(line.slice(6));
            const delta = json?.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch { /* skip */ }
        }
      }
      return;
    }
  }

  // Fallback: non-streaming
  const result = await chat(messages);
  for (const word of result.content.split(" ")) {
    yield word + " ";
  }
}
