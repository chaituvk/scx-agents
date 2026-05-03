"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Cpu,
  BarChart3,
  Phone,
  Users,
  Database,
  Sparkles,
  Shield,
  MessageSquare,
  Zap,
  Globe,
  Lock,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeIn = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5 },
  }),
};

const features = [
  {
    icon: Cpu,
    title: "Agent Studio",
    desc: "Build powerful AI agents quickly—with or without engineering support. No-code journeys, workspaces, and integrations.",
    href: "/studio",
  },
  {
    icon: Sparkles,
    title: "Ghostwriter",
    desc: "Upload SOPs, transcripts, and audio. Ghostwriter builds production-ready, multilingual, multichannel agents automatically.",
    href: "/ghostwriter",
  },
  {
    icon: MessageSquare,
    title: "Omnichannel",
    desc: "Deploy a single agent across chat, SMS, WhatsApp, email, voice, and ChatGPT. One build, every channel.",
    href: "/omnichannel",
  },
  {
    icon: BarChart3,
    title: "Insights 2.0",
    desc: "Analyze agent performance with Deep Research for conversations. Run experiments and monitor proactively.",
    href: "/insights",
  },
  {
    icon: Database,
    title: "Data Platform",
    desc: "Personalize experiences with persistent memory. Integrate structured data from systems of record and warehouses.",
    href: "/data-platform",
  },
  {
    icon: Shield,
    title: "Trust & Security",
    desc: "Built-in guardrails, data governance, and compliance. We never use your customer data to train shared models.",
    href: "/trust",
  },
];

const testimonials = [
  {
    quote:
      "Innovation is in our DNA, and Sierra helps us bring that to life in how we care for our members every day.",
    author: "Caryn Seidman-Becker",
    role: "Chief Executive Officer",
  },
  {
    quote:
      "Home ownership is personal and our agent is personal. Clients vote with clicks, and clients love the agent.",
    author: "Alex McGillis",
    role: "VP, Product Management",
  },
  {
    quote:
      "Sierra is a game-changer for meeting subscribers' needs. For every interaction, we gain valuable insights.",
    author: "Moshe Pridan",
    role: "Chief Product Officer",
  },
  {
    quote:
      "This isn't just about automation. It's about creating a better, faster experience that still feels personal and thoughtful.",
    author: "Sarah Wallis",
    role: "Chief Operating Officer",
  },
];

const defaultStats = [
  { label: "Enterprise Customers", value: "500+" },
  { label: "Conversations Handled", value: "1B+" },
  { label: "Resolution Rate", value: "94%" },
  { label: "Avg. Response Time", value: "<2s" },
];

export default function Home() {
  const [stats, setStats] = useState(defaultStats);

  useEffect(() => {
    fetch("/api/insights")
      .then((res) => res.json())
      .then((data) => {
        if (data.kpis) {
          setStats([
            { label: "Enterprise Customers", value: "500+" },
            { label: "Conversations Handled", value: data.kpis.totalConversations >= 1000000 ? `${(data.kpis.totalConversations / 1000000).toFixed(1)}M` : String(data.kpis.totalConversations) },
            { label: "Resolution Rate", value: `${data.kpis.resolutionRate}%` },
            { label: "Avg. Response Time", value: `${data.kpis.avgResponseTime}s` },
          ]);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <main className="relative">
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0 bg-gradient-sierra" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-[#c4a574]/10 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-[#8b7355]/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 py-32 lg:px-8 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            custom={0}
            className="inline-flex items-center gap-2 rounded-full border border-[#c4a574]/30 bg-[#c4a574]/10 px-4 py-1.5 text-sm text-[#c4a574] mb-8"
          >
            <Sparkles className="h-4 w-4" />
            Introducing Agent OS 2.0
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            custom={1}
            className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight leading-[1.1] mb-8"
          >
            Better customer
            <br />
            <span className="text-gradient">experiences</span>
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            custom={2}
            className="mx-auto max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed mb-10"
          >
            Sierra helps the great companies of the world show up at their best.
            Build, optimize, personalize, and scale AI agents that deliver truly
            human customer experiences.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeIn}
            custom={3}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              size="lg"
              className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0] px-8 py-6 text-base"
            >
              Get started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 px-8 py-6 text-base"
            >
              Watch demo
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative border-y border-white/5 bg-[#0f0f0f]">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
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

      {/* Value Props */}
      <section className="relative py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-6">
              Build, optimize, personalize,
              <br />
              and <span className="text-gradient">scale</span> the best AI agents
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Everything you need to deliver truly personalized experiences across
              every moment that matters.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {[
              {
                icon: Zap,
                title: "Build quickly",
                desc: "Upload SOPs, transcripts, whiteboard photos, and audio recordings—or explain your goal in plain English.",
              },
              {
                icon: TrendingUp,
                title: "Optimize continuously",
                desc: "Automate agent updates based on flagged issues and proactive insights. Review, validate, and ship with confidence.",
              },
              {
                icon: Globe,
                title: "Personalize at scale",
                desc: "Respond to real-world signals by triggering next best action workflows across any channel with real-time context.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-white/5 bg-[#141414] p-8 hover:border-[#c4a574]/20 transition-colors"
              >
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#c4a574]/10">
                  <item.icon className="h-6 w-6 text-[#c4a574]" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative py-32 border-t border-white/5 bg-[#0f0f0f]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-6">
              The complete <span className="text-gradient">Agent OS</span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              A unified platform to build, deploy, and optimize AI agents across
              every customer touchpoint.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <Link
                  href={feature.href}
                  className="group block rounded-2xl border border-white/5 bg-[#141414] p-8 hover:border-[#c4a574]/20 transition-all h-full"
                >
                  <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#c4a574]/10 group-hover:bg-[#c4a574]/20 transition-colors">
                    <feature.icon className="h-6 w-6 text-[#c4a574]" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 group-hover:text-[#c4a574] transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed mb-6">
                    {feature.desc}
                  </p>
                  <span className="inline-flex items-center text-sm font-medium text-[#c4a574]">
                    Learn more
                    <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Product Deep Dive: Agent Studio */}
      <section className="relative py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-[#c4a574]/30 bg-[#c4a574]/10 px-4 py-1.5 text-sm text-[#c4a574] mb-6">
                <Cpu className="h-4 w-4" />
                Agent Studio
              </div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6">
                Build agents with
                <br />
                <span className="text-gradient">no code required</span>
              </h2>
              <ul className="space-y-4">
                {[
                  "Journeys — composable workflow builder",
                  "Workspaces — GitHub-style collaboration",
                  "Integration Library — pre-built connectors",
                  "Staging to production with instant rollback",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-[#c4a574]" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link href="/studio">
                  <Button className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]">
                    Explore Agent Studio
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative rounded-2xl border border-white/10 bg-[#141414] p-6 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#c4a574]/5 to-transparent" />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Journey Builder</div>
                  <div className="flex gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500/50" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500/50" />
                    <div className="h-3 w-3 rounded-full bg-green-500/50" />
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-[#0a0a0a] p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#c4a574]/20 flex items-center justify-center">
                      <MessageSquare className="h-5 w-5 text-[#c4a574]" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Greeting</div>
                      <div className="text-xs text-muted-foreground">
                        Welcome the customer
                      </div>
                    </div>
                  </div>
                  <div className="ml-5 h-6 w-0.5 bg-white/10" />
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Database className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        Lookup Customer
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Query CRM for context
                      </div>
                    </div>
                  </div>
                  <div className="ml-5 h-6 w-0.5 bg-white/10" />
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                      <Zap className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Resolve Issue</div>
                      <div className="text-xs text-muted-foreground">
                        Process return or refund
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative py-32 border-t border-white/5 bg-[#0f0f0f]">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-6">
              Trusted by industry <span className="text-gradient">leaders</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.author}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="rounded-2xl border border-white/5 bg-[#141414] p-8"
              >
                <p className="text-lg md:text-xl leading-relaxed mb-6 text-foreground/90">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <div className="font-semibold">{t.author}</div>
                  <div className="text-sm text-muted-foreground">{t.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-32">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-6">
              Ready to build better
              <br />
              <span className="text-gradient">customer experiences?</span>
            </h2>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground mb-10">
              Find out how Sierra can help your business deliver truly
              personalized experiences across every moment that matters.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0] px-8 py-6 text-base"
              >
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 px-8 py-6 text-base"
              >
                Contact sales
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
                <li>
                  <Link href="/studio" className="hover:text-foreground transition-colors">
                    Agent Studio
                  </Link>
                </li>
                <li>
                  <Link href="/sdk" className="hover:text-foreground transition-colors">
                    Agent SDK
                  </Link>
                </li>
                <li>
                  <Link href="/insights" className="hover:text-foreground transition-colors">
                    Insights 2.0
                  </Link>
                </li>
                <li>
                  <Link href="/voice" className="hover:text-foreground transition-colors">
                    Voice
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/live-assist" className="hover:text-foreground transition-colors">
                    Live Assist
                  </Link>
                </li>
                <li>
                  <Link href="/data-platform" className="hover:text-foreground transition-colors">
                    Data Platform
                  </Link>
                </li>
                <li>
                  <Link href="/ghostwriter" className="hover:text-foreground transition-colors">
                    Ghostwriter
                  </Link>
                </li>
                <li>
                  <Link href="/trust" className="hover:text-foreground transition-colors">
                    Trust & Security
                  </Link>
                </li>
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
