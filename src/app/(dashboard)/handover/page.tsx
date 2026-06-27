"use client";

import { useState, useEffect, useRef } from "react";
import {
  Users, MessageSquare, AlertCircle, CheckCircle, Clock,
  UserCheck, RefreshCw, Send, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface EscalatedConversation {
  id: string;
  customer_name: string;
  customer_email: string;
  channel: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  updated_at: string;
  created_at: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  created_at: string;
}

interface AgentStatus {
  agent_id: string;
  status: "online" | "away" | "offline" | "busy";
  updated_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  online: "bg-green-500",
  busy: "bg-yellow-500",
  away: "bg-orange-400",
  offline: "bg-gray-400",
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-red-500/10 text-red-600 border-red-500/20",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  normal: "bg-blue-500/10 text-blue-600 border-blue-500/20",
};

export default function HandoverPage() {
  const [escalated, setEscalated] = useState<EscalatedConversation[]>([]);
  const [selected, setSelected] = useState<EscalatedConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [myStatus, setMyStatus] = useState<"online" | "away" | "offline" | "busy">("online");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get my user ID
    fetch("/api/auth/me").then(r => r.json()).then(d => setMyId(d?.userId ?? d?.id ?? null)).catch(() => {});
    loadEscalated();
    const interval = setInterval(loadEscalated, 15_000);
    return () => clearInterval(interval);
  }, []);

  async function loadEscalated() {
    setLoading(true);
    try {
      const res = await fetch("/api/conversations?status=escalated&limit=50");
      const data = await res.json();
      setEscalated(data.conversations ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function selectConversation(conv: EscalatedConversation) {
    setSelected(conv);
    setMessages([]);
    const res = await fetch(`/api/conversations/${conv.id}/messages`);
    const data = await res.json();
    setMessages(data.messages ?? []);
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  async function acceptHandoff() {
    if (!selected) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/conversations/${selected.id}/accept-handoff`, { method: "POST" });
      if (res.ok) {
        setSelected(prev => prev ? { ...prev, status: "open", assigned_to: myId } : prev);
        await loadEscalated();
      }
    } finally {
      setAccepting(false);
    }
  }

  async function sendReply() {
    if (!selected || !reply.trim() || sending) return;
    const text = reply.trim();
    setReply("");
    setSending(true);
    try {
      await fetch(`/api/conversations/${selected.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "assistant", content: text }),
      });
      setMessages(prev => [...prev, {
        id: Math.random().toString(36).slice(2),
        role: "assistant",
        content: text,
        created_at: new Date().toISOString(),
      }]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } finally {
      setSending(false);
    }
  }

  async function updateMyStatus(status: typeof myStatus) {
    if (!myId) return;
    setMyStatus(status);
    await fetch(`/api/agents/${myId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => {});
  }

  const isAssignedToMe = selected?.assigned_to === myId;
  const isEscalated = selected?.status === "escalated";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Left panel — escalated queue */}
      <div className="w-72 border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertCircle size={14} className="text-red-500" /> Escalation Queue
            </h1>
            <Button variant="ghost" size="icon" onClick={loadEscalated} className="h-6 w-6">
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>

          {/* My status */}
          <div className="flex items-center gap-2 mt-2">
            <div className={`w-2 h-2 rounded-full ${STATUS_COLOR[myStatus]}`} />
            <span className="text-xs text-muted-foreground capitalize">{myStatus}</span>
            <div className="flex gap-1 ml-auto">
              {(["online", "busy", "away", "offline"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => updateMyStatus(s)}
                  className={`text-xs px-1.5 py-0.5 rounded transition-colors ${myStatus === s ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {s.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {escalated.length === 0 && !loading && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <CheckCircle size={28} className="mx-auto mb-2 text-green-500 opacity-50" />
              No escalated conversations
            </div>
          )}
          {escalated.map(conv => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv)}
              className={`w-full text-left p-4 transition-colors hover:bg-muted/50 ${selected?.id === conv.id ? "bg-muted" : ""}`}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="text-sm font-medium text-foreground truncate">{conv.customer_name}</span>
                <Badge className={`text-[10px] ${PRIORITY_BADGE[conv.priority] ?? PRIORITY_BADGE.normal}`}>
                  {conv.priority}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock size={10} />
                {new Date(conv.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                <span className="ml-1 capitalize">{conv.channel}</span>
              </div>
              {conv.assigned_to && (
                <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <UserCheck size={10} /> Assigned
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel — conversation */}
      {selected ? (
        <div className="flex-1 flex flex-col">
          {/* Conversation header */}
          <div className="border-b border-border p-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">{selected.customer_name}</h2>
                <Badge className={PRIORITY_BADGE[selected.priority] ?? PRIORITY_BADGE.normal}>
                  {selected.priority}
                </Badge>
                <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
                  {selected.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selected.customer_email} · {selected.channel} · Started {new Date(selected.created_at).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isEscalated && !isAssignedToMe && (
                <Button size="sm" onClick={acceptHandoff} disabled={accepting}>
                  <UserCheck size={14} className="mr-1" />
                  {accepting ? "Accepting…" : "Accept Handoff"}
                </Button>
              )}
              {isAssignedToMe && (
                <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                  <CheckCircle size={10} className="mr-1" /> Assigned to you
                </Badge>
              )}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(m => (
              <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "" : "flex-row-reverse"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${m.role === "user" ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground"}`}>
                  {m.role === "user" ? "U" : "A"}
                </div>
                <div className={`max-w-[72%] rounded-xl px-3 py-2 text-sm ${m.role === "user" ? "bg-blue-500/10 text-foreground" : "bg-muted text-foreground"}`}>
                  {m.content}
                  <div className="text-[10px] text-muted-foreground mt-1">{new Date(m.created_at).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply box — only when assigned to me */}
          {isAssignedToMe && (
            <div className="border-t border-border p-4">
              <div className="flex gap-2">
                <Textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Type your reply…"
                  rows={2}
                  className="resize-none text-sm"
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                />
                <Button onClick={sendReply} disabled={!reply.trim() || sending} size="sm" className="self-end">
                  {sending ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                </Button>
              </div>
            </div>
          )}
          {isEscalated && !isAssignedToMe && (
            <div className="border-t border-border p-4 text-center text-sm text-muted-foreground">
              Accept the handoff to reply
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          <div className="text-center">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
            Select an escalated conversation to view
          </div>
        </div>
      )}
    </div>
  );
}
