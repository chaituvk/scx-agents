"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Plus, X, Check, Loader2, Search, Ban,
  AlertTriangle, Lock, ArrowRight, Trash2, Edit2,
  Scale, Building2, MessageSquare, Zap, Eye, ChevronDown,
  Activity, Clock, User, CheckCircle, XCircle, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────

type PolicyCategory = "safety" | "business" | "compliance" | "behavior";
type PolicySeverity = "critical" | "high" | "medium" | "low";
type PolicyEffect = "block" | "warn" | "require_approval" | "escalate";

interface Policy {
  id: string;
  statement: string;
  category: PolicyCategory;
  severity: PolicySeverity;
  effect: PolicyEffect;
  scope: "global" | "specific";
  active: boolean;
  created_at: string;
  trigger_count?: number;
}

type GuardrailLevel = "strict" | "moderate" | "permissive";
type GuardrailAction = "block" | "deflect" | "flag";

interface Guardrail {
  id: string;
  type: string;
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
  level?: GuardrailLevel;
  action?: GuardrailAction;
  topics?: string[];
  competitors?: string[];
}

interface AuditEvent {
  id: string;
  ts: string;
  playbook: string;
  policy: string;
  message: string;
  action: string;
  resolved: boolean;
}

// ─── Mock data ────────────────────────────────────────────────────────────

const INITIAL_POLICIES: Policy[] = [
  { id: "p1", statement: "Never offer refunds exceeding $500 without manager approval", category: "business", severity: "critical", effect: "require_approval", scope: "global", active: true, created_at: "2026-06-01T00:00:00Z", trigger_count: 12 },
  { id: "p2", statement: "Do not discuss competitor products, pricing, or services", category: "behavior", severity: "high", effect: "warn", scope: "global", active: true, created_at: "2026-06-02T00:00:00Z", trigger_count: 34 },
  { id: "p3", statement: "Always include a disclaimer when providing medical or legal guidance", category: "compliance", severity: "high", effect: "warn", scope: "global", active: true, created_at: "2026-06-05T00:00:00Z", trigger_count: 7 },
  { id: "p4", statement: "Never collect, repeat, or confirm payment card numbers in conversation", category: "safety", severity: "critical", effect: "block", scope: "global", active: true, created_at: "2026-06-10T00:00:00Z", trigger_count: 3 },
  { id: "p5", statement: "Immediately escalate if customer mentions physical harm, self-harm, or safety emergency", category: "safety", severity: "critical", effect: "escalate", scope: "global", active: true, created_at: "2026-06-10T00:00:00Z", trigger_count: 1 },
  { id: "p6", statement: "Do not make delivery date commitments not confirmed in the order management system", category: "business", severity: "medium", effect: "warn", scope: "global", active: false, created_at: "2026-06-15T00:00:00Z", trigger_count: 0 },
  { id: "p7", statement: "All responses involving account changes must include a confirmation step", category: "compliance", severity: "high", effect: "require_approval", scope: "global", active: true, created_at: "2026-06-18T00:00:00Z", trigger_count: 22 },
  { id: "p8", statement: "Never discuss internal pricing strategies, margins, or supplier details", category: "business", severity: "high", effect: "block", scope: "global", active: true, created_at: "2026-06-20T00:00:00Z", trigger_count: 0 },
];

const INITIAL_GUARDRAILS: Guardrail[] = [
  { id: "g1", type: "content_safety", label: "Content Safety", description: "Filters harmful, offensive, or inappropriate content from agent responses before delivery", icon: Shield, enabled: true, level: "moderate" },
  { id: "g2", type: "pii_protection", label: "PII Protection", description: "Auto-detects and masks personally identifiable information including SSNs, credit cards, and phone numbers", icon: Lock, enabled: true, action: "block" },
  { id: "g3", type: "topic_restriction", label: "Topic Restrictions", description: "Prevents the agent from engaging with specified off-limits topics across all playbooks", icon: Ban, enabled: false, topics: [] },
  { id: "g4", type: "competitor_filter", label: "Competitor Mention Filter", description: "Intercepts and deflects questions referencing competitor products, pricing, or services", icon: Building2, enabled: true, action: "deflect", competitors: [] },
  { id: "g5", type: "legal_claims", label: "Legal & Medical Claims Filter", description: "Blocks unsubstantiated legal, medical, or financial claims in agent responses", icon: Scale, enabled: true },
  { id: "g6", type: "language_safety", label: "Language Safety", description: "Filters profanity, slurs, and aggressive or abusive language in both directions", icon: MessageSquare, enabled: true, level: "strict" },
];

const AUDIT_EVENTS: AuditEvent[] = [
  { id: "a1", ts: "10:23 AM", playbook: "Returns & Refunds", policy: "Refund limit policy", message: "I need a refund for my $750 laptop that arrived damaged last week", action: "require_approval", resolved: true },
  { id: "a2", ts: "09:44 AM", playbook: "General Support", policy: "PII Protection", message: "My card number is 4532-xxxx and the billing zip is...", action: "blocked", resolved: true },
  { id: "a3", ts: "09:15 AM", playbook: "General Support", policy: "Competitor filter", message: "How does your pricing compare to what Competitor offers?", action: "deflect", resolved: true },
  { id: "a4", ts: "Yesterday 4:11 PM", playbook: "Returns & Refunds", policy: "Safety escalation", message: "I can't deal with this anymore, I'm so frustrated...", action: "escalated", resolved: true },
  { id: "a5", ts: "Yesterday 2:08 PM", playbook: "Account Support", policy: "Legal claims filter", message: "Can you guarantee my money is 100% safe with you?", action: "warned", resolved: true },
  { id: "a6", ts: "Yesterday 11:30 AM", playbook: "Returns & Refunds", policy: "Refund limit policy", message: "This $600 item was defective, I want my money back", action: "require_approval", resolved: true },
];

// ─── Config ───────────────────────────────────────────────────────────────

const CATEGORY_META: Record<PolicyCategory, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  safety:     { label: "Safety",     color: "text-red-400",    bgColor: "bg-red-500/10 border-red-500/20",    icon: Shield },
  business:   { label: "Business",   color: "text-blue-400",   bgColor: "bg-blue-500/10 border-blue-500/20",   icon: Building2 },
  compliance: { label: "Compliance", color: "text-yellow-400", bgColor: "bg-yellow-500/10 border-yellow-500/20", icon: Scale },
  behavior:   { label: "Behavior",   color: "text-purple-400", bgColor: "bg-purple-500/10 border-purple-500/20", icon: MessageSquare },
};

const SEVERITY_META: Record<PolicySeverity, { label: string; color: string }> = {
  critical: { label: "Critical", color: "text-red-400" },
  high:     { label: "High",     color: "text-orange-400" },
  medium:   { label: "Medium",   color: "text-yellow-400" },
  low:      { label: "Low",      color: "text-muted-foreground" },
};

const EFFECT_META: Record<PolicyEffect, { label: string; icon: React.ElementType; color: string; desc: string }> = {
  block:            { label: "Block",            icon: Ban,           color: "text-red-400",    desc: "Immediately stops the agent and returns an error message" },
  warn:             { label: "Warn",             icon: AlertTriangle, color: "text-yellow-400", desc: "Logs the event but lets the agent continue" },
  require_approval: { label: "Require Approval", icon: Lock,          color: "text-blue-400",   desc: "Pauses the conversation until a supervisor approves" },
  escalate:         { label: "Escalate",         icon: ArrowRight,    color: "text-orange-400", desc: "Immediately hands off to a human agent" },
};

const ACTION_BADGE: Record<string, string> = {
  blocked:          "text-red-400 bg-red-500/10 border-red-500/20",
  "require_approval": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  escalated:        "text-orange-400 bg-orange-500/10 border-orange-500/20",
  warned:           "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  deflect:          "text-purple-400 bg-purple-500/10 border-purple-500/20",
};

// ─── Small components ─────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${on ? "bg-[#c4a574]" : "bg-white/20"}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

function TagInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  function add() { const t = input.trim(); if (!t || values.includes(t)) { setInput(""); return; } onChange([...values, t]); setInput(""); }
  return (
    <div className="flex flex-wrap gap-1.5 p-2 bg-black/20 rounded-lg border border-white/10 min-h-[36px]">
      {values.map((v, i) => (
        <span key={i} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-white/10 text-foreground">
          {v}<button onClick={() => onChange(values.filter((_, j) => j !== i))} className="hover:text-red-400 text-muted-foreground">×</button>
        </span>
      ))}
      <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} placeholder={placeholder} className="flex-1 min-w-16 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground/50" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

type Tab = "policies" | "guardrails" | "audit";

export default function PoliciesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("policies");
  const [policies, setPolicies] = useState<Policy[]>(INITIAL_POLICIES);
  const [guardrails, setGuardrails] = useState<Guardrail[]>(INITIAL_GUARDRAILS);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<PolicyCategory | "all">("all");
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [editForm, setEditForm] = useState<Partial<Policy>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedGuardrail, setExpandedGuardrail] = useState<string | null>(null);

  const activeCount = policies.filter(p => p.active).length;
  const guardrailCount = guardrails.filter(g => g.enabled).length;
  const totalTriggers = policies.reduce((s, p) => s + (p.trigger_count ?? 0), 0);

  const filteredPolicies = policies.filter(p => {
    const matchesCat = catFilter === "all" || p.category === catFilter;
    const matchesSearch = !search || p.statement.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  function startCreate() {
    setIsCreating(true);
    setSelectedPolicy(null);
    setEditForm({ category: "business", severity: "high", effect: "warn", scope: "global", active: true });
  }

  function selectPolicy(p: Policy) {
    setSelectedPolicy(p);
    setEditForm({ ...p });
    setIsCreating(false);
  }

  function setEF<K extends keyof Policy>(k: K, v: Policy[K]) {
    setEditForm(f => ({ ...f, [k]: v }));
  }

  async function handleSave() {
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    if (isCreating) {
      const np: Policy = {
        ...(editForm as Policy),
        id: `p${Date.now()}`,
        created_at: new Date().toISOString(),
        trigger_count: 0,
      };
      setPolicies(prev => [np, ...prev]);
      setSelectedPolicy(np);
      setIsCreating(false);
    } else if (selectedPolicy) {
      const updated = { ...selectedPolicy, ...editForm } as Policy;
      setPolicies(prev => prev.map(p => p.id === selectedPolicy.id ? updated : p));
      setSelectedPolicy(updated);
    }
    setSaving(false);
  }

  function togglePolicy(id: string) {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
    if (selectedPolicy?.id === id) setSelectedPolicy(prev => prev ? { ...prev, active: !prev.active } : null);
  }

  function deletePolicy(id: string) {
    if (!confirm("Delete this policy?")) return;
    setPolicies(prev => prev.filter(p => p.id !== id));
    if (selectedPolicy?.id === id) { setSelectedPolicy(null); setEditForm({}); }
  }

  function toggleGuardrail(id: string) {
    setGuardrails(prev => prev.map(g => g.id === id ? { ...g, enabled: !g.enabled } : g));
  }

  function setGuardrailConfig<K extends keyof Guardrail>(id: string, key: K, val: Guardrail[K]) {
    setGuardrails(prev => prev.map(g => g.id === id ? { ...g, [key]: val } : g));
  }

  const isEditing = isCreating || selectedPolicy !== null;

  return (
    <div className="flex flex-col h-screen overflow-hidden pt-16">

      {/* ── Header ── */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between bg-[#0a0a0a] shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#c4a574]/10 border border-[#c4a574]/20">
            <Shield className="w-5 h-5 text-[#c4a574]" />
          </div>
          <div>
            <h1 className="text-base font-semibold">Policies &amp; Guardrails</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Company-wide rules and safety constraints applied across all playbooks</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span><span className="text-foreground font-medium">{activeCount}</span> active policies</span>
            <span><span className="text-foreground font-medium">{guardrailCount}</span> guardrails on</span>
            <span><span className="text-[#c4a574] font-medium">{totalTriggers}</span> triggers total</span>
          </div>
          {activeTab === "policies" && (
            <Button size="sm" onClick={startCreate} className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-1.5 h-8 text-xs">
              <Plus className="w-3 h-3" /> New Policy
            </Button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-border bg-[#0a0a0a] px-6 gap-0.5 shrink-0">
        {([
          { id: "policies" as Tab, label: "Policies", icon: Shield, count: activeCount },
          { id: "guardrails" as Tab, label: "Guardrails", icon: Ban, count: guardrailCount },
          { id: "audit" as Tab, label: "Audit Log", icon: Activity, count: AUDIT_EVENTS.length },
        ] as const).map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-[#c4a574] text-[#c4a574]" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-[#c4a574]/20 text-[#c4a574]" : "bg-white/8 text-muted-foreground"}`}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-hidden">

        {/* ═══ POLICIES TAB ═══ */}
        {activeTab === "policies" && (
          <div className="flex h-full">
            {/* Left: policy list */}
            <div className="w-96 shrink-0 border-r border-border flex flex-col bg-[#0d0d0d]">
              {/* Search + filter */}
              <div className="p-3 border-b border-border space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search policies…"
                    className="w-full bg-black/30 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none text-foreground placeholder:text-muted-foreground/40"
                  />
                </div>
                <div className="flex gap-1 flex-wrap">
                  <button onClick={() => setCatFilter("all")} className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${catFilter === "all" ? "bg-white/10 border-white/20 text-foreground" : "border-white/10 text-muted-foreground hover:text-foreground"}`}>
                    All ({policies.length})
                  </button>
                  {(Object.keys(CATEGORY_META) as PolicyCategory[]).map(cat => {
                    const m = CATEGORY_META[cat];
                    const Icon = m.icon;
                    return (
                      <button key={cat} onClick={() => setCatFilter(cat)} className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${catFilter === cat ? `${m.bgColor} ${m.color}` : "border-white/10 text-muted-foreground hover:text-foreground"}`}>
                        <Icon className="w-2.5 h-2.5" />{m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredPolicies.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground py-8">No policies match</p>
                ) : filteredPolicies.map(p => {
                  const cat = CATEGORY_META[p.category];
                  const sev = SEVERITY_META[p.severity];
                  const eff = EFFECT_META[p.effect];
                  const EffIcon = eff.icon;
                  return (
                    <button
                      key={p.id}
                      onClick={() => selectPolicy(p)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${selectedPolicy?.id === p.id ? "border-[#c4a574]/30 bg-[#c4a574]/5" : "border-white/5 bg-white/2 hover:border-white/10 hover:bg-white/4"} ${!p.active ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 shrink-0">
                          <Toggle on={p.active} onToggle={() => togglePolicy(p.id)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground leading-snug line-clamp-2">{p.statement}</p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${cat.bgColor} ${cat.color}`}>{cat.label}</span>
                            <span className={`text-[9px] font-medium ${sev.color}`}>{sev.label}</span>
                            <span className={`flex items-center gap-0.5 text-[9px] ${eff.color}`}>
                              <EffIcon className="w-2.5 h-2.5" />{eff.label}
                            </span>
                            {(p.trigger_count ?? 0) > 0 && (
                              <span className="text-[9px] text-muted-foreground/50 ml-auto">{p.trigger_count} triggers</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right: editor */}
            <div className="flex-1 overflow-y-auto p-6">
              {isEditing ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-xl">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-sm font-semibold">{isCreating ? "New Policy" : "Edit Policy"}</h2>
                    <div className="flex items-center gap-2">
                      {!isCreating && selectedPolicy && (
                        <button onClick={() => deletePolicy(selectedPolicy.id)} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => { setSelectedPolicy(null); setIsCreating(false); setEditForm({}); }} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Statement */}
                  <div className="mb-5">
                    <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Policy Statement</label>
                    <textarea
                      value={editForm.statement ?? ""}
                      onChange={e => setEF("statement", e.target.value)}
                      placeholder="e.g. Never offer refunds exceeding $500 without manager approval"
                      rows={3}
                      className="w-full bg-black/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none text-foreground placeholder:text-muted-foreground/40 resize-none focus:border-white/20"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Write as a declarative rule. Be specific — ambiguous policies are harder to enforce.</p>
                  </div>

                  {/* Category + Severity */}
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Category</label>
                      <div className="space-y-1.5">
                        {(Object.keys(CATEGORY_META) as PolicyCategory[]).map(cat => {
                          const m = CATEGORY_META[cat];
                          const Icon = m.icon;
                          return (
                            <button key={cat} onClick={() => setEF("category", cat)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${editForm.category === cat ? `${m.bgColor} ${m.color}` : "border-white/8 bg-white/2 text-muted-foreground hover:border-white/15"}`}>
                              <Icon className="w-3.5 h-3.5 shrink-0" />{m.label}
                              {editForm.category === cat && <Check className="w-3 h-3 ml-auto" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Severity</label>
                      <div className="space-y-1.5">
                        {(Object.keys(SEVERITY_META) as PolicySeverity[]).map(sev => {
                          const m = SEVERITY_META[sev];
                          return (
                            <button key={sev} onClick={() => setEF("severity", sev)} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all ${editForm.severity === sev ? "border-white/20 bg-white/8 text-foreground" : "border-white/8 bg-white/2 text-muted-foreground hover:border-white/15"}`}>
                              <span className={m.color}>{m.label}</span>
                              {editForm.severity === sev && <Check className="w-3 h-3 text-muted-foreground" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Effect */}
                  <div className="mb-5">
                    <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Effect when triggered</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.entries(EFFECT_META) as [PolicyEffect, typeof EFFECT_META[PolicyEffect]][]).map(([eff, m]) => {
                        const Icon = m.icon;
                        return (
                          <button key={eff} onClick={() => setEF("effect", eff)} className={`text-left p-3 rounded-xl border transition-all ${editForm.effect === eff ? "border-white/20 bg-white/8" : "border-white/8 bg-white/2 hover:border-white/15"}`}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <Icon className={`w-3.5 h-3.5 ${m.color}`} />
                              <span className={`text-xs font-medium ${editForm.effect === eff ? "text-foreground" : "text-muted-foreground"}`}>{m.label}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-relaxed">{m.desc}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active toggle */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-white/8 bg-white/2 mb-6">
                    <div>
                      <p className="text-xs font-medium">Policy Active</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Inactive policies are saved but not enforced</p>
                    </div>
                    <Toggle on={!!editForm.active} onToggle={() => setEF("active", !editForm.active)} />
                  </div>

                  <Button onClick={handleSave} disabled={saving || !editForm.statement?.trim()} className="w-full bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2 h-9">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    {isCreating ? "Create Policy" : "Save Changes"}
                  </Button>
                </motion.div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Shield className="w-10 h-10 mx-auto mb-4 text-muted-foreground/15" />
                    <p className="text-sm font-medium text-muted-foreground mb-1">No policy selected</p>
                    <p className="text-xs text-muted-foreground/60 mb-4">Select a policy to edit or create a new one</p>
                    <div className="text-left p-4 rounded-xl border border-white/5 bg-white/2 max-w-xs mx-auto">
                      <p className="text-[10px] font-medium text-muted-foreground mb-2">Policy categories</p>
                      <div className="space-y-1.5">
                        {(Object.entries(CATEGORY_META) as [PolicyCategory, typeof CATEGORY_META[PolicyCategory]][]).map(([cat, m]) => {
                          const Icon = m.icon;
                          return (
                            <div key={cat} className="flex items-center gap-2 text-[10px]">
                              <Icon className={`w-3 h-3 ${m.color}`} />
                              <span className="text-muted-foreground">{m.label}</span>
                              <span className="text-muted-foreground/40 ml-auto">{policies.filter(p => p.category === cat && p.active).length} active</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ GUARDRAILS TAB ═══ */}
        {activeTab === "guardrails" && (
          <div className="overflow-y-auto h-full p-6">
            <div className="max-w-3xl mx-auto">
              <div className="mb-6 p-4 rounded-xl bg-[#c4a574]/5 border border-[#c4a574]/15">
                <div className="flex items-start gap-3">
                  <Info className="w-4 h-4 text-[#c4a574] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-[#c4a574]">Global guardrails apply to all playbooks</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Individual playbooks can add additional restrictions but cannot loosen these global settings. Changes take effect immediately on active conversations.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {guardrails.map(g => {
                  const Icon = g.icon;
                  const isExpanded = expandedGuardrail === g.id;
                  return (
                    <motion.div key={g.id} layout className="border border-border rounded-xl overflow-hidden bg-[#0d0d0d]">
                      <div className="flex items-center gap-4 p-4">
                        <div className={`p-2 rounded-xl shrink-0 transition-colors ${g.enabled ? "bg-[#c4a574]/10" : "bg-white/5"}`}>
                          <Icon className={`w-4 h-4 ${g.enabled ? "text-[#c4a574]" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{g.label}</p>
                            {g.enabled && (
                              <span className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                                <span className="w-1 h-1 rounded-full bg-green-400" />Active
                              </span>
                            )}
                            {g.level && g.enabled && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/8 text-muted-foreground capitalize">{g.level}</span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{g.description}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {(g.level || g.action || g.topics !== undefined || g.competitors !== undefined) && (
                            <button onClick={() => setExpandedGuardrail(isExpanded ? null : g.id)} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                              <Eye className="w-3 h-3" />
                              {isExpanded ? "Less" : "Configure"}
                              <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </button>
                          )}
                          <Toggle on={g.enabled} onToggle={() => toggleGuardrail(g.id)} />
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && g.enabled && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-4">
                              {g.level !== undefined && (
                                <div>
                                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Level</p>
                                  <div className="flex gap-2">
                                    {(["strict", "moderate", "permissive"] as GuardrailLevel[]).map(lvl => (
                                      <button key={lvl} onClick={() => setGuardrailConfig(g.id, "level", lvl)} className={`flex-1 py-1.5 rounded-lg border text-xs transition-colors capitalize ${g.level === lvl ? "border-[#c4a574]/40 bg-[#c4a574]/10 text-[#c4a574]" : "border-white/10 text-muted-foreground hover:border-white/20"}`}>
                                        {lvl}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {g.action !== undefined && (
                                <div>
                                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Action</p>
                                  <div className="flex gap-2">
                                    {(["block", "deflect", "flag"] as GuardrailAction[]).map(act => (
                                      <button key={act} onClick={() => setGuardrailConfig(g.id, "action", act)} className={`flex-1 py-1.5 rounded-lg border text-xs transition-colors capitalize ${g.action === act ? "border-[#c4a574]/40 bg-[#c4a574]/10 text-[#c4a574]" : "border-white/10 text-muted-foreground hover:border-white/20"}`}>
                                        {act}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {g.topics !== undefined && (
                                <div>
                                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Restricted Topics</p>
                                  <TagInput values={g.topics} onChange={v => setGuardrailConfig(g.id, "topics", v)} placeholder="Add topic — press Enter" />
                                </div>
                              )}
                              {g.competitors !== undefined && (
                                <div>
                                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Competitor Names (optional)</p>
                                  <TagInput values={g.competitors ?? []} onChange={v => setGuardrailConfig(g.id, "competitors", v)} placeholder="Add competitor name — press Enter" />
                                  <p className="text-[10px] text-muted-foreground mt-1">Leave empty to deflect all competitor comparisons generically.</p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══ AUDIT LOG TAB ═══ */}
        {activeTab === "audit" && (
          <div className="overflow-y-auto h-full p-6">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted-foreground">Showing the last {AUDIT_EVENTS.length} policy trigger events</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Last updated just now</span>
                </div>
              </div>

              <div className="space-y-2">
                {AUDIT_EVENTS.map(ev => {
                  const badgeClass = ACTION_BADGE[ev.action] ?? "text-muted-foreground bg-white/5 border-white/10";
                  return (
                    <motion.div key={ev.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl border border-white/8 bg-white/2 hover:bg-white/3 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 mt-0.5">
                          {ev.resolved ? (
                            <CheckCircle className="w-4 h-4 text-green-400/60" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400/60" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="text-xs font-medium">{ev.policy}</span>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full border capitalize ${badgeClass}`}>{ev.action}</span>
                            <span className="text-[10px] text-muted-foreground/50 ml-auto">{ev.ts}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground bg-black/20 rounded-lg px-2.5 py-1.5 font-mono truncate">&quot;{ev.message}&quot;</p>
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/60">
                            <User className="w-3 h-3" />
                            <span>{ev.playbook}</span>
                            {ev.resolved && <span className="text-green-400/60">· Resolved</span>}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
