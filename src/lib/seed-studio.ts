import { run, getOne } from "./db";

export async function seedStudioData() {
  const testCount = await getOne("SELECT COUNT(*) as count FROM regression_tests") as { count: number };
  if (testCount.count > 0) return;

  console.log("[seed-studio] Seeding studio data...");
  const now = new Date().toISOString();

  // ── Regression Tests ──────────────────────────────────────────────
  const regressionTests = [
    { id: "rt-1", tenant_id: "r-mobile", name: "Device Warranty Validation", description: "Ensures agent correctly applies warranty policy", category: "policy", status: "pass", last_run: now, duration: "1.2s" },
    { id: "rt-2", tenant_id: "r-mobile", name: "Plan Upgrade Compliance", description: "Verifies agent discloses terms before upgrading", category: "behavior", status: "pass", last_run: now, duration: "0.8s" },
    { id: "rt-3", tenant_id: "r-mobile", name: "Off-Limit Phrase Detection", description: "Checks guardrail triggers when agent uses banned phrases", category: "behavior", status: "pass", last_run: now, duration: "1.5s" },
    { id: "rt-4", tenant_id: "ichiba", name: "Return Window Validation", description: "Ensures agent correctly applies 30-day return policy", category: "policy", status: "pass", last_run: now, duration: "1.2s" },
    { id: "rt-5", tenant_id: "ichiba", name: "Refund Over $500 Escalation", description: "Verifies agent escalates refunds exceeding approval threshold", category: "policy", status: "pass", last_run: now, duration: "0.8s" },
    { id: "rt-6", tenant_id: "ichiba", name: "Order Lookup Integration", description: "Tests Shopify order API connectivity", category: "technical", status: "fail", last_run: now, duration: "2.1s", error_message: "API timeout after 5s - Shopify rate limit exceeded" },
    { id: "rt-7", tenant_id: "r-travel", name: "Booking Cancellation Flow", description: "Validates cancellation and refund process", category: "policy", status: "pass", last_run: now, duration: "0.9s" },
    { id: "rt-8", tenant_id: "r-travel", name: "Multi-Turn Context Memory", description: "Verifies agent remembers destination across 5+ turns", category: "technical", status: "partial", last_run: now, duration: "4.5s", error_message: "Context lost after turn 4 when switching topics" },
  ];

  for (const t of regressionTests) {
    await run(
      `INSERT INTO regression_tests (id, tenant_id, name, description, category, status, last_run, duration, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [t.id, t.tenant_id, t.name, t.description, t.category, t.status, t.last_run, t.duration, t.error_message ?? null, now]
    );
  }

  // ── Voice Sims ────────────────────────────────────────────────────
  const voiceSims = [
    { id: "vs-1", tenant_id: "r-mobile", name: "Quiet Room - Native Speaker", noise_level: "quiet", speaker_type: "native", transcript: "Hi, my phone screen is cracked. Can you help?", confidence: 0.97, accuracy: 0.98, status: "pass" },
    { id: "vs-2", tenant_id: "r-mobile", name: "Noisy Cafe - Native Speaker", noise_level: "noisy", speaker_type: "native", transcript: "Hi... [static] ...screen... [static] ...cracked.", confidence: 0.72, accuracy: 0.65, status: "fail" },
    { id: "vs-3", tenant_id: "ichiba", name: "Quiet Room - Non-Native Accent", noise_level: "quiet", speaker_type: "non-native", transcript: "Hello, my order is break. I want money back please.", confidence: 0.85, accuracy: 0.91, status: "pass" },
    { id: "vs-4", tenant_id: "ichiba", name: "Drive-Thru - Native Speaker", noise_level: "very-noisy", speaker_type: "native", transcript: "...return... [wind noise] ...order... [engine] ...refund...", confidence: 0.45, accuracy: 0.38, status: "fail" },
    { id: "vs-5", tenant_id: "r-travel", name: "Office - Native Speaker", noise_level: "moderate", speaker_type: "native", transcript: "I'd like to check the status of my booking.", confidence: 0.89, accuracy: 0.94, status: "pass" },
    { id: "vs-6", tenant_id: "r-travel", name: "Quiet Room - Elderly Speaker", noise_level: "quiet", speaker_type: "elderly", transcript: "Young man, I booked this trip last month and need to cancel. Can you help an old lady?", confidence: 0.92, accuracy: 0.95, status: "pass" },
  ];

  for (const v of voiceSims) {
    await run(
      `INSERT INTO voice_sims (id, tenant_id, name, noise_level, speaker_type, transcript, confidence, accuracy, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [v.id, v.tenant_id, v.name, v.noise_level, v.speaker_type, v.transcript, v.confidence, v.accuracy, v.status, now]
    );
  }

  // ── Simulation Runs ───────────────────────────────────────────────
  const scenarios = [
    { tenant_id: "r-mobile", name: "Device Troubleshooting", outcomes: ["success", "success", "partial"] },
    { tenant_id: "r-mobile", name: "Plan Upgrade", outcomes: ["success", "partial", "failure"] },
    { tenant_id: "ichiba", name: "Return & Refund Flow", outcomes: ["success", "success", "partial"] },
    { tenant_id: "ichiba", name: "Shipping & Tracking", outcomes: ["success", "success", "success"] },
    { tenant_id: "r-travel", name: "Booking Assistant", outcomes: ["partial", "success"] },
    { tenant_id: "r-travel", name: "Cancellation & Refund", outcomes: ["success", "success", "partial", "failure"] },
  ];

  for (let i = 0; i < 12; i++) {
    const sc = scenarios[i % scenarios.length];
    const outcome = sc.outcomes[Math.floor(Math.random() * sc.outcomes.length)];
    const metrics = {
      resolution: Math.floor(60 + Math.random() * 40),
      empathy: Math.floor(60 + Math.random() * 40),
      compliance: Math.floor(60 + Math.random() * 40),
      accuracy: Math.floor(60 + Math.random() * 40),
    };
    const issues: string[] = [];
    if (outcome === "failure") issues.push("Agent failed to resolve customer issue");
    if (outcome === "partial") issues.push("Resolution incomplete - required escalation");
    if (metrics.compliance < 75) issues.push("Guardrail violation detected");

    const date = new Date();
    date.setHours(date.getHours() - i * 2);

    await run(
      `INSERT INTO simulation_runs (id, tenant_id, scenario_name, outcome, metrics, issues, messages, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [`sim-${i}`, sc.tenant_id, sc.name, outcome, JSON.stringify(metrics), JSON.stringify(issues), JSON.stringify([]), date.toISOString()]
    );
  }

  console.log("[seed-studio] Studio data seeded successfully");
}
