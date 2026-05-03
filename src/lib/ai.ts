export interface AgentPersona {
  id: string;
  name: string;
  goals: string[];
  skills: string[];
  guardrails: string[];
  tone: string;
}

const AGENT_RESPONSES: Record<string, Record<string, string[]>> = {
  "customer-support": {
    greeting: [
      "Hello! I'm your support specialist. How can I help you today?",
      "Hi there! I'm here to resolve any issues you're experiencing.",
    ],
    order: [
      "I'll look up your order right away. Could you share your order number?",
      "Let me check the status of your order in our system.",
    ],
    return: [
      "I can help process your return. What's the reason for the return, and do you have your order number?",
      "Returns are handled within 30 days. Let me check if your order is eligible.",
    ],
    refund: [
      "I can process refunds for eligible orders. Let me review your purchase details.",
      "Refunds typically process in 3-5 business days. I'll get that started for you.",
    ],
    shipping: [
      "Standard shipping is 3-5 business days. I can also upgrade to express if needed.",
      "Let me pull up the tracking information for your shipment.",
    ],
    angry: [
      "I sincerely apologize for this experience. Let me make this right for you immediately.",
      "I completely understand your frustration. I'm going to prioritize resolving this for you.",
    ],
    thanks: [
      "You're very welcome! I'm glad I could help resolve this.",
      "My pleasure! Please reach out if you need anything else.",
    ],
    default: [
      "I'm not sure I fully understand. Could you provide more details about what you need?",
      "Let me connect you with a specialist who can better assist with this.",
    ],
  },
  sales: {
    greeting: [
      "Hey there! Looking for something specific today? I can help you find the perfect fit.",
      "Welcome! I'm here to help you discover products you'll love.",
    ],
    order: [
      "Great choice! While I check that, can I show you some complementary items?",
      "I can help you track your order AND suggest some upgrades you might like.",
    ],
    return: [
      "I understand you want to return this. Before we proceed, would you consider an exchange or store credit? I can offer a 15% bonus.",
      "Sorry to hear it's not working out. Would a different model or size work better?",
    ],
    refund: [
      "I can process that refund. But wait — would you be interested in applying it as credit toward one of our premium options?",
      "Refund approved! While that's processing, can I show you what's new this season?",
    ],
    shipping: [
      "Good news — orders over $50 qualify for free express shipping! Let me check your cart.",
      "I can upgrade you to same-day delivery in select areas. Want me to check availability?",
    ],
    angry: [
      "I hear you, and I want to fix this. Let me see what I can do to turn this around.",
      "That's not the experience we want for you. Let me offer a solution that works.",
    ],
    thanks: [
      "Anytime! Happy to help. Keep an eye out — I'll make sure you're first to know about our next sale!",
      "You got it! Thanks for being a valued customer.",
    ],
    default: [
      "Interesting! Tell me more about what you're looking for and I'll find the best options.",
      "I'd love to help with that. What matters most to you — price, quality, or speed?",
    ],
  },
};

function classifyIntent(message: string): string {
  const lower = message.toLowerCase();
  if (/\b(hi|hello|hey|greetings|howdy)\b/.test(lower)) return "greeting";
  if (/\b(order|tracking|where is|ship|delivery|status)\b/.test(lower)) return "order";
  if (/\b(return|send back|dont want|don't want|exchange)\b/.test(lower)) return "return";
  if (/\b(refund|money back|chargeback|get my money)\b/.test(lower)) return "refund";
  if (/\b(shipping|delivery time|when will|how long|arrive)\b/.test(lower)) return "shipping";
  if (/\b(price|cost|how much|discount|deal|deals|sale|sales|buy|purchase|recommend|upgrade|upgrade|best|cheapest|offer|promo)\b/.test(lower)) return "sales";
  if (/\b(frustrated|angry|terrible|awful|worst|hate|mad|unacceptable|ridiculous)\b/.test(lower)) return "angry";
  if (/\b(thanks|thank you|appreciate|grateful|you're the best)\b/.test(lower)) return "thanks";
  return "default";
}

function routeToAgent(intent: string, agents: AgentPersona[]): AgentPersona | null {
  // Sales intent -> Sales Agent
  if (intent === "sales") {
    return agents.find((a) => a.skills.includes("recommend_product") || a.skills.includes("upsell")) || null;
  }
  // Support intents -> Customer Support Agent
  if (["order", "return", "refund", "shipping", "angry", "greeting", "thanks", "default"].includes(intent)) {
    return agents.find((a) => a.skills.includes("process_return") || a.skills.includes("lookup_order")) || null;
  }
  // Default to first available agent
  return agents[0] || null;
}

export function generateAgentResponse(
  message: string,
  agents: AgentPersona[]
): { response: string; agentId: string; agentName: string; intent: string } {
  const intent = classifyIntent(message);
  const agent = routeToAgent(intent, agents) || agents[0];
  if (!agent) {
    return { response: "No agent available.", agentId: "", agentName: "", intent };
  }
  // Determine agent type key
  let agentKey = "customer-support";
  if (agent.skills.includes("recommend_product") || agent.skills.includes("upsell")) {
    agentKey = "sales";
  }

  const responses = AGENT_RESPONSES[agentKey]?.[intent] || AGENT_RESPONSES[agentKey]?.["default"] || ["How can I help?"];
  const response = responses[Math.floor(Math.random() * responses.length)];

  // Apply guardrail check simulation
  let finalResponse = response;
  if (intent === "refund" && agent.guardrails.some((g) => g.includes("$500"))) {
    finalResponse += " (Note: Refunds over $500 require manager approval — I've flagged this for review.)";
  }
  if (intent === "angry" && agent.guardrails.some((g) => g.includes("escalate"))) {
    finalResponse += " [Priority: High — I've elevated this for faster resolution.]";
  }

  return {
    response: finalResponse,
    agentId: agent.id,
    agentName: agent.name,
    intent,
  };
}

export function generateAIResponse(message: string): string {
  const intent = classifyIntent(message);
  const responses = AGENT_RESPONSES["customer-support"][intent] || AGENT_RESPONSES["customer-support"]["default"];
  return responses[Math.floor(Math.random() * responses.length)];
}

export function* streamAgentResponse(
  message: string,
  agents: AgentPersona[]
): Generator<{ chunk: string; agentId: string; agentName: string; done: boolean }> {
  const result = generateAgentResponse(message, agents);
  const words = result.response.split(" ");
  let current = "";

  for (let i = 0; i < words.length; i++) {
    current += (current ? " " : "") + words[i];
    yield {
      chunk: current,
      agentId: result.agentId,
      agentName: result.agentName,
      done: i === words.length - 1,
    };
  }
}
