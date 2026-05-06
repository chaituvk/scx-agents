"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Cpu,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type ProfileKind = "router" | "specialist" | "policy";
type ProfileStatus = "active" | "draft" | "archived";

interface RuntimeProfile {
  id: string;
  tenant_id?: string;
  name: string;
  kind: ProfileKind;
  status: ProfileStatus;
  description?: string;
  allowed_journeys?: string[];
  allowed_tools?: string[];
  allowed_slots?: string[];
  guardrails?: string[];
  policies?: unknown[];
  config?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

interface DraftProfile {
  name: string;
  kind: ProfileKind;
  status: ProfileStatus;
  description: string;
  allowed_journeys: string;
  allowed_tools: string;
  allowed_slots: string;
  guardrails: string;
  policiesJson: string;
  configJson: string;
}

const EMPTY_DRAFT: DraftProfile = {
  name: "",
  kind: "specialist",
  status: "active",
  description: "",
  allowed_journeys: "",
  allowed_tools: "",
  allowed_slots: "",
  guardrails: "",
  policiesJson: "[]",
  configJson: "{}",
};

const KIND_COLORS: Record<ProfileKind, string> = {
  router: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  specialist: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  policy: "bg-orange-500/15 text-orange-300 border-orange-500/30",
};

const STATUS_COLORS: Record<ProfileStatus, string> = {
  active: "bg-green-500/15 text-green-300 border-green-500/30",
  draft: "bg-gray-500/15 text-gray-300 border-gray-500/30",
  archived: "bg-red-500/15 text-red-300 border-red-500/30",
};

function profileToDraft(p: RuntimeProfile): DraftProfile {
  return {
    name: p.name ?? "",
    kind: p.kind ?? "specialist",
    status: p.status ?? "active",
    description: p.description ?? "",
    allowed_journeys: (p.allowed_journeys ?? []).join(", "),
    allowed_tools: (p.allowed_tools ?? []).join(", "),
    allowed_slots: (p.allowed_slots ?? []).join(", "),
    guardrails: (p.guardrails ?? []).join("\n"),
    policiesJson: JSON.stringify(p.policies ?? [], null, 2),
    configJson: JSON.stringify(p.config ?? {}, null, 2),
  };
}

function csvList(text: string): string[] {
  return text.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

function lineList(text: string): string[] {
  return text.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
}

function tryParseJson(text: string, fallback: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: text.trim() === "" ? fallback : JSON.parse(text) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid JSON" };
  }
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<RuntimeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<DraftProfile>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/runtime/profiles");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProfiles(data.profiles ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  const startCreate = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId("new");
    setValidationError(null);
  };

  const startEdit = (profile: RuntimeProfile) => {
    setDraft(profileToDraft(profile));
    setEditingId(profile.id);
    setValidationError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setValidationError(null);
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setValidationError("Name is required");
      return;
    }
    const policiesParsed = tryParseJson(draft.policiesJson, []);
    if (!policiesParsed.ok) {
      setValidationError(`Policies JSON: ${policiesParsed.error}`);
      return;
    }
    const configParsed = tryParseJson(draft.configJson, {});
    if (!configParsed.ok) {
      setValidationError(`Config JSON: ${configParsed.error}`);
      return;
    }

    const body = {
      name: draft.name.trim(),
      kind: draft.kind,
      status: draft.status,
      description: draft.description,
      allowed_journeys: csvList(draft.allowed_journeys),
      allowed_tools: csvList(draft.allowed_tools),
      allowed_slots: csvList(draft.allowed_slots),
      guardrails: lineList(draft.guardrails),
      policies: policiesParsed.value,
      config: configParsed.value,
    };

    setSaving(true);
    setValidationError(null);
    try {
      const url = editingId === "new" ? "/api/runtime/profiles" : `/api/runtime/profiles/${editingId}`;
      const method = editingId === "new" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const issuesText = Array.isArray(errBody.issues)
          ? errBody.issues.map((i: { message?: string; path?: string[] }) => `${i.path?.join(".") ?? ""}: ${i.message}`).join("; ")
          : "";
        throw new Error(errBody.error ? `${errBody.error}${issuesText ? ` — ${issuesText}` : ""}` : `HTTP ${res.status}`);
      }
      setEditingId(null);
      await fetchProfiles();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (profile: RuntimeProfile) => {
    if (!confirm(`Delete profile "${profile.name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/runtime/profiles/${profile.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  return (
    <main className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-gradient-sierra" />

      <div className="relative mx-auto max-w-6xl px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="h-6 w-6 text-[#c4a574]" />
              <span className="text-sm font-medium text-[#c4a574]">Runtime Profiles</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-2">
              Router, specialist, and policy <span className="text-gradient">profiles</span>
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Tenant-scoped runtime configuration that the orchestrator loads on every turn.
              Routers map intents to journeys; specialists declare allowed tools/slots; policies
              enforce per-rule effects (allow / deny / require_approval / escalate).
            </p>
          </div>
          <Button onClick={startCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New profile
          </Button>
        </motion.div>

        {error && (
          <Card className="bg-red-500/10 border-red-500/30 mb-4">
            <CardContent className="p-4 flex items-center gap-2 text-red-300">
              <AlertTriangle className="h-4 w-4" /> {error}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading profiles…
          </div>
        ) : profiles.length === 0 ? (
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-8 text-center text-muted-foreground">
              No runtime profiles for this tenant yet. Create one to enable session-aware routing,
              tool/slot gating, or policy enforcement.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {profiles.map((p) => (
              <Card key={p.id} className="bg-[#141414] border-white/5">
                <CardContent className="p-5 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-medium truncate">{p.name}</span>
                      <Badge variant="outline" className={KIND_COLORS[p.kind]}>{p.kind}</Badge>
                      <Badge variant="outline" className={STATUS_COLORS[p.status]}>{p.status}</Badge>
                    </div>
                    {p.description && (
                      <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{p.description}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {(p.allowed_journeys ?? []).length > 0 && (
                        <span>journeys: {(p.allowed_journeys ?? []).length}</span>
                      )}
                      {(p.allowed_tools ?? []).length > 0 && (
                        <span>tools: {(p.allowed_tools ?? []).length}</span>
                      )}
                      {(p.allowed_slots ?? []).length > 0 && (
                        <span>slots: {(p.allowed_slots ?? []).length}</span>
                      )}
                      {(p.policies ?? []).length > 0 && (
                        <span>policies: {(p.policies ?? []).length}</span>
                      )}
                      {p.updated_at && (
                        <span>updated: {new Date(p.updated_at).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(p)} className="gap-1.5">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void remove(p)} className="gap-1.5 text-red-300 hover:text-red-200">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {editingId !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto" onClick={cancelEdit}>
            <Card className="bg-[#0e0e0e] border-white/10 w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-semibold">
                    {editingId === "new" ? "Create runtime profile" : "Edit runtime profile"}
                  </h2>
                  <Button variant="ghost" size="sm" onClick={cancelEdit}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4">
                  <label className="grid gap-1.5">
                    <span className="text-xs text-muted-foreground">Name</span>
                    <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1.5">
                      <span className="text-xs text-muted-foreground">Kind</span>
                      <select
                        className="h-10 rounded-md border border-white/10 bg-[#1a1a1a] px-3 text-sm"
                        value={draft.kind}
                        onChange={(e) => setDraft({ ...draft, kind: e.target.value as ProfileKind })}
                      >
                        <option value="router">router</option>
                        <option value="specialist">specialist</option>
                        <option value="policy">policy</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-xs text-muted-foreground">Status</span>
                      <select
                        className="h-10 rounded-md border border-white/10 bg-[#1a1a1a] px-3 text-sm"
                        value={draft.status}
                        onChange={(e) => setDraft({ ...draft, status: e.target.value as ProfileStatus })}
                      >
                        <option value="active">active</option>
                        <option value="draft">draft</option>
                        <option value="archived">archived</option>
                      </select>
                    </label>
                  </div>

                  <label className="grid gap-1.5">
                    <span className="text-xs text-muted-foreground">Description</span>
                    <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs text-muted-foreground">Allowed journeys (comma-separated ids)</span>
                    <Input value={draft.allowed_journeys} onChange={(e) => setDraft({ ...draft, allowed_journeys: e.target.value })} />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs text-muted-foreground">Allowed tools (comma-separated)</span>
                    <Input value={draft.allowed_tools} onChange={(e) => setDraft({ ...draft, allowed_tools: e.target.value })} />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs text-muted-foreground">Allowed slots (comma-separated)</span>
                    <Input value={draft.allowed_slots} onChange={(e) => setDraft({ ...draft, allowed_slots: e.target.value })} />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs text-muted-foreground">Guardrails (one per line)</span>
                    <textarea
                      className="min-h-[80px] rounded-md border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm font-mono"
                      value={draft.guardrails}
                      onChange={(e) => setDraft({ ...draft, guardrails: e.target.value })}
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs text-muted-foreground">Policies (JSON array of {"{ id, effect, when, reason }"})</span>
                    <textarea
                      className="min-h-[100px] rounded-md border border-white/10 bg-[#1a1a1a] px-3 py-2 text-xs font-mono"
                      value={draft.policiesJson}
                      onChange={(e) => setDraft({ ...draft, policiesJson: e.target.value })}
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      Config (JSON object — for router profiles, include {"{ intents: [{intent, journey_id}] }"})
                    </span>
                    <textarea
                      className="min-h-[100px] rounded-md border border-white/10 bg-[#1a1a1a] px-3 py-2 text-xs font-mono"
                      value={draft.configJson}
                      onChange={(e) => setDraft({ ...draft, configJson: e.target.value })}
                    />
                  </label>

                  {validationError && (
                    <div className="text-sm text-red-300 flex items-start gap-1.5">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{validationError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 mt-2">
                    <Button variant="ghost" onClick={cancelEdit} disabled={saving}>Cancel</Button>
                    <Button onClick={() => void save()} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {editingId === "new" ? "Create" : "Save changes"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {!loading && !error && profiles.length > 0 && (
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
            {profiles.filter((p) => p.status === "active").length} active of {profiles.length} total
          </div>
        )}
      </div>
    </main>
  );
}
