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
  History,
  RotateCcw,
  Send,
  Bot,
  User,
  FlaskConical,
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
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<{id: string; version: number; change_summary?: string; created_at: string}[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [testMessages, setTestMessages] = useState<{role: "user" | "assistant"; content: string; escalated?: boolean}[]>([]);
  const [testInput, setTestInput] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});

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
      const data = await res.json();
      setPlaybooks(data.playbooks ?? []);
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
    setTestMessages([]);
    setTestInput("");
    setTestVariables({});
  }

  // ── Test console ─────────────────────────────────────────────────────────────
  async function runTest() {
    if (!testInput.trim() || !selected || selected.id.startsWith("__new__")) return;
    const userMsg = testInput.trim();
    setTestInput("");
    const history = testMessages.map(m => ({ role: m.role, content: m.content }));
    setTestMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setTestRunning(true);
    try {
      const res = await fetch(`/api/playbooks/${selected.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...history, { role: "user", content: userMsg }], variables: testVariables }),
      });
      if (res.ok) {
        const data = await res.json();
        setTestMessages(prev => [...prev, { role: "assistant", content: data.response ?? "(no response)", escalated: data.escalated }]);
        if (data.variables) setTestVariables(data.variables);
      } else {
        setTestMessages(prev => [...prev, { role: "assistant", content: `Error: ${res.status}` }]);
      }
    } catch {
      setTestMessages(prev => [...prev, { role: "assistant", content: "Network error" }]);
    } finally {
      setTestRunning(false);
    }
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
      const body = await res.json();
      const saved: Playbook = body.playbook ?? body;
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
      const body = await res.json();
      const updated: Playbook = body.playbook ?? body;
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

  // ── Version history ──────────────────────────────────────────────────────────
  async function openVersionHistory() {
    if (!selected || selected.id.startsWith("__new__")) return;
    setShowVersions(true);
    if (versions.length > 0) return; // already loaded
    setLoadingVersions(true);
    try {
      const res = await fetch(`/api/playbooks/${selected.id}/versions`);
      const data = await res.json();
      setVersions(data.versions ?? []);
    } finally {
      setLoadingVersions(false);
    }
  }

  async function snapshotVersion() {
    if (!selected || selected.id.startsWith("__new__")) return;
    const summary = window.prompt("Change summary (optional):");
    if (summary === null) return; // cancelled
    const res = await fetch(`/api/playbooks/${selected.id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ change_summary: summary || undefined }),
    });
    if (res.ok) {
      const data = await res.json();
      setVersions((prev) => [data.version, ...prev]);
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
                      <TabsList className="bg-[#0a0a0a] border border-white/5 w-full grid grid-cols-5">
                        {(
                          [
                            ["identity", "Identity"],
                            ["instructions", "Instructions"],
                            ["policies", "Policies"],
                            ["actions", "Actions"],
                            ["test", "Test"],
                          ] as const
                        ).map(([val, label]) => (
                          <TabsTrigger
                            key={val}
                            value={val}
                            className="data-[state=active]:bg-[#c4a574]/20 data-[state=active]:text-[#c4a574] text-xs"
                          >
                            {val === "test" ? <><FlaskConical className="w-3 h-3 mr-1 inline" />{label}</> : label}
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
                      {/* ── Tab 5: Test Console ── */}
                      <TabsContent value="test" className="mt-5">
                        {selected?.id.startsWith("__new__") ? (
                          <div className="text-center py-12 text-muted-foreground text-sm">
                            Save the playbook before testing.
                          </div>
                        ) : (
                          <div className="flex flex-col h-[420px]">
                            {Object.keys(testVariables).length > 0 && (
                              <div className="mb-3 p-2.5 rounded-lg bg-white/3 border border-white/5">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Extracted Variables</p>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(testVariables).map(([k, v]) => (
                                    <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-[#c4a574]/10 border border-[#c4a574]/20 text-[#c4a574]">
                                      {k}: <span className="text-white/70">{String(v)}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
                              {testMessages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                                  <FlaskConical className="w-8 h-8 mb-2 opacity-30" />
                                  <p className="text-xs">Send a message to test this playbook.</p>
                                  <p className="text-[10px] mt-1 opacity-60">Uses RAG from your knowledge base.</p>
                                </div>
                              ) : (
                                testMessages.map((m, i) => (
                                  <div key={i} className={`flex gap-2 ${m.role === "assistant" ? "" : "flex-row-reverse"}`}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${m.role === "assistant" ? "bg-[#c4a574]/20" : "bg-white/10"}`}>
                                      {m.role === "assistant" ? <Bot className="w-3 h-3 text-[#c4a574]" /> : <User className="w-3 h-3 text-white/60" />}
                                    </div>
                                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${m.role === "assistant" ? "bg-[#1a1a1a] text-foreground border border-white/5" : "bg-[#c4a574]/20 text-white border border-[#c4a574]/20"}`}>
                                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                                      {m.escalated && (
                                        <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400">
                                          Escalated to human
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))
                              )}
                              {testRunning && (
                                <div className="flex gap-2">
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[#c4a574]/20 shrink-0">
                                    <Bot className="w-3 h-3 text-[#c4a574]" />
                                  </div>
                                  <div className="rounded-lg px-3 py-2 bg-[#1a1a1a] border border-white/5">
                                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <input
                                type="text"
                                value={testInput}
                                onChange={(e) => setTestInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runTest(); } }}
                                placeholder="Type a test message…"
                                className="flex-1 text-sm px-3 py-2 rounded-lg bg-[#0a0a0a] border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#c4a574]/40"
                              />
                              <Button
                                onClick={runTest}
                                disabled={!testInput.trim() || testRunning}
                                size="sm"
                                className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0] shrink-0"
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                              {testMessages.length > 0 && (
                                <Button
                                  onClick={() => { setTestMessages([]); setTestVariables({}); }}
                                  size="sm"
                                  variant="outline"
                                  className="border-white/10 text-muted-foreground shrink-0"
                                  title="Clear conversation"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
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
                          size="sm"
                          onClick={openVersionHistory}
                          className="border-white/10 text-muted-foreground hover:text-foreground"
                        >
                          <History className="h-3.5 w-3.5 mr-1.5" />
                          History
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

      {/* Version history side panel */}
      {showVersions && selected && (
        <div className="fixed inset-0 z-40 flex">
          <div className="flex-1" onClick={() => setShowVersions(false)} />
          <div className="w-80 bg-[#0a0a0a] border-l border-white/10 h-full overflow-y-auto shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <History className="w-4 h-4 text-[#c4a574]" /> Version History
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={snapshotVersion}
                  className="text-xs text-[#c4a574] hover:underline flex items-center gap-1"
                >
                  <Save className="w-3 h-3" /> Snapshot
                </button>
                <button onClick={() => setShowVersions(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-4 space-y-3">
              {loadingVersions ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No snapshots yet.</p>
                  <p className="text-xs mt-1">Click "Snapshot" to save a version.</p>
                </div>
              ) : (
                versions.map((v) => (
                  <div key={v.id} className="p-3 bg-[#141414] rounded-lg border border-white/5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[#c4a574]">v{v.version}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(v.created_at).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {v.change_summary && (
                      <p className="text-xs text-muted-foreground">{v.change_summary}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
