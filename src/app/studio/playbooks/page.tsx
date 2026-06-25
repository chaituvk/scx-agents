"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BookOpenCheck,
  Plus,
  X,
  Save,
  Loader2,
  Trash2,
  Zap,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PolicyItem {
  text: string;
  severity: "hard" | "soft";
}

interface Playbook {
  id: string;
  tenant_id?: string;
  name: string;
  description: string;
  status: "draft" | "active" | "archived";
  persona: string;
  topics: string[];
  instructions: string[];
  policies: PolicyItem[];
  actions: string[];
  escalation_triggers: string[];
  end_message?: string;
  model_tier?: string;
  created_at?: string;
  updated_at?: string;
}

const emptyPlaybook = (): Omit<Playbook, "id"> => ({
  name: "New Playbook",
  description: "",
  status: "draft",
  persona: "",
  topics: [],
  instructions: [""],
  policies: [],
  actions: [],
  escalation_triggers: [],
  end_message: "",
  model_tier: "large",
});

// ─── Status badge helper ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Playbook["status"] }) {
  if (status === "active") {
    return (
      <Badge className="bg-[#c4a574]/20 text-[#c4a574] border-[#c4a574]/30 capitalize">
        active
      </Badge>
    );
  }
  if (status === "archived") {
    return (
      <Badge className="bg-white/5 text-muted-foreground border-white/10 capitalize">
        archived
      </Badge>
    );
  }
  return (
    <Badge className="bg-white/10 text-white/60 border-white/10 capitalize">
      draft
    </Badge>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PlaybooksPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [selected, setSelected] = useState<Playbook | null>(null);
  const [draft, setDraft] = useState<Playbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newAction, setNewAction] = useState("");
  const [error, setError] = useState<string | null>(null);

  // ── Fetch on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchPlaybooks();
  }, []);

  async function fetchPlaybooks() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/playbooks");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Playbook[];
      setPlaybooks(data);
    } catch (e) {
      setError("Failed to load playbooks.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // ── Select / deselect ───────────────────────────────────────────────────────
  function selectPlaybook(pb: Playbook) {
    setSelected(pb);
    setDraft(structuredClone(pb));
    setConfirmDelete(false);
  }

  // ── Create new playbook ─────────────────────────────────────────────────────
  function createNew() {
    const tempId = `__new__${Date.now()}`;
    const pb: Playbook = { id: tempId, ...emptyPlaybook() };
    setSelected(pb);
    setDraft(structuredClone(pb));
    setConfirmDelete(false);
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const isNew = draft.id.startsWith("__new__");
      const url = isNew ? "/api/playbooks" : `/api/playbooks/${draft.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved = (await res.json()) as Playbook;
      setPlaybooks((prev) =>
        isNew
          ? [...prev, saved]
          : prev.map((p) => (p.id === draft.id ? saved : p))
      );
      setSelected(saved);
      setDraft(structuredClone(saved));
    } catch (e) {
      setError("Failed to save playbook.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  // ── Activate ────────────────────────────────────────────────────────────────
  async function handleActivate() {
    if (!selected || selected.id.startsWith("__new__")) return;
    setActivating(true);
    setError(null);
    try {
      const res = await fetch(`/api/playbooks/${selected.id}/activate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = (await res.json()) as Playbook;
      // Deactivate others, activate this one
      setPlaybooks((prev) =>
        prev.map((p) =>
          p.id === updated.id
            ? updated
            : p.status === "active"
            ? { ...p, status: "draft" }
            : p
        )
      );
      setSelected(updated);
      setDraft(structuredClone(updated));
    } catch (e) {
      setError("Failed to activate playbook.");
      console.error(e);
    } finally {
      setActivating(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!selected || selected.id.startsWith("__new__")) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/playbooks/${selected.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPlaybooks((prev) => prev.filter((p) => p.id !== selected.id));
      setSelected(null);
      setDraft(null);
      setConfirmDelete(false);
    } catch (e) {
      setError("Failed to delete playbook.");
      console.error(e);
    } finally {
      setDeleting(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <main className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-gradient-sierra" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-4">
            <BookOpenCheck className="h-6 w-6 text-[#c4a574]" />
            <span className="text-sm font-medium text-[#c4a574]">
              Playbook Studio
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">
            Playbooks
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Configure your AI agent in plain English — no code, no flows.
          </p>
        </motion.div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-[#c4a574]" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-5 gap-6">
            {/* ── Left panel: Playbook list ── */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-foreground">
                  {playbooks.length} playbook{playbooks.length !== 1 ? "s" : ""}
                </span>
                <Button
                  size="sm"
                  onClick={createNew}
                  className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0] h-8 gap-1"
                >
                  <Plus className="h-4 w-4" />
                  New Playbook
                </Button>
              </div>

              <div className="space-y-2">
                {playbooks.length === 0 && !selected && (
                  <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
                    <BookOpenCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No playbooks yet. Create one to get started.
                    </p>
                  </div>
                )}

                {playbooks.map((pb) => (
                  <button
                    key={pb.id}
                    onClick={() => selectPlaybook(pb)}
                    className={`w-full text-left rounded-xl border p-4 transition-all ${
                      selected?.id === pb.id
                        ? "border-[#c4a574]/50 bg-[#c4a574]/5"
                        : "border-white/5 bg-[#141414] hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">
                          {pb.name}
                        </div>
                        {pb.description && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {pb.description}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <StatusBadge status={pb.status} />
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </div>
                  </button>
                ))}

                {/* New (unsaved) playbook */}
                {selected?.id.startsWith("__new__") && (
                  <button
                    className="w-full text-left rounded-xl border border-[#c4a574]/50 bg-[#c4a574]/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm truncate">
                          {draft?.name || "New Playbook"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Unsaved
                        </div>
                      </div>
                      <StatusBadge status="draft" />
                    </div>
                  </button>
                )}
              </div>
            </motion.div>

            {/* ── Right panel: Editor ── */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="lg:col-span-3"
            >
              {!draft ? (
                <Card className="bg-[#141414] border-white/5 h-full flex items-center justify-center min-h-[400px]">
                  <CardContent className="text-center py-16">
                    <BookOpenCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground text-sm">
                      Select a playbook to edit, or create a new one.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-[#141414] border-white/5">
                  <CardHeader className="pb-3 border-b border-white/5">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base truncate">
                        {draft.name || "Untitled Playbook"}
                      </CardTitle>
                      <StatusBadge status={draft.status} />
                    </div>
                  </CardHeader>

                  <CardContent className="pt-5">
                    <Tabs defaultValue="identity" className="w-full">
                      <TabsList className="bg-[#0a0a0a] border border-white/5 w-full grid grid-cols-4">
                        {(
                          [
                            ["identity", "Identity"],
                            ["instructions", "Instructions"],
                            ["policies", "Policies"],
                            ["actions", "Actions"],
                          ] as const
                        ).map(([val, label]) => (
                          <TabsTrigger
                            key={val}
                            value={val}
                            className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574] text-xs"
                          >
                            {label}
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {/* ── Tab 1: Identity ── */}
                      <TabsContent value="identity" className="mt-5 space-y-5">
                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Name
                          </label>
                          <Input
                            value={draft.name}
                            onChange={(e) =>
                              setDraft({ ...draft, name: e.target.value })
                            }
                            className="bg-[#0a0a0a] border-white/10"
                            placeholder="e.g. Returns & Refunds Agent"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Description
                          </label>
                          <Textarea
                            value={draft.description}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                description: e.target.value,
                              })
                            }
                            className="bg-[#0a0a0a] border-white/10 min-h-[60px]"
                            placeholder="A short description of what this playbook does"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Status
                          </label>
                          <select
                            value={draft.status}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                status: e.target.value as Playbook["status"],
                              })
                            }
                            className="w-full rounded-md bg-[#0a0a0a] border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#c4a574]"
                          >
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            Persona
                          </label>
                          <Textarea
                            value={draft.persona}
                            onChange={(e) =>
                              setDraft({ ...draft, persona: e.target.value })
                            }
                            className="bg-[#0a0a0a] border-white/10 min-h-[120px]"
                            placeholder="Write as if describing who this agent is — e.g. 'You are a friendly support agent for Acme Corp specializing in returns and refunds. You are patient, empathetic, and always look for ways to resolve issues quickly.'"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            This becomes the agent&apos;s system prompt introduction.
                          </p>
                        </div>

                        <div>
                          <label className="text-sm font-medium mb-2 block">
                            End Message{" "}
                            <span className="text-muted-foreground font-normal">
                              (optional)
                            </span>
                          </label>
                          <Input
                            value={draft.end_message ?? ""}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                end_message: e.target.value,
                              })
                            }
                            className="bg-[#0a0a0a] border-white/10"
                            placeholder="e.g. Is there anything else I can help you with?"
                          />
                        </div>
                      </TabsContent>

                      {/* ── Tab 2: Instructions ── */}
                      <TabsContent
                        value="instructions"
                        className="mt-5 space-y-4"
                      >
                        <p className="text-sm text-muted-foreground">
                          Step-by-step guide for what this agent should do.
                          Numbered order matters.
                        </p>
                        <div className="space-y-2">
                          {draft.instructions.map((instr, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                                {i + 1}.
                              </span>
                              <Input
                                value={instr}
                                onChange={(e) => {
                                  const updated = [...draft.instructions];
                                  updated[i] = e.target.value;
                                  setDraft({
                                    ...draft,
                                    instructions: updated,
                                  });
                                }}
                                className="bg-[#0a0a0a] border-white/10 flex-1"
                                placeholder={
                                  i === 0
                                    ? "e.g. Greet the customer and ask how you can help"
                                    : i === 1
                                    ? "e.g. Ask for the customer's order number if not provided"
                                    : "Add an instruction step..."
                                }
                              />
                              <button
                                onClick={() => {
                                  const updated = draft.instructions.filter(
                                    (_, j) => j !== i
                                  );
                                  setDraft({
                                    ...draft,
                                    instructions:
                                      updated.length > 0 ? updated : [""],
                                  });
                                }}
                                className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white/10 hover:border-[#c4a574]/40"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              instructions: [...draft.instructions, ""],
                            })
                          }
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Step
                        </Button>
                      </TabsContent>

                      {/* ── Tab 3: Policies ── */}
                      <TabsContent value="policies" className="mt-5 space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Rules the agent must follow.{" "}
                          <span className="text-red-400">Hard</span> rules are
                          never broken;{" "}
                          <span className="text-yellow-400">soft</span> rules
                          can be overridden with good reason.
                        </p>

                        <div className="space-y-2">
                          {draft.policies.map((policy, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Input
                                value={policy.text}
                                onChange={(e) => {
                                  const updated = [...draft.policies];
                                  updated[i] = {
                                    ...updated[i],
                                    text: e.target.value,
                                  };
                                  setDraft({ ...draft, policies: updated });
                                }}
                                className="bg-[#0a0a0a] border-white/10 flex-1"
                                placeholder={
                                  i === 0
                                    ? "e.g. Never issue a refund above $500 without manager approval"
                                    : "Add a policy rule..."
                                }
                              />
                              <button
                                onClick={() => {
                                  const updated = [...draft.policies];
                                  updated[i] = {
                                    ...updated[i],
                                    severity:
                                      updated[i].severity === "hard"
                                        ? "soft"
                                        : "hard",
                                  };
                                  setDraft({ ...draft, policies: updated });
                                }}
                                title={`Severity: ${policy.severity} — click to toggle`}
                                className={`shrink-0 rounded-md border px-2 py-1 text-xs font-medium transition-all ${
                                  policy.severity === "hard"
                                    ? "border-red-500/40 bg-red-500/10 text-red-400"
                                    : "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
                                }`}
                              >
                                {policy.severity === "hard" ? "Hard" : "Soft"}
                              </button>
                              <button
                                onClick={() => {
                                  const updated = draft.policies.filter(
                                    (_, j) => j !== i
                                  );
                                  setDraft({ ...draft, policies: updated });
                                }}
                                className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white/10 hover:border-[#c4a574]/40"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              policies: [
                                ...draft.policies,
                                { text: "", severity: "soft" },
                              ],
                            })
                          }
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Policy
                        </Button>
                      </TabsContent>

                      {/* ── Tab 4: Actions & Escalation ── */}
                      <TabsContent value="actions" className="mt-5 space-y-6">
                        {/* Actions */}
                        <div>
                          <label className="text-sm font-medium mb-1 block">
                            Allowed Actions
                          </label>
                          <p className="text-xs text-muted-foreground mb-3">
                            Tool names this agent is permitted to invoke.
                          </p>
                          <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
                            {draft.actions.map((action, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 rounded-md bg-[#c4a574]/10 border border-[#c4a574]/20 px-2 py-1 text-xs text-[#c4a574]"
                              >
                                {action}
                                <button
                                  onClick={() =>
                                    setDraft({
                                      ...draft,
                                      actions: draft.actions.filter(
                                        (_, j) => j !== i
                                      ),
                                    })
                                  }
                                  className="hover:text-white transition-colors"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              value={newAction}
                              onChange={(e) => setNewAction(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newAction.trim()) {
                                  if (
                                    !draft.actions.includes(newAction.trim())
                                  ) {
                                    setDraft({
                                      ...draft,
                                      actions: [
                                        ...draft.actions,
                                        newAction.trim(),
                                      ],
                                    });
                                  }
                                  setNewAction("");
                                }
                              }}
                              className="bg-[#0a0a0a] border-white/10"
                              placeholder="e.g. lookup_order, issue_refund"
                            />
                            <Button
                              size="sm"
                              className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0] shrink-0"
                              onClick={() => {
                                if (
                                  newAction.trim() &&
                                  !draft.actions.includes(newAction.trim())
                                ) {
                                  setDraft({
                                    ...draft,
                                    actions: [
                                      ...draft.actions,
                                      newAction.trim(),
                                    ],
                                  });
                                  setNewAction("");
                                }
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Escalation triggers */}
                        <div>
                          <label className="text-sm font-medium mb-1 block">
                            Escalation Triggers
                          </label>
                          <p className="text-xs text-muted-foreground mb-3">
                            When should this agent transfer to a human agent?
                          </p>
                          <div className="space-y-2">
                            {draft.escalation_triggers.map((trigger, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2"
                              >
                                <span className="text-xs text-muted-foreground w-5 text-right shrink-0">
                                  {i + 1}.
                                </span>
                                <Input
                                  value={trigger}
                                  onChange={(e) => {
                                    const updated = [
                                      ...draft.escalation_triggers,
                                    ];
                                    updated[i] = e.target.value;
                                    setDraft({
                                      ...draft,
                                      escalation_triggers: updated,
                                    });
                                  }}
                                  className="bg-[#0a0a0a] border-white/10 flex-1"
                                  placeholder={
                                    i === 0
                                      ? "e.g. Customer is angry or threatening legal action"
                                      : i === 1
                                      ? "e.g. Refund amount exceeds $500"
                                      : "Add a trigger condition..."
                                  }
                                />
                                <button
                                  onClick={() => {
                                    const updated =
                                      draft.escalation_triggers.filter(
                                        (_, j) => j !== i
                                      );
                                    setDraft({
                                      ...draft,
                                      escalation_triggers: updated,
                                    });
                                  }}
                                  className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 border-white/10 hover:border-[#c4a574]/40"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                escalation_triggers: [
                                  ...draft.escalation_triggers,
                                  "",
                                ],
                              })
                            }
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Trigger
                          </Button>
                        </div>
                      </TabsContent>
                    </Tabs>

                    {/* ── Action bar ── */}
                    <div className="flex flex-wrap items-center gap-3 mt-6 pt-5 border-t border-white/5">
                      <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        {saving ? "Saving…" : "Save"}
                      </Button>

                      {!draft.id.startsWith("__new__") &&
                        draft.status !== "active" && (
                          <Button
                            variant="outline"
                            onClick={handleActivate}
                            disabled={activating}
                            className="border-[#c4a574]/30 text-[#c4a574] hover:bg-[#c4a574]/10"
                          >
                            {activating ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Zap className="h-4 w-4 mr-2" />
                            )}
                            {activating ? "Activating…" : "Activate"}
                          </Button>
                        )}

                      {!draft.id.startsWith("__new__") && (
                        <Button
                          variant="outline"
                          onClick={handleDelete}
                          disabled={deleting}
                          className={
                            confirmDelete
                              ? "border-red-500/50 text-red-400 hover:bg-red-500/10 ml-auto"
                              : "border-white/10 text-muted-foreground hover:text-red-400 hover:border-red-500/30 ml-auto"
                          }
                        >
                          {deleting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          {confirmDelete
                            ? "Confirm Delete"
                            : deleting
                            ? "Deleting…"
                            : "Delete"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </main>
  );
}
