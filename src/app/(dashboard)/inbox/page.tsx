"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Search, Filter, ChevronRight, User, Bot, Clock,
  CheckCircle, AlertCircle, X, Send, Loader2, Star, UserPlus,
  Sparkles, Zap, ChevronDown, Download, FileText, StickyNote, Flame,
  Square, CheckSquare, Users, Brain, History, UserCircle, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface Conversation {
  id: string;
  customer_name: string;
  customer_email: string;
  channel: string;
  status: string;
  sentiment: string;
  priority: string;
  assigned_to: string | null;
  message_count: number;
  updated_at: string;
  urgency_score?: number;
  wait_minutes?: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  agent_id?: string;
  created_at: string;
}

interface CsatRating {
  score: number;
  comment: string | null;
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "text-green-500",
  negative: "text-red-500",
  neutral: "text-yellow-500",
};

const STATUS_COLOR: Record<string, string> = {
  open: "bg-green-500/10 text-green-600 border-green-500/20",
  closed: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  escalated: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [csatScore, setCsatScore] = useState<number>(0);
  const [csatComment, setCsatComment] = useState("");
  const [csatSubmitted, setCsatSubmitted] = useState(false);
  const [existingCsat, setExistingCsat] = useState<CsatRating | null>(null);
  const [priorityMode, setPriorityMode] = useState(false);
  const [copilotSuggestions, setCopilotSuggestions] = useState<string[]>([]);
  const [copilotIntent, setCopilotIntent] = useState<string | null>(null);
  const [copilotSentiment, setCopilotSentiment] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"messages" | "notes">("messages");
  const [notes, setNotes] = useState<{ id: string; content: string; agent_id: string; created_at: string }[]>([]);
  const [noteText, setNoteText] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [convTags, setConvTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkActing, setBulkActing] = useState(false);
  const [customerPanelOpen, setCustomerPanelOpen] = useState(false);
  const [customerProfile, setCustomerProfile] = useState<Record<string, unknown> | null>(null);
  const [customerConvs, setCustomerConvs] = useState<Conversation[]>([]);
  const [customerMemories, setCustomerMemories] = useState<{id: string; memory_type: string; content: string; importance: number; created_at: string}[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<EventSource | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copilotTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchConversations = useCallback(async (search = q) => {
    setLoading(true);
    try {
      if (priorityMode) {
        const res = await fetch(`/api/conversations/priority-queue?limit=50`);
        const data = await res.json();
        setConversations(data.conversations ?? []);
      } else {
        const params = new URLSearchParams({ limit: "50" });
        if (search) params.set("q", search);
        if (statusFilter) params.set("status", statusFilter);
        const res = await fetch(`/api/conversations/search?${params}`);
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter, priorityMode]);

  useEffect(() => { fetchConversations(); }, [statusFilter, priorityMode]);

  useEffect(() => {
    fetch("/api/team").then(r => r.json()).then(d => setTeamMembers(d.team ?? [])).catch(() => {});
  }, []);

  function handleSearch(val: string) {
    setQ(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchConversations(val), 300);
  }

  async function selectConversation(conv: Conversation) {
    setSelected(conv);
    setMsgLoading(true);
    setCsatScore(0);
    setCsatComment("");
    setCsatSubmitted(false);
    setExistingCsat(null);

    // Stop existing stream
    if (streamRef.current) { streamRef.current.close(); streamRef.current = null; }

    setActiveTab("messages");
    setNotes([]);
    setNoteText("");
    setSummary(null);
    setConvTags([]);
    setTagInput("");

    // Load messages
    setCopilotSuggestions([]);
    setCopilotIntent(null);
    setCopilotSentiment(null);
    try {
      const res = await fetch(`/api/conversations/${conv.id}/messages`);
      const data = await res.json();
      setMessages(data.messages ?? []);
    } finally {
      setMsgLoading(false);
    }

    // Load tags
    fetch(`/api/conversations/${conv.id}/tags`).then(r => r.json()).then(d => setConvTags(d.tags ?? [])).catch(() => {});

    // Load copilot suggestions
    if (conv.status === "open") {
      fetchCopilot(conv.id);
    }

    // Load CSAT
    const csatRes = await fetch(`/api/csat?conversation_id=${conv.id}`).catch(() => null);
    if (csatRes?.ok) {
      const csatData = await csatRes.json();
      if (csatData.rating) setExistingCsat(csatData.rating);
    }

    // Subscribe to SSE stream for live updates
    const es = new EventSource(`/api/conversations/${conv.id}/stream`);
    es.addEventListener("message", (e) => {
      const msg = JSON.parse(e.data);
      setMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    streamRef.current = es;
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendReply() {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      const res = await fetch("/api/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selected.id,
          message: reply,
        }),
      });
      const data = await res.json();
      setReply("");
      // Reload messages
      const msgRes = await fetch(`/api/conversations/${selected.id}/messages`);
      const msgData = await msgRes.json();
      setMessages(msgData.messages ?? []);
    } finally {
      setSending(false);
    }
  }

  async function fetchCopilot(convId: string) {
    setCopilotLoading(true);
    try {
      const res = await fetch(`/api/conversations/${convId}/copilot`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setCopilotSuggestions(data.suggestions ?? []);
        setCopilotIntent(data.intent ?? null);
        setCopilotSentiment(data.sentiment ?? null);
      }
    } catch { /* non-fatal */ }
    finally { setCopilotLoading(false); }
  }

  async function assignTo(agentId: string) {
    if (!selected) return;
    setAssignOpen(false);
    await fetch(`/api/conversations/${selected.id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });
    const name = teamMembers.find(m => m.id === agentId)?.name ?? agentId;
    setSelected(s => s ? { ...s, assigned_to: name } : null);
    fetchConversations();
  }

  async function loadNotes(convId: string) {
    const res = await fetch(`/api/conversations/${convId}/notes`).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setNotes(data.notes ?? []);
    }
  }

  async function saveNote() {
    if (!noteText.trim() || !selected) return;
    setNotesSaving(true);
    try {
      const res = await fetch(`/api/conversations/${selected.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteText.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotes((prev) => [...prev, data.note]);
        setNoteText("");
      }
    } finally {
      setNotesSaving(false);
    }
  }

  async function fetchSummary() {
    if (!selected) return;
    setSummaryLoading(true);
    setSummary(null);
    try {
      const res = await fetch(`/api/conversations/${selected.id}/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary ?? null);
      }
    } catch { /* non-fatal */ }
    finally { setSummaryLoading(false); }
  }

  async function addTag(tag: string) {
    const t = tag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!t || !selected || convTags.includes(t)) return;
    await fetch(`/api/conversations/${selected.id}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag: t }),
    });
    setConvTags(prev => [...prev, t]);
    setTagInput("");
  }

  async function removeTag(tag: string) {
    if (!selected) return;
    await fetch(`/api/conversations/${selected.id}/tags`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags: [tag] }),
    });
    setConvTags(prev => prev.filter(t => t !== tag));
  }

  async function openCustomerPanel() {
    if (!selected) return;
    setCustomerPanelOpen(true);
    setCustomerLoading(true);
    setCustomerProfile(null);
    setCustomerConvs([]);
    setCustomerMemories([]);
    try {
      const email = selected.customer_email;
      const [custRes, convsRes] = await Promise.all([
        email ? fetch(`/api/customers?q=${encodeURIComponent(email)}&limit=1`).then(r => r.json()) : null,
        fetch(`/api/conversations/search?q=${encodeURIComponent(selected.customer_email || selected.customer_name || "")}&limit=10`).then(r => r.json()),
      ]);
      const profile = custRes?.customers?.[0] ?? null;
      setCustomerProfile(profile);
      setCustomerConvs((convsRes?.conversations ?? []).filter((c: Conversation) => c.id !== selected.id));
      if (profile?.id) {
        const memRes = await fetch(`/api/customers/${profile.id}/memories`).then(r => r.json()).catch(() => ({}));
        setCustomerMemories(memRes.memories ?? []);
      }
    } finally {
      setCustomerLoading(false);
    }
  }

  async function updatePriority(priority: string) {
    if (!selected) return;
    await fetch(`/api/conversations/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority }),
    });
    setSelected(s => s ? { ...s, priority } : null);
    setConversations(prev => prev.map(c => c.id === selected.id ? { ...c, priority } : c));
  }

  function toggleBulkSelect(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (bulkSelected.size === conversations.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(conversations.map(c => c.id)));
    }
  }

  async function bulkClose() {
    if (!bulkSelected.size) return;
    setBulkActing(true);
    await Promise.all([...bulkSelected].map(id =>
      fetch(`/api/conversations/${id}/close`, { method: "POST" }).catch(() => null)
    ));
    setBulkSelected(new Set());
    setBulkMode(false);
    fetchConversations();
    setBulkActing(false);
  }

  async function bulkAssign(agentId: string) {
    if (!bulkSelected.size) return;
    setBulkActing(true);
    await Promise.all([...bulkSelected].map(id =>
      fetch(`/api/conversations/${id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      }).catch(() => null)
    ));
    setBulkSelected(new Set());
    setBulkMode(false);
    fetchConversations();
    setBulkActing(false);
  }

  async function bulkSetPriority(priority: string) {
    if (!bulkSelected.size) return;
    setBulkActing(true);
    await Promise.all([...bulkSelected].map(id =>
      fetch(`/api/conversations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      }).catch(() => null)
    ));
    setBulkSelected(new Set());
    setBulkMode(false);
    fetchConversations();
    setBulkActing(false);
  }

  function downloadTranscript(format: "html" | "text") {
    if (!selected) return;
    window.location.href = `/api/conversations/${selected.id}/transcript?format=${format}`;
  }

  function exportConversations() {
    const params = new URLSearchParams({ format: "csv" });
    if (statusFilter) params.set("status", statusFilter);
    window.location.href = `/api/conversations/export?${params}`;
  }

  async function closeConversation() {
    if (!selected) return;
    await fetch(`/api/conversations/${selected.id}/close`, { method: "POST" });
    fetchConversations();
    setSelected((s) => s ? { ...s, status: "closed" } : null);
  }

  async function submitCsat() {
    if (!selected || !csatScore) return;
    const res = await fetch("/api/csat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selected.id, score: csatScore, comment: csatComment }),
    });
    if (res.ok) {
      setCsatSubmitted(true);
      setExistingCsat({ score: csatScore, comment: csatComment });
    }
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar — conversation list */}
      <div className="w-80 border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              <h1 className="font-semibold">Inbox</h1>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setBulkMode(m => !m); setBulkSelected(new Set()); }}
                title="Bulk select"
                className={`p-1 rounded transition-colors ${bulkMode ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                <CheckSquare className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPriorityMode((m) => !m)}
                title={priorityMode ? "Switch to recent" : "Switch to priority queue"}
                className={`p-1 rounded transition-colors ${priorityMode ? "text-orange-400 bg-orange-500/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
              >
                <Flame className="w-4 h-4" />
              </button>
              <button
                onClick={exportConversations}
                title="Export as CSV"
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Search conversations…"
              value={q}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            {["open", "closed", "escalated"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-2 py-1 rounded capitalize transition-colors ${
                  statusFilter === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk action toolbar */}
        {bulkMode && (
          <div className="border-b bg-muted/30 px-3 py-2 flex items-center gap-2 flex-wrap">
            <button onClick={toggleSelectAll} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              {bulkSelected.size === conversations.length ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
              {bulkSelected.size === conversations.length ? "Deselect all" : "Select all"}
            </button>
            {bulkSelected.size > 0 && (
              <>
                <span className="text-xs text-muted-foreground">({bulkSelected.size})</span>
                <button
                  onClick={bulkClose}
                  disabled={bulkActing}
                  className="text-xs px-2 py-0.5 rounded border border-border hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {bulkActing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                  Close
                </button>
                {teamMembers.length > 0 && (
                  <select
                    onChange={(e) => { if (e.target.value) bulkAssign(e.target.value); e.target.value = ""; }}
                    disabled={bulkActing}
                    className="text-xs px-2 py-0.5 rounded border border-border bg-background cursor-pointer disabled:opacity-50"
                    defaultValue=""
                  >
                    <option value="" disabled>Assign to…</option>
                    {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                )}
                <select
                  onChange={(e) => { if (e.target.value) bulkSetPriority(e.target.value); e.target.value = ""; }}
                  disabled={bulkActing}
                  className="text-xs px-2 py-0.5 rounded border border-border bg-background cursor-pointer disabled:opacity-50"
                  defaultValue=""
                >
                  <option value="" disabled>Set priority…</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">No conversations found</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`relative flex items-start border-b hover:bg-muted/50 transition-colors cursor-pointer ${
                  selected?.id === conv.id ? "bg-muted" : ""
                } ${bulkSelected.has(conv.id) ? "bg-primary/5" : ""}`}
                onClick={() => bulkMode ? null : selectConversation(conv)}
              >
                {bulkMode && (
                  <button
                    onClick={(e) => toggleBulkSelect(conv.id, e)}
                    className="p-3 pr-2 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {bulkSelected.has(conv.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                  </button>
                )}
                <button
                  className="flex-1 text-left p-3 pl-0 min-w-0"
                  onClick={() => bulkMode ? toggleBulkSelect(conv.id, { stopPropagation: () => {} } as React.MouseEvent) : selectConversation(conv)}
                  style={{ paddingLeft: bulkMode ? 0 : undefined }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium truncate">{conv.customer_name || "Anonymous"}</span>
                    {priorityMode && conv.urgency_score != null ? (
                      <span className={`text-xs font-medium ${conv.urgency_score >= 60 ? "text-red-400" : conv.urgency_score >= 30 ? "text-orange-400" : "text-muted-foreground"}`}>
                        {Math.round(conv.urgency_score)}
                      </span>
                    ) : (
                      <span className={`text-xs ${SENTIMENT_COLOR[conv.sentiment] ?? "text-muted-foreground"}`}>●</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${STATUS_COLOR[conv.status] ?? ""}`}>
                      {conv.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{conv.channel}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {priorityMode && conv.wait_minutes != null
                        ? `${conv.wait_minutes}m`
                        : new Date(conv.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main — conversation detail */}
      {selected ? (
        <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={openCustomerPanel}
                title="View customer profile"
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors shrink-0"
              >
                <User className="w-4 h-4 text-muted-foreground" />
              </button>
              <div>
                <h2 className="font-semibold">{selected.customer_name || "Anonymous"}</h2>
                <p className="text-xs text-muted-foreground">{selected.customer_email} · {selected.channel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={STATUS_COLOR[selected.status] ?? ""}>
                {selected.status}
              </Badge>
              <button
                onClick={() => downloadTranscript("html")}
                title="Download transcript"
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <FileText className="w-4 h-4" />
              </button>
              {/* Assign dropdown */}
              {teamMembers.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setAssignOpen(o => !o)}
                    title="Assign to agent"
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${selected.assigned_to ? "border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                  >
                    <UserPlus className="w-3 h-3" />
                    {selected.assigned_to ? String(selected.assigned_to).slice(0, 12) : "Assign"}
                  </button>
                  {assignOpen && (
                    <div className="absolute right-0 top-full mt-1 z-20 bg-popover border border-border rounded-lg shadow-xl overflow-hidden w-48">
                      {teamMembers.map(m => (
                        <button
                          key={m.id}
                          onClick={() => assignTo(m.id)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                        >
                          {m.name}
                          <span className="block text-xs text-muted-foreground truncate">{m.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {/* Priority dropdown */}
              <div className="relative">
                <select
                  value={selected.priority}
                  onChange={(e) => updatePriority(e.target.value)}
                  className="text-xs px-2 py-1 rounded border border-border bg-background text-foreground appearance-none cursor-pointer pr-6"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
              </div>
              {selected.status === "open" && (
                <Button variant="outline" size="sm" onClick={closeConversation} className="gap-1 text-xs">
                  <CheckCircle className="w-3.5 h-3.5" /> Close
                </Button>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b px-4 shrink-0">
            <button
              onClick={() => setActiveTab("messages")}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === "messages" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Messages
            </button>
            <button
              onClick={() => {
                setActiveTab("notes");
                if (notes.length === 0) loadNotes(selected.id);
              }}
              className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1 ${
                activeTab === "notes" ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <StickyNote className="w-3 h-3" /> Notes
            </button>
          </div>

          {/* Messages */}
          {activeTab === "messages" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-2 ${msg.role === "assistant" ? "" : "flex-row-reverse"}`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      msg.role === "assistant" ? "bg-primary/10" : "bg-muted"
                    }`}>
                      {msg.role === "assistant" ? (
                        <Bot className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "assistant"
                        ? "bg-muted text-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.intent && (
                        <p className="text-xs opacity-50 mt-1">intent: {msg.intent}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            <div ref={messagesEndRef} />
          </div>
          )}

          {/* Notes tab */}
          {activeTab === "notes" && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No internal notes yet</p>
                <p className="text-xs opacity-60 mt-1">Notes are only visible to your team</p>
              </div>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="rounded-lg p-3 bg-yellow-500/5 border border-yellow-500/20">
                  <p className="text-xs text-muted-foreground mb-1">
                    Agent {n.agent_id.slice(0, 8)}… · {new Date(n.created_at).toLocaleString()}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                </div>
              ))
            )}
          </div>
          )}

          {/* CSAT */}
          {selected.status === "closed" && (
            <div className="border-t p-4 bg-muted/30">
              {existingCsat ? (
                <div className="flex items-center gap-2 text-sm">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span>CSAT: {existingCsat.score}/5</span>
                  {existingCsat.comment && <span className="text-muted-foreground">· "{existingCsat.comment}"</span>}
                </div>
              ) : csatSubmitted ? (
                <p className="text-sm text-green-600">Thanks for the rating!</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Rate this conversation</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button key={s} onClick={() => setCsatScore(s)}>
                        <Star className={`w-5 h-5 ${s <= csatScore ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
                      </button>
                    ))}
                  </div>
                  {csatScore > 0 && (
                    <div className="flex gap-2">
                      <Input
                        className="h-8 text-sm"
                        placeholder="Optional comment…"
                        value={csatComment}
                        onChange={(e) => setCsatComment(e.target.value)}
                      />
                      <Button size="sm" onClick={submitCsat}>Submit</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reply bar / Note input */}
          {activeTab === "messages" && selected.status === "open" && (
            <div className="border-t p-3 flex gap-2 shrink-0">
              <Textarea
                className="min-h-[60px] text-sm resize-none"
                placeholder="Type a message… (AI will respond)"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); }
                }}
              />
              <Button onClick={sendReply} disabled={!reply.trim() || sending} className="self-end">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          )}
          {activeTab === "notes" && (
            <div className="border-t p-3 flex gap-2 shrink-0">
              <Textarea
                className="min-h-[60px] text-sm resize-none border-yellow-500/20 focus:border-yellow-500/50"
                placeholder="Add an internal note (only visible to agents)…"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveNote(); }
                }}
              />
              <Button
                onClick={saveNote}
                disabled={!noteText.trim() || notesSaving}
                className="self-end bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 border border-yellow-500/30"
                variant="outline"
              >
                {notesSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <StickyNote className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </div>

        {/* Customer context panel */}
        <AnimatePresence>
          {customerPanelOpen && (
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-background border-l z-20 flex flex-col shadow-2xl"
            >
              <div className="p-4 border-b flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-primary" />
                  <span className="font-medium text-sm">Customer Profile</span>
                </div>
                <button onClick={() => setCustomerPanelOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {customerLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    {/* Profile card */}
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{(customerProfile?.name as string) || selected.customer_name || "Anonymous"}</p>
                          <p className="text-xs text-muted-foreground truncate">{(customerProfile?.email as string) || selected.customer_email}</p>
                        </div>
                      </div>
                      {customerProfile && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {(customerProfile.phone as string) && (
                            <div><p className="text-muted-foreground">Phone</p><p className="font-medium">{customerProfile.phone as string}</p></div>
                          )}
                          {(customerProfile.channel as string) && (
                            <div><p className="text-muted-foreground">Channel</p><p className="font-medium capitalize">{customerProfile.channel as string}</p></div>
                          )}
                          {(customerProfile.language as string) && (
                            <div><p className="text-muted-foreground">Language</p><p className="font-medium uppercase">{customerProfile.language as string}</p></div>
                          )}
                          <div><p className="text-muted-foreground">Conversations</p><p className="font-medium">{(customerProfile.total_conversations as number) ?? 0}</p></div>
                          {(customerProfile.last_seen_at as string) && (
                            <div className="col-span-2"><p className="text-muted-foreground">Last seen</p><p className="font-medium">{new Date(customerProfile.last_seen_at as string).toLocaleDateString()}</p></div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* AI Memories */}
                    {customerMemories.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-3">
                          <Brain className="w-3.5 h-3.5 text-primary" />
                          <p className="text-xs font-medium">AI Memories ({customerMemories.length})</p>
                        </div>
                        <div className="space-y-2">
                          {customerMemories.slice(0, 5).map((m) => (
                            <div key={m.id} className="text-xs p-2.5 rounded-lg bg-muted/50 border">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary capitalize">
                                  {m.memory_type.replace(/_/g, " ")}
                                </span>
                                <span className="text-muted-foreground ml-auto">★{m.importance}/10</span>
                              </div>
                              <p className="text-foreground leading-relaxed">{m.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Previous conversations */}
                    {customerConvs.length > 0 && (
                      <div>
                        <div className="flex items-center gap-1.5 mb-3">
                          <History className="w-3.5 h-3.5 text-muted-foreground" />
                          <p className="text-xs font-medium">Previous Conversations ({customerConvs.length})</p>
                        </div>
                        <div className="space-y-2">
                          {customerConvs.slice(0, 5).map((c) => (
                            <div key={c.id} className="text-xs p-2.5 rounded-lg border hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-1.5 py-0.5 rounded border text-[10px] ${STATUS_COLOR[c.status] ?? ""}`}>{c.status}</span>
                                <span className="text-muted-foreground">{c.channel}</span>
                                <span className="text-muted-foreground ml-auto">{new Date(c.updated_at).toLocaleDateString()}</span>
                              </div>
                              {c.priority !== "normal" && (
                                <span className={`text-[10px] ${c.priority === "urgent" ? "text-red-500" : "text-orange-500"}`}>
                                  {c.priority} priority
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!customerProfile && customerConvs.length === 0 && customerMemories.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <UserCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No profile data found</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Copilot panel */}
        <div className="w-64 border-l flex flex-col shrink-0 bg-[#0a0a0a]">
          <div className="p-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#c4a574]">
              <Sparkles className="h-3.5 w-3.5" />
              AI Copilot
            </div>
            <button onClick={() => selected && fetchCopilot(selected.id)} className="text-muted-foreground hover:text-foreground">
              <Zap className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {copilotIntent && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Detected intent</p>
                <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 capitalize">
                  {copilotIntent.replace(/_/g, " ")}
                </span>
              </div>
            )}
            {copilotSentiment && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Sentiment</p>
                <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                  copilotSentiment === "positive" ? "bg-green-500/10 text-green-400" :
                  copilotSentiment === "negative" || copilotSentiment === "frustrated" ? "bg-red-500/10 text-red-400" :
                  "bg-gray-500/10 text-gray-400"
                }`}>
                  {copilotSentiment}
                </span>
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Suggestions</p>
              {copilotLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-lg bg-white/5 animate-pulse" />)}
                </div>
              ) : copilotSuggestions.length > 0 ? (
                <div className="space-y-2">
                  {copilotSuggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setReply(s)}
                      className="w-full text-left text-xs p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[#c4a574]/30 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {selected.status === "open" ? "Click ⚡ to generate suggestions." : "Suggestions available for open conversations."}
                </p>
              )}
            </div>

            {/* AI Summary */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Summary</p>
                <button
                  onClick={fetchSummary}
                  disabled={summaryLoading}
                  className="text-[10px] text-[#c4a574] hover:text-[#d4c4b0] disabled:opacity-50"
                >
                  {summaryLoading ? "…" : summary ? "Refresh" : "Generate"}
                </button>
              </div>
              {summaryLoading ? (
                <div className="h-20 rounded-lg bg-white/5 animate-pulse" />
              ) : summary ? (
                <p className="text-xs text-muted-foreground leading-relaxed bg-white/3 p-2.5 rounded-lg border border-white/5">{summary}</p>
              ) : null}
            </div>

            {/* Tags */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Tags</p>
              <div className="flex flex-wrap gap-1 mb-2">
                {convTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="hover:text-red-400 transition-colors leading-none"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); }
                  }}
                  placeholder="Add tag…"
                  className="flex-1 text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#c4a574]/40"
                />
                <button
                  onClick={() => addTag(tagInput)}
                  disabled={!tagInput.trim()}
                  className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-[#c4a574] hover:bg-white/10 disabled:opacity-40 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Select a conversation to view details</p>
          </div>
        </div>
      )}
    </div>
  );
}
