"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Cpu, Sparkles, Workflow, FlaskConical, BookOpen, ScrollText,
  Beaker, GitBranch, Zap, ArrowRight, Wand2,
} from "lucide-react";

const TOOLS = [
  {
    href: "/studio/ghostwriter",
    icon: Wand2,
    label: "Ghostwriter",
    desc: "Describe your agent in plain English. AI generates a complete, executable conversation journey.",
    badge: "AI",
    badgeColor: "bg-[#c4a574]/10 text-[#c4a574] border-[#c4a574]/20",
    accent: "from-[#c4a574]/20 to-[#c4a574]/5",
  },
  {
    href: "/studio/playbooks",
    icon: ScrollText,
    label: "Playbooks",
    desc: "Define your AI agent's persona, instructions, policies, and escalation behavior in natural language.",
    badge: "Core",
    badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    accent: "from-blue-500/10 to-blue-500/5",
  },
  {
    href: "/studio/knowledge",
    icon: BookOpen,
    label: "Knowledge",
    desc: "Connect help centers, websites, and documents. Auto-detect and fill knowledge gaps.",
    badge: "RAG",
    badgeColor: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    accent: "from-teal-500/10 to-teal-500/5",
  },
  {
    href: "/studio/flows",
    icon: Workflow,
    label: "Flows",
    desc: "Manage all your AI conversation journeys. Activate, archive, and monitor execution.",
    badge: null,
    badgeColor: "",
    accent: "from-purple-500/10 to-purple-500/5",
  },
  {
    href: "/studio/simulation",
    icon: FlaskConical,
    label: "Simulation",
    desc: "Run your journeys against predefined test scenarios to catch issues before going live.",
    badge: null,
    badgeColor: "",
    accent: "from-yellow-500/10 to-yellow-500/5",
  },
  {
    href: "/studio/routing",
    icon: GitBranch,
    label: "Routing",
    desc: "Automatically triage and route conversations based on channel, intent, and sentiment.",
    badge: null,
    badgeColor: "",
    accent: "from-green-500/10 to-green-500/5",
  },
  {
    href: "/studio/experiments",
    icon: Beaker,
    label: "Experiments",
    desc: "Run A/B tests across prompt variants, playbooks, and journeys to optimize performance.",
    badge: "Beta",
    badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    accent: "from-orange-500/10 to-orange-500/5",
  },
  {
    href: "/studio/proactive",
    icon: Zap,
    label: "Proactive Triggers",
    desc: "Define conditions that trigger outbound messages — re-engage, upsell, or notify proactively.",
    badge: null,
    badgeColor: "",
    accent: "from-red-500/10 to-red-500/5",
  },
];

export default function StudioPage() {
  return (
    <div className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-[#c4a574]/20 to-[#c4a574]/5 border border-[#c4a574]/20">
            <Cpu className="w-6 h-6 text-[#c4a574]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Agent Studio</h1>
            <p className="text-sm text-muted-foreground">Build, test, and deploy AI agents — no ML expertise required.</p>
          </div>
        </div>
      </div>

      {/* Tool grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map((tool, i) => (
          <motion.div
            key={tool.href}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              href={tool.href}
              className={`group relative flex flex-col p-5 bg-card border border-border rounded-2xl hover:border-white/20 transition-all duration-200 overflow-hidden h-full`}
            >
              {/* Gradient accent */}
              <div className={`absolute inset-0 bg-gradient-to-br ${tool.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
                    <tool.icon className="w-5 h-5 text-foreground" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {tool.badge && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${tool.badgeColor}`}>
                        {tool.badge}
                      </span>
                    )}
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-200" />
                  </div>
                </div>
                <h3 className="font-medium text-sm mb-1">{tool.label}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{tool.desc}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* CTA for Ghostwriter */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-8 p-6 rounded-2xl border border-[#c4a574]/20 bg-gradient-to-r from-[#c4a574]/5 to-transparent"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-[#c4a574]/10">
              <Sparkles className="w-5 h-5 text-[#c4a574]" />
            </div>
            <div>
              <p className="font-medium">New to Agent Studio?</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Start with Ghostwriter — describe your use case in plain English and we&apos;ll generate a complete AI agent.
              </p>
            </div>
          </div>
          <Link
            href="/studio/ghostwriter"
            className="shrink-0 px-4 py-2 rounded-xl bg-[#c4a574] text-[#0a0a0a] text-sm font-medium hover:bg-[#d4b584] transition-colors flex items-center gap-2"
          >
            <Wand2 className="w-4 h-4" />
            Try Ghostwriter
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
