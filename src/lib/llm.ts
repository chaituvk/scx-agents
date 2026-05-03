// LLM abstraction supporting OpenAI, Anthropic, and local Ollama

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
}

async function callOpenRouter(messages: LLMMessage[]): Promise<LLMResponse | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_REFERER || "http://localhost:3000",
      "X-Title": "Sierra AI",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-nano-omni-30b-a3b",
      messages,
      temperature: 0.2,
      max_tokens: 4000,
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

async function callOpenAI(messages: LLMMessage[]): Promise<LLMResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages,
      temperature: 0.2,
      max_tokens: 4000,
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

async function callAnthropic(messages: LLMMessage[]): Promise<LLMResponse | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const systemMsg = messages.find((m) => m.role === "system")?.content || "";
  const userMsgs = messages.filter((m) => m.role !== "system");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
      max_tokens: 4000,
      system: systemMsg,
      messages: userMsgs.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
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

export async function chat(messages: LLMMessage[]): Promise<LLMResponse> {
  // Try OpenRouter first (user-provided), then Ollama (free local), then OpenAI, then Anthropic, then mock
  const providers = [callOpenRouter, callOllama, callOpenAI, callAnthropic];

  for (const provider of providers) {
    const result = await provider(messages);
    if (result) return result;
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
    process.env.OPENROUTER_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OLLAMA_HOST
  );
}
