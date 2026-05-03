"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Phone,
  Mail,
  MessageCircle,
  Bot,
  ArrowRight,
  Check,
  Globe,
  TrendingUp,
  Clock,
  ThumbsUp,
  Send,
  Smartphone,
  Monitor,
  Wifi,
  Zap,
  BarChart3,
  Star,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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

interface ChannelData {
  id: string;
  name: string;
  icon: typeof MessageSquare;
  status: string;
  volume: string;
  resolution: number;
  csat: number;
  desc: string;
}

const defaultChannels: ChannelData[] = [
  {
    id: "web",
    name: "Web Chat",
    icon: Monitor,
    status: "Connected",
    volume: "45%",
    resolution: 94,
    csat: 4.8,
    desc: "Embedded widget for web and mobile apps",
  },
  {
    id: "voice",
    name: "Voice",
    icon: Phone,
    status: "Connected",
    volume: "28%",
    resolution: 89,
    csat: 4.6,
    desc: "Natural-sounding AI for inbound and outbound calls",
  },
  {
    id: "email",
    name: "Email",
    icon: Mail,
    status: "Connected",
    volume: "15%",
    resolution: 92,
    csat: 4.7,
    desc: "Intelligent email responses with full context",
  },
  {
    id: "sms",
    name: "SMS",
    icon: MessageSquare,
    status: "Connected",
    volume: "8%",
    resolution: 91,
    csat: 4.5,
    desc: "Text message support with quick replies",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: Smartphone,
    status: "Connected",
    volume: "3%",
    resolution: 93,
    csat: 4.9,
    desc: "WhatsApp Business API integration",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    icon: Bot,
    status: "Connected",
    volume: "1%",
    resolution: 88,
    csat: 4.4,
    desc: "Publish via OpenAI Apps SDK",
  },
];

const chatMessages = [
  { channel: "web", text: "Hi, I need help with my order", time: "2:30 PM", me: true },
  { channel: "web", text: "Of course! What's your order number?", time: "2:30 PM", me: false },
  { channel: "email", text: "Following up on order #48291 — any updates?", time: "2:35 PM", me: true },
  { channel: "email", text: "Your order has shipped! Tracking: 1Z999AA...", time: "2:36 PM", me: false },
  { channel: "sms", text: "Thanks for the update!", time: "2:37 PM", me: true },
  { channel: "sms", text: "You're welcome! Reply STOP to opt out.", time: "2:37 PM", me: false },
];

const channelBadge = (channel: string) => {
  const map: Record<string, string> = {
    web: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    voice: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    email: "bg-green-500/20 text-green-400 border-green-500/30",
    sms: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    whatsapp: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    chatgpt: "bg-[#c4a574]/20 text-[#c4a574] border-[#c4a574]/30",
  };
  return map[channel] || "bg-white/10";
};

export default function OmnichannelPage() {
  const [activeChannel, setActiveChannel] = useState("web");
  const [channels, setChannels] = useState<ChannelData[]>(defaultChannels);

  useEffect(() => {
    fetch("/api/integrations")
      .then((res) => res.json())
      .then((data) => {
        if (data.integrations) {
          // Map integrations to channel status
          const integrationMap = new Map(data.integrations.map((i: { name: string; status: string }) => [i.name.toLowerCase(), i.status]));
          setChannels((prev) =>
            prev.map((ch) => {
              const status = integrationMap.get(ch.name.toLowerCase()) === "connected" ? "Connected" : "Disconnected";
              return { ...ch, status };
            })
          );
        }
      })
      .catch(() => {});
  }, []);

  return (
    <main className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-gradient-sierra" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 mb-4">
            <Globe className="h-6 w-6 text-[#c4a574]" />
            <span className="text-sm font-medium text-[#c4a574]">Omnichannel</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            One agent. <span className="text-gradient">Every channel.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Build once, deploy everywhere. Your AI agent delivers consistent, personalized experiences across all customer touchpoints.
          </p>
        </motion.div>

        {/* Channel Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16"
        >
          {channels.map((channel, i) => (
            <motion.div
              key={channel.id}
              variants={fadeIn}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
            >
              <Card className="bg-[#141414] border-white/5 hover:border-[#c4a574]/20 transition-colors group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${channelBadge(channel.id)}`}>
                      <channel.icon className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                        {channel.status}
                      </Badge>
                      <Switch defaultChecked className="data-[state=checked]:bg-[#c4a574]" />
                    </div>
                  </div>
                  <h3 className="font-semibold mb-1 group-hover:text-[#c4a574] transition-colors">
                    {channel.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">{channel.desc}</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-semibold">{channel.volume}</div>
                      <div className="text-xs text-muted-foreground">Volume</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{channel.resolution}%</div>
                      <div className="text-xs text-muted-foreground">Resolved</div>
                    </div>
                    <div>
                      <div className="text-lg font-semibold">{channel.csat}</div>
                      <div className="text-xs text-muted-foreground">CSAT</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Unified Conversation View */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h2 className="text-2xl font-semibold mb-6">Unified Conversation View</h2>
          <Card className="bg-[#141414] border-white/5">
            <CardHeader className="border-b border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#c4a574] to-[#8b7355] flex items-center justify-center text-[#0a0a0a] font-semibold">
                    AT
                  </div>
                  <div>
                    <CardTitle className="text-base">Alex Thompson</CardTitle>
                    <p className="text-xs text-muted-foreground">Cross-channel conversation history</p>
                  </div>
                </div>
                <Badge className="bg-[#c4a574]/20 text-[#c4a574] border-[#c4a574]/30">VIP</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {chatMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex ${msg.me ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[80%] flex items-start gap-3 ${msg.me ? "flex-row-reverse" : ""}`}>
                      <Badge variant="outline" className={`shrink-0 mt-1 ${channelBadge(msg.channel)}`}>
                        {msg.channel}
                      </Badge>
                      <div className={`rounded-2xl px-4 py-2.5 ${
                        msg.me ? "bg-[#c4a574]/20 rounded-tr-sm" : "bg-[#1e1e1e] rounded-tl-sm"
                      }`}>
                        <p className="text-sm">{msg.text}</p>
                        <p className="text-xs text-muted-foreground mt-1">{msg.time}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Setup Wizard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h2 className="text-2xl font-semibold mb-6">Channel Setup</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Choose Channel",
                desc: "Select from web chat, voice, email, SMS, WhatsApp, or ChatGPT.",
                icon: Globe,
                active: true,
              },
              {
                step: "02",
                title: "Configure",
                desc: "Set branding, greeting messages, business hours, and routing rules.",
                icon: Zap,
                active: false,
              },
              {
                step: "03",
                title: "Deploy",
                desc: "Go live with one click. Monitor performance in real-time.",
                icon: Wifi,
                active: false,
              },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                variants={fadeIn}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                custom={i}
              >
                <Card className={`bg-[#141414] border-white/5 h-full ${s.active ? "border-[#c4a574]/30" : ""}`}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-3xl font-bold text-[#c4a574]/30">{s.step}</span>
                      {s.active && (
                        <div className="h-8 w-8 rounded-full bg-[#c4a574]/20 flex items-center justify-center">
                          <Check className="h-4 w-4 text-[#c4a574]" />
                        </div>
                      )}
                    </div>
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#c4a574]/10">
                      <s.icon className="h-5 w-5 text-[#c4a574]" />
                    </div>
                    <h3 className="font-semibold mb-2">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Channel Performance */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-2xl font-semibold mb-6">Performance Overview</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Conversations", value: "2.4M", icon: MessageSquare, change: "+12%" },
              { label: "Cross-channel Users", value: "340K", icon: Users, change: "+8%" },
              { label: "Avg Response Time", value: "1.8s", icon: Clock, change: "-0.4s" },
              { label: "Overall CSAT", value: "4.8", icon: Star, change: "+0.2" },
            ].map((stat, i) => (
              <Card key={stat.label} className="bg-[#141414] border-white/5">
                <CardContent className="p-6">
                  <stat.icon className="h-5 w-5 text-[#c4a574] mb-3" />
                  <div className="text-2xl font-semibold mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
