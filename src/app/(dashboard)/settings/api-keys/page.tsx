"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Key, Plus, Trash2, Copy, Check, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  status: "active" | "revoked";
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

interface NewKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  status: "active";
  last_used_at: null;
  expires_at: null;
  created_at: string;
  plaintext: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState<NewKey | null>(null);
  const [form, setForm] = useState({ name: "", scopes: ["read", "write"] as string[], expiresAt: "" });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchKeys(); }, []);

  async function fetchKeys() {
    setLoading(true);
    try {
      const res = await fetch("/api/api-keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createKey() {
    if (!form.name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          scopes: form.scopes,
          expiresAt: form.expiresAt || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewKey(data.key);
        setAdding(false);
        setForm({ name: "", scopes: ["read", "write"], expiresAt: "" });
        fetchKeys();
      }
    } finally {
      setSaving(false);
    }
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    fetchKeys();
  }

  function copyKey() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey.plaintext);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleScope(scope: string) {
    setForm((f) => ({
      ...f,
      scopes: f.scopes.includes(scope) ? f.scopes.filter((s) => s !== scope) : [...f.scopes, scope],
    }));
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Key className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl font-semibold">API Keys</h1>
              <p className="text-muted-foreground text-sm">Manage programmatic access to the Sierra API</p>
            </div>
          </div>
          <Button onClick={() => setAdding(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Create Key
          </Button>
        </div>

        {/* New key reveal banner */}
        <AnimatePresence>
          {newKey && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-700 mb-1">
                    Copy your key — it won't be shown again
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-background border rounded px-2 py-1 font-mono flex-1 truncate">
                      {newKey.plaintext}
                    </code>
                    <Button size="sm" variant="outline" onClick={copyKey} className="gap-1 shrink-0">
                      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                </div>
                <button onClick={() => setNewKey(null)} className="text-muted-foreground hover:text-foreground">
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create form */}
        {adding && (
          <Card className="mb-6 border-primary/40">
            <CardHeader>
              <CardTitle className="text-base">New API Key</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Key Name</label>
                <Input
                  placeholder="e.g. Production CRM Integration"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Scopes</label>
                <div className="flex gap-2">
                  {["read", "write", "admin"].map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => toggleScope(scope)}
                      className={`text-sm px-3 py-1 rounded border transition-colors ${
                        form.scopes.includes(scope)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-foreground"
                      }`}
                    >
                      {scope}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Expiry (optional)</label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={createKey} disabled={!form.name || saving}>
                  {saving ? "Creating…" : "Create Key"}
                </Button>
                <Button variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Keys list */}
        {loading ? (
          <div className="text-center text-muted-foreground py-20">Loading…</div>
        ) : keys.length === 0 ? (
          <div className="text-center text-muted-foreground py-20">
            <Key className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>No API keys yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <motion.div key={k.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{k.name}</span>
                          <Badge variant={k.status === "active" ? "default" : "secondary"} className="text-xs">
                            {k.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-mono">{k.key_prefix}…</span>
                          <span>{k.scopes.join(", ")}</span>
                          {k.last_used_at && (
                            <span>Last used {new Date(k.last_used_at).toLocaleDateString()}</span>
                          )}
                          {k.expires_at && (
                            <span>Expires {new Date(k.expires_at).toLocaleDateString()}</span>
                          )}
                          <span>Created {new Date(k.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {k.status === "active" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => revokeKey(k.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-8 p-4 bg-muted/30 rounded-lg text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Using the API</p>
          <p>Include your key in the <code className="bg-muted px-1 rounded">Authorization</code> header:</p>
          <code className="block mt-2 bg-muted p-2 rounded text-xs font-mono">
            Authorization: Bearer sk_your_api_key
          </code>
        </div>
      </div>
    </div>
  );
}
