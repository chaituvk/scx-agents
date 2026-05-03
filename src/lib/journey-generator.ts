import { chat } from "./llm";

export interface GeneratedJourney {
  name: string;
  description: string;
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
    condition?: string;
  }>;
  variables: string[];
  guardrails: string[];
  skills: string[];
}

const SYSTEM_PROMPT = `You are a conversation flow designer for a customer support AI platform.
Given a natural language description of a workflow, generate a JSON object representing a conversation journey.

Available node types:
- "start": Entry point. Must be first node. Has no data.
- "message": Sends text to user. data: { text: string }
- "input": Prompts user for input. data: { prompt: string, variable: string }
- "condition": Routes based on variable. data: { variable: string, condition: string }
- "action": Sets a variable. data: { action: "set_variable", variable: string, value: string }
- "api": Calls external API. data: { endpoint: string, params: string[] }
- "intent": Classifies user message. data: {} (classifier runs automatically)
- "transfer": Hands to human. data: { department: string, reason: string }
- "end": Ends flow. data: { text?: string }

Edge condition format: "eq <value>", "neq <value>", "gt <number>", "lt <number>", "contains <text>"

Rules:
1. Every journey MUST have exactly one "start" node and at least one "end" node.
2. Node IDs must be "n1", "n2", "n3", etc.
3. Edge IDs must be "e1", "e2", "e3", etc.
4. Use "input" nodes to collect information before "condition" or "api" nodes.
5. Use "message" nodes to communicate results to the user.
6. Variable names use snake_case.
7. Position nodes in a top-to-bottom layout (x: 100, 300, 500... y: 100, 200, 300...).
8. Response MUST be valid JSON only — no markdown, no explanations.

Output format:
{
  "name": "Journey Name",
  "description": "Brief description",
  "nodes": [
    { "id": "n1", "type": "start", "label": "Start", "position": { "x": 100, "y": 100 }, "data": {} },
    { "id": "n2", "type": "message", "label": "Greeting", "position": { "x": 100, "y": 200 }, "data": { "text": "Hello! How can I help?" } },
    ...
  ],
  "edges": [
    { "id": "e1", "source": "n1", "target": "n2" },
    { "id": "e2", "source": "n4", "target": "n5", "condition": "eq yes" },
    ...
  ],
  "variables": ["order_number", "within_window"],
  "guardrails": ["Never blame the customer", "Always offer a solution"],
  "skills": ["order_lookup", "return_processing"]
}`;

function generateFallbackJourney(description: string): GeneratedJourney {
  const lower = description.toLowerCase();

  // Detect workflow type from keywords
  const isReturn = lower.includes("return") || lower.includes("refund") || lower.includes("send back");
  const isKyc = lower.includes("verify") || lower.includes("identity") || lower.includes("kyc") || lower.includes("ssn");
  const isShipping = lower.includes("ship") || lower.includes("deliver") || lower.includes("track");
  const isSales = lower.includes("buy") || lower.includes("purchase") || lower.includes("discount") || lower.includes("promo");
  const isComplaint = lower.includes("complaint") || lower.includes("angry") || lower.includes("frustrated") || lower.includes("issue");

  if (isKyc) {
    return {
      name: "Identity Verification Flow",
      description: "KYC verification with risk scoring and conditional routing",
      nodes: [
        { id: "n1", type: "start", label: "Start", position: { x: 100, y: 100 }, data: {} },
        { id: "n2", type: "message", label: "Greeting", position: { x: 100, y: 180 }, data: { text: "I'll help you verify your identity. This will only take a moment." } },
        { id: "n3", type: "input", label: "Full Name", position: { x: 100, y: 260 }, data: { prompt: "Please provide your full legal name.", variable: "full_name" } },
        { id: "n4", type: "input", label: "SSN Last 4", position: { x: 100, y: 340 }, data: { prompt: "Please provide the last 4 digits of your SSN.", variable: "ssn_last4" } },
        { id: "n5", type: "input", label: "Date of Birth", position: { x: 100, y: 420 }, data: { prompt: "What is your date of birth? (MM/DD/YYYY)", variable: "dob" } },
        { id: "n6", type: "api", label: "Verify Identity", position: { x: 100, y: 500 }, data: { endpoint: "/api/kyc/verify", params: ["ssn_last4", "dob"] } },
        { id: "n7", type: "condition", label: "Verified?", position: { x: 100, y: 580 }, data: { variable: "kyc_status", condition: "eq verified" } },
        { id: "n8", type: "message", label: "Success", position: { x: 300, y: 580 }, data: { text: "✅ Identity verified! You're all set." } },
        { id: "n9", type: "transfer", label: "Manual Review", position: { x: 0, y: 580 }, data: { department: "Compliance", reason: "Additional verification required" } },
        { id: "n10", type: "end", label: "End", position: { x: 300, y: 660 }, data: { text: "Thank you for your patience." } },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4" },
        { id: "e4", source: "n4", target: "n5" },
        { id: "e5", source: "n5", target: "n6" },
        { id: "e6", source: "n6", target: "n7" },
        { id: "e7", source: "n7", target: "n8", condition: "eq verified" },
        { id: "e8", source: "n7", target: "n9" },
        { id: "e9", source: "n8", target: "n10" },
      ],
      variables: ["full_name", "ssn_last4", "dob", "kyc_status", "risk_score"],
      guardrails: ["Never store full SSN", "Verify identity before disclosing account details", "Escalate suspicious activity to compliance"],
      skills: ["identity_verification", "kyc_check", "risk_scoring"],
    };
  }

  if (isSales) {
    return {
      name: "Sales & Upsell Flow",
      description: "Product recommendations and promotion application",
      nodes: [
        { id: "n1", type: "start", label: "Start", position: { x: 100, y: 100 }, data: {} },
        { id: "n2", type: "message", label: "Welcome", position: { x: 100, y: 180 }, data: { text: "Hi there! I'd love to help you find the perfect product. What are you looking for today?" } },
        { id: "n3", type: "input", label: "Product Interest", position: { x: 100, y: 260 }, data: { prompt: "Tell me what you're looking for or your budget range.", variable: "product_interest" } },
        { id: "n4", type: "action", label: "Set Promo", position: { x: 100, y: 340 }, data: { action: "set_variable", variable: "promo_code", value: "WELCOME10" } },
        { id: "n5", type: "message", label: "Recommendation", position: { x: 100, y: 420 }, data: { text: "Great choice! I found some excellent options. I've also applied code WELCOME10 for 10% off your first order." } },
        { id: "n6", type: "input", label: "Confirm Order", position: { x: 100, y: 500 }, data: { prompt: "Would you like to proceed with the order? (yes/no)", variable: "order_confirmed" } },
        { id: "n7", type: "condition", label: "Ordered?", position: { x: 100, y: 580 }, data: { variable: "order_confirmed", condition: "eq yes" } },
        { id: "n8", type: "message", label: "Order Placed", position: { x: 300, y: 580 }, data: { text: "Perfect! Your order is confirmed. You'll receive a confirmation email shortly." } },
        { id: "n9", type: "message", label: "No Problem", position: { x: 0, y: 580 }, data: { text: "No worries! Let me know if you need anything else." } },
        { id: "n10", type: "end", label: "End", position: { x: 300, y: 660 }, data: { text: "Thanks for shopping with us!" } },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4" },
        { id: "e4", source: "n4", target: "n5" },
        { id: "e5", source: "n5", target: "n6" },
        { id: "e6", source: "n6", target: "n7" },
        { id: "e7", source: "n7", target: "n8", condition: "eq yes" },
        { id: "e8", source: "n7", target: "n9" },
        { id: "e9", source: "n8", target: "n10" },
      ],
      variables: ["product_interest", "promo_code", "order_confirmed"],
      guardrails: ["Never make false claims about products", "Always disclose promotion terms and expiration", "Respect opt-out preferences"],
      skills: ["product_recommendation", "promo_code_management", "order_placement"],
    };
  }

  if (isShipping) {
    return {
      name: "Shipping & Tracking Flow",
      description: "Order tracking and shipping inquiry handling",
      nodes: [
        { id: "n1", type: "start", label: "Start", position: { x: 100, y: 100 }, data: {} },
        { id: "n2", type: "message", label: "Greeting", position: { x: 100, y: 180 }, data: { text: "I can help you track your shipment. Let me look that up for you." } },
        { id: "n3", type: "input", label: "Order Number", position: { x: 100, y: 260 }, data: { prompt: "Can you provide your order number or email address?", variable: "order_number" } },
        { id: "n4", type: "api", label: "Lookup Order", position: { x: 100, y: 340 }, data: { endpoint: "/api/orders/lookup", params: ["order_number"] } },
        { id: "n5", type: "condition", label: "Found?", position: { x: 100, y: 420 }, data: { variable: "order_found", condition: "eq yes" } },
        { id: "n6", type: "message", label: "Tracking Info", position: { x: 300, y: 420 }, data: { text: "Your order {{order_number}} is {{shipping_status}}. Expected delivery: {{delivery_date}}." } },
        { id: "n7", type: "message", label: "Not Found", position: { x: 0, y: 420 }, data: { text: "I couldn't find that order. Can you double-check the number or provide the email used for the order?" } },
        { id: "n8", type: "input", label: "Email Fallback", position: { x: 0, y: 500 }, data: { prompt: "What email was used for the order?", variable: "customer_email" } },
        { id: "n9", type: "end", label: "End", position: { x: 300, y: 500 }, data: { text: "Is there anything else I can help with?" } },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4" },
        { id: "e4", source: "n4", target: "n5" },
        { id: "e5", source: "n5", target: "n6", condition: "eq yes" },
        { id: "e6", source: "n5", target: "n7" },
        { id: "e7", source: "n7", target: "n8" },
        { id: "e8", source: "n6", target: "n9" },
      ],
      variables: ["order_number", "order_found", "shipping_status", "delivery_date", "customer_email"],
      guardrails: ["Never share tracking info without verifying identity", "Provide accurate delivery estimates only"],
      skills: ["order_lookup", "shipping_tracking"],
    };
  }

  if (isComplaint) {
    return {
      name: "Complaint Resolution Flow",
      description: "Empathetic complaint handling with escalation paths",
      nodes: [
        { id: "n1", type: "start", label: "Start", position: { x: 100, y: 100 }, data: {} },
        { id: "n2", type: "message", label: "Empathy", position: { x: 100, y: 180 }, data: { text: "I'm truly sorry you've had this experience. I completely understand how frustrating this must be, and I'm here to make it right." } },
        { id: "n3", type: "input", label: "Describe Issue", position: { x: 100, y: 260 }, data: { prompt: "Can you tell me more about what happened?", variable: "issue_description" } },
        { id: "n4", type: "input", label: "Order Number", position: { x: 100, y: 340 }, data: { prompt: "To help resolve this quickly, can you provide your order number?", variable: "order_number" } },
        { id: "n5", type: "action", label: "Log Complaint", position: { x: 100, y: 420 }, data: { action: "set_variable", variable: "complaint_logged", value: "true" } },
        { id: "n6", type: "message", label: "Resolution", position: { x: 100, y: 500 }, data: { text: "Thank you for your patience. I've logged your complaint and can offer you a full refund plus a $20 store credit for the inconvenience." } },
        { id: "n7", type: "input", label: "Accept?", position: { x: 100, y: 580 }, data: { prompt: "Does this resolution work for you? (yes/no)", variable: "resolution_accepted" } },
        { id: "n8", type: "condition", label: "Accepted?", position: { x: 100, y: 660 }, data: { variable: "resolution_accepted", condition: "eq yes" } },
        { id: "n9", type: "message", label: "Resolved", position: { x: 300, y: 660 }, data: { text: "Perfect! I've processed the refund. It will appear in 3-5 business days." } },
        { id: "n10", type: "transfer", label: "Escalate", position: { x: 0, y: 660 }, data: { department: "Customer Relations", reason: "Customer declined standard resolution" } },
        { id: "n11", type: "end", label: "End", position: { x: 300, y: 740 }, data: { text: "Again, I'm so sorry for the trouble. Have a better day!" } },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4" },
        { id: "e4", source: "n4", target: "n5" },
        { id: "e5", source: "n5", target: "n6" },
        { id: "e6", source: "n6", target: "n7" },
        { id: "e7", source: "n7", target: "n8" },
        { id: "e8", source: "n8", target: "n9", condition: "eq yes" },
        { id: "e9", source: "n8", target: "n10" },
        { id: "e10", source: "n9", target: "n11" },
      ],
      variables: ["issue_description", "order_number", "complaint_logged", "resolution_accepted"],
      guardrails: ["Never blame the customer", "Always acknowledge their feelings first", "Never make promises without approval", "Maximum compensation without manager: $100"],
      skills: ["complaint_logging", "refund_processing", "escalation_handling"],
    };
  }

  // Default: Return & Refund (most common)
  return {
    name: "Return & Refund Flow",
    description: "Handles product returns and refund processing with policy enforcement",
    nodes: [
      { id: "n1", type: "start", label: "Start", position: { x: 100, y: 100 }, data: {} },
      { id: "n2", type: "message", label: "Greeting", position: { x: 100, y: 180 }, data: { text: "Hello! I'm here to help with your return. I know this isn't ideal, and I'll make it as smooth as possible." } },
      { id: "n3", type: "input", label: "Order Number", position: { x: 100, y: 260 }, data: { prompt: "Can you provide your order number?", variable: "order_number" } },
      { id: "n4", type: "api", label: "Lookup Order", position: { x: 100, y: 340 }, data: { endpoint: "/api/orders/lookup", params: ["order_number"] } },
      { id: "n5", type: "condition", label: "Within Window?", position: { x: 100, y: 420 }, data: { variable: "within_window", condition: "eq yes" } },
      { id: "n6", type: "message", label: "Outside Window", position: { x: 0, y: 420 }, data: { text: "This order is outside our standard 30-day return window. However, I can offer store credit with a 10% bonus applied to your account." } },
      { id: "n7", type: "input", label: "Return Reason", position: { x: 300, y: 420 }, data: { prompt: "What's the reason for your return? (defective / wrong item / changed mind)", variable: "return_reason" } },
      { id: "n8", type: "condition", label: "Defective?", position: { x: 300, y: 500 }, data: { variable: "return_reason", condition: "eq defective" } },
      { id: "n9", type: "message", label: "Defective Offer", position: { x: 500, y: 500 }, data: { text: "I'm sorry the item arrived defective. I can offer a free replacement shipped immediately OR a full refund with a prepaid return label. Which would you prefer?" } },
      { id: "n10", type: "message", label: "Standard Offer", position: { x: 300, y: 580 }, data: { text: "I can process a refund minus a $5 restocking fee, or offer store credit with a 10% bonus. What works better for you?" } },
      { id: "n11", type: "input", label: "Choice", position: { x: 400, y: 660 }, data: { prompt: "What would you like to do?", variable: "customer_choice" } },
      { id: "n12", type: "action", label: "Process", position: { x: 400, y: 740 }, data: { action: "set_variable", variable: "refund_status", value: "approved" } },
      { id: "n13", type: "message", label: "Confirmation", position: { x: 400, y: 820 }, data: { text: "All set! Your refund will be processed within 3-5 business days. Is there anything else I can help with?" } },
      { id: "n14", type: "end", label: "End", position: { x: 400, y: 900 }, data: { text: "Thank you for your business. Have a great day!" } },
    ],
    edges: [
      { id: "e1", source: "n1", target: "n2" },
      { id: "e2", source: "n2", target: "n3" },
      { id: "e3", source: "n3", target: "n4" },
      { id: "e4", source: "n4", target: "n5" },
      { id: "e5", source: "n5", target: "n6" },
      { id: "e6", source: "n5", target: "n7", condition: "eq yes" },
      { id: "e7", source: "n7", target: "n8" },
      { id: "e8", source: "n8", target: "n9", condition: "eq defective" },
      { id: "e9", source: "n8", target: "n10" },
      { id: "e10", source: "n9", target: "n11" },
      { id: "e11", source: "n10", target: "n11" },
      { id: "e12", source: "n11", target: "n12" },
      { id: "e13", source: "n12", target: "n13" },
      { id: "e14", source: "n13", target: "n14" },
      { id: "e15", source: "n6", target: "n11" },
    ],
    variables: ["order_number", "within_window", "return_reason", "customer_choice", "refund_status"],
    guardrails: ["Never insult the product or brand", "Never blame the customer", "Always offer solution before transferring", "Maximum refund without approval: $500"],
    skills: ["order_lookup", "return_processing", "refund_handling"],
  };
}

export async function generateJourneyFromText(description: string): Promise<GeneratedJourney> {
  const response = await chat([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: description },
  ]);

  // If LLM returned an error or no provider, use fallback
  if (response.model === "mock" || !response.content.trim().startsWith("{")) {
    return generateFallbackJourney(description);
  }

  let jsonStr = response.content.trim();

  // Strip markdown code fences if present
  if (jsonStr.startsWith("```json")) jsonStr = jsonStr.slice(7);
  if (jsonStr.startsWith("```")) jsonStr = jsonStr.slice(3);
  if (jsonStr.endsWith("```")) jsonStr = jsonStr.slice(0, -3);
  jsonStr = jsonStr.trim();

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return generateFallbackJourney(description);
  }

  if (parsed.error) {
    return generateFallbackJourney(description);
  }

  // Validate structure
  if (!parsed.nodes || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
    return generateFallbackJourney(description);
  }
  if (!parsed.edges || !Array.isArray(parsed.edges)) {
    parsed.edges = [];
  }

  // Ensure start node exists
  const hasStart = parsed.nodes.some((n: any) => n.type === "start");
  if (!hasStart) {
    parsed.nodes.unshift({
      id: "n0",
      type: "start",
      label: "Start",
      position: { x: 100, y: 100 },
      data: {},
    });
    if (parsed.edges.length > 0) {
      parsed.edges[0].source = "n0";
    }
  }

  // Ensure end node exists
  const hasEnd = parsed.nodes.some((n: any) => n.type === "end");
  if (!hasEnd) {
    const lastNode = parsed.nodes[parsed.nodes.length - 1];
    const endId = `n${parsed.nodes.length + 1}`;
    parsed.nodes.push({
      id: endId,
      type: "end",
      label: "End",
      position: { x: lastNode.position?.x || 100, y: (lastNode.position?.y || 100) + 100 },
      data: { text: "Thank you for chatting with us!" },
    });
    parsed.edges.push({
      id: `e${parsed.edges.length + 1}`,
      source: lastNode.id,
      target: endId,
    });
  }

  return {
    name: parsed.name || "Generated Journey",
    description: parsed.description || "Generated from natural language",
    nodes: parsed.nodes,
    edges: parsed.edges,
    variables: parsed.variables || [],
    guardrails: parsed.guardrails || [],
    skills: parsed.skills || [],
  };
}
