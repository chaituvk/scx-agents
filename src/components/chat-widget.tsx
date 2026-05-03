"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, Bot, User, ChevronDown } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: string;
}

interface TenantConfig {
  id: string;
  name: string;
  primaryColor: string;
  welcomeMessage: string;
}

const TENANTS: Record<string, TenantConfig> = {
  "r-mobile": {
    id: "r-mobile",
    name: "R-Mobile",
    primaryColor: "#ef4444",
    welcomeMessage: "Welcome to R-Mobile! How can we help with your device or plan today?",
  },
  ichiba: {
    id: "ichiba",
    name: "Ichiba",
    primaryColor: "#f97316",
    welcomeMessage: "Konnichiwa! Welcome to Ichiba. What can we help you find today?",
  },
  "r-travel": {
    id: "r-travel",
    name: "RTravel",
    primaryColor: "#06b6d4",
    welcomeMessage: "Hello traveler! Ready to plan your next adventure?",
  },
};

function getTenantHeader(tenantId: string) {
  return { "x-tenant-id": tenantId };
}

export default function ChatWidget({ defaultTenant = "r-mobile" }: { defaultTenant?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [tenant, setTenant] = useState(defaultTenant);
  const [showTenantPicker, setShowTenantPicker] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const tenantConfig = TENANTS[tenant] || TENANTS["r-mobile"];

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/widget/journeys", { headers: getTenantHeader(tenant) })
      .then((r) => r.json())
      .then((data) => setJourneys(data.journeys || []));
  }, [isOpen, tenant]);

  const startJourney = async (journey: any) => {
    setShowTenantPicker(false);
    setIsLoading(true);

    try {
      const convRes = await fetch("/api/widget/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getTenantHeader(tenant) },
        body: JSON.stringify({ tenant, customerName: "Visitor", customerEmail: "visitor@example.com" }),
      });
      const conv = await convRes.json();
      const convId = conv.conversation.id;
      setConversationId(convId);
      setJourneyId(journey.id);

      const res = await fetch("/api/widget/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getTenantHeader(tenant) },
        body: JSON.stringify({ tenant, conversationId: convId, journeyId: journey.id }),
      });
      const data = await res.json();

      for (const msg of data.messages || []) {
        addMessage("agent", msg);
      }
    } catch (err) {
      addMessage("agent", "⚠️ Failed to start conversation. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !conversationId || isLoading) return;
    const text = input.trim();
    setInput("");
    addMessage("user", text);
    setIsLoading(true);

    try {
      const res = await fetch("/api/widget/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getTenantHeader(tenant) },
        body: JSON.stringify({ tenant, conversationId, journeyId, message: text }),
      });
      const data = await res.json();

      for (const msg of data.messages || []) {
        addMessage("agent", msg);
      }
    } catch {
      addMessage("agent", "⚠️ Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const addMessage = (role: "user" | "agent", content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role,
        content,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const reset = () => {
    setMessages([]);
    setConversationId(null);
    setJourneyId(null);
    setShowTenantPicker(true);
  };

  const switchTenant = (t: string) => {
    setTenant(t);
    reset();
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-2xl flex items-center justify-center text-white"
          style={{ backgroundColor: tenantConfig.primaryColor }}
        >
          <MessageCircle className="h-6 w-6" />
        </motion.button>
      )}

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10"
            style={{ backgroundColor: "#0a0a0a" }}
          >
            {/* Header */}
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ backgroundColor: tenantConfig.primaryColor }}
            >
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-white" />
                <span className="text-sm font-semibold text-white">{tenantConfig.name} Support</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Tenant switcher (only when not in active chat) */}
                {!conversationId && (
                  <div className="relative">
                    <button
                      onClick={() => setShowTenantPicker(!showTenantPicker)}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-white/20 text-white text-xs hover:bg-white/30"
                    >
                      <div className="h-2 w-2 rounded-full bg-white" />
                      Switch
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {showTenantPicker && (
                      <div className="absolute right-0 top-full mt-1 w-36 bg-[#141414] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                        {Object.values(TENANTS).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => switchTenant(t.id)}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2 ${tenant === t.id ? "bg-white/5" : ""}`}
                          >
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.primaryColor }} />
                            {t.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {showTenantPicker && !conversationId ? (
                <div className="space-y-4">
                  <div className="text-center py-4">
                    <div
                      className="h-12 w-12 rounded-xl mx-auto mb-3 flex items-center justify-center"
                      style={{ backgroundColor: tenantConfig.primaryColor }}
                    >
                      <Bot className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-sm font-medium">{tenantConfig.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{tenantConfig.welcomeMessage}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center">Choose a topic</p>
                    {journeys.map((j) => (
                      <button
                        key={j.id}
                        onClick={() => startJourney(j)}
                        className="w-full text-left p-3 rounded-xl bg-[#141414] border border-white/5 hover:border-white/20 transition-colors text-sm"
                      >
                        <div className="font-medium">{j.name}</div>
                        <div className="text-xs text-muted-foreground">{j.description}</div>
                        <div className="mt-1">
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full"
                            style={{
                              backgroundColor: j.execution_mode === "llm" ? "#8b5cf620" : j.execution_mode === "hybrid" ? "#c4a57420" : "#3b82f620",
                              color: j.execution_mode === "llm" ? "#a78bfa" : j.execution_mode === "hybrid" ? "#c4a574" : "#60a5fa",
                            }}
                          >
                            {j.execution_mode}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                      <div
                        className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                          msg.role === "user" ? "bg-white/10" : ""
                        }`}
                        style={msg.role === "agent" ? { backgroundColor: tenantConfig.primaryColor + "30" } : {}}
                      >
                        {msg.role === "user" ? (
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <Bot className="h-3.5 w-3.5" style={{ color: tenantConfig.primaryColor }} />
                        )}
                      </div>
                      <div
                        className={`max-w-[75%] text-sm px-3 py-2 rounded-xl ${
                          msg.role === "user"
                            ? "bg-white/10 text-white"
                            : "bg-[#141414] border border-white/5 text-white/90"
                        }`}
                      >
                        {msg.content}
                        <div className="text-[10px] text-muted-foreground mt-1 text-right">{msg.timestamp}</div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-2">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
                        style={{ backgroundColor: tenantConfig.primaryColor + "30" }}
                      >
                        <Bot className="h-3.5 w-3.5" style={{ color: tenantConfig.primaryColor }} />
                      </div>
                      <div className="bg-[#141414] border border-white/5 rounded-xl px-3 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" style={{ color: tenantConfig.primaryColor }} />
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            {conversationId && (
              <div className="border-t border-white/5 p-3 bg-[#0a0a0a]">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Type your message..."
                    disabled={isLoading}
                    className="flex-1 bg-[#141414] border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-white/20 disabled:opacity-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || !input.trim()}
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-white disabled:opacity-50"
                    style={{ backgroundColor: tenantConfig.primaryColor }}
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <button onClick={reset} className="text-[10px] text-muted-foreground hover:text-white transition-colors">
                    New conversation
                  </button>
                  <span className="text-[10px] text-muted-foreground">{tenantConfig.name}</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
