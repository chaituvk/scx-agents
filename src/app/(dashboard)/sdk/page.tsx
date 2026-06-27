"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Sparkles, Key, Copy, CheckCircle, Plus, Trash2, Eye, EyeOff,
  Code, Terminal, Package, Globe, Loader2, Shield, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  key_masked?: string;
  scopes: string[];
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
  created_by?: string;
}

const SDK_LANGS = [
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "curl", label: "cURL" },
];

const CODE_SAMPLES: Record<string, string> = {
  typescript: `import { SierraClient } from "@sierra-ai/sdk";

const client = new SierraClient({ apiKey: "sk_live_..." });

// Start a conversation
const session = await client.conversations.create({
  channel: "api",
  metadata: { userId: "usr_123" },
});

// Send a message
const response = await client.conversations.message(session.id, {
  content: "I need help with my order",
});

console.log(response.message.content);
console.log("Intent:", response.intent);
console.log("Resolved:", response.resolved);`,

  python: `from sierra_ai import SierraClient

client = SierraClient(api_key="sk_live_...")

# Start a conversation
session = client.conversations.create(
    channel="api",
    metadata={"user_id": "usr_123"}
)

# Send a message
response = client.conversations.message(session.id,
    content="I need help with my order"
)

print(response.message.content)
print("Intent:", response.intent)
print("Resolved:", response.resolved)`,

  curl: `# Create a conversation
curl -X POST https://api.sierra.ai/v1/conversations \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"channel": "api", "metadata": {"userId": "usr_123"}}'

# Send a message
curl -X POST https://api.sierra.ai/v1/conversations/{id}/messages \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"content": "I need help with my order"}'`,
};

const ENDPOINTS = [
  { method: "POST", path: "/v1/conversations", desc: "Start a new conversation session" },
  { method: "POST", path: "/v1/conversations/:id/messages", desc: "Send a message to a conversation" },
  { method: "GET", path: "/v1/conversations/:id", desc: "Retrieve conversation state" },
  { method: "POST", path: "/v1/conversations/:id/handover", desc: "Escalate to human agent" },
  { method: "GET", path: "/v1/journeys", desc: "List available agent journeys" },
  { method: "POST", path: "/v1/customers", desc: "Upsert customer profile" },
  { method: "GET", path: "/v1/customers/:id/memory", desc: "Retrieve customer memory slots" },
  { method: "POST", path: "/v1/knowledge/search", desc: "Semantic search knowledge base" },
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-500/10 text-blue-400",
  POST: "bg-green-500/10 text-green-400",
  PATCH: "bg-yellow-500/10 text-yellow-400",
  DELETE: "bg-red-500/10 text-red-400",
};

export default function SdkPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [lang, setLang] = useState("typescript");

  useEffect(() => {
    fetch("/api/api-keys")
      .then(r => r.json())
      .then(d => setKeys(d.keys ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!newKeyName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim(), scopes: ["read", "write"] }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewKey(data.key?.raw_key ?? data.key?.key_prefix + "...");
        setKeys(prev => [data.key, ...prev].filter(Boolean));
        setCreating(false);
        setNewKeyName("");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" }).catch(() => {});
    setKeys(prev => prev.filter(k => k.id !== id));
  }

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Agent SDK</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Embed Sierra agents into your product with a few lines of code.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded bg-[#c4a574]/10 text-[#c4a574] font-mono">v1.4.2</span>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => copy("npm install @sierra-ai/sdk", "npm")}
          >
            <Terminal className="w-4 h-4" />
            {copied === "npm" ? "Copied!" : "npm install @sierra-ai/sdk"}
          </Button>
        </div>
      </div>

      {newKey && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6 flex items-start gap-3"
        >
          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-400 mb-1">API key created — copy it now</p>
            <p className="text-xs text-muted-foreground mb-2">This key will not be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-black/30 rounded px-3 py-1.5 font-mono text-foreground flex-1 min-w-0 truncate">{newKey}</code>
              <button onClick={() => copy(newKey, "newkey")} className="p-1.5 rounded hover:bg-white/10 text-green-400 shrink-0">
                <Copy className={`w-3.5 h-3.5 ${copied === "newkey" ? "text-green-300" : ""}`} />
              </button>
            </div>
          </div>
          <button onClick={() => setNewKey(null)} className="text-muted-foreground hover:text-foreground shrink-0">×</button>
        </motion.div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* API Keys */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-[#c4a574]" />
                <h3 className="font-medium text-sm">API Keys</h3>
              </div>
              <Button size="sm" onClick={() => setCreating(!creating)} className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-1 h-7 text-xs">
                <Plus className="w-3 h-3" /> New Key
              </Button>
            </div>

            {creating && (
              <div className="mb-4 p-3 bg-black/20 rounded-lg border border-white/10 space-y-3">
                <input
                  value={newKeyName}
                  onChange={e => setNewKeyName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleCreate()}
                  placeholder="Key name (e.g. Production)"
                  className="w-full bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground/50"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreate} disabled={saving || !newKeyName.trim()} className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] h-7 text-xs gap-1">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}
                    Generate
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCreating(false)} className="h-7 text-xs">Cancel</Button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : keys.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                <Key className="w-6 h-6 mx-auto mb-2 opacity-30" />
                No API keys yet
              </div>
            ) : (
              <div className="space-y-2">
                {keys.map(k => (
                  <div key={k.id} className="flex items-start gap-3 p-3 bg-black/20 rounded-lg border border-white/5">
                    <Shield className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium">{k.name}</p>
                        {k.expires_at && (
                          <span className="text-[10px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            Expires {new Date(k.expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <code className="text-[10px] text-muted-foreground font-mono">
                          {revealed.has(k.id) ? (k.key_masked ?? k.key_prefix + "••••••••") : k.key_prefix + "••••••••"}
                        </code>
                        <button
                          onClick={() => setRevealed(prev => {
                            const s = new Set(prev);
                            if (s.has(k.id)) s.delete(k.id); else s.add(k.id);
                            return s;
                          })}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {revealed.has(k.id) ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                        </button>
                        <button onClick={() => copy(k.key_prefix, k.id + "-copy")} className="text-muted-foreground hover:text-foreground">
                          <Copy className={`w-2.5 h-2.5 ${copied === k.id + "-copy" ? "text-green-400" : ""}`} />
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        Created {new Date(k.created_at).toLocaleDateString()}
                        {k.last_used_at && ` · last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <button onClick={() => handleDelete(k.id)} className="p-1 rounded hover:bg-white/5 text-muted-foreground hover:text-red-400 shrink-0">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* REST Endpoints */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-xl p-5 mt-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-[#c4a574]" />
              <h3 className="font-medium text-sm">REST API Reference</h3>
            </div>
            <div className="space-y-2">
              {ENDPOINTS.map(ep => (
                <div key={ep.path} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${METHOD_COLORS[ep.method]}`}>
                    {ep.method}
                  </span>
                  <div className="flex-1 min-w-0">
                    <code className="text-xs text-foreground font-mono">{ep.path}</code>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{ep.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Code Samples */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-card border border-border rounded-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-[#c4a574]" />
                <h3 className="font-medium text-sm">Quick Start</h3>
              </div>
              <div className="flex items-center gap-1 bg-black/30 rounded-lg p-0.5">
                {SDK_LANGS.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setLang(l.id)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      lang === l.id ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <pre className="p-5 text-xs font-mono text-green-300/90 overflow-x-auto leading-relaxed bg-[#050505]">
                <code>{CODE_SAMPLES[lang]}</code>
              </pre>
              <button
                onClick={() => copy(CODE_SAMPLES[lang], "code")}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Copy className={`w-3.5 h-3.5 ${copied === "code" ? "text-green-400" : ""}`} />
              </button>
            </div>
          </motion.div>

          {/* Install & packages */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card border border-border rounded-xl p-5 mt-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-4 h-4 text-[#c4a574]" />
              <h3 className="font-medium text-sm">SDKs & Packages</h3>
            </div>
            <div className="space-y-2">
              {[
                { lang: "TypeScript / Node.js", pkg: "npm install @sierra-ai/sdk", badge: "Official" },
                { lang: "Python", pkg: "pip install sierra-ai", badge: "Official" },
                { lang: "Go", pkg: "go get github.com/sierra-ai/sierra-go", badge: "Community" },
                { lang: "REST", pkg: "https://api.sierra.ai/v1", badge: "Always available" },
              ].map(s => (
                <div key={s.lang} className="flex items-center gap-3 p-3 bg-black/20 rounded-lg border border-white/5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{s.lang}</p>
                    <code className="text-[10px] text-muted-foreground font-mono">{s.pkg}</code>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.badge === "Official" ? "bg-[#c4a574]/10 text-[#c4a574]" : "bg-white/5 text-muted-foreground"}`}>
                      {s.badge}
                    </span>
                    <button onClick={() => copy(s.pkg, s.lang)} className="text-muted-foreground hover:text-foreground">
                      <Copy className={`w-3 h-3 ${copied === s.lang ? "text-green-400" : ""}`} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
