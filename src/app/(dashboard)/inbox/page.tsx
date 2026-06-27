"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Search, Filter, ChevronRight, User, Bot, Clock,
  CheckCircle, AlertCircle, X, Send, Loader2, Star, UserPlus,
  Sparkles, Zap, ChevronDown,
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
  const [copilotSuggestions, setCopilotSuggestions] = useState<string[]>([]);
  const [copilotIntent, setCopilotIntent] = useState<string | null>(null);
  const [copilotSentiment, setCopilotSentiment] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<EventSource | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copilotTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchConversations = useCallback(async (search = q) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (search) params.set("q", search);
    if (statusFilter) params.set("status", statusFilter);
    try {
      const res = await fetch(`/api/conversations/search?${params}`);
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter]);

  useEffect(() => { fetchConversations(); }, [statusFilter]);

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
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h1 className="font-semibold">Inbox</h1>
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

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">No conversations found</div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`w-full text-left p-3 border-b hover:bg-muted/50 transition-colors ${
                  selected?.id === conv.id ? "bg-muted" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">{conv.customer_name || "Anonymous"}</span>
                  <span className={`text-xs ${SENTIMENT_COLOR[conv.sentiment] ?? "text-muted-foreground"}`}>●</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-1.5 py-0.5 rounded border ${STATUS_COLOR[conv.status] ?? ""}`}>
                    {conv.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{conv.channel}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(conv.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main — conversation detail */}
      {selected ? (
        <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b flex items-center justify-between shrink-0">
            <div>
              <h2 className="font-semibold">{selected.customer_name || "Anonymous"}</h2>
              <p className="text-xs text-muted-foreground">{selected.customer_email} · {selected.channel}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={STATUS_COLOR[selected.status] ?? ""}>
                {selected.status}
              </Badge>
              {selected.status === "open" && (
                <Button variant="outline" size="sm" onClick={closeConversation} className="gap-1 text-xs">
                  <CheckCircle className="w-3.5 h-3.5" /> Close
                </Button>
              )}
            </div>
          </div>

          {/* Messages */}
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

          {/* Reply bar */}
          {selected.status === "open" && (
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
        </div>

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
