"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Cpu,
  Sparkles,
  GitBranch,
  FlaskConical,
  BookOpen,
  Palette,
  Beaker,
  ArrowRight,
  Workflow,
  CheckCircle,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const studioModules = [
  {
    name: "Flow Builder",
    href: "/studio/flows",
    icon: Workflow,
    description: "Visual node-based conversation designer with drag-and-drop canvas",
    status: "live",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    name: "Ghostwriter",
    href: "/studio/ghostwriter",
    icon: Sparkles,
    description: "Upload SOPs, transcripts, or audio to auto-generate agent workflows",
    status: "live",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    name: "Simulation",
    href: "/studio/simulation",
    icon: FlaskConical,
    description: "Auto-generate test conversations and evaluate outcomes before deploying",
    status: "live",
    color: "text-green-400",
    bg: "bg-green-500/10",
  },
  {
    name: "Knowledge Base",
    href: "/studio/knowledge",
    icon: BookOpen,
    description: "Connect Help Centers, FAQs, policies. Detect gaps with real-time grounding",
    status: "live",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  {
    name: "Brand Studio",
    href: "/studio/brand",
    icon: Palette,
    description: "Define tone, voice, welcome message, colors, logo, and off-limits filters",
    status: "live",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
  {
    name: "Test Suite",
    href: "/studio/testing",
    icon: Beaker,
    description: "Regression tests, voice sims with noise & accents, behavior validation",
    status: "live",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
];

const quickStats = [
  { label: "Active Agents", value: "2", icon: Cpu },
  { label: "Conversations Today", value: "47", icon: MessageSquare },
  { label: "Resolution Rate", value: "92%", icon: CheckCircle },
  { label: "Tests Passing", value: "6/8", icon: Beaker, warning: true },
];

export default function StudioPage() {
  return (
    <main className="relative min-h-screen pt-24 pb-16">
      <div className="absolute inset-0 bg-gradient-sierra" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Cpu className="h-6 w-6 text-[#c4a574]" />
            <span className="text-sm font-medium text-[#c4a574]">Agent Studio</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">
            Build, test, and deploy <span className="text-gradient">intelligent agents</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Everything you need to create production-ready AI agents — from visual flow design 
            to simulation, knowledge management, and brand customization.
          </p>
        </motion.div>

        {/* Quick Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10"
        >
          {quickStats.map((stat) => (
            <Card key={stat.label} className="bg-[#141414] border-white/5">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className={`h-4 w-4 ${stat.warning ? "text-yellow-400" : "text-[#c4a574]"}`} />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <div className={`text-2xl font-semibold ${stat.warning ? "text-yellow-400" : ""}`}>{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Module Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-semibold mb-4">Studio Modules</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {studioModules.map((mod, i) => (
              <motion.div
                key={mod.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
              >
                <Link href={mod.href}>
                  <Card className="bg-[#141414] border-white/5 hover:border-[#c4a574]/30 transition-all group h-full">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${mod.bg}`}>
                          <mod.icon className={`h-5 w-5 ${mod.color}`} />
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[#c4a574] transition-colors" />
                      </div>
                      <h3 className="font-semibold mb-1">{mod.name}</h3>
                      <p className="text-sm text-muted-foreground">{mod.description}</p>
                      <div className="mt-4">
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Live</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-10"
        >
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-0">
              {[
                { action: "Simulation suite completed", detail: "6/8 tests passed, 2 failures in transfer handoff", time: "2 min ago", icon: FlaskConical, color: "text-yellow-400" },
                { action: "Knowledge gap detected", detail: "3 new unanswered questions identified", time: "15 min ago", icon: AlertTriangle, color: "text-yellow-400" },
                { action: "Ghostwriter generated Return Flow", detail: "12 nodes, 4 guardrails extracted from SOP", time: "1 hour ago", icon: Sparkles, color: "text-purple-400" },
                { action: "Brand configuration updated", detail: "Tone changed to Empathetic, 2 off-limit phrases added", time: "3 hours ago", icon: Palette, color: "text-pink-400" },
                { action: "Flow deployed", detail: "KYC Identity Verification v1.2 deployed to production", time: "5 hours ago", icon: Workflow, color: "text-blue-400" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-white/5 last:border-0">
                  <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{item.action}</div>
                    <div className="text-xs text-muted-foreground">{item.detail}</div>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">{item.time}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
