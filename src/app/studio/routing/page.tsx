"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitBranch,
  Plus,
  Edit3,
  Trash2,
  GripVertical,
  CheckCircle,
  XCircle,
  Loader2,
  X,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type ConditionField = "message" | "channel" | "customer_language" | "customer_tag" | "conversation_count" | "hour_of_day";
type ConditionOperator = "contains" | "not_contains" | "equals" | "not_equals" | "greater_than" | "less_than";

interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

interface RoutingRule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  status: "active" | "disabled";
  conditions: RuleCondition[];
  condition_logic: "any" | "all";
  action_type: string;
  action_payload: Record<string, unknown>;
  created_at: string;
}

const FIELD_LABELS: Record<ConditionField, string> = {
  message: "Message contains",
  channel: "Channel",
  customer_language: "Language",
  customer_tag: "Customer tag",
  conversation_count: "Conversation count",
  hour_of_day: "Hour of day",
};

const ACTION_TYPES = [
  { value: "assign_playbook", label: "Assign playbook" },
  { value: "assign_agent", label: "Assign to agent" },
  { value: "set_priority", label: "Set priority" },
  { value: "add_tag", label: "Add tag" },
  { value: "escalate", label: "Escalate to human" },
  { value: "set_language", label: "Set language" },
];

const FIELDS: ConditionField[] = ["message", "channel", "customer_language", "customer_tag", "conversation_count", "hour_of_day"];
const OPERATORS: ConditionOperator[] = ["contains", "not_contains", "equals", "not_equals", "greater_than", "less_than"];

function emptyCondition(): RuleCondition {
  return { field: "message", operator: "contains", value: "" };
}

interface RuleFormProps {
  initial?: Partial<RoutingRule>;
  onSave: (rule: RoutingRule) => void;
  onCancel: () => void;
}

function RuleForm({ initial, onSave, onCancel }: RuleFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? 100);
  const [conditionLogic, setConditionLogic] = useState<"any" | "all">(initial?.condition_logic ?? "any");
  const [conditions, setConditions] = useState<RuleCondition[]>(initial?.conditions?.length ? initial.conditions : [emptyCondition()]);
  const [actionType, setActionType] = useState(initial?.action_type ?? "assign_playbook");
  const [actionValue, setActionValue] = useState(
    (initial?.action_payload as {playbook_id?: string; agent_id?: string; priority?: string; tag?: string; value?: string})?.playbook_id
    ?? (initial?.action_payload as {agent_id?: string})?.agent_id
    ?? (initial?.action_payload as {priority?: string})?.priority
    ?? (initial?.action_payload as {tag?: string})?.tag
    ?? (initial?.action_payload as {value?: string})?.value
    ?? ""
  );
  const [saving, setSaving] = useState(false);

  function buildPayload(): Record<string, unknown> {
    const payloadKey: Record<string, string> = {
      assign_playbook: "playbook_id",
      assign_agent: "agent_id",
      set_priority: "priority",
      add_tag: "tag",
      escalate: "reason",
      set_language: "language",
    };
    return { [payloadKey[actionType] ?? "value"]: actionValue.trim() };
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const isEdit = !!initial?.id;
    const url = isEdit ? `/api/routing-rules/${initial!.id}` : "/api/routing-rules";
    const method = isEdit ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          priority,
          condition_logic: conditionLogic,
          conditions: conditions.filter((c) => c.value.trim()),
          action_type: actionType,
          action_payload: buildPayload(),
          status: initial?.status ?? "active",
        }),
      });
      const data = await res.json();
      if (res.ok) onSave(data.rule);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-[#141414] border border-white/10 rounded-2xl p-6 w-full max-w-xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <button onClick={onCancel} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
        <h3 className="font-semibold text-base mb-5">
          {initial?.id ? "Edit Rule" : "New Routing Rule"}
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Rule Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Japanese → JP playbook" className="bg-[#0a0a0a] border-white/10" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Priority (lower runs first)</label>
              <Input type="number" min="1" value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="bg-[#0a0a0a] border-white/10" />
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">Conditions — match</label>
              <div className="flex gap-1">
                {(["any", "all"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setConditionLogic(l)}
                    className={`text-xs px-2 py-0.5 rounded ${conditionLogic === l ? "bg-[#c4a574]/20 text-[#c4a574]" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {conditions.map((cond, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={cond.field}
                    onChange={(e) => setConditions(conditions.map((c, j) => j === i ? { ...c, field: e.target.value as ConditionField } : c))}
                    className="flex-1 px-2 py-1.5 rounded bg-[#0a0a0a] border border-white/10 text-xs text-foreground"
                  >
                    {FIELDS.map((f) => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
                  </select>
                  <select
                    value={cond.operator}
                    onChange={(e) => setConditions(conditions.map((c, j) => j === i ? { ...c, operator: e.target.value as ConditionOperator } : c))}
                    className="w-28 px-2 py-1.5 rounded bg-[#0a0a0a] border border-white/10 text-xs text-foreground"
                  >
                    {OPERATORS.map((op) => <option key={op} value={op}>{op.replace(/_/g, " ")}</option>)}
                  </select>
                  <Input
                    value={cond.value}
                    onChange={(e) => setConditions(conditions.map((c, j) => j === i ? { ...c, value: e.target.value } : c))}
                    placeholder="value"
                    className="w-28 h-8 text-xs bg-[#0a0a0a] border-white/10"
                  />
                  {conditions.length > 1 && (
                    <button onClick={() => setConditions(conditions.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setConditions([...conditions, emptyCondition()])}
                className="text-xs text-[#c4a574] hover:underline flex items-center gap-1 mt-1"
              >
                <Plus className="w-3 h-3" /> Add condition
              </button>
            </div>
          </div>

          {/* Action */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Then…</label>
            <div className="flex gap-2">
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="flex-1 px-2 py-1.5 rounded bg-[#0a0a0a] border border-white/10 text-xs text-foreground"
              >
                {ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              <Input
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                placeholder={actionType === "assign_playbook" ? "playbook ID" : actionType === "set_priority" ? "urgent/high/normal" : "value"}
                className="flex-1 h-8 text-xs bg-[#0a0a0a] border-white/10"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <Button onClick={onCancel} variant="outline" size="sm" className="flex-1 border-white/10">Cancel</Button>
          <Button
            onClick={handleSave}
            size="sm"
            className="flex-1 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
            disabled={!name.trim() || saving}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <CheckCircle className="w-3.5 h-3.5 mr-1.5" />}
            {saving ? "Saving…" : initial?.id ? "Update" : "Create Rule"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

export default function RoutingRulesPage() {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RoutingRule | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/routing-rules")
      .then((r) => r.json())
      .then((d) => setRules(d.rules ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggleRule(rule: RoutingRule) {
    setTogglingId(rule.id);
    const newStatus = rule.status === "active" ? "disabled" : "active";
    try {
      const res = await fetch(`/api/routing-rules/${rule.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rule, status: newStatus }),
      });
      if (res.ok) setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, status: newStatus } : r));
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteRule(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/routing-rules/${id}`, { method: "DELETE" });
      setRules((prev) => prev.filter((r) => r.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  const sorted = [...rules].sort((a, b) => a.priority - b.priority);

  return (
    <main className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-gradient-sierra" />

      <div className="relative mx-auto max-w-5xl px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="h-6 w-6 text-[#c4a574]" />
            <span className="text-sm font-medium text-[#c4a574]">Routing</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight mb-2">
                Routing <span className="text-gradient">Rules</span>
              </h1>
              <p className="text-muted-foreground text-base max-w-xl">
                Priority-ordered rules that automatically route, tag, escalate, or assign playbooks
                based on message content, channel, language, customer data, and time.
              </p>
            </div>
            <Button onClick={() => setCreating(true)} className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0] shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              New Rule
            </Button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-green-400">{rules.filter((r) => r.status === "active").length}</p>
              <p className="text-xs text-muted-foreground">Active Rules</p>
            </CardContent>
          </Card>
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-4">
              <p className="text-2xl font-semibold">{rules.length}</p>
              <p className="text-xs text-muted-foreground">Total Rules</p>
            </CardContent>
          </Card>
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-4">
              <p className="text-2xl font-semibold text-[#c4a574]">{new Set(rules.map((r) => r.action_type)).size}</p>
              <p className="text-xs text-muted-foreground">Action Types</p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : rules.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <GitBranch className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No routing rules yet.</p>
            <p className="text-xs mt-1">Create a rule to automatically route conversations.</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {sorted.map((rule, idx) => {
              const actionLabel = ACTION_TYPES.find((a) => a.value === rule.action_type)?.label ?? rule.action_type;
              const actionVal = Object.values(rule.action_payload)[0];
              return (
                <motion.div key={rule.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
                  <Card className={`bg-[#141414] border-white/5 ${rule.status === "disabled" ? "opacity-50" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#c4a574]/10 flex items-center justify-center text-[10px] text-[#c4a574] font-bold shrink-0">
                          {rule.priority}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium">{rule.name}</span>
                            {rule.status === "disabled" && (
                              <Badge className="bg-gray-500/20 text-gray-400 text-[10px] border-0">Disabled</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                            {rule.conditions.slice(0, 2).map((c, i) => (
                              <span key={i} className="bg-white/5 px-1.5 py-0.5 rounded text-[10px]">
                                {FIELD_LABELS[c.field as ConditionField] ?? c.field} {c.operator.replace(/_/g, " ")} &quot;{String(c.value).slice(0, 20)}&quot;
                              </span>
                            ))}
                            {rule.conditions.length > 2 && <span className="text-[10px]">+{rule.conditions.length - 2} more</span>}
                            <ArrowRight className="w-3 h-3 mx-1 text-muted-foreground/50" />
                            <span className="text-[10px] bg-[#c4a574]/10 text-[#c4a574] px-1.5 py-0.5 rounded">
                              {actionLabel}{actionVal ? `: ${String(actionVal).slice(0, 20)}` : ""}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => toggleRule(rule)} disabled={togglingId === rule.id} className="text-muted-foreground hover:text-foreground" title={rule.status === "active" ? "Disable" : "Enable"}>
                            {togglingId === rule.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : rule.status === "active" ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => setEditing(rule)} className="text-muted-foreground hover:text-foreground">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteRule(rule.id)} disabled={deletingId === rule.id} className="text-muted-foreground hover:text-red-400">
                            {deletingId === rule.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        <div className="mt-10 p-5 bg-[#141414] border border-white/5 rounded-2xl">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#c4a574]" /> How routing works
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Rules are evaluated in priority order (lowest number first) on every new conversation turn.
            The first matching rule&apos;s action is applied — remaining rules are skipped.
            Rules only run when <strong className="text-foreground">active</strong>; disabled rules are ignored entirely.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {creating && (
          <RuleForm onCancel={() => setCreating(false)} onSave={(rule) => { setRules((p) => [...p, rule]); setCreating(false); }} />
        )}
        {editing && (
          <RuleForm initial={editing} onCancel={() => setEditing(null)} onSave={(rule) => { setRules((p) => p.map((r) => r.id === rule.id ? rule : r)); setEditing(null); }} />
        )}
      </AnimatePresence>
    </main>
  );
}
