"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Tag,
  Hash,
  Copy,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

interface CannedResponse {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  shortcut: string | null;
  use_count: number;
  created_at: string;
}

const CATEGORY_OPTIONS = ["general", "billing", "technical", "shipping", "returns", "onboarding", "escalation"];

interface DialogProps {
  item: CannedResponse | null;
  onClose: () => void;
  onSaved: (r: CannedResponse) => void;
}

function CannedDialog({ item, onClose, onSaved }: DialogProps) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [content, setContent] = useState(item?.content ?? "");
  const [category, setCategory] = useState(item?.category ?? "general");
  const [tagsInput, setTagsInput] = useState((item?.tags ?? []).join(", "));
  const [shortcut, setShortcut] = useState(item?.shortcut ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!title.trim() || !content.trim()) { setError("Title and content are required"); return; }
    setSaving(true);
    setError("");
    try {
      const body = {
        title: title.trim(),
        content: content.trim(),
        category,
        tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
        shortcut: shortcut.trim() || null,
      };
      let res: Response;
      if (item) {
        res = await fetch(`/api/canned-responses/${item.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/canned-responses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      onSaved(data.canned_response);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">{item ? "Edit Response" : "New Canned Response"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Shipping delay apology" className="bg-[#0a0a0a]" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Response content</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder="Hi {{customer_name}}, I'm sorry to hear about the delay with your order…"
              className="bg-[#0a0a0a] resize-none text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Use {"{{customer_name}}"}, {"{{order_id}}"}, etc. for dynamic fields</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full text-sm bg-[#0a0a0a] border border-white/10 rounded-md px-3 py-2 text-foreground"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Shortcut (e.g. /delay)</label>
              <Input
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                placeholder="/delay"
                className="bg-[#0a0a0a]"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Tags (comma-separated)</label>
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="shipping, delay, apology" className="bg-[#0a0a0a]" />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={submit} disabled={saving} className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]">
              {saving ? "Saving…" : item ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CannedResponsesPage() {
  const [items, setItems] = useState<CannedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CannedResponse | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      const res = await fetch(`/api/canned-responses?${params}`);
      const data = await res.json();
      setItems(data.canned_responses ?? []);
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  async function deleteItem(id: string, title: string) {
    if (!confirm(`Delete "${title}"?`)) return;
    setDeleting(id);
    await fetch(`/api/canned-responses/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((x) => x.id !== id));
    setDeleting(null);
  }

  function copyContent(content: string, id: string) {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const categories = ["all", ...Array.from(new Set(items.map((i) => i.category).filter(Boolean)))];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Canned Responses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pre-written responses for agents to use in conversations. Use shortcuts for quick access.
          </p>
        </div>
        <Button
          onClick={() => { setEditingItem(null); setDialogOpen(true); }}
          className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Response
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="bg-[#0a0a0a] border-white/5">
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{items.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total responses</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0a0a0a] border-white/5">
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{items.filter((i) => i.shortcut).length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">With shortcuts</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0a0a0a] border-white/5">
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{items.reduce((s, i) => s + i.use_count, 0).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total uses</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or content…"
            className="pl-9 bg-[#0a0a0a]"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                categoryFilter === c
                  ? "bg-[#c4a574]/10 text-[#c4a574] border border-[#c4a574]/30"
                  : "text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-white/5 animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="bg-[#0a0a0a] border-white/5">
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? `No responses match "${search}".` : "No canned responses yet. Create one to help your team reply faster."}
            </p>
            {!search && (
              <Button
                onClick={() => { setEditingItem(null); setDialogOpen(true); }}
                className="mt-4 bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Create first response
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-[#0a0a0a] border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-sm font-medium">{item.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground capitalize">
                      {item.category}
                    </span>
                    {item.shortcut && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#c4a574]/10 text-[#c4a574] font-mono flex items-center gap-1">
                        <Hash className="h-2.5 w-2.5" />
                        {item.shortcut}
                      </span>
                    )}
                    {item.use_count > 0 && (
                      <span className="text-[10px] text-muted-foreground">{item.use_count} uses</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{item.content}</p>
                  {item.tags.length > 0 && (
                    <div className="flex items-center gap-1 mt-2 flex-wrap">
                      <Tag className="h-3 w-3 text-muted-foreground" />
                      {item.tags.map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copyContent(item.content, item.id)}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy content"
                  >
                    {copied === item.id ? <CheckCheck className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => { setEditingItem(item); setDialogOpen(true); }}
                    className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteItem(item.id, item.title)}
                    disabled={deleting === item.id}
                    className="p-1.5 text-muted-foreground hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <CannedDialog
          item={editingItem}
          onClose={() => setDialogOpen(false)}
          onSaved={(r) => {
            setItems((prev) => {
              const idx = prev.findIndex((x) => x.id === r.id);
              if (idx >= 0) { const next = [...prev]; next[idx] = r; return next; }
              return [r, ...prev];
            });
            setDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
