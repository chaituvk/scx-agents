"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Radio,
  Mic,
  BarChart3,
  Clock,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Headphones,
  Layers,
  Activity,
  Smile,
  Meh,
  Frown,
  Zap,
  Shield,
  Play,
  Pause,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeInUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.55, ease: "easeOut" as const },
  }),
};

const features = [
  {
    icon: PhoneIncoming,
    title: "Inbound Calls",
    desc: "Smart routing with full context awareness. AI agents greet callers by name, access account history, and resolve issues without transfers.",
  },
  {
    icon: PhoneOutgoing,
    title: "Outbound Calls",
    desc: "Proactive outreach at scale. Appointment reminders, payment follow-ups, and renewal campaigns that sound genuinely human.",
  },
  {
    icon: Layers,
    title: "IVR Integration",
    desc: "Seamless handoff from existing phone systems. Upgrade legacy IVR flows with AI-powered natural language understanding.",
  },
  {
    icon: Mic,
    title: "Voice Sims",
    desc: "Test agents under real-world conditions before going live. Simulate accents, background noise, interruptions, and edge cases.",
  },
];

const transcriptLines = [
  { speaker: "ai", text: "Hello, thank you for calling Sierra Support. My name is Aria. How may I help you today?" },
  { speaker: "human", text: "Hi, I need to reschedule my delivery. Something came up at work." },
  { speaker: "ai", text: "Of course. I can help with that. I see your order #48291 is scheduled for tomorrow between 2-4 PM. What works better for you?" },
  { speaker: "human", text: "Friday morning would be great, if possible." },
  { speaker: "ai", text: "Perfect. I've moved your delivery to Friday, 9 AM - 11 AM. You'll receive a confirmation text shortly. Is there anything else?" },
  { speaker: "human", text: "No, that's all. Thanks for the quick help!" },
  { speaker: "ai", text: "You're very welcome. Have a wonderful day!" },
];

const sentimentTimeline = [
  { time: "0:05", label: "Neutral", value: 50, icon: Meh },
  { time: "0:18", label: "Slightly Positive", value: 62, icon: Smile },
  { time: "0:34", label: "Positive", value: 78, icon: Smile },
  { time: "0:52", label: "Very Positive", value: 91, icon: Smile },
  { time: "1:08", label: "Positive", value: 85, icon: Smile },
];

function Waveform({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex items-end justify-center gap-[3px] h-12">
      {Array.from({ length: 32 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-[#c4a574]"
          animate={
            isPlaying
              ? {
                  height: [8, 24 + Math.random() * 28, 12, 32, 8],
                }
              : { height: 8 }
          }
          transition={{
            duration: 0.6 + Math.random() * 0.4,
            repeat: Infinity,
            repeatType: "reverse",
            delay: i * 0.03,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export default function VoicePage() {
  const [simPlaying, setSimPlaying] = useState(true);
  const [visibleLines, setVisibleLines] = useState(2);
  const [currentSentiment, setCurrentSentiment] = useState(0);

  useEffect(() => {
    if (!simPlaying) return;
    const interval = setInterval(() => {
      setVisibleLines((prev) => {
        if (prev >= transcriptLines.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 2200);
    return () => clearInterval(interval);
  }, [simPlaying]);

  useEffect(() => {
    if (!simPlaying) return;
    const interval = setInterval(() => {
      setCurrentSentiment((prev) => {
        if (prev >= sentimentTimeline.length - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [simPlaying]);

  const SentimentIcon = sentimentTimeline[currentSentiment].icon;

  return (
    <main className="relative">
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0 bg-gradient-sierra" />
        <div className="absolute inset-0 opacity-25">
          <div className="absolute top-1/4 left-1/3 h-[500px] w-[500px] rounded-full bg-[#c4a574]/10 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-[#8b7355]/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 py-28 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            custom={0}
            className="inline-flex items-center gap-2 rounded-full border border-[#c4a574]/30 bg-[#c4a574]/10 px-4 py-1.5 text-sm text-[#c4a574] mb-8"
          >
            <Phone className="h-4 w-4" />
            AI Phone Agents
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            custom={1}
            className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight leading-[1.1] mb-8"
          >
            Voice
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            custom={2}
            className="mx-auto max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed mb-10"
          >
            Natural-sounding AI agents for every phone call. Resolve issues,
            book appointments, and delight callers—without wait times or transfers.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeInUp}
            custom={3}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              size="lg"
              className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0] px-8 py-6 text-base"
            >
              Request a demo
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 px-8 py-6 text-base"
            >
              View documentation
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="relative border-y border-white/5 bg-[#0f0f0f]">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { label: "Calls Handled Daily", value: "2M+" },
              { label: "Avg. Handle Time", value: "-40%" },
              { label: "Customer Satisfaction", value: "4.8/5" },
              { label: "First Call Resolution", value: "89%" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-semibold text-gradient mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-6">
              Everything you need for{" "}
              <span className="text-gradient">voice AI</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              From inbound support to proactive outreach—deploy agents that
              sound human, understand context, and get things done.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-white/5 bg-[#141414] p-8 hover:border-[#c4a574]/20 transition-colors"
              >
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#c4a574]/10">
                  <feature.icon className="h-6 w-6 text-[#c4a574]" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Voice Simulator Mockup */}
      <section className="relative py-28 border-t border-white/5 bg-[#0f0f0f]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#c4a574]/30 bg-[#c4a574]/10 px-4 py-1.5 text-sm text-[#c4a574] mb-6">
              <Radio className="h-4 w-4" />
              Voice Simulator
            </div>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-6">
              Test before you <span className="text-gradient">deploy</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Simulate real phone conversations with dynamic transcripts,
              waveform visualization, and live sentiment tracking.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="mx-auto max-w-4xl"
          >
            <div className="rounded-2xl border border-white/10 bg-[#141414] overflow-hidden">
              {/* Simulator Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#1a1a1a]">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[#c4a574]/20 flex items-center justify-center">
                    <Phone className="h-5 w-5 text-[#c4a574]" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">Voice Sim #482</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      In Progress · 1:08
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSimPlaying(!simPlaying)}
                    className="h-9 w-9 rounded-lg bg-[#c4a574]/10 hover:bg-[#c4a574]/20 flex items-center justify-center transition-colors"
                  >
                    {simPlaying ? (
                      <Pause className="h-4 w-4 text-[#c4a574]" />
                    ) : (
                      <Play className="h-4 w-4 text-[#c4a574]" />
                    )}
                  </button>
                  <div className="h-9 w-9 rounded-lg bg-white/5 flex items-center justify-center">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* Waveform */}
              <div className="px-6 py-6 border-b border-white/5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    Live Audio
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Latency:</span>
                    <span className="text-xs font-mono text-[#c4a574]">420ms</span>
                  </div>
                </div>
                <Waveform isPlaying={simPlaying} />
              </div>

              <div className="grid md:grid-cols-5">
                {/* Transcript */}
                <div className="md:col-span-3 px-6 py-5 border-b md:border-b-0 md:border-r border-white/5">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-4">
                    Transcript
                  </div>
                  <div className="space-y-3 max-h-[340px] overflow-y-auto pr-2">
                    <AnimatePresence>
                      {transcriptLines.slice(0, visibleLines).map((line, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: line.speaker === "ai" ? -12 : 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.35 }}
                          className={`flex gap-3 ${
                            line.speaker === "ai" ? "flex-row" : "flex-row-reverse"
                          }`}
                        >
                          <div
                            className={`h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                              line.speaker === "ai"
                                ? "bg-[#c4a574]/20 text-[#c4a574]"
                                : "bg-white/10 text-foreground"
                            }`}
                          >
                            {line.speaker === "ai" ? "AI" : "CX"}
                          </div>
                          <div
                            className={`rounded-xl px-4 py-2.5 text-sm leading-relaxed max-w-[85%] ${
                              line.speaker === "ai"
                                ? "bg-[#c4a574]/10 text-foreground"
                                : "bg-white/5 text-muted-foreground"
                            }`}
                          >
                            {line.text}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Sentiment & Metrics */}
                <div className="md:col-span-2 px-6 py-5">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-4">
                    Sentiment Analysis
                  </div>

                  <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-4 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted-foreground">Current</span>
                      <motion.div
                        key={currentSentiment}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center gap-1.5"
                      >
                        <SentimentIcon className="h-4 w-4 text-[#c4a574]" />
                        <span className="text-sm font-medium">
                          {sentimentTimeline[currentSentiment].label}
                        </span>
                      </motion.div>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        key={currentSentiment}
                        className="h-full rounded-full bg-gradient-to-r from-[#8b7355] to-[#c4a574]"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${sentimentTimeline[currentSentiment].value}%`,
                        }}
                        transition={{ duration: 0.8, ease: "easeOut" as const }}
                      />
                    </div>
                    <div className="flex justify-between mt-2">
                      <span className="text-[10px] text-muted-foreground">Negative</span>
                      <span className="text-[10px] text-muted-foreground">Positive</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      { label: "Confidence", value: "97.4%" },
                      { label: "Interruption Count", value: "0" },
                      { label: "Topic", value: "Reschedule" },
                      { label: "Escalation Risk", value: "Low" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-mono text-[#c4a574]">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Call Analytics Preview */}
      <section className="relative py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-[#c4a574]/30 bg-[#c4a574]/10 px-4 py-1.5 text-sm text-[#c4a574] mb-6">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </div>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-6">
              Understand every <span className="text-gradient">conversation</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Real-time dashboards and deep conversation insights to continuously
              improve your voice agents.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
          >
            <div className="rounded-2xl border border-white/10 bg-[#141414] p-6 md:p-8">
              {/* Dashboard Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-lg font-semibold">Call Center Overview</h3>
                  <p className="text-sm text-muted-foreground">Last 30 days · All channels</p>
                </div>
                <div className="flex items-center gap-2">
                  {["1H", "24H", "7D", "30D"].map((period) => (
                    <button
                      key={period}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        period === "30D"
                          ? "bg-[#c4a574]/20 text-[#c4a574]"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  {
                    label: "Total Calls",
                    value: "48,291",
                    change: "+12.4%",
                    up: true,
                    icon: Phone,
                  },
                  {
                    label: "Avg. Duration",
                    value: "3:42",
                    change: "-8.1%",
                    up: false,
                    icon: Clock,
                  },
                  {
                    label: "Resolution Rate",
                    value: "89.3%",
                    change: "+3.2%",
                    up: true,
                    icon: CheckCircle2,
                  },
                  {
                    label: "CSAT Score",
                    value: "4.82",
                    change: "+0.15",
                    up: true,
                    icon: Smile,
                  },
                ].map((kpi, i) => (
                  <motion.div
                    key={kpi.label}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="rounded-xl border border-white/5 bg-[#0a0a0a] p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-muted-foreground">{kpi.label}</span>
                      <kpi.icon className="h-4 w-4 text-[#c4a574]/60" />
                    </div>
                    <div className="text-2xl font-semibold mb-1">{kpi.value}</div>
                    <div
                      className={`flex items-center gap-1 text-xs ${
                        kpi.up ? "text-green-400" : "text-amber-400"
                      }`}
                    >
                      {kpi.up ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {kpi.change} vs last period
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Mini chart */}
              <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-5">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm font-medium">Call Volume Trend</span>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#c4a574]" />
                      <span className="text-xs text-muted-foreground">Inbound</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-[#8b7355]" />
                      <span className="text-xs text-muted-foreground">Outbound</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-end gap-[6px] h-40">
                  {[
                    [35, 22], [42, 28], [38, 25], [55, 32], [48, 30], [62, 38],
                    [58, 35], [70, 42], [65, 40], [78, 48], [72, 45], [85, 52],
                    [80, 50], [92, 58], [88, 55], [95, 62], [90, 58], [98, 65],
                    [94, 60], [100, 68], [96, 64], [102, 70], [98, 66], [105, 72],
                  ].map(([inbound, outbound], i) => (
                    <div key={i} className="flex-1 flex flex-col justify-end gap-[2px]">
                      <motion.div
                        initial={{ height: 0 }}
                        whileInView={{ height: `${outbound}%` }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.02, duration: 0.4 }}
                        className="w-full rounded-t-sm bg-[#8b7355]/60"
                      />
                      <motion.div
                        initial={{ height: 0 }}
                        whileInView={{ height: `${inbound}%` }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.02, duration: 0.4 }}
                        className="w-full rounded-t-sm bg-[#c4a574]/80"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-3 text-[10px] text-muted-foreground">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>23:59</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Additional Features */}
      <section className="relative py-28 border-t border-white/5 bg-[#0f0f0f]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-6">
              Built for <span className="text-gradient">enterprise scale</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Security, compliance, and reliability at the core of every call.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: "PCI-DSS Compliant",
                desc: "Secure payment handling with automatic PAN redaction and encrypted call recordings.",
              },
              {
                icon: Activity,
                title: "99.99% Uptime SLA",
                desc: "Global infrastructure with automatic failover, load balancing, and real-time monitoring.",
              },
              {
                icon: Zap,
                title: "Sub-500ms Latency",
                desc: "Lightning-fast response times with edge-deployed models and optimized audio pipelines.",
              },
              {
                icon: Headphones,
                title: "Human Handoff",
                desc: "Seamless escalation to live agents with full context transfer—no repeating information.",
              },
              {
                icon: Radio,
                title: "Multi-language",
                desc: "Native-quality voices in 30+ languages with automatic language detection and switching.",
              },
              {
                icon: BarChart3,
                title: "Custom Reporting",
                desc: "Build dashboards with conversation metrics, intent analysis, and business outcomes.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-white/5 bg-[#141414] p-8 hover:border-[#c4a574]/20 transition-colors"
              >
                <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#c4a574]/10">
                  <item.icon className="h-5 w-5 text-[#c4a574]" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-28">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-6">
              Ready to transform your{" "}
              <span className="text-gradient">phone experience?</span>
            </h2>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground mb-10">
              Join hundreds of enterprises using Sierra Voice to deliver
              faster, more human phone support at scale.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0] px-8 py-6 text-base"
              >
                Schedule a call
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 px-8 py-6 text-base"
              >
                Talk to sales
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-white/5 bg-[#0a0a0a] py-16">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#c4a574] to-[#8b7355]" />
                <span className="text-xl font-semibold">Sierra</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Better customer experiences with AI.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Products</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/studio" className="hover:text-foreground transition-colors">Agent Studio</Link></li>
                <li><Link href="/voice" className="hover:text-foreground transition-colors">Voice</Link></li>
                <li><Link href="/live-assist" className="hover:text-foreground transition-colors">Live Assist</Link></li>
                <li><Link href="/insights" className="hover:text-foreground transition-colors">Insights 2.0</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Documentation</li>
                <li>API Reference</li>
                <li>Status</li>
                <li>Changelog</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>About</li>
                <li>Careers</li>
                <li>Press</li>
                <li>Contact</li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              &copy; 2026 Sierra Technologies, Inc. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span className="hover:text-foreground cursor-pointer">Privacy</span>
              <span className="hover:text-foreground cursor-pointer">Terms</span>
              <span className="hover:text-foreground cursor-pointer">Cookies</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
