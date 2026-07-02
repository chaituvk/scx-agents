"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch, Plus, Loader2, ChevronDown, ChevronRight, Trash2,
  Edit3, CheckCircle, Circle, ArrowRight, AlertCircle, X, Users, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface RoutingRule {
  id: string;
  name: string;
  description: string;
  priority: number;
  status: "active" | "inactive";
  conditions: Condition[];
  condition_logic: "any" | "all";
  action_type: string;
  action_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const ACTION_TYPE_LABELS: Record<string, string> = {
  assign_team: "Assign to Team",
  assign_agent: "Assign to Agent",
  set_priority: "Set Priority",
  add_tag: "Add Tag",
  trigger_journey: "Trigger Journey",
  escalate: "Escalate",
  auto_reply: "Auto Reply",
};

const FIELD_OPTIONS = ["channel", "intent", "sentiment", "language", "customer_tier", "keyword", "topic", "priority"];
const OPERATOR_OPTIONS = ["equals", "contains", "starts_with", "not_equals", "in"];

interface RuleFormData {
  id?: string;
  name: string;
  description: string;
  priority: number;
  status: "active" | "inactive";
  conditions: Condition[];
  condition_logic: "any" | "all";
  action_type: string;
  action_payload: Record<string, unknown>;
}

const BLANK_RULE: RuleFormData = {
  name: "",
  description: "",
  priority: 100,
  status: "active",
  conditions: [{ field: "channel", operator: "equals", value: "" }],
  condition_logic: "any",
  action_type: "assign_team",
  action_payload: {},
};

function RuleForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: RuleFormData;
  onSave: (data: RuleFormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [data, setData] = useState<RuleFormData>({ ...BLANK_RULE, ...initial });

  function updateCondition(i: number, condField: keyof Condition, val: string) {
    setData(d => ({
      ...d,
      conditions: d.conditions.map((c, j) => j === i ? { ...c, [condField]: val } : c),
    }));
  }

  function addCondition() {
    setData(d => ({ ...d, conditions: [...d.conditions, { field: "channel", operator: "equals", value: "" }] }));
  }

  function removeCondition(i: number) {
    setData(d => ({ ...d, conditions: d.conditions.filter((_, j) => j !== i) }));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">Name *</label>
          <input
            value={data.name}
            onChange={e => setData(d => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Route VIP customers"
            className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Priority (lower = higher)</label>
          <input
            type="number"
            value={data.priority}
            onChange={e => setData(d => ({ ...d, priority: parseInt(e.target.value) || 100 }))}
            className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground">Description</label>
        <input
          value={data.description}
          onChange={e => setData(d => ({ ...d, description: e.target.value }))}
          placeholder="What does this rule do?"
          className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Conditions */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-muted-foreground">Conditions</label>
          <div className="flex items-center gap-2">
            <select
              value={data.condition_logic}
              onChange={e => setData(d => ({ ...d, condition_logic: e.target.value as "any" | "all" }))}
              className="bg-black/20 border border-white/10 rounded px-2 py-0.5 text-xs text-foreground outline-none"
            >
              <option value="any">Match ANY</option>
              <option value="all">Match ALL</option>
            </select>
            <button onClick={addCondition} className="text-[#c4a574] hover:text-[#d4b584] text-xs flex items-center gap-0.5">
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {data.conditions.map((cond, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={cond.field}
                onChange={e => updateCondition(i, "field", e.target.value)}
                className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
              >
                {FIELD_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
              <select
                value={cond.operator}
                onChange={e => updateCondition(i, "operator", e.target.value)}
                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
              >
                {OPERATOR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <input
                value={cond.value}
                onChange={e => updateCondition(i, "value", e.target.value)}
                placeholder="value"
                className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
              />
              {data.conditions.length > 1 && (
                <button onClick={() => removeCondition(i)} className="text-muted-foreground hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground">Action</label>
          <select
            value={data.action_type}
            onChange={e => setData(d => ({ ...d, action_type: e.target.value, action_payload: {} }))}
            className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground"
          >
            {Object.entries(ACTION_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Action Value</label>
          <input
            value={(data.action_payload.value as string) ?? ""}
            onChange={e => setData(d => ({ ...d, action_payload: { value: e.target.value } }))}
            placeholder={
              data.action_type === "assign_team" ? "team name or ID" :
              data.action_type === "set_priority" ? "high / medium / low" :
              data.action_type === "add_tag" ? "tag name" :
              "value"
            }
            className="mt-1 w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          onClick={() => onSave(data)}
          disabled={saving || !data.name.trim()}
          className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          {initial.id ? "Save Rule" : "Create Rule"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function RuleCard({
  rule,
  onEdit,
  onDelete,
  onToggle,
}: {
  rule: RoutingRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border rounded-xl p-4 ${rule.status === "active" ? "border-border" : "border-border opacity-60"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={onToggle} className="shrink-0">
              {rule.status === "active" ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-muted-foreground/40" />
              )}
            </button>
            <span className="text-sm font-medium">{rule.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
              Priority {rule.priority}
            </span>
          </div>
          {rule.description && (
            <p className="text-xs text-muted-foreground ml-5">{rule.description}</p>
          )}

          {/* Conditions summary */}
          <div className="ml-5 mt-2 flex flex-wrap gap-1.5 items-center">
            {(rule.conditions ?? []).map((cond, i) => (
              <span key={i}>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {cond.field} {cond.operator} &quot;{cond.value}&quot;
                </span>
                {i < rule.conditions.length - 1 && (
                  <span className="text-[10px] text-muted-foreground mx-1">{rule.condition_logic}</span>
                )}
              </span>
            ))}
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c4a574]/10 text-[#c4a574] border border-[#c4a574]/20">
              {ACTION_TYPE_LABELS[rule.action_type] ?? rule.action_type}
              {rule.action_payload?.value ? `: ${rule.action_payload.value}` : ""}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function RoutingPage() {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RoutingRule | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/routing-rules");
      if (res.ok) {
        const data = await res.json();
        setRules(data.rules ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: RuleFormData) {
    setSaving(true);
    try {
      if (editing?.id) {
        await fetch(`/api/routing-rules/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } else {
        await fetch("/api/routing-rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      }
      setCreating(false);
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this routing rule?")) return;
    await fetch(`/api/routing-rules/${id}`, { method: "DELETE" }).catch(() => {});
    setRules(prev => prev.filter(r => r.id !== id));
  }

  async function handleToggle(rule: RoutingRule) {
    const newStatus = rule.status === "active" ? "inactive" : "active";
    await fetch(`/api/routing-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {});
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, status: newStatus } : r));
  }

  const activeRules = rules.filter(r => r.status === "active");

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GitBranch className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Routing Rules</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Automatically route conversations based on channel, intent, sentiment, and more.
          </p>
        </div>
        <Button
          onClick={() => { setCreating(true); setEditing(null); }}
          className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-2"
        >
          <Plus className="w-4 h-4" />
          New Rule
        </Button>
      </div>

      {/* Create/edit form */}
      <AnimatePresence>
        {(creating || editing) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="bg-card border border-[#c4a574]/30 rounded-xl p-6 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium">{editing ? "Edit Rule" : "New Routing Rule"}</h2>
              <button onClick={() => { setCreating(false); setEditing(null); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <RuleForm
              initial={editing ? { ...BLANK_RULE, ...editing } : BLANK_RULE}
              onSave={handleSave}
              onCancel={() => { setCreating(false); setEditing(null); }}
              saving={saving}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary */}
      {!loading && rules.length > 0 && (
        <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
          <span><span className="text-foreground font-medium">{rules.length}</span> total rules</span>
          <span>·</span>
          <span><span className="text-green-400 font-medium">{activeRules.length}</span> active</span>
        </div>
      )}

      {/* Rules list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <GitBranch className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">No routing rules</p>
          <p className="text-xs text-muted-foreground mt-1">Rules let you automatically triage and route incoming conversations.</p>
          <Button size="sm" className="mt-4 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584]" onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4 mr-1" /> Create First Rule
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {[...rules].sort((a, b) => a.priority - b.priority).map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => { setEditing(rule); setCreating(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              onDelete={() => handleDelete(rule.id)}
              onToggle={() => handleToggle(rule)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
