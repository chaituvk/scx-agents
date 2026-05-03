import { run, getOne } from "./db";
import bcrypt from "bcryptjs";

export async function seedDatabase() {
  // Check if already seeded
  const userCountRow = await getOne("SELECT COUNT(*) as count FROM users") as { count: number };
  if (userCountRow.count > 0) return;

  console.log("[seed] Seeding database...");

  const now = new Date().toISOString();

  // Seed users
  const passwordHash = bcrypt.hashSync("sierra2026", 10);
  await run(
    `INSERT INTO users (id, email, name, password, role, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    ["user-1", "admin@sierra.ai", "Admin User", passwordHash, "admin", now]
  );

  // Seed agents
  await run(
    `INSERT INTO agents (id, name, description, status, goals, skills, guardrails, languages, channels,
     tone, welcome_message, primary_color, accent_color, created_at, updated_at, version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT (id) DO NOTHING`,
    [
      "agent-1", "Customer Support", "Handles returns, refunds, shipping, and general inquiries",
      "production",
      JSON.stringify(["Resolve customer issues", "Maintain high CSAT", "Follow return policy"]),
      JSON.stringify(["order_lookup", "return_processing", "shipping_tracking", "refund_handling"]),
      JSON.stringify(["Never insult the product", "Never blame the customer", "Always offer solution before transferring", "Maximum refund without approval: $500"]),
      JSON.stringify(["English"]),
      JSON.stringify(["web", "chat"]),
      "empathetic", "Hello! I'm here to help with your questions. What can I assist you with today?",
      "#c4a574", "#0a0a0a", now, now, "1.0.0"
    ]
  );

  await run(
    `INSERT INTO agents (id, name, description, status, goals, skills, guardrails, languages, channels,
     tone, welcome_message, primary_color, accent_color, created_at, updated_at, version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT (id) DO NOTHING`,
    [
      "agent-2", "Sales Agent", "Drives upsells, cross-sells, and retention through promotions",
      "production",
      JSON.stringify(["Increase average order value", "Drive retention", "Promote new products"]),
      JSON.stringify(["product_recommendation", "promo_code_management", "loyalty_program"]),
      JSON.stringify(["Never make false claims", "Always disclose terms", "Respect opt-out preferences"]),
      JSON.stringify(["English"]),
      JSON.stringify(["web", "chat"]),
      "enthusiastic", "Hey there! Looking for something special? I can help you find exactly what you need!",
      "#c4a574", "#0a0a0a", now, now, "1.0.0"
    ]
  );

  // Seed conversations
  await run(
    `INSERT INTO conversations (id, customer_name, customer_email, channel, status, sentiment, agent_id, assigned_to, topic, priority, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO NOTHING`,
    ["conv-1", "Sarah Johnson", "sarah@example.com", "web", "open", "neutral", "agent-1", "Customer Support", "return", "normal", "2026-04-30T10:00:00Z", "2026-05-02T10:00:00Z"]
  );
  await run(
    `INSERT INTO conversations (id, customer_name, customer_email, channel, status, sentiment, agent_id, assigned_to, topic, priority, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO NOTHING`,
    ["conv-2", "Mike Chen", "mike@example.com", "web", "resolved", "positive", "agent-2", "Sales Agent", "product inquiry", "low", "2026-04-29T14:00:00Z", "2026-04-29T15:30:00Z"]
  );
  await run(
    `INSERT INTO conversations (id, customer_name, customer_email, channel, status, sentiment, agent_id, assigned_to, topic, priority, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (id) DO NOTHING`,
    ["conv-3", "Emily Davis", "emily@example.com", "web", "escalated", "negative", null, null, "refund dispute", "high", "2026-04-28T09:00:00Z", "2026-05-01T11:00:00Z"]
  );

  // Seed messages
  await run(
    `INSERT INTO messages (id, conversation_id, role, content, agent_id, intent, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    ["msg-1", "conv-1", "user", "Hi, I need to return my order. It arrived damaged.", null, "return", "2026-04-30T10:01:00Z"]
  );
  await run(
    `INSERT INTO messages (id, conversation_id, role, content, agent_id, intent, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    ["msg-2", "conv-1", "assistant", "I'm sorry to hear your order arrived damaged. I'd be happy to help with a return. Could you provide your order number?", "agent-1", "return", "2026-04-30T10:02:00Z"]
  );
  await run(
    `INSERT INTO messages (id, conversation_id, role, content, agent_id, intent, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    ["msg-3", "conv-1", "user", "It's #45678", null, "return", "2026-04-30T10:03:00Z"]
  );
  await run(
    `INSERT INTO messages (id, conversation_id, role, content, agent_id, intent, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    ["msg-4", "conv-1", "assistant", "Thank you. I can see your order for the Wireless Headphones. I'll process a replacement right away with expedited shipping at no charge.", "agent-1", "return", "2026-04-30T10:04:00Z"]
  );

  // Seed integrations
  await run(
    `INSERT INTO integrations (id, name, type, status, records, last_sync, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    ["int-1", "Zendesk", "CRM", "connected", "2.4M", "15 min ago", now]
  );
  await run(
    `INSERT INTO integrations (id, name, type, status, records, last_sync, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    ["int-2", "Shopify", "E-commerce", "connected", "1.8M", "1 hour ago", now]
  );
  await run(
    `INSERT INTO integrations (id, name, type, status, records, last_sync, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    ["int-3", "Stripe", "Payment", "connected", "890K", "5 min ago", now]
  );
  await run(
    `INSERT INTO integrations (id, name, type, status, records, last_sync, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    ["int-4", "Salesforce", "CRM", "disconnected", "—", "—", now]
  );
  await run(
    `INSERT INTO integrations (id, name, type, status, records, last_sync, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    ["int-5", "Twilio", "Voice", "error", "—", "3 hours ago", now]
  );

  // Seed insights
  const metrics = [
    { metric: "conversations", category: "volume" },
    { metric: "resolution_rate", category: "quality" },
    { metric: "avg_response_time", category: "performance" },
    { metric: "csat", category: "quality" },
    { metric: "escalation_rate", category: "quality" },
  ];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    for (let m = 0; m < metrics.length; m++) {
      const meta = metrics[m];
      let value: number;
      switch (meta.metric) {
        case "conversations": value = Math.floor(Math.random() * 500) + 1200; break;
        case "resolution_rate": value = 88 + Math.floor(Math.random() * 10); break;
        case "avg_response_time": value = +(1.2 + Math.random() * 1.5).toFixed(2); break;
        case "csat": value = +(4.5 + Math.random() * 0.4).toFixed(2); break;
        case "escalation_rate": value = 3 + Math.floor(Math.random() * 5); break;
        default: value = 0;
      }
      await run(
        `INSERT INTO insights (id, date, metric, value, category, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [`ins-${i}-${m}`, dateStr, meta.metric, value, meta.category, date.toISOString()]
      );
    }
  }

  // Seed journeys
  await run(
    `INSERT INTO journeys (id, name, description, nodes, edges, variables, execution_mode, status, version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO NOTHING`,
    [
      "journey-1", "Return & Refund Flow", "Handles product returns and refund processing",
      JSON.stringify([
        { id: "n1", type: "start", label: "Start", position: { x: 100, y: 100 }, data: {} },
        { id: "n2", type: "message", label: "Greeting", position: { x: 100, y: 200 }, data: { text: "I can help you with your return." } },
        { id: "n3", type: "input", label: "Get Order #", position: { x: 100, y: 300 }, data: { prompt: "What's your order number?", variable: "order_number" } },
        { id: "n4", type: "condition", label: "Within Window?", position: { x: 100, y: 400 }, data: { variable: "within_window", condition: "eq yes" } },
        { id: "n5", type: "message", label: "Process", position: { x: 300, y: 400 }, data: { text: "Great! I can process your return." } },
        { id: "n6", type: "end", label: "End", position: { x: 300, y: 500 }, data: {} },
      ]),
      JSON.stringify([
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4" },
        { id: "e4", source: "n4", target: "n5", condition: "eq yes" },
        { id: "e5", source: "n5", target: "n6" },
      ]),
      JSON.stringify(["order_number", "within_window"]),
      "deterministic", "active", "1.0.0", now, now
    ]
  );

  await run(
    `INSERT INTO journeys (id, name, description, nodes, edges, variables, execution_mode, status, version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO NOTHING`,
    [
      "journey-2", "Intent Router", "Routes conversations based on detected intent",
      JSON.stringify([
        { id: "n1", type: "start", label: "Start", position: { x: 100, y: 100 }, data: {} },
        { id: "n2", type: "intent", label: "Detect Intent", position: { x: 100, y: 200 }, data: {} },
        { id: "n3", type: "transfer", label: "Sales", position: { x: 300, y: 300 }, data: { department: "Sales", reason: "Sales inquiry" } },
        { id: "n4", type: "transfer", label: "Support", position: { x: 0, y: 300 }, data: { department: "Support", reason: "Support issue" } },
      ]),
      JSON.stringify([
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3", label: "sales" },
        { id: "e3", source: "n2", target: "n4", label: "support" },
      ]),
      JSON.stringify(["detected_intent"]),
      "deterministic", "active", "1.0.0", now, now
    ]
  );

  await run(
    `INSERT INTO journeys (id, name, description, nodes, edges, variables, execution_mode, status, version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO NOTHING`,
    [
      "journey-3", "KYC Identity Verification", "Verifies customer identity with risk scoring",
      JSON.stringify([
        { id: "n1", type: "start", label: "Start", position: { x: 100, y: 100 }, data: {} },
        { id: "n2", type: "input", label: "SSN", position: { x: 100, y: 200 }, data: { prompt: "Please provide last 4 of SSN", variable: "ssn_last4" } },
        { id: "n3", type: "input", label: "DOB", position: { x: 100, y: 300 }, data: { prompt: "Date of birth?", variable: "dob" } },
        { id: "n4", type: "api", label: "Verify", position: { x: 100, y: 400 }, data: { endpoint: "/api/kyc/verify", params: ["ssn_last4", "dob"] } },
        { id: "n5", type: "condition", label: "Result?", position: { x: 100, y: 500 }, data: { variable: "kyc_status", condition: "eq verified" } },
        { id: "n6", type: "message", label: "Verified", position: { x: 300, y: 500 }, data: { text: "Identity verified!" } },
        { id: "n7", type: "transfer", label: "Review", position: { x: 0, y: 500 }, data: { department: "Compliance", reason: "Manual review required" } },
        { id: "n8", type: "end", label: "End", position: { x: 300, y: 600 }, data: {} },
      ]),
      JSON.stringify([
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4" },
        { id: "e4", source: "n4", target: "n5" },
        { id: "e5", source: "n5", target: "n6", condition: "eq verified" },
        { id: "e6", source: "n5", target: "n7" },
        { id: "e7", source: "n6", target: "n8" },
      ]),
      JSON.stringify(["ssn_last4", "dob", "kyc_status", "risk_score"]),
      "deterministic", "active", "1.2.0", now, now
    ]
  );

  // LLM-mode journey
  await run(
    `INSERT INTO journeys (id, name, description, nodes, edges, variables, execution_mode, status, version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO NOTHING`,
    [
      "journey-4", "General Support (AI Agent)", "Flexible AI agent for general support with guardrails",
      JSON.stringify([
        { id: "n1", type: "start", label: "Start", position: { x: 100, y: 100 }, data: {} },
        { id: "n2", type: "end", label: "End", position: { x: 100, y: 200 }, data: { text: "Thank you for chatting with us!" } },
      ]),
      JSON.stringify([{ id: "e1", source: "n1", target: "n2" }]),
      JSON.stringify({}),
      "llm", "active", "1.0.0", now, now
    ]
  );

  // Hybrid-mode journey
  await run(
    `INSERT INTO journeys (id, name, description, nodes, edges, variables, execution_mode, status, version, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO NOTHING`,
    [
      "journey-5", "Refund with AI (Hybrid)", "AI handles conversation but follows strict refund policy checkpoints",
      JSON.stringify([
        { id: "n1", type: "start", label: "Start", position: { x: 100, y: 100 }, data: {} },
        { id: "n2", type: "input", label: "Order Number", position: { x: 100, y: 200 }, data: { prompt: "What's your order number?", variable: "order_number" } },
        { id: "n3", type: "condition", label: "Within Window?", position: { x: 100, y: 300 }, data: { variable: "within_window", condition: "eq yes" } },
        { id: "n4", type: "input", label: "Refund Amount", position: { x: 300, y: 300 }, data: { prompt: "What's the refund amount?", variable: "refund_amount" } },
        { id: "n5", type: "condition", label: "Under $500?", position: { x: 300, y: 400 }, data: { variable: "refund_amount", condition: "lt 500" } },
        { id: "n6", type: "end", label: "Approved", position: { x: 500, y: 400 }, data: { text: "Refund approved!" } },
        { id: "n7", type: "transfer", label: "Needs Approval", position: { x: 100, y: 400 }, data: { department: "Manager", reason: "Refund over $500 or outside window" } },
      ]),
      JSON.stringify([
        { id: "e1", source: "n1", target: "n2" },
        { id: "e2", source: "n2", target: "n3" },
        { id: "e3", source: "n3", target: "n4", condition: "eq yes" },
        { id: "e4", source: "n3", target: "n7" },
        { id: "e5", source: "n4", target: "n5" },
        { id: "e6", source: "n5", target: "n6", condition: "eq yes" },
        { id: "e7", source: "n5", target: "n7" },
      ]),
      JSON.stringify(["order_number", "within_window", "refund_amount"]),
      "hybrid", "active", "1.0.0", now, now
    ]
  );

  // Seed flagged conversations
  await run(
    `INSERT INTO flagged_conversations (id, conversation_id, reason, severity, status, assigned_to, notes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    ["flag-1", "conv-3", "Angry customer demanding $800 refund", "high", "open", "manager@sierra.ai", "Requires manager approval for refund > $500", now]
  );
  await run(
    `INSERT INTO flagged_conversations (id, conversation_id, reason, severity, status, assigned_to, notes, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    ["flag-2", "conv-1", "Agent mentioned off-limit phrase", "medium", "resolved", "admin@sierra.ai", "Agent said 'I don't know' - coaching provided", now]
  );

  // Seed knowledge sources
  await run(
    `INSERT INTO knowledge_sources (id, name, type, status, entries, last_sync, gaps, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    ["ks-1", "Help Center Articles", "help-center", "active", 247, "2 min ago", null, now]
  );
  await run(
    `INSERT INTO knowledge_sources (id, name, type, status, entries, last_sync, gaps, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    ["ks-2", "Return & Refund Policy", "policy", "active", 12, "1 hour ago", null, now]
  );
  await run(
    `INSERT INTO knowledge_sources (id, name, type, status, entries, last_sync, gaps, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    ["ks-3", "Shipping Guidelines", "policy", "error", 8, "3 days ago", JSON.stringify(["Missing international shipping info", "No holiday cutoff dates"]), now]
  );

  // Seed knowledge gaps
  await run(
    `INSERT INTO knowledge_gaps (id, question, frequency, status, suggested_answer, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    ["gap-1", "How do I change my shipping address after ordering?", 45, "open", "Orders can be modified within 2 hours. Contact support immediately.", now]
  );
  await run(
    `INSERT INTO knowledge_gaps (id, question, frequency, status, suggested_answer, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    ["gap-2", "What is your warranty policy for electronics?", 38, "open", "All electronics carry a 1-year manufacturer warranty plus 90-day return window.", now]
  );
  await run(
    `INSERT INTO knowledge_gaps (id, question, frequency, status, suggested_answer, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO NOTHING`,
    ["gap-3", "Can I combine multiple promo codes?", 29, "resolved", null, now]
  );

  console.log("[seed] Database seeded successfully");
}
