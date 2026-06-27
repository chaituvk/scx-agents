"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Beaker, Plus, Loader2, CheckCircle, X, Play, Pause,
  BarChart3, ArrowUpRight, TrendingUp, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Variant {
  name: string;
  description: string;
  weight: number;
}

interface Experiment {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "running" | "paused" | "completed";
  variants: Variant[];
  metric_goal: string;
  created_at: string;
}

const METRIC_GOAL_OPTIONS = [
  "resolution_rate",
  "csat_score",
  "escalation_rate",
  "avg_handle_time",
  "first_contact_resolution",
  "fallback_rate",
];

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-white/5 text-muted-foreground",
  running: "bg-green-500/10 text-green-400",
  paused: "bg-yellow-500/10 text-yellow-400",
  completed: "bg-blue-500/10 text-blue-400",
};

function VariantEditor({ variants, onChange }: { variants: Variant[]; onChange: (v: Variant[]) => void }) {
  function update(i: number, field: keyof Variant, val: string | number) {
    onChange(variants.map((v, j) => j === i ? { ...v, [field]: val } : v));
  }

  function add() {
    const remaining = 100 - variants.reduce((s, v) => s + v.weight, 0);
    onChange([...variants, { name: `Variant ${String.fromCharCode(65 + variants.length)}`, description: "", weight: Math.max(remaining, 10) }]);
  }

  function remove(i: number) {
    if (variants.length <= 2) return;
    onChange(variants.filter((_, j) => j !== i));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-muted-foreground">Variants</label>
        <button onClick={add} className="text-[#c4a574] text-xs hover:text-[#d4b584] flex items-center gap-0.5">
          <Plus className="w-3 h-3" /> Add variant
        </button>
      </div>
      <div className="space-y-2">
        {variants.map((v, i) => (
          <div key={i} className="p-3 bg-black/20 border border-white/10 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c4a574]/10 text-[#c4a574] font-medium">
                {String.fromCharCode(65 + i)}
              </span>
              <input
                value={v.name}
                onChange={e => update(i, "name", e.target.value)}
                className="flex-1 bg-transparent text-xs font-medium outline-none text-foreground"
              />
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={v.weight}
                  onChange={e => update(i, "weight", parseInt(e.target.value) || 0)}
                  className="w-12 bg-transparent text-xs text-right outline-none text-foreground"
                />
                <span className="text-[10px] text-muted-foreground">%</span>
              </div>
              {variants.length > 2 && (
                <button onClick={() => remove(i)} className="text-muted-foreground hover:text-red-400">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <input
              value={v.description}
              onChange={e => update(i, "description", e.target.value)}
              placeholder="What's different in this variant?"
              className="w-full bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        ))}
        {(() => {
          const total = variants.reduce((s, v) => s + v.weight, 0);
          return total !== 100 ? (
            <p className={`text-[10px] ${total > 100 ? "text-red-400" : "text-yellow-400"}`}>
              ⚠ Weights sum to {total}% (must equal 100%)
            </p>
          ) : null;
        })()}
      </div>
    </div>
  );
}

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    metric_goal: "resolution_rate",
    variants: [
      { name: "Control", description: "Current behavior", weight: 50 },
      { name: "Treatment A", description: "New variant", weight: 50 },
    ] as Variant[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/experiments");
      if (res.ok) {
        const data = await res.json();
        setExperiments(data.experiments ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    const totalWeight = form.variants.reduce((s, v) => s + v.weight, 0);
    if (totalWeight !== 100) return;
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          variants: form.variants,
          metricGoal: form.metric_goal,
          status: "draft",
        }),
      });
      if (res.ok) {
        setCreating(false);
        setForm({
          name: "",
          description: "",
          metric_goal: "resolution_rate",
          variants: [
            { name: "Control", description: "Current behavior", weight: 50 },
            { name: "Treatment A", description: "New variant", weight: 50 },
          ],
        });
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/experiments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    if (res?.ok) {
      setExperiments(prev => prev.map(e => e.id === id ? { ...e, status: status as Experiment["status"] } : e));
    }
  }

  const runningCount = experiments.filter(e => e.status === "running").length;

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Beaker className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Experiments</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            A/B test prompt variants, playbooks, and journeys to find what works best.
          </p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2"
        >
          <Plus className="w-4 h-4" />
          New Experiment
        </Button>
      </div>

      {/* Summary */}
      {!loading && experiments.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{experiments.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Total</div>
          </div>
          <div className="bg-card border border-green-500/20 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{runningCount}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Running</div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{experiments.filter(e => e.status === "completed").length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Completed</div>
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
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-medium">New Experiment</h2>
              <button onClick={() => setCreating(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Empathetic vs. Direct tone"
                    className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Optimize For</label>
                  <select
                    value={form.metric_goal}
                    onChange={e => setForm(f => ({ ...f, metric_goal: e.target.value }))}
                    className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
                  >
                    {METRIC_GOAL_OPTIONS.map(m => (
                      <option key={m} value={m}>{m.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="What hypothesis are you testing?"
                  rows={2}
                  className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50 resize-none"
                />
              </div>
              <VariantEditor
                variants={form.variants}
                onChange={v => setForm(f => ({ ...f, variants: v }))}
              />
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleCreate}
                  disabled={saving || !form.name.trim() || form.variants.reduce((s, v) => s + v.weight, 0) !== 100}
                  className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Create Experiment
                </Button>
                <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Experiment list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : experiments.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <Beaker className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">No experiments yet</p>
          <p className="text-xs text-muted-foreground mt-1">Run A/B tests to scientifically optimize your AI agent.</p>
          <Button size="sm" className="mt-4 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584]" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" /> Create First Experiment
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {experiments.map(exp => (
            <motion.div
              key={exp.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-xl p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-sm">{exp.name}</h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_STYLES[exp.status] ?? STATUS_STYLES.draft}`}>
                      {exp.status}
                    </span>
                  </div>
                  {exp.description && (
                    <p className="text-xs text-muted-foreground mb-2">{exp.description}</p>
                  )}

                  {/* Variants */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(exp.variants ?? []).map((v, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/10"
                      >
                        <span className="text-[#c4a574] font-semibold">{String.fromCharCode(65 + i)}</span>
                        <span>{v.name}</span>
                        <span className="text-muted-foreground">·{v.weight}%</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground px-2 py-1">
                      <TrendingUp className="w-3 h-3" />
                      Optimizing: {(exp.metric_goal ?? "").replace(/_/g, " ")}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {exp.status === "draft" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(exp.id, "running")}
                      className="text-xs h-7 gap-1 border-green-500/30 text-green-400 hover:bg-green-500/10"
                    >
                      <Play className="w-3 h-3" /> Start
                    </Button>
                  )}
                  {exp.status === "running" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateStatus(exp.id, "paused")}
                        className="text-xs h-7 gap-1 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/10"
                      >
                        <Pause className="w-3 h-3" /> Pause
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateStatus(exp.id, "completed")}
                        className="text-xs h-7 gap-1 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584]"
                      >
                        <CheckCircle className="w-3 h-3" /> Complete
                      </Button>
                    </>
                  )}
                  {exp.status === "paused" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(exp.id, "running")}
                      className="text-xs h-7 gap-1 border-green-500/30 text-green-400 hover:bg-green-500/10"
                    >
                      <Play className="w-3 h-3" /> Resume
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3 text-[10px] text-muted-foreground border-t border-border pt-3">
                Created {new Date(exp.created_at).toLocaleDateString()}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
