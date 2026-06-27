"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, User, Phone, Mail, Tag, Clock, MessageSquare, Plus, ChevronRight, CheckCircle, AlertCircle } from "lucide-react";

interface CustomerProfile {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  channel?: string;
  language: string;
  tags: string[];
  custom_attributes: Record<string, string>;
  total_conversations: number;
  last_seen_at?: string;
  created_at: string;
}

interface CustomerMemory {
  id: string;
  memory_type: string;
  content: string;
  importance: number;
  created_at: string;
}

interface CustomerConversation {
  id: string;
  channel: string;
  status: string;
  sentiment: string;
  topic?: string;
  message_count: number;
  updated_at: string;
  created_at: string;
}

const MEMORY_TYPE_COLORS: Record<string, string> = {
  preference: "bg-blue-500/20 text-blue-300",
  complaint: "bg-red-500/20 text-red-300",
  fact: "bg-gray-500/20 text-gray-300",
  goal: "bg-green-500/20 text-green-300",
  purchase: "bg-yellow-500/20 text-yellow-300",
  interaction: "bg-purple-500/20 text-purple-300",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [selected, setSelected] = useState<CustomerProfile | null>(null);
  const [memories, setMemories] = useState<CustomerMemory[]>([]);
  const [conversations, setConversations] = useState<CustomerConversation[]>([]);
  const [detailTab, setDetailTab] = useState<"memories" | "conversations">("memories");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [addMemoryOpen, setAddMemoryOpen] = useState(false);
  const [newMemory, setNewMemory] = useState({ memory_type: "fact", content: "", importance: 5 });

  const loadCustomers = useCallback(async (q = "") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    const t = setTimeout(() => loadCustomers(search), 300);
    return () => clearTimeout(t);
  }, [search, loadCustomers]);

  async function loadMemories(customerId: string) {
    const res = await fetch(`/api/customers/${customerId}/memories`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setMemories(data.memories ?? []);
    }
  }

  async function loadConversations(c: CustomerProfile) {
    const q = c.email || c.name || "";
    if (!q) return;
    const res = await fetch(`/api/conversations/search?q=${encodeURIComponent(q)}&limit=20`).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setConversations(data.conversations ?? []);
    }
  }

  async function selectCustomer(c: CustomerProfile) {
    setSelected(c);
    setDetailTab("memories");
    setConversations([]);
    await loadMemories(c.id);
  }

  async function addMemory() {
    if (!selected || !newMemory.content.trim()) return;
    const res = await fetch(`/api/customers/${selected.id}/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(newMemory),
    });
    if (res.ok) {
      setNewMemory({ memory_type: "fact", content: "", importance: 5 });
      setAddMemoryOpen(false);
      await loadMemories(selected.id);
    }
  }

  function formatDate(s?: string) {
    if (!s) return "Never";
    return new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-950 text-gray-100">
      {/* Customer list */}
      <div className="w-80 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-lg font-semibold mb-3">Customers</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone…"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500 text-sm">Loading…</div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <User className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No customers yet</p>
              <p className="text-xs mt-1 opacity-60">Profiles are created automatically when conversations start</p>
            </div>
          ) : (
            customers.map((c) => (
              <button
                key={c.id}
                onClick={() => selectCustomer(c)}
                className={`w-full text-left p-4 border-b border-gray-800/50 hover:bg-gray-800/50 transition-colors ${
                  selected?.id === c.id ? "bg-gray-800" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-indigo-400">
                      {(c.name || c.email || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.name || c.email || c.phone || "Anonymous"}</p>
                    <p className="text-xs text-gray-400 truncate">{c.email || c.phone || c.channel || "—"}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-gray-500">{c.total_conversations} conv</p>
                    <ChevronRight className="h-3 w-3 text-gray-600 ml-auto mt-1" />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Customer detail */}
      {selected ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                <span className="text-2xl font-semibold text-indigo-400">
                  {(selected.name || selected.email || "?").charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-semibold">{selected.name || "Anonymous Customer"}</h2>
                <p className="text-sm text-gray-400">ID: {selected.id.slice(0, 8)}…</p>
              </div>
            </div>

            {/* Contact info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {selected.email && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Mail className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wider">Email</span>
                  </div>
                  <p className="text-sm font-medium">{selected.email}</p>
                </div>
              )}
              {selected.phone && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-400 mb-1">
                    <Phone className="h-4 w-4" />
                    <span className="text-xs uppercase tracking-wider">Phone</span>
                  </div>
                  <p className="text-sm font-medium">{selected.phone}</p>
                </div>
              )}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <MessageSquare className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wider">Conversations</span>
                </div>
                <p className="text-2xl font-semibold">{selected.total_conversations}</p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-400 mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs uppercase tracking-wider">Last Seen</span>
                </div>
                <p className="text-sm font-medium">{formatDate(selected.last_seen_at)}</p>
              </div>
            </div>

            {/* Tags */}
            {selected.tags.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                  <Tag className="h-4 w-4" /> Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selected.tags.map((tag) => (
                    <span key={tag} className="px-3 py-1 bg-gray-800 border border-gray-700 rounded-full text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tab bar */}
            <div className="flex border-b border-gray-800 mb-4">
              <button
                onClick={() => setDetailTab("memories")}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  detailTab === "memories" ? "border-indigo-500 text-white" : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                AI Memory
              </button>
              <button
                onClick={() => {
                  setDetailTab("conversations");
                  if (conversations.length === 0) loadConversations(selected);
                }}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                  detailTab === "conversations" ? "border-indigo-500 text-white" : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" /> Conversations
                {selected.total_conversations > 0 && (
                  <span className="ml-1 text-xs text-gray-500">({selected.total_conversations})</span>
                )}
              </button>
            </div>

            {/* Conversations tab */}
            {detailTab === "conversations" && (
              <div className="space-y-2">
                {conversations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No conversations found</p>
                  </div>
                ) : (
                  conversations.map(c => (
                    <a
                      key={c.id}
                      href={`/inbox`}
                      className="block bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-3 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          {c.status === "resolved" || c.status === "closed" ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          ) : c.status === "escalated" ? (
                            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                          ) : (
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-0.5" />
                          )}
                          <span className="text-sm capitalize">{c.status}</span>
                        </div>
                        <span className="text-xs text-gray-500">{c.channel}</span>
                      </div>
                      {c.topic && <p className="text-xs text-gray-400 mb-1 truncate">{c.topic}</p>}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{c.message_count} messages</span>
                        <span>{new Date(c.updated_at).toLocaleDateString()}</span>
                      </div>
                    </a>
                  ))
                )}
              </div>
            )}

            {/* Memories tab */}
            {detailTab === "memories" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-400">AI Memory</h3>
                <button
                  onClick={() => setAddMemoryOpen(!addMemoryOpen)}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                >
                  <Plus className="h-3 w-3" /> Add memory
                </button>
              </div>

              {addMemoryOpen && (
                <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <select
                      value={newMemory.memory_type}
                      onChange={(e) => setNewMemory((m) => ({ ...m, memory_type: e.target.value }))}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                    >
                      {["preference", "complaint", "fact", "goal", "purchase", "interaction"].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Importance:</span>
                      <input
                        type="range" min={1} max={10}
                        value={newMemory.importance}
                        onChange={(e) => setNewMemory((m) => ({ ...m, importance: Number(e.target.value) }))}
                        className="flex-1"
                      />
                      <span className="text-xs w-4">{newMemory.importance}</span>
                    </div>
                  </div>
                  <textarea
                    value={newMemory.content}
                    onChange={(e) => setNewMemory((m) => ({ ...m, content: e.target.value }))}
                    placeholder="Memory content…"
                    rows={2}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-indigo-500 mb-3"
                  />
                  <div className="flex gap-2">
                    <button onClick={addMemory} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm">
                      Save
                    </button>
                    <button onClick={() => setAddMemoryOpen(false)} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {memories.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No memories recorded yet</p>
                    <p className="text-xs mt-1 opacity-60">Memories are added automatically during conversations</p>
                  </div>
                ) : (
                  memories.map((m) => (
                    <div key={m.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${MEMORY_TYPE_COLORS[m.memory_type] ?? "bg-gray-700 text-gray-300"}`}>
                          {m.memory_type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200">{m.content}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs text-gray-500">{formatDate(m.created_at)}</span>
                            <div className="flex items-center gap-1">
                              <div className="flex gap-0.5">
                                {Array.from({ length: 10 }).map((_, i) => (
                                  <div
                                    key={i}
                                    className={`w-1 h-2 rounded-sm ${i < m.importance ? "bg-indigo-500" : "bg-gray-700"}`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-gray-500 ml-1">{m.importance}/10</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Select a customer to view their profile</p>
          </div>
        </div>
      )}
    </div>
  );
}
