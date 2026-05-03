"use client";

import { motion } from "framer-motion";
import {
  Shield,
  Lock,
  Eye,
  FileCheck,
  Server,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronRight,
  ArrowRight,
  Database,
  Key,
  Fingerprint,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4 },
  }),
};

const certifications = [
  { name: "SOC 2 Type II", status: "Certified", date: "Jan 2026" },
  { name: "ISO 27001", status: "Certified", date: "Dec 2025" },
  { name: "GDPR Compliant", status: "Certified", date: "Ongoing" },
  { name: "HIPAA", status: "Certified", date: "Nov 2025" },
  { name: "CCPA", status: "Compliant", date: "Ongoing" },
  { name: "PCI DSS", status: "Level 1", date: "Oct 2025" },
];

const complianceChecks = [
  { policy: "Data Encryption at Rest", status: "Pass", lastAudit: "2 days ago", nextReview: "90 days" },
  { policy: "Data Encryption in Transit", status: "Pass", lastAudit: "2 days ago", nextReview: "90 days" },
  { policy: "Access Control & RBAC", status: "Pass", lastAudit: "1 week ago", nextReview: "30 days" },
  { policy: "Audit Logging", status: "Pass", lastAudit: "1 week ago", nextReview: "30 days" },
  { policy: "Data Retention Policy", status: "Pass", lastAudit: "2 weeks ago", nextReview: "60 days" },
  { policy: "Third-Party Risk Assessment", status: "Pass", lastAudit: "1 month ago", nextReview: "180 days" },
];

const guardrails = [
  {
    condition: "customer_asks_for_medical_advice",
    action: "escalate_to_human",
    priority: "Critical",
    active: true,
  },
  {
    condition: "refund_amount > $500",
    action: "require_manager_approval",
    priority: "High",
    active: true,
  },
  {
    condition: "contains_pii_request",
    action: "verify_identity_first",
    priority: "High",
    active: true,
  },
  {
    condition: "legal_threat_detected",
    action: "escalate_immediately",
    priority: "Critical",
    active: true,
  },
  {
    condition: "account_deletion_request",
    action: "confirm_via_email",
    priority: "Medium",
    active: false,
  },
];

const securityFeatures = [
  {
    icon: Lock,
    title: "Data Privacy",
    desc: "We never use your customer data to train shared models. Your data stays yours, always.",
  },
  {
    icon: Eye,
    title: "Full Audit Logging",
    desc: "Every conversation, tool call, and decision is logged with full traceability for compliance.",
  },
  {
    icon: Server,
    title: "Enterprise Encryption",
    desc: "AES-256 encryption at rest and TLS 1.3 in transit. Your data is protected at every layer.",
  },
  {
    icon: UserCheck,
    title: "Access Controls",
    desc: "Role-based access control, SSO integration, and multi-factor authentication for all users.",
  },
  {
    icon: Database,
    title: "Data Residency",
    desc: "Choose where your data lives. US, EU, or custom regions with full compliance.",
  },
  {
    icon: Fingerprint,
    title: "PII Protection",
    desc: "Automatic PII detection and redaction. Built-in guardrails prevent data leakage.",
  },
];

const priorityColor = (p: string) => {
  if (p === "Critical") return "bg-red-500/20 text-red-400 border-red-500/30";
  if (p === "High") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
};

export default function TrustPage() {
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
            <Shield className="h-6 w-6 text-[#c4a574]" />
            <span className="text-sm font-medium text-[#c4a574]">Trust & Security</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            Enterprise-grade <span className="text-gradient">security</span>
            <br />
            built into every layer
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            We designed Sierra with the highest commitment to trust, security, and compliance.
            Your data is protected, your customers are safe, and your reputation is secure.
          </p>
        </motion.div>

        {/* Certifications */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {certifications.map((cert, i) => (
              <motion.div
                key={cert.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="bg-[#141414] border-white/5 text-center h-full">
                  <CardContent className="p-4">
                    <div className="h-12 w-12 mx-auto mb-3 rounded-xl bg-[#c4a574]/10 flex items-center justify-center">
                      <FileCheck className="h-6 w-6 text-[#c4a574]" />
                    </div>
                    <div className="text-sm font-medium mb-1">{cert.name}</div>
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                      {cert.status}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-2">{cert.date}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Security Features */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {securityFeatures.map((feature, i) => (
            <motion.div
              key={feature.title}
              variants={fadeIn}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
            >
              <Card className="bg-[#141414] border-white/5 h-full hover:border-[#c4a574]/20 transition-colors">
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#c4a574]/10">
                    <feature.icon className="h-5 w-5 text-[#c4a574]" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Compliance Dashboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h2 className="text-2xl font-semibold mb-6">Compliance Dashboard</h2>
          <Card className="bg-[#141414] border-white/5">
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5 text-left text-sm text-muted-foreground">
                      <th className="pb-4 font-medium">Policy</th>
                      <th className="pb-4 font-medium">Status</th>
                      <th className="pb-4 font-medium">Last Audit</th>
                      <th className="pb-4 font-medium">Next Review</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {complianceChecks.map((check) => (
                      <tr key={check.policy} className="border-b border-white/5 last:border-0">
                        <td className="py-4">{check.policy}</td>
                        <td className="py-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-400" />
                            <span>{check.status}</span>
                          </div>
                        </td>
                        <td className="py-4 text-muted-foreground">{check.lastAudit}</td>
                        <td className="py-4 text-muted-foreground">{check.nextReview}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Guardrails Builder */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h2 className="text-2xl font-semibold mb-6">Guardrails Builder</h2>
          <div className="space-y-4">
            {guardrails.map((rule, i) => (
              <motion.div
                key={rule.condition}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="bg-[#141414] border-white/5">
                  <CardContent className="p-5">
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${rule.active ? "bg-green-500/20" : "bg-white/5"}`}>
                          {rule.active ? (
                            <CheckCircle2 className="h-4 w-4 text-green-400" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <Badge variant="outline" className={priorityColor(rule.priority)}>
                          {rule.priority}
                        </Badge>
                      </div>
                      <div className="flex-1 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">IF</span>
                          <span className="font-mono text-xs bg-[#0a0a0a] px-2 py-1 rounded">{rule.condition}</span>
                        </div>
                        <ChevronRight className="hidden md:block h-4 w-4 text-muted-foreground" />
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">THEN</span>
                          <span className="font-mono text-xs bg-[#c4a574]/10 text-[#c4a574] px-2 py-1 rounded">{rule.action}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${rule.active ? "bg-green-400" : "bg-muted-foreground"}`} />
                        <span className="text-xs text-muted-foreground">{rule.active ? "Active" : "Draft"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Card className="bg-gradient-to-br from-[#c4a574]/10 to-[#8b7355]/10 border-[#c4a574]/20">
            <CardContent className="p-10">
              <Shield className="h-12 w-12 text-[#c4a574] mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-3">Ready for a security review?</h2>
              <p className="text-muted-foreground max-w-xl mx-auto mb-6">
                Our security team is available for custom reviews, penetration testing coordination, and compliance questionnaires.
              </p>
              <Button className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]">
                Request Security Review
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </main>
  );
}
