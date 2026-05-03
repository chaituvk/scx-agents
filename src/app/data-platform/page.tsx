"use client";

import { motion } from "framer-motion";
import {
  Database,
  Brain,
  Link2,
  Target,
  Bell,
  User,
  Clock,
  ShoppingBag,
  MapPin,
  CreditCard,
  Tag,
  Star,
  ChevronRight,
  ArrowRight,
  Zap,
  Globe,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

const customerTimeline = [
  { event: "Signed up", time: "2 years ago", icon: User },
  { event: "First purchase: Wireless Headphones", time: "1 year ago", icon: ShoppingBag },
  { event: "Upgraded to Premium plan", time: "8 months ago", icon: Star },
  { event: "Last conversation: Shipping inquiry", time: "3 days ago", icon: Clock },
  { event: "Currently viewing: Laptop Pro X1", time: "Active now", icon: Zap },
];

const dataSources = [
  { name: "Salesforce CRM", status: "Connected", records: "2.4M" },
  { name: "Snowflake Warehouse", status: "Connected", records: "850M" },
  { name: "Stripe", status: "Connected", records: "1.2M" },
  { name: "Zendesk", status: "Connected", records: "4.1M" },
  { name: "Segment CDP", status: "Connected", records: "12M" },
];

export default function DataPlatformPage() {
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
            <Database className="h-6 w-6 text-[#c4a574]" />
            <span className="text-sm font-medium text-[#c4a574]">Agent Data Platform</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-3">
            Personalize every <span className="text-gradient">interaction</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl">
            Persistent memory, structured data integration, and real-time context to power truly personalized AI experiences.
          </p>
        </motion.div>

        {/* Memory Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-16"
        >
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Conversation History */}
            <Card className="bg-[#141414] border-white/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#c4a574]" />
                  Conversation History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { text: "Where is my order #48291?", from: "Customer", time: "3 days ago" },
                  { text: "It's currently in transit, arriving tomorrow.", from: "Agent", time: "3 days ago" },
                  { text: "Can I upgrade to express shipping?", from: "Customer", time: "3 days ago" },
                ].map((msg, i) => (
                  <div key={i} className={`rounded-lg p-3 ${msg.from === "Customer" ? "bg-[#0a0a0a]" : "bg-[#c4a574]/10"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{msg.from}</span>
                      <span className="text-xs text-muted-foreground">{msg.time}</span>
                    </div>
                    <p className="text-sm">{msg.text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Customer Profile */}
            <Card className="bg-[#141414] border-white/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-[#c4a574]" />
                  Customer Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#c4a574] to-[#8b7355] flex items-center justify-center text-[#0a0a0a] font-semibold">
                    AT
                  </div>
                  <div>
                    <div className="font-semibold">Alex Thompson</div>
                    <div className="text-xs text-muted-foreground">alex@example.com</div>
                  </div>
                  <Badge className="ml-auto bg-[#c4a574]/20 text-[#c4a574] border-[#c4a574]/30">VIP</Badge>
                </div>
                <Separator className="my-4 bg-white/5" />
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <ShoppingBag className="h-3.5 w-3.5" /> Lifetime Value
                    </span>
                    <span className="font-medium">$4,250</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <CreditCard className="h-3.5 w-3.5" /> Payment Method
                    </span>
                    <span className="font-medium">Visa ····4242</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5" /> Location
                    </span>
                    <span className="font-medium">San Francisco, CA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Tag className="h-3.5 w-3.5" /> Preferences
                    </span>
                    <span className="font-medium">Tech, Early Adopter</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Real-time Context */}
            <Card className="bg-[#141414] border-white/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#c4a574]" />
                  Real-time Context
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border border-[#c4a574]/30 bg-[#c4a574]/10 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-sm font-medium">Currently Browsing</span>
                  </div>
                  <p className="text-sm">Laptop Pro X1 — $1,899</p>
                  <p className="text-xs text-muted-foreground mt-1">On product page for 4 minutes</p>
                </div>
                <div className="rounded-lg border border-white/5 bg-[#0a0a0a] p-4">
                  <div className="text-sm font-medium mb-2">Active Signals</div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-blue-500/30 text-blue-400">High Intent</Badge>
                    <Badge variant="outline" className="border-green-500/30 text-green-400">Repeat Buyer</Badge>
                    <Badge variant="outline" className="border-yellow-500/30 text-yellow-400">Price Sensitive</Badge>
                  </div>
                </div>
                <div className="rounded-lg border border-white/5 bg-[#0a0a0a] p-4">
                  <div className="text-sm font-medium mb-2">Next Best Action</div>
                  <p className="text-sm text-muted-foreground">Offer 10% loyalty discount + free extended warranty</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Decision Engine Connector */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex justify-center mb-16"
        >
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="h-4 w-4 text-[#c4a574]" />
              Conversation Memory
            </div>
            <div className="hidden lg:block h-px w-16 bg-gradient-to-r from-[#c4a574]/50 to-[#c4a574]" />
            <Card className="bg-gradient-to-br from-[#c4a574]/20 to-[#8b7355]/20 border-[#c4a574]/30 px-8 py-4">
              <div className="flex items-center gap-3">
                <Layers className="h-6 w-6 text-[#c4a574]" />
                <div>
                  <div className="font-semibold">Agent Decision Engine</div>
                  <div className="text-xs text-muted-foreground">Personalized Response Generation</div>
                </div>
              </div>
            </Card>
            <div className="hidden lg:block h-px w-16 bg-gradient-to-l from-[#c4a574]/50 to-[#c4a574]" />
            <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4 text-[#c4a574]" />
              Personalized Action
            </div>
          </div>
        </motion.div>

        {/* Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {[
            {
              icon: Brain,
              title: "Persistent Memory",
              desc: "Agents remember every interaction across channels and time, building rich customer understanding.",
            },
            {
              icon: Link2,
              title: "Structured Data Integration",
              desc: "Connect CRMs, data warehouses, and systems of record for real-time data access.",
            },
            {
              icon: Target,
              title: "Recommendation Engine",
              desc: "AI-powered next best action recommendations based on context, history, and business goals.",
            },
            {
              icon: Globe,
              title: "Audience Targeting",
              desc: "Segment customers and personalize experiences based on behavior, value, and preferences.",
            },
            {
              icon: Bell,
              title: "Proactive Engagement",
              desc: "Trigger workflows based on real-world signals and customer behavior patterns.",
            },
            {
              icon: Database,
              title: "Unified Profile",
              desc: "A single 360° view of every customer, combining all data sources into one rich profile.",
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
              <Card className="bg-[#141414] border-white/5 h-full hover:border-[#c4a574]/20 transition-colors">
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

        {/* Data Sources */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h2 className="text-2xl font-semibold mb-6">Connected Data Sources</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dataSources.map((source, i) => (
              <motion.div
                key={source.name}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="bg-[#141414] border-white/5">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium mb-1">{source.name}</div>
                        <div className="text-xs text-muted-foreground">{source.records} records synced</div>
                      </div>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        {source.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Customer 360 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h2 className="text-2xl font-semibold mb-6">Customer 360° Timeline</h2>
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-6">
              <div className="space-y-0">
                {customerTimeline.map((item, i) => (
                  <div key={i} className="flex items-start gap-4 relative">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-[#c4a574]/10 flex items-center justify-center">
                        <item.icon className="h-4 w-4 text-[#c4a574]" />
                      </div>
                      {i < customerTimeline.length - 1 && (
                        <div className="w-px h-full min-h-[40px] bg-white/10 my-1" />
                      )}
                    </div>
                    <div className="pb-6">
                      <div className="font-medium">{item.event}</div>
                      <div className="text-sm text-muted-foreground">{item.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
