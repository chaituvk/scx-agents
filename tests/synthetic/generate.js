"use strict";

/**
 * Deterministic synthetic data generator for Sierra.
 *
 * Produces tenant-scoped conversations, messages, daily insights, and flagged
 * conversations that match the DB schema in src/lib/db.ts. Same seed → byte-for
 * -byte identical output, so it is safe to use in reproducible tests.
 *
 * No external dependencies (runs on a bare Node install).
 *
 * CLI:
 *   node tests/synthetic/generate.js                 # defaults, writes ./data
 *   node tests/synthetic/generate.js --conversations 200 --seed 42
 *   node tests/synthetic/generate.js --sql            # also emit seed.sql
 *   node tests/synthetic/generate.js --tenants r-mobile,ichiba
 *
 * Programmatic:
 *   const { generate } = require("./generate");
 *   const dataset = generate({ conversationsPerTenant: 50, seed: 1337 });
 */

const fs = require("fs");
const path = require("path");

// Fixed reference "now" so timestamps are deterministic (never Date.now()).
const NOW = Date.parse("2026-07-14T00:00:00.000Z");
const DAY = 86_400_000;

// ── Deterministic RNG (mulberry32) ──────────────────────────────────
function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const intBetween = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const round = (n, d = 2) => Number(n.toFixed(d));
function weighted(rng, entries) {
  // entries: [[value, weight], ...]
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [value, w] of entries) {
    if ((r -= w) < 0) return value;
  }
  return entries[entries.length - 1][0];
}

// ── Shared pools ────────────────────────────────────────────────────
const FIRST_NAMES = [
  "Sarah", "James", "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan",
  "Sophia", "Mason", "Isabella", "Lucas", "Mia", "Daniel", "Grace", "Henry",
  "Yuki", "Taro", "Hana", "Kenji", "Aoi", "Sota", "Rin", "Haruto",
  "Priya", "Arjun", "Diego", "Camila", "Omar", "Fatima", "Chen", "Wei",
];
const LAST_NAMES = [
  "Johnson", "Smith", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Tanaka", "Sato", "Suzuki", "Takahashi", "Watanabe", "Ito",
  "Patel", "Kumar", "Nguyen", "Kim", "Lopez", "Silva", "Khan",
];
const CHANNELS = [["web", 5], ["email", 2], ["sms", 1], ["whatsapp", 1], ["voice", 1]];
const STATUSES = [["resolved", 11], ["open", 4], ["escalated", 2], ["pending", 3]];
const SENTIMENTS = [["neutral", 5], ["positive", 3], ["negative", 2]];
const PRIORITIES = [["normal", 6], ["high", 2], ["low", 1], ["urgent", 1]];
const FLAG_REASONS = [
  "Negative sentiment spike",
  "Policy override requested",
  "Refund above approval threshold",
  "Repeated unresolved contact",
  "Potential PII exposure",
  "Off-limit topic detected",
  "Low answer confidence",
];
const SEVERITIES = [["low", 3], ["medium", 4], ["high", 2], ["critical", 1]];

// ── Tenant flavor ───────────────────────────────────────────────────
const TENANTS = {
  "r-mobile": {
    assignedTo: "R-Mobile Support",
    agents: 4,
    topics: {
      device_issue: ["My phone screen is cracked, can you help?", "The camera on my handset stopped working.", "My device won't turn on after the update."],
      billing: ["I was charged twice on my last bill.", "Why is my bill higher than usual this month?", "Can you explain these data roaming charges?"],
      plan_change: ["I'd like to upgrade to an unlimited data plan.", "Can I switch to a cheaper monthly plan?", "How do I add a family line?"],
      network_coverage: ["I have no signal at my home address.", "Data speeds have been really slow this week.", "Is there an outage in my area?"],
      sim_activation: ["My new SIM card isn't activating.", "How long does eSIM activation take?", "I swapped SIMs and lost service."],
      refund: ["I want a refund for a device I returned.", "My accessory arrived damaged, I need a refund.", "Charge me back for the cancelled add-on please."],
    },
  },
  ichiba: {
    assignedTo: "Ichiba Support",
    agents: 4,
    topics: {
      return: ["I need to return an item that doesn't fit.", "The product I received is defective, how do I return it?", "Can I return an opened item?"],
      order_status: ["Where is my order? It hasn't shipped yet.", "My tracking hasn't updated in three days.", "Can you confirm my delivery date?"],
      refund: ["I returned my order but haven't been refunded.", "I want a refund for a cancelled order.", "Please refund the shipping fee."],
      product_question: ["Is this item available in a larger size?", "Does this product come with a warranty?", "What material is this made of?"],
      shipping: ["Can I change my delivery address?", "Do you offer express shipping to Osaka?", "My package was marked delivered but I didn't get it."],
      cancellation: ["I need to cancel my order before it ships.", "Can I cancel one item from my order?", "Please cancel my subscription box."],
    },
  },
  "r-travel": {
    assignedTo: "RTravel Concierge",
    agents: 3,
    topics: {
      booking: ["I want to book a trip to Tokyo next month.", "Can you help me reserve a hotel in Kyoto?", "I'd like to book a round-trip flight to Bali."],
      cancellation: ["I need to cancel my flight booking.", "Can I cancel my hotel reservation for a refund?", "Please cancel the tour I booked yesterday."],
      itinerary_change: ["Can I move my flight to a later date?", "I need to add a stopover to my itinerary.", "Change my hotel checkout to Sunday please."],
      refund: ["I want a refund for my cancelled trip.", "The tour was cancelled, when do I get my money back?", "Refund my seat upgrade, I no longer need it."],
      baggage: ["How much baggage is included on my ticket?", "I want to add an extra checked bag.", "My luggage was lost on my last flight."],
      visa_question: ["Do I need a visa to travel to Japan?", "How long does visa processing take?", "What documents do I need for entry?"],
    },
  },
};

const AGENT_REPLIES = [
  "I'm sorry to hear that — let me pull up your account and take a look.",
  "Thanks for reaching out. I can help you with that right away.",
  "I understand how frustrating that is. Here's what we can do.",
  "Good news — I've found your record and can resolve this now.",
  "Let me confirm a few details so I can assist you accurately.",
  "That's all sorted on my end. Is there anything else I can help with?",
  "I've escalated this to our specialist team; you'll hear back within 24 hours.",
  "I've processed that for you. You should see the update shortly.",
];
const USER_FOLLOWUPS = [
  "Okay, thank you.", "How long will that take?", "That works for me.",
  "Can you email me a confirmation?", "Great, I appreciate the help.",
  "What's the reference number?", "Is there any charge for this?",
];

function slugEmail(rng, first, last) {
  const domains = ["example.com", "mail.com", "inbox.test", "demo.io"];
  const sep = pick(rng, [".", "_", ""]);
  const num = rng() < 0.4 ? intBetween(rng, 1, 99) : "";
  return `${first}${sep}${last}${num}`.toLowerCase() + "@" + pick(rng, domains);
}

// ── Core generation ─────────────────────────────────────────────────
function generateTenant(tenantId, cfg, rng, opts) {
  const conversations = [];
  const messages = [];
  const flagged = [];
  const insights = [];

  const topicKeys = Object.keys(cfg.topics);
  let msgSeq = 0;

  for (let i = 1; i <= opts.conversationsPerTenant; i++) {
    const first = pick(rng, FIRST_NAMES);
    const last = pick(rng, LAST_NAMES);
    const topic = pick(rng, topicKeys);
    const status = weighted(rng, STATUSES);
    const sentiment = topic === "refund" && rng() < 0.5 ? "negative" : weighted(rng, SENTIMENTS);
    const agentNum = intBetween(rng, 1, cfg.agents);
    const ageDays = intBetween(rng, 0, 89);
    const createdAt = NOW - ageDays * DAY - intBetween(rng, 0, DAY - 1);
    const convId = `${tenantId}-conv-${i}`;

    conversations.push({
      id: convId,
      tenant_id: tenantId,
      customer_name: `${first} ${last}`,
      customer_email: slugEmail(rng, first, last),
      channel: weighted(rng, CHANNELS),
      status,
      sentiment,
      agent_id: `${tenantId}-agent-${agentNum}`,
      assigned_to: cfg.assignedTo,
      topic,
      priority: sentiment === "negative" ? weighted(rng, [["high", 3], ["urgent", 2], ["normal", 2]]) : weighted(rng, PRIORITIES),
      created_at: new Date(createdAt).toISOString(),
      updated_at: new Date(createdAt + intBetween(rng, 60_000, 6 * 3_600_000)).toISOString(),
    });

    // Message thread: opening user message on-topic, then alternating turns.
    const turns = intBetween(rng, 2, 8);
    let t = createdAt + intBetween(rng, 10_000, 120_000);
    const opener = pick(rng, cfg.topics[topic]);
    for (let turn = 0; turn < turns; turn++) {
      const role = turn === 0 ? "user" : turn % 2 === 1 ? "agent" : "user";
      const content = turn === 0 ? opener : role === "agent" ? pick(rng, AGENT_REPLIES) : pick(rng, USER_FOLLOWUPS);
      messages.push({
        id: `${tenantId}-msg-${++msgSeq}`,
        tenant_id: tenantId,
        conversation_id: convId,
        role,
        content,
        agent_id: role === "agent" ? `${tenantId}-agent-${agentNum}` : null,
        intent: turn === 0 ? topic : null,
        groundings: null,
        confidence: role === "agent" ? round(0.6 + rng() * 0.38) : null,
        created_at: new Date(t).toISOString(),
      });
      t += intBetween(rng, 15_000, 240_000);
    }

    // ~14% of conversations get flagged.
    if (rng() < 0.14) {
      flagged.push({
        id: `${tenantId}-flag-${flagged.length + 1}`,
        tenant_id: tenantId,
        conversation_id: convId,
        reason: pick(rng, FLAG_REASONS),
        severity: weighted(rng, SEVERITIES),
        status: weighted(rng, [["open", 5], ["reviewing", 2], ["resolved", 3]]),
        assigned_to: rng() < 0.5 ? cfg.assignedTo : null,
        notes: null,
        created_at: new Date(createdAt + DAY).toISOString(),
      });
    }
  }

  // Daily insights for the last 30 days across a fixed set of metrics.
  const metrics = [
    { metric: "resolution_rate", category: "quality", base: 82, jitter: 12, clampMax: 99 },
    { metric: "csat", category: "quality", base: 4.4, jitter: 0.5, clampMax: 5 },
    { metric: "avg_response_time", category: "performance", base: 1.8, jitter: 1.2, clampMax: 8 },
    { metric: "deflection_rate", category: "efficiency", base: 58, jitter: 18, clampMax: 95 },
    { metric: "conversation_volume", category: "volume", base: 120, jitter: 80, clampMax: 400, integer: true },
  ];
  let insSeq = 0;
  for (let d = 29; d >= 0; d--) {
    const date = new Date(NOW - d * DAY).toISOString().slice(0, 10);
    for (const m of metrics) {
      let value = m.base + (rng() - 0.5) * 2 * m.jitter;
      value = Math.max(0, Math.min(m.clampMax, value));
      value = m.integer ? Math.round(value) : round(value, m.metric === "csat" ? 2 : 1);
      insights.push({
        id: `${tenantId}-insight-${++insSeq}`,
        tenant_id: tenantId,
        date,
        metric: m.metric,
        value,
        category: m.category,
        created_at: new Date(NOW - d * DAY).toISOString(),
      });
    }
  }

  return { conversations, messages, flagged, insights };
}

/**
 * Generate a full dataset. Pure and deterministic for a given config.
 * @returns {{ meta: object, tenants: Record<string, object> }}
 */
function generate(opts = {}) {
  const conversationsPerTenant = opts.conversationsPerTenant ?? 50;
  const seed = opts.seed ?? 1337;
  const tenantIds = opts.tenants ?? Object.keys(TENANTS);

  const tenants = {};
  const totals = { conversations: 0, messages: 0, flagged: 0, insights: 0 };

  // One RNG stream, advanced per tenant in a fixed order → deterministic.
  const rng = makeRng(seed);
  for (const id of tenantIds) {
    const cfg = TENANTS[id];
    if (!cfg) throw new Error(`Unknown tenant "${id}"`);
    const data = generateTenant(id, cfg, rng, { conversationsPerTenant });
    tenants[id] = data;
    totals.conversations += data.conversations.length;
    totals.messages += data.messages.length;
    totals.flagged += data.flagged.length;
    totals.insights += data.insights.length;
  }

  return {
    meta: { seed, conversationsPerTenant, tenants: tenantIds, referenceDate: new Date(NOW).toISOString(), totals },
    tenants,
  };
}

// ── SQL emission (for loading into Postgres / Supabase) ─────────────
function sqlLiteral(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function insertRows(table, cols, rows) {
  if (!rows.length) return "";
  const values = rows
    .map((r) => "  (" + cols.map((c) => sqlLiteral(r[c])).join(", ") + ")")
    .join(",\n");
  return `INSERT INTO ${table} (${cols.join(", ")}) VALUES\n${values}\nON CONFLICT (id) DO NOTHING;\n\n`;
}
function toSql(dataset) {
  let sql = "-- Synthetic dataset (deterministic). Generated by tests/synthetic/generate.js\n";
  sql += `-- seed=${dataset.meta.seed} conversationsPerTenant=${dataset.meta.conversationsPerTenant}\n`;
  sql += "BEGIN;\n\n";
  for (const id of dataset.meta.tenants) {
    const d = dataset.tenants[id];
    sql += `-- tenant: ${id}\n`;
    sql += insertRows("conversations",
      ["id", "tenant_id", "customer_name", "customer_email", "channel", "status", "sentiment", "agent_id", "assigned_to", "topic", "priority", "created_at", "updated_at"],
      d.conversations);
    sql += insertRows("messages",
      ["id", "tenant_id", "conversation_id", "role", "content", "agent_id", "intent", "confidence", "created_at"],
      d.messages);
    sql += insertRows("insights",
      ["id", "tenant_id", "date", "metric", "value", "category", "created_at"],
      d.insights);
    sql += insertRows("flagged_conversations",
      ["id", "tenant_id", "conversation_id", "reason", "severity", "status", "assigned_to", "notes", "created_at"],
      d.flagged);
  }
  sql += "COMMIT;\n";
  return sql;
}

// ── File writing ────────────────────────────────────────────────────
function writeDataset(dataset, outDir, { sql = false } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  for (const id of dataset.meta.tenants) {
    const dir = path.join(outDir, id);
    fs.mkdirSync(dir, { recursive: true });
    const d = dataset.tenants[id];
    fs.writeFileSync(path.join(dir, "conversations.json"), JSON.stringify(d.conversations, null, 2));
    fs.writeFileSync(path.join(dir, "messages.json"), JSON.stringify(d.messages, null, 2));
    fs.writeFileSync(path.join(dir, "insights.json"), JSON.stringify(d.insights, null, 2));
    fs.writeFileSync(path.join(dir, "flagged.json"), JSON.stringify(d.flagged, null, 2));
  }
  fs.writeFileSync(path.join(outDir, "dataset.json"), JSON.stringify(dataset, null, 2));
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify(dataset.meta, null, 2));
  if (sql) fs.writeFileSync(path.join(outDir, "seed.sql"), toSql(dataset));
}

// ── CLI ─────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--conversations") out.conversationsPerTenant = parseInt(argv[++i], 10);
    else if (a === "--seed") out.seed = parseInt(argv[++i], 10);
    else if (a === "--tenants") out.tenants = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--out") out.out = argv[++i];
    else if (a === "--sql") out.sql = true;
  }
  return out;
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const outDir = args.out || path.join(__dirname, "data");
  const dataset = generate(args);
  writeDataset(dataset, outDir, { sql: !!args.sql });
  const { totals } = dataset.meta;
  console.log(`Synthetic dataset written to ${outDir}`);
  console.log(`  seed=${dataset.meta.seed} conversations/tenant=${dataset.meta.conversationsPerTenant}`);
  console.log(`  ${totals.conversations} conversations, ${totals.messages} messages, ${totals.insights} insights, ${totals.flagged} flagged`);
  if (args.sql) console.log(`  seed.sql emitted (psql -f ${path.join(outDir, "seed.sql")})`);
}

module.exports = { generate, toSql, writeDataset, TENANTS };
