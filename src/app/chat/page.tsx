"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  User,
  Loader2,
  Shield,
  Wrench,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Zap,
  Paperclip,
  CheckCircle2,
  TrendingUp,
  Building2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
  toolCalls?: Array<{ tool: string; result: any }>;
  knowledgeUsed?: Array<{ title: string; source: string }>;
  guardrailTriggered?: string;
  executionMode?: string;
}

interface JourneyOption {
  id: string;
  name: string;
  description: string;
  execution_mode: string;
}

interface TenantConfig {
  id: string;
  name: string;
  primaryColor: string;
  accentColor: string;
  welcomeMessage: string;
}

const TENANTS: Record<string, TenantConfig> = {
  "r-mobile": { id: "r-mobile", name: "R-Mobile", primaryColor: "#ef4444", accentColor: "#1e293b", welcomeMessage: "Welcome to R-Mobile! How can we help with your device or plan today?" },
  ichiba: { id: "ichiba", name: "Ichiba", primaryColor: "#f97316", accentColor: "#0f172a", welcomeMessage: "Konnichiwa! Welcome to Ichiba. What can we help you find today?" },
  "r-travel": { id: "r-travel", name: "RTravel", primaryColor: "#06b6d4", accentColor: "#0f172a", welcomeMessage: "Hello traveler! Ready to plan your next adventure?" },
};

function setTenantCookie(tenantId: string) {
  document.cookie = `tenant=${tenantId};path=/;max-age=${60 * 60 * 24 * 7};SameSite=Lax`;
}

function getTenantHeader(tenantId: string) {
  return { "x-tenant-id": tenantId };
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [journeys, setJourneys] = useState<JourneyOption[]>([]);
  const [showJourneyPicker, setShowJourneyPicker] = useState(true);
  const [currentMode, setCurrentMode] = useState<string>("");
  const [currentNode, setCurrentNode] = useState<string>("");
  const [status, setStatus] = useState<string>("open");
  const [tenant, setTenant] = useState<string>("r-mobile");
  const [showTenantMenu, setShowTenantMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const tenantConfig = TENANTS[tenant];

  useEffect(() => {
    setTenantCookie(tenant);
    fetch(`/api/journeys`, {
      credentials: "include",
      headers: getTenantHeader(tenant),
    })
      .then((r) => r.json())
      .then((data) => setJourneys(data.journeys || []))
      .catch(() => router.push("/login"));
  }, [router, tenant]);

  const startJourney = async (j: JourneyOption) => {
    setShowJourneyPicker(false);
    setIsLoading(true);

    try {
      const convRes = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getTenantHeader(tenant) },
        credentials: "include",
        body: JSON.stringify({ customerName: "User", customerEmail: "user@example.com" }),
      });
      if (!convRes.ok) throw new Error("Failed to create conversation");
      const conv = await convRes.json();
      const convId = conv.conversation.id;
      setConversationId(convId);
      setJourneyId(j.id);
      setCurrentMode(j.execution_mode);

      await sendToDialog({ conversationId: convId, journeyId: j.id, tenant });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start";
      setMessages([{ id: crypto.randomUUID(), role: "agent", content: `⚠️ ${msg}`, timestamp: now() }]);
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !conversationId || isLoading) return;
    const text = input.trim();
    setInput("");

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    await sendToDialog({ conversationId, journeyId: journeyId!, tenant, message: text });
  };

  const sendToDialog = async (body: { conversationId: string; journeyId: string; tenant: string; message?: string }) => {
    setIsLoading(true);

    try {
      const streamRes = await fetch("/api/dialog/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getTenantHeader(body.tenant) },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (streamRes.ok && streamRes.body) {
        const result = await parseStream(streamRes.body);
        if (result.success && result.text) {
          addAgentMessage(result);
          setCurrentNode(result.state?.currentNodeId || "");
          if (result.done) setStatus("resolved");
          if (result.escalated) setStatus("escalated");
          setIsLoading(false);
          inputRef.current?.focus();
          return;
        }
      }
    } catch {
      // Streaming failed, fall through to regular POST
    }

    try {
      const res = await fetch("/api/dialog/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getTenantHeader(body.tenant) },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      for (const msg of data.messages || []) {
        addAgentMessage({
          text: msg,
          toolCalls: data.toolCalls,
          knowledgeUsed: data.knowledgeUsed,
          guardrailTriggered: data.guardrailTriggered,
          mode: data.mode,
          state: data.state,
          done: data.done,
          escalated: data.actions?.some((a: any) => a.type === "transfer" || a.type === "escalate"),
        });
      }

      setCurrentNode(data.state?.currentNodeId || "");
      if (data.done) setStatus("resolved");
      if (data.actions?.some((a: any) => a.type === "transfer" || a.type === "escalate")) {
        setStatus("escalated");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Request failed";
      addAgentMessage({ text: `⚠️ ${msg}`, mode: currentMode });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  async function parseStream(body: ReadableStream) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    const tools: any[] = [];
    const knowledge: any[] = [];
    let guardrail: string | undefined;
    let done = false;
    let state: any = null;
    let escalated = false;

    try {
      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });

        const events = parseSSE(buffer);
        buffer = events.remainder;

        for (const evt of events.parsed) {
          switch (evt.event) {
            case "start":
              setCurrentMode(evt.data.mode);
              break;
            case "node":
              setCurrentNode(evt.data.nodeId);
              break;
            case "chunk":
              fullText += evt.data.text;
              break;
            case "message":
              fullText = evt.data.text;
              break;
            case "tool":
              tools.push(evt.data);
              break;
            case "knowledge":
              knowledge.push(evt.data);
              break;
            case "guardrail":
              guardrail = evt.data.triggered;
              break;
            case "action":
              if (evt.data.type === "transfer" || evt.data.type === "escalate") escalated = true;
              break;
            case "done":
              done = evt.data.done;
              state = evt.data.state;
              break;
            case "error":
              throw new Error(evt.data.message);
          }
        }
      }
      return { success: true, text: fullText, toolCalls: tools, knowledgeUsed: knowledge, guardrailTriggered: guardrail, done, state, escalated, mode: currentMode };
    } catch (err: unknown) {
      return { success: false, text: fullText || "⚠️ Stream interrupted", error: err instanceof Error ? err.message : "Stream error" };
    } finally {
      reader.releaseLock();
    }
  }

  function parseSSE(text: string) {
    const parsed: Array<{ event: string; data: any }> = [];
    const lines = text.split("\n");
    let remainder = "";
    let currentEvent = "";
    let currentData = "";
    let i = 0;

    for (; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        currentData = line.slice(5).trim();
      } else if (line.trim() === "" && currentEvent) {
        try {
          parsed.push({ event: currentEvent, data: JSON.parse(currentData) });
        } catch {
          parsed.push({ event: currentEvent, data: currentData });
        }
        currentEvent = "";
        currentData = "";
      } else if (line.trim() !== "" && !line.startsWith("event:") && !line.startsWith("data:")) {
        remainder = lines.slice(i).join("\n");
        break;
      }
    }

    if (!remainder && (currentEvent || currentData)) {
      remainder = lines.slice(i).join("\n");
    }

    return { parsed, remainder };
  }

  function addAgentMessage(data: any) {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "agent",
        content: data.text,
        timestamp: now(),
        toolCalls: data.toolCalls,
        knowledgeUsed: data.knowledgeUsed,
        guardrailTriggered: data.guardrailTriggered,
        executionMode: data.mode || currentMode,
      },
    ]);
  }

  const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const reset = () => {
    setMessages([]);
    setConversationId(null);
    setJourneyId(null);
    setShowJourneyPicker(true);
    setCurrentMode("");
    setCurrentNode("");
    setStatus("open");
  };

  const switchTenant = (t: string) => {
    setTenant(t);
    setTenantCookie(t);
    setShowTenantMenu(false);
    reset();
  };

  const getModeBadge = (mode?: string) => {
    switch (mode) {
      case "deterministic": return <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">Deterministic</Badge>;
      case "llm": return <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">LLM Agent</Badge>;
      case "hybrid": return <Badge className="bg-[#c4a574]/20 text-[#c4a574] text-[10px]">Hybrid</Badge>;
      default: return null;
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case "resolved": return <Badge className="bg-green-500/20 text-green-400 text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />Resolved</Badge>;
      case "escalated": return <Badge className="bg-red-500/20 text-red-400 text-[10px]"><TrendingUp className="h-3 w-3 mr-1" />Escalated</Badge>;
      default: return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-white/5 px-6 py-3 flex items-center justify-between bg-[#141414]">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: tenantConfig.primaryColor }}>
            <Bot className="h-4 w-4" style={{ color: tenantConfig.accentColor }} />
          </div>
          <div>
            <h1 className="text-sm font-semibold">{tenantConfig.name} Agent</h1>
            <div className="flex items-center gap-2">
              {getModeBadge(currentMode)}
              {getStatusBadge()}
              {currentNode && <span className="text-[10px] text-muted-foreground">Node: {currentNode}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Tenant Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowTenantMenu(!showTenantMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0a0a0a] border border-white/10 text-xs hover:border-white/20 transition-colors"
            >
              <Building2 className="h-3.5 w-3.5" />
              {tenantConfig.name}
              <ChevronDown className={`h-3 w-3 transition-transform ${showTenantMenu ? "rotate-180" : ""}`} />
            </button>
            {showTenantMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-[#141414] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                {Object.values(TENANTS).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => switchTenant(t.id)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2 ${tenant === t.id ? "bg-white/5" : ""}`}
                  >
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: t.primaryColor }} />
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {conversationId && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={reset}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              New Chat
            </Button>
          )}
        </div>
      </header>

      {/* Journey Picker */}
      <AnimatePresence>
        {showJourneyPicker && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex items-center justify-center p-6"
          >
            <div className="max-w-2xl w-full">
              <div className="text-center mb-8">
                <div className="h-12 w-12 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: tenantConfig.primaryColor }}>
                  <Bot className="h-6 w-6" style={{ color: tenantConfig.accentColor }} />
                </div>
                <h2 className="text-2xl font-semibold mb-2">{tenantConfig.name}</h2>
                <p className="text-muted-foreground">{tenantConfig.welcomeMessage}</p>
              </div>
              <h3 className="text-sm font-medium text-muted-foreground mb-4 text-center">Choose a journey</h3>
              <div className="grid gap-4">
                {journeys.map((j) => (
                  <motion.button
                    key={j.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => startJourney(j)}
                    className="flex items-center justify-between p-5 rounded-xl bg-[#141414] border border-white/5 hover:border-white/20 transition-colors text-left"
                    style={{ borderColor: undefined }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = tenantConfig.primaryColor + "4D")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
                  >
                    <div>
                      <div className="font-medium mb-1">{j.name}</div>
                      <div className="text-sm text-muted-foreground">{j.description}</div>
                      <div className="mt-2">{getModeBadge(j.execution_mode)}</div>
                    </div>
                    <ArrowRight className="h-5 w-5" style={{ color: tenantConfig.primaryColor }} />
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      {!showJourneyPicker && (
        <>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "" : "flex-row-reverse"}`}
              >
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-[#c4a574]/20" : "bg-blue-500/20"}`}>
                  {msg.role === "user" ? <User className="h-4 w-4 text-[#c4a574]" /> : <Bot className="h-4 w-4 text-blue-400" />}
                </div>
                <div className={`max-w-[70%] ${msg.role === "user" ? "" : "text-right"}`}>
                  <div className={`inline-block rounded-xl px-4 py-2 text-sm ${msg.role === "user" ? "bg-[#141414] border border-white/5" : "bg-blue-500/10 border border-blue-500/20"}`}>
                    {msg.content}
                  </div>
                  {msg.role === "agent" && (
                    <div className="mt-1 flex flex-wrap gap-1 justify-end">
                      {msg.toolCalls && msg.toolCalls.length > 0 && (
                        <Badge variant="outline" className="text-[9px] h-4 border-blue-500/30 text-blue-400">
                          <Wrench className="h-3 w-3 mr-1" />
                          {msg.toolCalls.length} tool call{msg.toolCalls.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {msg.knowledgeUsed && msg.knowledgeUsed.length > 0 && (
                        <Badge variant="outline" className="text-[9px] h-4 border-[#c4a574]/30 text-[#c4a574]">
                          <BookOpen className="h-3 w-3 mr-1" />
                          {msg.knowledgeUsed.length} KB source{msg.knowledgeUsed.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {msg.guardrailTriggered && (
                        <Badge variant="outline" className="text-[9px] h-4 border-red-500/30 text-red-400">
                          <Shield className="h-3 w-3 mr-1" />
                          Guardrail
                        </Badge>
                      )}
                      {msg.executionMode && (
                        <Badge variant="outline" className="text-[9px] h-4 border-white/10 text-muted-foreground">
                          <Zap className="h-3 w-3 mr-1" />
                          {msg.executionMode}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground mt-1">{msg.timestamp}</div>
                </div>
              </motion.div>
            ))}

            {isLoading && (
              <div className="flex gap-3 flex-row-reverse">
                <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-blue-400" />
                </div>
                <div className="bg-[#141414] rounded-xl px-4 py-2 border border-white/5">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/5 p-4 bg-[#141414]">
            {status === "resolved" && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-green-500/5 border border-green-500/10 text-xs text-green-400 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Conversation resolved. Start a new chat to continue.
              </div>
            )}
            {status === "escalated" && (
              <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10 text-xs text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                Conversation escalated to a human agent.
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="text-muted-foreground shrink-0">
                <Paperclip className="h-4 w-4" />
              </Button>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder={status !== "open" ? "Chat ended" : "Type your message..."}
                disabled={isLoading || status !== "open"}
                className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#c4a574]/30 disabled:opacity-50"
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim() || status !== "open"}
                className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0] shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
