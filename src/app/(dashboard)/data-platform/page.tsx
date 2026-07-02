"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Database, Users, Loader2, Search, Brain, Layers, Clock,
  BarChart2, ArrowRight, Eye, RefreshCw,
} from "lucide-react";
import Link from "next/link";

interface Customer {
  id: string;
  name?: string;
  email?: string;
  channel?: string;
  total_conversations?: number;
  last_seen_at?: string;
  metadata?: Record<string, unknown>;
  memory?: Record<string, unknown>;
  tags?: string[];
}

interface PlatformStats {
  total_customers: number;
  customers_with_memory: number;
  total_memory_slots: number;
  avg_conversations_per_customer: number;
  top_channels: { channel: string; count: number }[];
  top_intents: { intent: string; count: number }[];
}

const ENTITY_TYPES = [
  { key: "order_id", label: "Order IDs", color: "text-blue-400 bg-blue-500/10", count: 1842 },
  { key: "product_sku", label: "Product SKUs", color: "text-purple-400 bg-purple-500/10", count: 934 },
  { key: "account_tier", label: "Account Tiers", color: "text-[#c4a574] bg-[#c4a574]/10", count: 3201 },
  { key: "support_topic", label: "Support Topics", color: "text-green-400 bg-green-500/10", count: 5670 },
  { key: "complaint_flag", label: "Complaint Flags", color: "text-red-400 bg-red-500/10", count: 287 },
  { key: "preferred_language", label: "Languages", color: "text-cyan-400 bg-cyan-500/10", count: 3201 },
];

export default function DataPlatformPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "customers" | "entities">("overview");

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics?type=customers");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats ?? null);
      }
    } catch {}
  }, []);

  const loadCustomers = useCallback(async (q?: string) => {
    setSearching(!!q);
    if (!q) setLoading(true);
    try {
      const url = q ? `/api/customers?search=${encodeURIComponent(q)}&limit=20` : "/api/customers?limit=20";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers ?? []);
      }
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadCustomers();
  }, [loadStats, loadCustomers]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim()) loadCustomers(search.trim());
      else loadCustomers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, loadCustomers]);

  const statCards = [
    { label: "Total Customers", value: stats?.total_customers?.toLocaleString() ?? "—", icon: Users, color: "text-[#c4a574]" },
    { label: "With Memory", value: stats?.customers_with_memory?.toLocaleString() ?? "—", icon: Brain, color: "text-purple-400" },
    { label: "Memory Slots", value: stats?.total_memory_slots?.toLocaleString() ?? "—", icon: Layers, color: "text-blue-400" },
    { label: "Avg Conversations", value: stats?.avg_conversations_per_customer?.toFixed(1) ?? "—", icon: BarChart2, color: "text-green-400" },
  ];

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Data Platform</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Customer memory, entity extraction, and personalization — powering context-aware conversations at scale.
          </p>
        </div>
        <button
          onClick={() => { loadStats(); loadCustomers(search || undefined); }}
          className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-2xl font-semibold">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1 w-fit mb-6">
        {(["overview", "customers", "entities"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeTab === tab ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Channel breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <h3 className="font-medium text-sm mb-4">Customers by Channel</h3>
            {stats?.top_channels && stats.top_channels.length > 0 ? (
              <div className="space-y-3">
                {stats.top_channels.map(ch => {
                  const max = Math.max(...stats.top_channels.map(c => c.count));
                  const pct = Math.round((ch.count / max) * 100);
                  return (
                    <div key={ch.channel}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="capitalize">{ch.channel}</span>
                        <span className="text-muted-foreground">{ch.count.toLocaleString()}</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-[#c4a574] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground">No channel data yet</div>
            )}
          </motion.div>

          {/* Top intents */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <h3 className="font-medium text-sm mb-4">Top Customer Intents</h3>
            {stats?.top_intents && stats.top_intents.length > 0 ? (
              <div className="space-y-2">
                {stats.top_intents.slice(0, 8).map((intent, i) => (
                  <div key={intent.intent} className="flex items-center gap-3 text-xs">
                    <span className="w-4 text-muted-foreground/60 text-right">{i + 1}</span>
                    <span className="flex-1">{intent.intent.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground">{intent.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-muted-foreground">No intent data yet</div>
            )}
          </motion.div>

          {/* Memory architecture */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-xl p-5 lg:col-span-2"
          >
            <h3 className="font-medium text-sm mb-4">Memory Architecture</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  title: "Working Memory",
                  icon: Clock,
                  color: "text-blue-400",
                  desc: "In-session context: current intent, recent turns, active slots. Cleared at conversation end.",
                  ttl: "Session-scoped",
                },
                {
                  title: "Episodic Memory",
                  icon: Brain,
                  color: "text-purple-400",
                  desc: "Cross-session events: past orders, complaints, resolved issues. Informs future conversations.",
                  ttl: "90 days",
                },
                {
                  title: "Semantic Memory",
                  icon: Database,
                  color: "text-[#c4a574]",
                  desc: "Long-term customer facts: preferences, account tier, language, opt-outs. Never expires.",
                  ttl: "Permanent",
                },
              ].map(m => (
                <div key={m.title} className="p-4 bg-black/20 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <m.icon className={`w-4 h-4 ${m.color}`} />
                    <p className="text-xs font-medium">{m.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
                  <div className="mt-3 text-[10px] px-2 py-1 rounded bg-white/5 text-muted-foreground w-fit">
                    TTL: {m.ttl}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {activeTab === "customers" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 flex-1 bg-card border border-border rounded-xl px-4 py-2.5">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email…"
                className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
              />
              {searching && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground shrink-0" />}
            </div>
            <Link href="/customers" className="text-sm text-[#c4a574] hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <Users className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm font-medium">No customers found</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_80px_80px_40px] gap-4 px-4 py-2.5 border-b border-border text-[10px] text-muted-foreground uppercase tracking-wider">
                <span>Customer</span>
                <span>Email</span>
                <span>Channel</span>
                <span>Conversations</span>
                <span></span>
              </div>
              <div className="divide-y divide-white/5">
                {customers.map(c => (
                  <div key={c.id} className="grid grid-cols-[1fr_1fr_80px_80px_40px] gap-4 px-4 py-3 items-center hover:bg-white/2 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{c.name || "Anonymous"}</p>
                      {c.last_seen_at && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Last seen {new Date(c.last_seen_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.email || "—"}</p>
                    <span className="text-xs text-muted-foreground capitalize">{c.channel || "—"}</span>
                    <span className="text-xs text-center">{c.total_conversations ?? 0}</span>
                    <Link href="/customers" className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground flex justify-center">
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {activeTab === "entities" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              Sierra automatically extracts and stores structured entities from conversations, making them available as memory slots for future interactions.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {ENTITY_TYPES.map((e, i) => (
              <motion.div
                key={e.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-card border border-border rounded-xl p-4"
              >
                <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg mb-3 ${e.color}`}>
                  <span className="font-mono">{e.key}</span>
                </div>
                <p className="text-sm font-medium">{e.label}</p>
                <p className="text-2xl font-semibold mt-1">{e.count.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">stored values</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-xl p-5 mt-6"
          >
            <h3 className="font-medium text-sm mb-3">Memory Slot Example</h3>
            <pre className="text-xs font-mono text-green-300/80 bg-[#050505] rounded-lg p-4 overflow-x-auto leading-relaxed">
{`{
  "customer_id": "usr_7f9a2b",
  "memory": {
    "account_tier": "premium",
    "preferred_language": "en-US",
    "last_order_id": "ORD-2024-88271",
    "complaint_count": 1,
    "support_topics": ["billing", "shipping"],
    "opted_out_proactive": false
  },
  "updated_at": "2026-06-27T09:14:22Z"
}`}
            </pre>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
