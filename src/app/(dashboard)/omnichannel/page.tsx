"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare, Globe, Mail, Smartphone, MessageCircle,
  Hash, CheckCircle, Settings, Zap, ArrowRight, Copy,
  AlertCircle, Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Channel {
  id: string;
  name: string;
  icon: React.ElementType;
  status: "connected" | "available" | "coming_soon";
  color: string;
  desc: string;
  docsPath?: string;
  webhookPath?: string;
  stats?: { label: string; value: string }[];
}

const CHANNELS: Channel[] = [
  {
    id: "web",
    name: "Web Chat",
    icon: Globe,
    status: "connected",
    color: "text-[#c4a574] bg-[#c4a574]/10",
    desc: "Embedded chat widget for your website. Zero-latency streaming responses.",
    stats: [
      { label: "Active sessions", value: "24" },
      { label: "Avg response", value: "1.2s" },
      { label: "CSAT", value: "4.7/5" },
    ],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: MessageCircle,
    status: "available",
    color: "text-green-400 bg-green-500/10",
    desc: "Business messaging via WhatsApp Business API through Twilio. Rich media, templates.",
    webhookPath: "/api/channels/whatsapp",
  },
  {
    id: "email",
    name: "Email",
    icon: Mail,
    status: "available",
    color: "text-blue-400 bg-blue-500/10",
    desc: "Inbound email triage and auto-response via SendGrid Inbound Parse.",
    webhookPath: "/api/channels/email",
  },
  {
    id: "sms",
    name: "SMS",
    icon: Smartphone,
    status: "available",
    color: "text-purple-400 bg-purple-500/10",
    desc: "Two-way SMS via Twilio. Respond to customer texts automatically.",
    webhookPath: "/api/channels/sms",
  },
  {
    id: "slack",
    name: "Slack",
    icon: Hash,
    status: "coming_soon",
    color: "text-yellow-400 bg-yellow-500/10",
    desc: "Internal Slack bot for employee support workflows and IT helpdesk automation.",
  },
  {
    id: "voice",
    name: "Voice / IVR",
    icon: Phone,
    status: "coming_soon",
    color: "text-red-400 bg-red-500/10",
    desc: "Phone call handling with real-time ASR and TTS. Natural spoken-language agents.",
  },
];

const STATUS_BADGE: Record<Channel["status"], React.ReactNode> = {
  connected: (
    <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
      Connected
    </span>
  ),
  available: (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground">
      Available
    </span>
  ),
  coming_soon: (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground/50">
      Coming soon
    </span>
  ),
};

export default function OmnichannelPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  function copy(text: string, id: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const connected = CHANNELS.filter(c => c.status === "connected");
  const available = CHANNELS.filter(c => c.status === "available");
  const soonChannels = CHANNELS.filter(c => c.status === "coming_soon");

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-5 h-5 text-[#c4a574]" />
            <h1 className="text-2xl font-semibold">Omnichannel</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            One agent, every channel. Meet customers wherever they are.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span><span className="text-green-400 font-medium">{connected.length}</span> connected</span>
          <span>·</span>
          <span><span className="text-foreground font-medium">{CHANNELS.length}</span> total</span>
        </div>
      </div>

      {/* Unified inbox banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#c4a574]/10 border border-[#c4a574]/30 rounded-xl p-4 mb-8 flex items-center gap-4"
      >
        <div className="p-2 rounded-lg bg-[#c4a574]/20">
          <Zap className="w-4 h-4 text-[#c4a574]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-[#c4a574]">Unified Inbox</p>
          <p className="text-xs text-muted-foreground">All channels converge in one place — conversations from web, email, SMS, and WhatsApp land in the same inbox.</p>
        </div>
        <Link href="/inbox">
          <Button size="sm" className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-1 shrink-0">
            Open Inbox <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </motion.div>

      {/* Connected channels */}
      {connected.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Connected</h2>
          <div className="grid lg:grid-cols-2 gap-4">
            {connected.map((ch, i) => (
              <motion.div
                key={ch.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-green-500/20 rounded-xl p-5"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${ch.color}`}>
                    <ch.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-sm">{ch.name}</p>
                      {STATUS_BADGE[ch.status]}
                    </div>
                    <p className="text-xs text-muted-foreground">{ch.desc}</p>
                  </div>
                  <button
                    onClick={() => setSelectedChannel(selectedChannel?.id === ch.id ? null : ch)}
                    className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
                {ch.stats && (
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/5">
                    {ch.stats.map(s => (
                      <div key={s.label} className="text-center">
                        <p className="text-lg font-semibold text-foreground">{s.value}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Available channels */}
      {available.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Available to Connect</h2>
          <div className="grid lg:grid-cols-3 gap-4">
            {available.map((ch, i) => (
              <motion.div
                key={ch.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className={`p-2 rounded-xl shrink-0 ${ch.color}`}>
                    <ch.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-sm">{ch.name}</p>
                      {STATUS_BADGE[ch.status]}
                    </div>
                    <p className="text-xs text-muted-foreground">{ch.desc}</p>
                  </div>
                </div>
                {ch.webhookPath && (
                  <div className="mb-3">
                    <p className="text-[10px] text-muted-foreground mb-1.5">Webhook URL</p>
                    <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2">
                      <code className="text-[10px] text-foreground font-mono flex-1 truncate">{ch.webhookPath}</code>
                      <button
                        onClick={() => copy(ch.webhookPath!, ch.id + "-url")}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <Copy className={`w-3 h-3 ${copied === ch.id + "-url" ? "text-green-400" : ""}`} />
                      </button>
                    </div>
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={() => setSelectedChannel(selectedChannel?.id === ch.id ? null : ch)}
                  className="w-full bg-white/5 hover:bg-white/10 text-foreground gap-1.5 h-8 text-xs border border-white/10"
                >
                  <Settings className="w-3 h-3" /> Configure
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Configuration panel */}
      {selectedChannel && selectedChannel.status === "available" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-[#c4a574]/20 rounded-xl p-5 mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${selectedChannel.color}`}>
                <selectedChannel.icon className="w-4 h-4" />
              </div>
              <h3 className="font-medium text-sm">Configure {selectedChannel.name}</h3>
            </div>
            <button onClick={() => setSelectedChannel(null)} className="text-muted-foreground hover:text-foreground text-sm">×</button>
          </div>
          <div className="flex items-start gap-3 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg text-xs text-yellow-400">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium mb-0.5">Configuration required in your provider</p>
              <p className="text-yellow-400/70">
                {selectedChannel.id === "whatsapp" && "Set your Twilio WhatsApp webhook to the URL above. Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN env vars."}
                {selectedChannel.id === "email" && "Configure SendGrid Inbound Parse to forward to the webhook URL above. Requires SENDGRID_API_KEY env var."}
                {selectedChannel.id === "sms" && "Configure your Twilio phone number webhook to the URL above. Requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN env vars."}
              </p>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <Link href="/settings/integrations">
              <Button size="sm" className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4b584] gap-1.5 h-8 text-xs">
                <CheckCircle className="w-3 h-3" /> Go to Integrations
              </Button>
            </Link>
          </div>
        </motion.div>
      )}

      {/* Coming soon */}
      {soonChannels.length > 0 && (
        <div>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Coming Soon</h2>
          <div className="grid lg:grid-cols-2 gap-4">
            {soonChannels.map((ch, i) => (
              <motion.div
                key={ch.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-xl p-5 opacity-60"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${ch.color}`}>
                    <ch.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-sm">{ch.name}</p>
                      {STATUS_BADGE[ch.status]}
                    </div>
                    <p className="text-xs text-muted-foreground">{ch.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
