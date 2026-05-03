"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Zap,
  MessageSquare,
  Send,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Clock,
  Star,
  Shield,
  User,
  ShoppingBag,
  Tag,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

const chatMessages = [
  { from: "customer", text: "Hi, I ordered a laptop last week and it still hasn't shipped. Order #48291.", time: "2:34 PM" },
  { from: "agent", text: "I understand your frustration. Let me look into that right away.", time: "2:35 PM" },
  { from: "system", text: "Agent pulled order #48291 — Status: Processing delay due to inventory", time: "2:35 PM" },
  { from: "agent", text: "I see there's a slight delay due to high demand. Your laptop is reserved and will ship within 24 hours.", time: "2:36 PM" },
  { from: "customer", text: "That's frustrating. I needed it for work.", time: "2:36 PM" },
];

const suggestedReplies = [
  "I sincerely apologize for the delay. As a gesture of goodwill, I can upgrade your shipping to express at no charge.",
  "I completely understand — work can't wait. Let me check if we have one at a nearby store for immediate pickup.",
  "I see this is your 5th order with us. I'd like to apply a 15% credit to your account for the inconvenience.",
];

const quickActions = [
  { label: "Apply 15% Credit", icon: Tag, color: "bg-green-500/20 text-green-400" },
  { label: "Upgrade Shipping", icon: Zap, color: "bg-blue-500/20 text-blue-400" },
  { label: "Escalate to Manager", icon: AlertCircle, color: "bg-yellow-500/20 text-yellow-400" },
  { label: "Initiate Refund", icon: RefreshCw, color: "bg-red-500/20 text-red-400" },
];

const experiments = [
  { name: "Proactive Credit Offer", conversion: 68, uplift: "+12%", status: "Running" },
  { name: "Express Shipping Upsell", conversion: 42, uplift: "+8%", status: "Running" },
  { name: "Empathy-First Responses", conversion: 91, uplift: "+15%", status: "Winner" },
];

export default function LiveAssistPage() {
  const [messages, setMessages] = useState(chatMessages);
  const [typingIndex, setTypingIndex] = useState(0);
  const [showCopilot, setShowCopilot] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (typingIndex < suggestedReplies.length) {
        setTypingIndex(typingIndex + 1);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [typingIndex]);

  return (
    <main className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-gradient-sierra" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-6 w-6 text-[#c4a574]" />
            <span className="text-sm font-medium text-[#c4a574]">Live Assist</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">
            AI superpowers for <span className="text-gradient">human care reps</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl">
            Real-time guidance, auto-drafted responses, and one-click actions to help your team deliver exceptional service.
          </p>
        </motion.div>

        {/* Demo Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-16"
        >
          <div className="grid lg:grid-cols-5 gap-6">
            {/* Chat Window */}
            <Card className="lg:col-span-3 bg-[#141414] border-white/5">
              <CardHeader className="border-b border-white/5 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#c4a574] to-[#8b7355] flex items-center justify-center">
                      <User className="h-5 w-5 text-[#0a0a0a]" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Alex Thompson</CardTitle>
                      <p className="text-xs text-muted-foreground">Customer · VIP Tier</p>
                    </div>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Online</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[400px] overflow-y-auto p-4 space-y-4">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`flex ${msg.from === "customer" ? "justify-start" : msg.from === "system" ? "justify-center" : "justify-end"}`}
                    >
                      {msg.from === "system" ? (
                        <div className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs text-muted-foreground">
                          <Sparkles className="h-3 w-3 text-[#c4a574]" />
                          {msg.text}
                        </div>
                      ) : (
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          msg.from === "customer"
                            ? "bg-[#1e1e1e] rounded-tl-sm"
                            : "bg-[#c4a574]/20 rounded-tr-sm"
                        }`}>
                          <p className="text-sm">{msg.text}</p>
                          <p className="text-xs text-muted-foreground mt-1">{msg.time}</p>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
                <div className="border-t border-white/5 p-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Type a message..."
                      className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#c4a574]/50"
                    />
                    <Button size="icon" className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Copilot Sidebar */}
            <Card className="lg:col-span-2 bg-[#141414] border-white/5">
              <CardHeader className="border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#c4a574]" />
                  <CardTitle className="text-base">AI Copilot</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Customer Context */}
                <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <User className="h-4 w-4 text-[#c4a574]" />
                    Customer Context
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lifetime Value</span>
                      <span className="font-medium">$4,250</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Orders</span>
                      <span className="font-medium">12</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Order</span>
                      <span className="font-medium">7 days ago</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sentiment</span>
                      <span className="text-yellow-400">Frustrated</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tier</span>
                      <Badge className="bg-[#c4a574]/20 text-[#c4a574] border-[#c4a574]/30">VIP</Badge>
                    </div>
                  </div>
                </div>

                {/* Suggested Responses */}
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-[#c4a574]" />
                    Suggested Responses
                  </h4>
                  <div className="space-y-2">
                    {suggestedReplies.slice(0, typingIndex).map((reply, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="group cursor-pointer rounded-xl border border-white/5 bg-[#0a0a0a] p-3 hover:border-[#c4a574]/30 transition-colors"
                      >
                        <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors mb-2">
                          {reply}
                        </p>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                            <ThumbsUp className="h-3 w-3 mr-1" />
                            Use
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Regenerate
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-[#c4a574]" />
                    One-Click Actions
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#0a0a0a] px-3 py-2.5 text-xs font-medium hover:border-[#c4a574]/30 transition-colors"
                      >
                        <action.icon className={`h-3.5 w-3.5 ${action.color.split(" ")[1]}`} />
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            {
              icon: MessageSquare,
              title: "Auto-drafted responses",
              desc: "AI suggests context-aware replies based on customer history, sentiment, and your brand voice.",
            },
            {
              icon: Zap,
              title: "Real-time guidance",
              desc: "Get instant recommendations on next best actions, policy references, and upsell opportunities.",
            },
            {
              icon: Shield,
              title: "One-click actions",
              desc: "Process refunds, apply credits, upgrade shipping, and escalate — all without leaving the chat.",
            },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              variants={fadeIn}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
            >
              <Card className="bg-[#141414] border-white/5 h-full">
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#c4a574]/10">
                    <f.icon className="h-5 w-5 text-[#c4a574]" />
                  </div>
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Retention Campaigns */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="h-5 w-5 text-[#c4a574]" />
            <h2 className="text-2xl font-semibold">Retention Campaigns</h2>
          </div>
          <div className="grid gap-4">
            {experiments.map((exp, i) => (
              <Card key={exp.name} className="bg-[#141414] border-white/5">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{exp.name}</h3>
                        <Badge
                          variant="outline"
                          className={
                            exp.status === "Winner"
                              ? "bg-green-500/20 text-green-400 border-green-500/30"
                              : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                          }
                        >
                          {exp.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5 text-green-400" />
                          {exp.uplift} uplift
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-[#c4a574]" />
                          {exp.conversion}% conversion
                        </span>
                      </div>
                    </div>
                    <div className="w-full md:w-48">
                      <Progress value={exp.conversion} className="h-2 bg-white/5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
