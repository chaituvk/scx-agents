"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Plus, Loader2, CheckCircle, AlertCircle, X, Trash2, Edit3,
  Lock, Eye, AlertTriangle, ToggleLeft, ToggleRight, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Guardrail {
  id: string;
  name: string;
  description?: string;
  kind: string;
  status: "active" | "inactive" | "draft";
  policies?: Policy[];
  created_at: string;
  updated_at: string;
}

interface Policy {
  type: string;
  rule: string;
  action: string;
  severity: "critical" | "high" | "medium" | "low";
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  low: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const POLICY_TYPE_OPTIONS = ["keyword_block", "topic_restriction", "pii_redaction", "sentiment_trigger", "compliance_check", "output_filter"];
const POLICY_ACTION_OPTIONS = ["block", "warn", "redact", "escalate", "log"];

function PolicyEditor({ policies, onChange }: { policies: Policy[]; onChange: (p: Policy[]) => void }) {
  const [newPolicy, setNewPolicy] = useState<Policy>({ type: "keyword_block", rule: "", action: "block", severity: "high" });

  function add() {
    if (!newPolicy.rule.trim()) return;
    onChange([...policies, { ...newPolicy, rule: newPolicy.rule.trim() }]);
    setNewPolicy({ type: "keyword_block", rule: "", action: "block", severity: "high" });
  }

  return (
    <div>
      <label className="text-xs text-muted-foreground uppercase tracking-wider">Rules</label>
      <div className="mt-1.5 space-y-2">
        {policies.map((p, i) => (
          <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${SEVERITY_COLORS[p.severity]}`}>
            <Shield className="w-3 h-3 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{p.rule}</div>
              <div className="opacity-70 mt-0.5">{p.type.replace(/_/g, " ")} → {p.action}</div>
            </div>
            <span className="text-[10px] font-semibold uppercase">{p.severity}</span>
            <button onClick={() => onChange(policies.filter((_, j) => j !== i))} className="hover:opacity-70">
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <div className="grid grid-cols-4 gap-2">
          <select
            value={newPolicy.type}
            onChange={e => setNewPolicy(p => ({ ...p, type: e.target.value }))}
            className="col-span-1 bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none text-foreground"
          >
            {POLICY_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
          </select>
          <input
            value={newPolicy.rule}
            onChange={e => setNewPolicy(p => ({ ...p, rule: e.target.value }))}
            onKeyDown={e => { if (e.key === "Enter") add(); }}
            placeholder="Rule / keyword / pattern"
            className="col-span-1 bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none text-foreground placeholder:text-muted-foreground/50"
          />
          <select
            value={newPolicy.action}
            onChange={e => setNewPolicy(p => ({ ...p, action: e.target.value }))}
            className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none text-foreground"
          >
            {POLICY_ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={newPolicy.severity}
            onChange={e => setNewPolicy(p => ({ ...p, severity: e.target.value as Policy["severity"] }))}
            className="bg-black/20 border border-white/10 rounded-lg px-2 py-1.5 text-xs outline-none text-foreground"
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <Button size="sm" onClick={add} variant="outline" className="text-xs h-7">
          <Plus className="w-3 h-3 mr-1" /> Add Rule
        </Button>
      </div>
    </div>
  );
}

export default function TrustPage() {
  const [guardrails, setGuardrails] = useState<Guardrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", policies: [] as Policy[] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/guardrails");
      if (res.ok) {
        const data = await res.json();
        setGuardrails(data.guardrails ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/guardrails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          policies: form.policies,
          status: "active",
        }),
      });
      setCreating(false);
      setForm({ name: "", description: "", policies: [] });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(g: Guardrail) {
    const newStatus = g.status === "active" ? "inactive" : "active";
    await fetch(`/api/guardrails/${g.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {});
    setGuardrails(prev => prev.map(r => r.id === g.id ? { ...r, status: newStatus as Guardrail["status"] } : r));
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this guardrail?")) return;
    await fetch(`/api/guardrails/${id}`, { method: "DELETE" }).catch(() => {});
    setGuardrails(prev => prev.filter(g => g.id !== id));
  }

  const activeCount = guardrails.filter(g => g.status === "active").length;

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Trust & Safety</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Guardrails that protect your customers and brand — enforced at the AI layer before any response is sent.
          </p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Guardrail
        </Button>
      </div>

      {/* Quick stats */}
      {!loading && guardrails.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <Shield className="w-5 h-5 text-green-400" />
            <div>
              <div className="text-xl font-bold">{activeCount}</div>
              <div className="text-xs text-muted-foreground">Active guardrails</div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            <div>
              <div className="text-xl font-bold">
                {guardrails.reduce((sum, g) => sum + ((g.policies as Policy[] ?? []).filter(p => p.severity === "critical").length), 0)}
              </div>
              <div className="text-xs text-muted-foreground">Critical rules</div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <Lock className="w-5 h-5 text-blue-400" />
            <div>
              <div className="text-xl font-bold">
                {guardrails.reduce((sum, g) => sum + (g.policies as Policy[] ?? []).length, 0)}
              </div>
              <div className="text-xs text-muted-foreground">Total rules</div>
            </div>
          </div>
        </div>
      )}

      {/* Create form */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-card border border-[#c4a574]/30 rounded-xl p-6 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#c4a574]" />
                New Guardrail
              </h2>
              <button onClick={() => setCreating(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. PII Protection, Off-topic Blocker"
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Description</label>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What does this guardrail protect against?"
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <PolicyEditor policies={form.policies} onChange={p => setForm(f => ({ ...f, policies: p }))} />
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleCreate}
                  disabled={saving || !form.name.trim()}
                  className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Create Guardrail
                </Button>
                <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guardrails list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : guardrails.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Shield className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">No guardrails configured</p>
          <p className="text-xs text-muted-foreground mt-1">Add guardrails to protect your AI from harmful outputs and policy violations.</p>
          <Button size="sm" className="mt-4 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584]" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add First Guardrail
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {guardrails.map(g => {
            const policies = (g.policies ?? []) as Policy[];
            const isExpanded = expanded === g.id;
            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-card border rounded-xl overflow-hidden ${g.status === "active" ? "border-green-500/20" : "border-border opacity-70"}`}
              >
                <div className="p-4 flex items-start gap-3">
                  <button onClick={() => toggleStatus(g)} className="mt-0.5 shrink-0">
                    {g.status === "active" ? (
                      <ToggleRight className="w-5 h-5 text-green-400" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-sm">{g.name}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${g.status === "active" ? "bg-green-500/10 text-green-400" : "bg-white/5 text-muted-foreground"}`}>
                        {g.status}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{policies.length} rules</span>
                    </div>
                    {g.description && <p className="text-xs text-muted-foreground">{g.description}</p>}
                    {policies.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {policies.slice(0, 4).map((p, i) => (
                          <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[p.severity]}`}>
                            {p.type.replace(/_/g, " ")}
                          </span>
                        ))}
                        {policies.length > 4 && <span className="text-[10px] text-muted-foreground">+{policies.length - 4}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : g.id)}
                      className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    <button onClick={() => handleDelete(g.id)} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <AnimatePresence>
                  {isExpanded && policies.length > 0 && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border p-4 space-y-2">
                        {policies.map((p, i) => (
                          <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${SEVERITY_COLORS[p.severity]}`}>
                            <Shield className="w-3 h-3 shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <div className="font-medium">{p.rule}</div>
                              <div className="opacity-70 mt-0.5">{p.type.replace(/_/g, " ")} → {p.action}</div>
                            </div>
                            <span className="text-[10px] font-semibold uppercase shrink-0">{p.severity}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
