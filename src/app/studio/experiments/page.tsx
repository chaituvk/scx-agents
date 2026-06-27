"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical,
  Plus,
  Play,
  Pause,
  CheckCircle,
  Trash2,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  GitBranch,
  TrendingUp,
  Users,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Variant {
  id: string;
  name: string;
  playbookId?: string;
  weight: number;
}

interface VariantStat {
  variant_id: string;
  total_assigned: number;
  resolved: number;
  escalated: number;
  completed: number;
  completion_rate: number;
  escalation_rate: number;
}

interface Experiment {
  id: string;
  name: string;
  description?: string;
  status: "draft" | "active" | "stopped" | "completed";
  variants: Variant[];
  metric_goal: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-500/20 text-gray-400 border-gray-500/20",
  active: "bg-green-500/20 text-green-400 border-green-500/20",
  stopped: "bg-yellow-500/20 text-yellow-400 border-yellow-500/20",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/20",
};

function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

interface CreateDialogProps {
  onClose: () => void;
  onCreate: (exp: Experiment) => void;
}

function CreateDialog({ onClose, onCreate }: CreateDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [metricGoal, setMetricGoal] = useState("resolution_rate");
  const [variants, setVariants] = useState<Variant[]>([
    { id: crypto.randomUUID(), name: "Control", weight: 50 },
    { id: crypto.randomUUID(), name: "Variant A", weight: 50 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addVariant() {
    if (variants.length >= 4) return;
    const remaining = Math.floor(100 / (variants.length + 1));
    setVariants([
      ...variants.map((v) => ({ ...v, weight: remaining })),
      { id: crypto.randomUUID(), name: `Variant ${String.fromCharCode(64 + variants.length)}`, weight: remaining },
    ]);
  }

  function removeVariant(id: string) {
    if (variants.length <= 2) return;
    setVariants(variants.filter((v) => v.id !== id));
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined, variants, metricGoal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onCreate(data.experiment);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-[#141414] border border-white/10 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
        <h3 className="font-semibold text-lg mb-5 flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-[#c4a574]" /> New Experiment
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Experiment Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Empathetic vs. Direct tone"
              className="bg-[#0a0a0a] border-white/10"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Description (optional)</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you testing and why?"
              rows={2}
              className="text-sm bg-[#0a0a0a] border-white/10 resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Primary Metric</label>
            <select
              value={metricGoal}
              onChange={(e) => setMetricGoal(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0a0a0a] border border-white/10 text-sm text-foreground"
            >
              <option value="resolution_rate">Resolution Rate</option>
              <option value="csat_score">CSAT Score</option>
              <option value="escalation_rate">Escalation Rate (lower is better)</option>
              <option value="handle_time">Handle Time (lower is better)</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">Variants</label>
              {variants.length < 4 && (
                <button onClick={addVariant} className="text-xs text-[#c4a574] hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add variant
                </button>
              )}
            </div>
            <div className="space-y-2">
              {variants.map((v, i) => (
                <div key={v.id} className="flex items-center gap-2 p-3 bg-[#0a0a0a] rounded-lg border border-white/5">
                  <div className="w-5 h-5 rounded-full bg-[#c4a574]/20 flex items-center justify-center text-[10px] text-[#c4a574] shrink-0 font-bold">
                    {String.fromCharCode(65 + i)}
                  </div>
                  <Input
                    value={v.name}
                    onChange={(e) => setVariants(variants.map((x) => x.id === v.id ? { ...x, name: e.target.value } : x))}
                    className="flex-1 h-7 text-sm bg-transparent border-0 p-0 focus-visible:ring-0"
                    placeholder="Variant name"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <Input
                      type="number"
                      min="1"
                      max="99"
                      value={v.weight}
                      onChange={(e) => setVariants(variants.map((x) => x.id === v.id ? { ...x, weight: Number(e.target.value) } : x))}
                      className="w-14 h-7 text-sm text-center bg-transparent border-white/10"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  {variants.length > 2 && (
                    <button onClick={() => removeVariant(v.id)} className="text-muted-foreground hover:text-red-400 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

        <div className="flex gap-2 mt-5">
          <Button onClick={onClose} variant="outline" size="sm" className="flex-1 border-white/10">Cancel</Button>
          <Button
            onClick={handleCreate}
            size="sm"
            className="flex-1 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
            disabled={!name.trim() || saving}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
            Create
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

interface ExperimentCardProps {
  experiment: Experiment;
  onUpdate: (exp: Experiment) => void;
  onDelete: (id: string) => void;
}

function ExperimentCard({ experiment: exp, onUpdate, onDelete }: ExperimentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState<VariantStat[] | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function loadStats() {
    if (stats) { setExpanded(!expanded); return; }
    setExpanded(true);
    setLoadingStats(true);
    try {
      const res = await fetch(`/api/experiments/${exp.id}?results=true`);
      const data = await res.json();
      setStats(data.variant_stats ?? []);
    } finally {
      setLoadingStats(false);
    }
  }

  async function handleStatusChange(status: string) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/experiments/${exp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) onUpdate(data.experiment);
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/experiments/${exp.id}`, { method: "DELETE" });
      onDelete(exp.id);
    } finally {
      setDeleting(false);
    }
  }

  const totalAssigned = stats?.reduce((s, v) => s + v.total_assigned, 0) ?? 0;
  const bestVariant = stats?.reduce((best, v) => (!best || v.completion_rate > best.completion_rate) ? v : best, null as VariantStat | null);

  return (
    <Card className="bg-[#141414] border-white/5">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium truncate">{exp.name}</span>
              <Badge className={`text-[10px] shrink-0 ${STATUS_BADGE[exp.status]}`}>{exp.status}</Badge>
            </div>
            {exp.description && <p className="text-xs text-muted-foreground mb-2">{exp.description}</p>}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <GitBranch className="w-3 h-3" /> {exp.variants.length} variants
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> {exp.metric_goal.replace(/_/g, " ")}
              </span>
              {totalAssigned > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {totalAssigned} assigned
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {exp.status === "draft" && (
              <Button size="sm" variant="outline" className="border-green-500/30 text-green-400 text-xs h-7" onClick={() => handleStatusChange("active")} disabled={updating}>
                {updating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Play className="w-3 h-3 mr-1" />}
                Start
              </Button>
            )}
            {exp.status === "active" && (
              <Button size="sm" variant="outline" className="border-yellow-500/30 text-yellow-400 text-xs h-7" onClick={() => handleStatusChange("stopped")} disabled={updating}>
                {updating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Pause className="w-3 h-3 mr-1" />}
                Stop
              </Button>
            )}
            {(exp.status === "stopped") && (
              <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 text-xs h-7" onClick={() => handleStatusChange("completed")} disabled={updating}>
                <CheckCircle className="w-3 h-3 mr-1" /> Conclude
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-muted-foreground h-7 px-2" onClick={loadStats}>
              <BarChart3 className="w-3.5 h-3.5" />
            </Button>
            {exp.status === "draft" && (
              <Button size="sm" variant="ghost" className="text-red-400 h-7 px-2" onClick={handleDelete} disabled={deleting}>
                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              </Button>
            )}
            <button onClick={loadStats} className="text-muted-foreground hover:text-foreground">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 pt-4 border-t border-white/5"
            >
              {loadingStats ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3">
                  {exp.variants.map((variant, i) => {
                    const vStat = stats?.find((s) => s.variant_id === variant.id);
                    const isBest = bestVariant?.variant_id === variant.id && (vStat?.total_assigned ?? 0) > 0;
                    return (
                      <div key={variant.id} className="p-3 rounded-lg bg-[#0a0a0a] border border-white/5">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-[#c4a574]/20 flex items-center justify-center text-[10px] text-[#c4a574] font-bold">
                              {String.fromCharCode(65 + i)}
                            </div>
                            <span className="text-sm font-medium">{variant.name}</span>
                            <span className="text-xs text-muted-foreground">{variant.weight}%</span>
                            {isBest && <Badge className="text-[10px] bg-[#c4a574]/20 text-[#c4a574] border-0">Best</Badge>}
                          </div>
                          {vStat && (
                            <span className="text-xs text-muted-foreground">{vStat.total_assigned} conversations</span>
                          )}
                        </div>
                        {vStat && vStat.total_assigned > 0 ? (
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <p className="text-[10px] text-muted-foreground mb-0.5">Completion</p>
                              <p className="text-sm font-semibold text-green-400">{pct(vStat.completion_rate)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground mb-0.5">Escalation</p>
                              <p className="text-sm font-semibold text-red-400">{pct(vStat.escalation_rate)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground mb-0.5">Resolved</p>
                              <p className="text-sm font-semibold">{vStat.resolved}</p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No data yet</p>
                        )}
                      </div>
                    );
                  })}

                  {bestVariant && totalAssigned > 0 && exp.status !== "draft" && (
                    <div className="flex items-center gap-2 text-xs text-[#c4a574] bg-[#c4a574]/5 border border-[#c4a574]/20 rounded-lg px-3 py-2">
                      <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        <strong>{exp.variants.find((v) => v.id === bestVariant.variant_id)?.name}</strong> is leading with {pct(bestVariant.completion_rate)} completion rate
                        {totalAssigned < 100 && " — gather more data before concluding"}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

export default function ExperimentsPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "draft" | "completed">("all");

  useEffect(() => {
    fetch("/api/experiments")
      .then((r) => r.json())
      .then((d) => setExperiments(d.experiments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = experiments.filter((e) => filter === "all" || e.status === filter);

  const counts = {
    active: experiments.filter((e) => e.status === "active").length,
    draft: experiments.filter((e) => e.status === "draft").length,
    completed: experiments.filter((e) => e.status === "completed" || e.status === "stopped").length,
  };

  return (
    <main className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-gradient-sierra" />

      <div className="relative mx-auto max-w-5xl px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="h-6 w-6 text-[#c4a574]" />
            <span className="text-sm font-medium text-[#c4a574]">Experiments</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight mb-2">
                A/B <span className="text-gradient">Experiments</span>
              </h1>
              <p className="text-muted-foreground text-base max-w-xl">
                Test playbook variants against each other. Sierra routes conversations to variants automatically
                and tracks completion, escalation, and CSAT to find the winner.
              </p>
            </div>
            <Button
              onClick={() => setCreating(true)}
              className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0] shrink-0"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Experiment
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="grid grid-cols-3 gap-4 mb-8">
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-green-400">{counts.active}</p>
              <p className="text-xs text-muted-foreground">Running</p>
            </CardContent>
          </Card>
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-4">
              <p className="text-2xl font-semibold">{counts.draft}</p>
              <p className="text-xs text-muted-foreground">Draft</p>
            </CardContent>
          </Card>
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-blue-400">{counts.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {(["all", "active", "draft", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                filter === f ? "bg-[#c4a574]/20 text-[#c4a574]" : "bg-[#141414] text-muted-foreground border border-white/5 hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Experiment list */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {filter === "all" ? "No experiments yet — create one to start testing." : `No ${filter} experiments.`}
            </p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {filtered.map((exp) => (
              <ExperimentCard
                key={exp.id}
                experiment={exp}
                onUpdate={(updated) => setExperiments((prev) => prev.map((e) => e.id === updated.id ? updated : e))}
                onDelete={(id) => setExperiments((prev) => prev.filter((e) => e.id !== id))}
              />
            ))}
          </motion.div>
        )}

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 p-6 bg-[#141414] border border-white/5 rounded-2xl"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#c4a574]" /> How experiments work
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { step: "1", title: "Define variants", desc: "Name each variant and assign traffic weights. Sierra will assign conversations deterministically." },
              { step: "2", title: "Map to playbooks", desc: "Each variant maps to a playbook by naming convention: append \" [variant-name]\" to a playbook name." },
              { step: "3", title: "Read results", desc: "After enough data (100+ conversations), the winning variant shows clearly. Apply it permanently." },
            ].map((item) => (
              <div key={item.step} className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-[#c4a574]/20 text-[#c4a574] text-xs flex items-center justify-center font-bold shrink-0 mt-0.5">
                  {item.step}
                </div>
                <div>
                  <p className="text-sm font-medium mb-1">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {creating && (
          <CreateDialog
            onClose={() => setCreating(false)}
            onCreate={(exp) => setExperiments((prev) => [exp as Experiment, ...prev])}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
