// Per-subtask model selection. Routes to the right model tier.
//
// Tiers:
//   - small:     fast/cheap → triage, classify, summarize
//   - reasoning: default → respond, extract_slot, confirm
//   - large:     complex multi-step reasoning → escalation summaries, supervisor judge
//
// Provider preference (per tier) is set via env vars; falls back to llm.ts.chat() defaults.

import { chat as llmChat, type LLMMessage, type LLMResponse } from "./llm";
import type { ModelTier, ModelCallOptions } from "./agents/types";

interface TierConfig {
  envModel: string | undefined;
  temperature: number;
  maxTokens: number;
}

function tierConfig(tier: ModelTier): TierConfig {
  switch (tier) {
    case "small":
      return {
        envModel: process.env.MODEL_SMALL,
        temperature: 0.0,
        maxTokens: 800,
      };
    case "large":
      return {
        envModel: process.env.MODEL_LARGE,
        temperature: 0.3,
        maxTokens: 4000,
      };
    case "reasoning":
    default:
      return {
        envModel: process.env.MODEL_REASONING,
        temperature: 0.2,
        maxTokens: 2000,
      };
  }
}

export async function callModel(
  messages: LLMMessage[],
  opts: ModelCallOptions = {}
): Promise<LLMResponse> {
  const tier = opts.tier ?? "reasoning";
  const cfg = tierConfig(tier);

  // Temporarily override the default model for this call by setting the
  // provider's env var on a per-tier basis. We pass the tier model through
  // by way of OPENROUTER_MODEL/OPENAI_MODEL/etc. set via MODEL_SMALL etc.
  // Simpler approach: stash and restore.
  const prev = {
    openrouter: process.env.OPENROUTER_MODEL,
    openai: process.env.OPENAI_MODEL,
    anthropic: process.env.ANTHROPIC_MODEL,
  };

  if (cfg.envModel) {
    // Apply to whichever provider is active. Setting all is harmless because
    // each provider only reads its own var.
    process.env.OPENROUTER_MODEL = cfg.envModel;
    process.env.OPENAI_MODEL = cfg.envModel;
    process.env.ANTHROPIC_MODEL = cfg.envModel;
  }

  try {
    // Inject JSON-mode hint into system message if requested.
    const finalMessages = opts.jsonMode
      ? messages.map((m, i) =>
          i === 0 && m.role === "system"
            ? { ...m, content: m.content + "\n\nReturn only valid JSON. No prose." }
            : m
        )
      : messages;
    return await llmChat(finalMessages);
  } finally {
    process.env.OPENROUTER_MODEL = prev.openrouter;
    process.env.OPENAI_MODEL = prev.openai;
    process.env.ANTHROPIC_MODEL = prev.anthropic;
  }
}

export function isMockResponse(res: LLMResponse): boolean {
  return res.model === "mock" || res.content.startsWith('{"error"');
}
