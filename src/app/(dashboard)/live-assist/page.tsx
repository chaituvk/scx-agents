"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, MessageSquare, Sparkles, Loader2, Send, ChevronRight,
  Mic, MicOff, Brain, AlertCircle, CheckCircle, Clock, Lightbulb,
  RefreshCw, ArrowRight, Shield, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Conversation {
  id: string;
  customer_name: string;
  customer_email: string;
  channel: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  message_count: number;
  updated_at: string;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

interface CopilotData {
  summary: string;
  detected_intent: string;
  suggested_replies: string[];
  customer_sentiment: string;
  recommended_action: string | null;
  confidence: number;
}

const SENTIMENT_STYLES: Record<string, string> = {
  positive: "text-green-400",
  neutral: "text-muted-foreground",
  negative: "text-red-400",
  frustrated: "text-orange-400",
};

function ConvListItem({
  conv,
  selected,
  onClick,
}: {
  conv: Conversation;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
        selected ? "bg-[#c4a574]/10 border border-[#c4a574]/30" : "hover:bg-white/5 border border-transparent"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{conv.customer_name || "Anonymous"}</p>
          <p className="text-xs text-muted-foreground truncate">{conv.customer_email}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          <span className={`text-[10px] px-1 rounded ${
            conv.priority === "high" ? "bg-red-500/10 text-red-400" :
            conv.priority === "medium" ? "bg-yellow-500/10 text-yellow-400" :
            "bg-white/5 text-muted-foreground"
          }`}>{conv.priority}</span>
          <span className="text-[9px] text-muted-foreground">{conv.channel}</span>
        </div>
      </div>
    </button>
  );
}

export default function LiveAssistPage() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [copilot, setCopilot] = useState<CopilotData | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("open");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConvs = useCallback(async () => {
    setLoadingConvs(true);
    try {
      const res = await fetch(`/api/conversations/search?status=${filterStatus}&limit=30`);
      const data = await res.json();
      setConvs(data.conversations ?? []);
    } finally {
      setLoadingConvs(false);
    }
  }, [filterStatus]);

  useEffect(() => { loadConvs(); }, [loadConvs]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function selectConv(conv: Conversation) {
    setSelected(conv);
    setMessages([]);
    setCopilot(null);
    setSummary(null);
    setReply("");
    setLoadingMsgs(true);

    const [msgsRes] = await Promise.all([
      fetch(`/api/conversations/${conv.id}`).then(r => r.json()).catch(() => ({})),
    ]);
    setMessages(msgsRes.messages ?? []);
    setLoadingMsgs(false);

    // Load copilot + summary in parallel
    setCopilotLoading(true);
    setSummaryLoading(true);
    Promise.all([
      fetch(`/api/conversations/${conv.id}/copilot`, { method: "POST" }).then(r => r.json()).catch(() => null),
      fetch(`/api/conversations/${conv.id}/summary`).then(r => r.json()).catch(() => null),
    ]).then(([cp, sm]) => {
      if (cp) setCopilot(cp);
      if (sm?.summary) setSummary(sm.summary);
    }).finally(() => {
      setCopilotLoading(false);
      setSummaryLoading(false);
    });
  }

  async function sendMessage() {
    if (!reply.trim() || !selected || sending) return;
    setSending(true);
    const content = reply.trim();
    setReply("");

    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "assistant",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);

    try {
      await fetch(`/api/conversations/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, role: "assistant" }),
      });
    } finally {
      setSending(false);
    }
  }

  async function generateDraft() {
    if (!selected || draftLoading) return;
    setDraftLoading(true);
    try {
      const res = await fetch(`/api/conversations/${selected.id}/draft`, { method: "POST" });
      const data = await res.json();
      if (data.draft) setReply(data.draft);
    } finally {
      setDraftLoading(false);
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden pt-16">
      {/* Sub-header */}
      <div className="border-b border-border px-6 py-3 flex items-center justify-between bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Users className="w-4 h-4 text-[#c4a574]" />
          <span className="font-medium text-sm">Live Assist</span>
          <span className="text-xs text-muted-foreground">AI copilot for human agents</span>
        </div>
        <div className="flex items-center gap-2">
          {(["open", "escalated", "all"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors capitalize ${
                filterStatus === s ? "bg-white/10 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
          <button onClick={loadConvs} className="p-1.5 rounded hover:bg-white/5 text-muted-foreground hover:text-foreground">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list */}
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto p-2 bg-[#0a0a0a]">
          {loadingConvs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : convs.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground px-3">
              No conversations found.
            </div>
          ) : (
            <div className="space-y-0.5">
              {convs.map(conv => (
                <ConvListItem
                  key={conv.id}
                  conv={conv}
                  selected={selected?.id === conv.id}
                  onClick={() => selectConv(conv)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Main conversation panel */}
        <div className="flex-1 flex overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
              <div className="p-4 rounded-2xl bg-[#c4a574]/5 border border-[#c4a574]/10">
                <Sparkles className="w-8 h-8 text-[#c4a574]" />
              </div>
              <p className="font-medium">Select a conversation</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                AI Copilot provides real-time summaries, intent detection, and suggested replies as you handle conversations.
              </p>
            </div>
          ) : (
            <>
              {/* Conversation messages */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Conv header */}
                <div className="px-5 py-3 border-b border-border shrink-0 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{selected.customer_name || "Anonymous"}</p>
                    <p className="text-xs text-muted-foreground">{selected.customer_email} · {selected.channel}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      selected.status === "open" ? "bg-blue-500/10 text-blue-400" :
                      selected.status === "escalated" ? "bg-red-500/10 text-red-400" :
                      "bg-white/5 text-muted-foreground"
                    }`}>{selected.status}</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {loadingMsgs ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-12">No messages yet.</p>
                  ) : (
                    messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
                      >
                        <div
                          className={`max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm ${
                            msg.role === "user"
                              ? "bg-white/5 text-foreground rounded-tl-sm"
                              : "bg-[#c4a574]/10 text-foreground border border-[#c4a574]/20 rounded-tr-sm"
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                          <p className="text-[9px] text-muted-foreground mt-1 text-right">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply bar */}
                <div className="px-5 py-4 border-t border-border shrink-0">
                  <div className="flex gap-2 items-end">
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                      }}
                      placeholder="Type a reply… ↵ to send, Shift+↵ for newline"
                      rows={3}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none resize-none text-foreground placeholder:text-muted-foreground/50 focus:border-[#c4a574]/30"
                    />
                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={generateDraft}
                        disabled={draftLoading}
                        variant="outline"
                        size="sm"
                        className="border-[#c4a574]/20 text-[#c4a574] hover:bg-[#c4a574]/10 h-9"
                        title="AI Draft"
                      >
                        {draftLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        onClick={sendMessage}
                        disabled={!reply.trim() || sending}
                        size="sm"
                        className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] h-9"
                      >
                        {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Copilot sidebar */}
              <div className="w-72 shrink-0 border-l border-border overflow-y-auto bg-[#0a0a0a] p-4 space-y-5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#c4a574]/10">
                    <Brain className="w-4 h-4 text-[#c4a574]" />
                  </div>
                  <span className="text-sm font-medium">AI Copilot</span>
                  {(copilotLoading || summaryLoading) && (
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />
                  )}
                </div>

                {/* Summary */}
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Summary</p>
                  {summaryLoading ? (
                    <div className="h-16 bg-white/5 rounded-lg animate-pulse" />
                  ) : summary ? (
                    <p className="text-xs text-foreground/80 leading-relaxed bg-white/5 rounded-lg p-2.5">{summary}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not available</p>
                  )}
                </div>

                {/* Intent + Sentiment */}
                {copilot && (
                  <>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Detected Intent</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          {copilot.detected_intent || "Unknown"}
                        </span>
                        {copilot.confidence && (
                          <span className="text-[10px] text-muted-foreground">{Math.round(copilot.confidence * 100)}% conf.</span>
                        )}
                      </div>
                    </div>

                    {copilot.customer_sentiment && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Customer Sentiment</p>
                        <span className={`text-xs font-medium capitalize ${SENTIMENT_STYLES[copilot.customer_sentiment] ?? "text-muted-foreground"}`}>
                          {copilot.customer_sentiment}
                        </span>
                      </div>
                    )}

                    {/* Suggested replies */}
                    {(copilot.suggested_replies ?? []).length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Suggested Replies</p>
                        <div className="space-y-2">
                          {copilot.suggested_replies.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => setReply(s)}
                              className="w-full text-left text-xs p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10 transition-colors leading-relaxed"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommended action */}
                    {copilot.recommended_action && (
                      <div className="p-2.5 rounded-lg bg-[#c4a574]/5 border border-[#c4a574]/20">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="w-3.5 h-3.5 text-[#c4a574] shrink-0 mt-0.5" />
                          <p className="text-xs text-foreground/80">{copilot.recommended_action}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {copilotLoading && !copilot && (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-8 bg-white/5 rounded-lg animate-pulse" />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
