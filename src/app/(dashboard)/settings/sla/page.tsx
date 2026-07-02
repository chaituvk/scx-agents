"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Pencil,
  Trash2,
  X,
  ShieldAlert,
  RefreshCw,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface SlaConfig {
  id: string;
  name: string;
  priority: string;
  first_response_minutes: number;
  resolution_minutes: number;
  status: string;
  created_at: string;
}

interface SlaBreach {
  id: string;
  conversation_id: string;
  sla_config_id: string | null;
  breach_type: string;
  breached_at: string;
  acknowledged_at: string | null;
}

interface AtRisk {
  conversation_id: string;
  breach_type: string;
  minutes_remaining: number;
  sla_config_id: string;
}

const PRIORITY_OPTIONS = ["critical", "high", "normal", "low"];
const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-400 bg-red-400/10",
  high: "text-orange-400 bg-orange-400/10",
  normal: "text-blue-400 bg-blue-400/10",
  low: "text-gray-400 bg-gray-400/10",
};

function formatMinutes(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

interface ConfigDialogProps {
  config: SlaConfig | null;
  onClose: () => void;
  onSaved: (c: SlaConfig) => void;
}

function ConfigDialog({ config, onClose, onSaved }: ConfigDialogProps) {
  const [name, setName] = useState(config?.name ?? "");
  const [priority, setPriority] = useState(config?.priority ?? "normal");
  const [firstResponse, setFirstResponse] = useState(String(config?.first_response_minutes ?? 60));
  const [resolution, setResolution] = useState(String(config?.resolution_minutes ?? 480));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const body = {
        name: name.trim(),
        priority,
        first_response_minutes: parseInt(firstResponse, 10) || 60,
        resolution_minutes: parseInt(resolution, 10) || 480,
        status: "active",
      };
      let res: Response;
      if (config) {
        res = await fetch(`/api/sla/${config.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/sla", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onSaved(data.config);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md bg-[#141414] border border-white/10 rounded-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{config ? "Edit SLA Policy" : "New SLA Policy"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Policy name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard SLA" className="bg-[#0a0a0a]" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Priority tier</label>
            <div className="flex gap-2 flex-wrap">
              {PRIORITY_OPTIONS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize border transition-colors ${
                    priority === p
                      ? "border-[#c4a574] bg-[#c4a574]/10 text-[#c4a574]"
                      : "border-white/10 text-muted-foreground hover:border-white/20"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">First response (minutes)</label>
              <Input
                type="number"
                min={1}
                value={firstResponse}
                onChange={(e) => setFirstResponse(e.target.value)}
                className="bg-[#0a0a0a]"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{formatMinutes(parseInt(firstResponse, 10) || 0)}</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Resolution (minutes)</label>
              <Input
                type="number"
                min={1}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="bg-[#0a0a0a]"
              />
              <p className="text-[10px] text-muted-foreground mt-1">{formatMinutes(parseInt(resolution, 10) || 0)}</p>
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={submit} disabled={saving} className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]">
              {saving ? "Saving…" : config ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

type Tab = "policies" | "breaches" | "at-risk";

export default function SlaPage() {
  const [tab, setTab] = useState<Tab>("policies");
  const [configs, setConfigs] = useState<SlaConfig[]>([]);
  const [breaches, setBreaches] = useState<SlaBreach[]>([]);
  const [atRisk, setAtRisk] = useState<AtRisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SlaConfig | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sla");
      const data = await res.json();
      setConfigs(data.configs ?? []);
      setBreaches(data.recent_breaches ?? []);
      setAtRisk(data.open_conversations_at_risk ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteConfig(id: string) {
    if (!confirm("Delete this SLA policy?")) return;
    setDeleting(id);
    await fetch(`/api/sla/${id}`, { method: "DELETE" });
    setConfigs((prev) => prev.filter((c) => c.id !== id));
    setDeleting(null);
  }

  async function toggleStatus(cfg: SlaConfig) {
    const next = cfg.status === "active" ? "paused" : "active";
    const res = await fetch(`/api/sla/${cfg.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setConfigs((prev) => prev.map((c) => (c.id === cfg.id ? data.config : c)));
    }
  }

  async function acknowledgeBreach(id: string) {
    setAcknowledging(id);
    await fetch("/api/sla/breaches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setBreaches((prev) =>
      prev.map((b) => (b.id === id ? { ...b, acknowledged_at: new Date().toISOString() } : b))
    );
    setAcknowledging(null);
  }

  const unacknowledgedBreaches = breaches.filter((b) => !b.acknowledged_at);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">SLA Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define response and resolution time targets, monitor breaches and at-risk conversations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={load} className="text-muted-foreground">
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button
            onClick={() => { setEditingConfig(null); setDialogOpen(true); }}
            className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Policy
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="bg-[#0a0a0a] border-white/5">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{configs.filter((c) => c.status === "active").length}</p>
                <p className="text-xs text-muted-foreground">Active policies</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0a0a0a] border-white/5">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{unacknowledgedBreaches.length}</p>
                <p className="text-xs text-muted-foreground">Unacknowledged breaches</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0a0a0a] border-white/5">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{atRisk.length}</p>
                <p className="text-xs text-muted-foreground">Conversations at risk</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/5">
        {(["policies", "breaches", "at-risk"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-[#c4a574] text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "at-risk" ? "At Risk" : t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "breaches" && unacknowledgedBreaches.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400">
                {unacknowledgedBreaches.length}
              </span>
            )}
            {t === "at-risk" && atRisk.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-orange-500/20 text-orange-400">
                {atRisk.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : tab === "policies" ? (
        <div className="space-y-3">
          {configs.length === 0 ? (
            <Card className="bg-[#0a0a0a] border-white/5">
              <CardContent className="p-12 text-center">
                <Clock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No SLA policies yet. Create one to start tracking response targets.</p>
                <Button
                  onClick={() => { setEditingConfig(null); setDialogOpen(true); }}
                  className="mt-4 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create first policy
                </Button>
              </CardContent>
            </Card>
          ) : (
            configs.map((cfg) => (
              <div
                key={cfg.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-[#0a0a0a] border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="h-10 w-10 rounded-lg bg-[#c4a574]/10 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-[#c4a574]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium">{cfg.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize font-medium ${PRIORITY_COLORS[cfg.priority] ?? "text-gray-400 bg-gray-400/10"}`}>
                      {cfg.priority}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${cfg.status === "active" ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}`}>
                      {cfg.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>First response: <span className="text-foreground">{formatMinutes(cfg.first_response_minutes)}</span></span>
                    <span>Resolution: <span className="text-foreground">{formatMinutes(cfg.resolution_minutes)}</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleStatus(cfg)}
                    className={`text-xs px-3 py-1 rounded-md border transition-colors ${
                      cfg.status === "active"
                        ? "border-white/10 text-muted-foreground hover:border-white/20"
                        : "border-green-500/30 text-green-400 hover:border-green-500/50"
                    }`}
                  >
                    {cfg.status === "active" ? "Pause" : "Activate"}
                  </button>
                  <button
                    onClick={() => { setEditingConfig(cfg); setDialogOpen(true); }}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteConfig(cfg.id)}
                    disabled={deleting === cfg.id}
                    className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : tab === "breaches" ? (
        <div className="space-y-3">
          {breaches.length === 0 ? (
            <Card className="bg-[#0a0a0a] border-white/5">
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No SLA breaches in the last 7 days.</p>
              </CardContent>
            </Card>
          ) : (
            breaches.map((b) => (
              <div
                key={b.id}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-colors ${
                  b.acknowledged_at
                    ? "bg-[#0a0a0a] border-white/5 opacity-60"
                    : "bg-red-500/5 border-red-500/20"
                }`}
              >
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${b.acknowledged_at ? "bg-gray-500/10" : "bg-red-500/10"}`}>
                  <AlertTriangle className={`h-4 w-4 ${b.acknowledged_at ? "text-gray-400" : "text-red-400"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium capitalize">
                      {b.breach_type.replace("_", " ")} breach
                    </span>
                    {b.acknowledged_at && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400">Acknowledged</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Conversation: <span className="text-foreground font-mono text-[10px]">{b.conversation_id.slice(0, 8)}</span></span>
                    <span>Breached: {formatDate(b.breached_at)}</span>
                  </div>
                </div>
                {!b.acknowledged_at && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={acknowledging === b.id}
                    onClick={() => acknowledgeBreach(b.id)}
                    className="shrink-0 text-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Acknowledge
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {atRisk.length === 0 ? (
            <Card className="bg-[#0a0a0a] border-white/5">
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No conversations at risk right now.</p>
              </CardContent>
            </Card>
          ) : (
            atRisk.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 p-4 rounded-xl bg-orange-500/5 border border-orange-500/20"
              >
                <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                  <ShieldAlert className="h-4 w-4 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium capitalize">
                      {item.breach_type.replace("_", " ")} at risk
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400">
                      {item.minutes_remaining}m remaining
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Conversation: <span className="text-foreground font-mono text-[10px]">{item.conversation_id.slice(0, 8)}</span>
                  </div>
                </div>
                <a
                  href={`/inbox?conversation=${item.conversation_id}`}
                  className="shrink-0 flex items-center gap-1.5 text-xs text-[#c4a574] hover:text-[#d4c4b0] transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" />
                  View
                </a>
              </div>
            ))
          )}
        </div>
      )}

      {dialogOpen && (
        <ConfigDialog
          config={editingConfig}
          onClose={() => setDialogOpen(false)}
          onSaved={(c) => {
            setConfigs((prev) => {
              const idx = prev.findIndex((x) => x.id === c.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = c;
                return next;
              }
              return [c, ...prev];
            });
            setDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
