"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  Mail,
  Shield,
  Eye,
  EyeOff,
  UserCheck,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: "admin" | "agent" | "viewer" | "superadmin";
  created_at?: string;
  tenant_id: string;
}

const ROLE_OPTIONS: Array<{ value: string; label: string; desc: string }> = [
  { value: "admin", label: "Admin", desc: "Full access including settings" },
  { value: "agent", label: "Agent", desc: "Handle conversations and use tools" },
  { value: "viewer", label: "Viewer", desc: "Read-only access to all areas" },
];

const ROLE_COLORS: Record<string, string> = {
  superadmin: "text-purple-400 bg-purple-400/10",
  admin: "text-[#c4a574] bg-[#c4a574]/10",
  agent: "text-blue-400 bg-blue-400/10",
  viewer: "text-gray-400 bg-gray-400/10",
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

interface MemberDialogProps {
  member: TeamMember | null;
  onClose: () => void;
  onSaved: (m: TeamMember) => void;
}

function MemberDialog({ member, onClose, onSaved }: MemberDialogProps) {
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [role, setRole] = useState(member?.role ?? "agent");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim() || !email.trim()) { setError("Name and email are required"); return; }
    if (!member && !password.trim()) { setError("Password is required for new members"); return; }
    setSaving(true);
    setError("");
    try {
      let res: Response;
      if (member) {
        const body: Record<string, string> = { name: name.trim(), email: email.trim(), role };
        res = await fetch(`/api/team/${member.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), email: email.trim(), role, password }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onSaved(data.user);
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
          <h2 className="text-lg font-semibold">{member ? "Edit Team Member" : "Invite Team Member"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Full name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" className="bg-[#0a0a0a]" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Email address</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="jane@company.com" className="bg-[#0a0a0a]" />
          </div>
          {!member && (
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Temporary password</label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="bg-[#0a0a0a] pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Role</label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRole(opt.value as TeamMember["role"])}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    role === opt.value
                      ? "border-[#c4a574] bg-[#c4a574]/5"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={submit} disabled={saving} className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]">
              {saving ? "Saving…" : member ? "Update" : "Invite"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team");
      const data = await res.json();
      setTeam(data.team ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteMember(id: string, name: string) {
    if (!confirm(`Remove ${name} from the team?`)) return;
    setDeleting(id);
    await fetch(`/api/team/${id}`, { method: "DELETE" });
    setTeam((prev) => prev.filter((m) => m.id !== id));
    setDeleting(null);
  }

  const filtered = team.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || m.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleCounts = team.reduce<Record<string, number>>((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Members</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your support team, assign roles and permissions.
          </p>
        </div>
        <Button
          onClick={() => { setEditingMember(null); setDialogOpen(true); }}
          className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Invite Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {["total", "admin", "agent", "viewer"].map((label) => (
          <Card key={label} className="bg-[#0a0a0a] border-white/5">
            <CardContent className="p-4">
              <p className="text-2xl font-bold">
                {label === "total" ? team.length : (roleCounts[label] ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground capitalize mt-0.5">{label === "total" ? "Total members" : `${label}s`}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9 bg-[#0a0a0a]"
          />
        </div>
        <div className="flex gap-1">
          {["all", "admin", "agent", "viewer"].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                roleFilter === r
                  ? "bg-[#c4a574]/10 text-[#c4a574] border border-[#c4a574]/30"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#0a0a0a] border-white/5">
          <CardContent className="p-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search || roleFilter !== "all" ? "No members match your filters." : "No team members yet. Invite someone to get started."}
            </p>
            {!search && roleFilter === "all" && (
              <Button
                onClick={() => { setEditingMember(null); setDialogOpen(true); }}
                className="mt-4 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Invite first member
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-[#0a0a0a] border border-white/5 hover:border-white/10 transition-colors"
            >
              {/* Avatar */}
              <div className="h-10 w-10 rounded-full bg-[#c4a574]/10 flex items-center justify-center shrink-0 text-[#c4a574] font-semibold text-sm">
                {m.name.slice(0, 2).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium">{m.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize font-medium ${ROLE_COLORS[m.role] ?? "text-gray-400 bg-gray-400/10"}`}>
                    {m.role}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {m.email}
                  </span>
                  {m.created_at && (
                    <span>Joined {formatDate(m.created_at)}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { setEditingMember(m); setDialogOpen(true); }}
                  className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {m.role !== "superadmin" && (
                  <button
                    onClick={() => deleteMember(m.id, m.name)}
                    disabled={deleting === m.id}
                    className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Permissions legend */}
      <div className="mt-8 p-4 rounded-xl bg-[#0a0a0a] border border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Role permissions</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {ROLE_OPTIONS.map((r) => (
            <div key={r.value}>
              <div className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block mb-1.5 capitalize ${ROLE_COLORS[r.value]}`}>
                {r.label}
              </div>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {dialogOpen && (
        <MemberDialog
          member={editingMember}
          onClose={() => setDialogOpen(false)}
          onSaved={(m) => {
            setTeam((prev) => {
              const idx = prev.findIndex((x) => x.id === m.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = m;
                return next;
              }
              return [m, ...prev];
            });
            setDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
