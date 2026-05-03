"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

const TENANTS = [
  { id: "r-mobile", name: "R-Mobile", email: "admin@sierra.ai", color: "#ef4444" },
  { id: "ichiba", name: "Ichiba", email: "admin@ichiba.ai", color: "#f97316" },
  { id: "r-travel", name: "RTravel", email: "admin@rtravel.ai", color: "#06b6d4" },
];

const SUPERADMIN = { email: "superadmin@sierra.ai", password: "sierra2026" };

export default function LoginPage() {
  const [email, setEmail] = useState("admin@sierra.ai");
  const [password, setPassword] = useState("sierra2026");
  const [tenant, setTenant] = useState("r-mobile");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, tenant }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Login failed");
      }

      // Hard redirect to ensure auth state is fresh
      window.location.href = "/";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  const handleTenantChange = (t: string) => {
    setTenant(t);
    const tenantConfig = TENANTS.find((x) => x.id === t);
    if (tenantConfig) setEmail(tenantConfig.email);
    setError("");
  };

  const isSuperAdmin = email === SUPERADMIN.email;

  return (
    <main className="relative min-h-screen flex items-center justify-center pt-20">
      <div className="absolute inset-0 bg-gradient-sierra" />
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-[#c4a574]/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-96 w-96 rounded-full bg-[#8b7355]/10 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md px-6"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-[#c4a574] to-[#8b7355] mb-4">
            <Sparkles className="h-6 w-6 text-[#0a0a0a]" />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Welcome to Sierra</h1>
          <p className="text-muted-foreground">Sign in to access your Agent OS</p>
        </div>

        <Card className="bg-[#141414] border-white/5">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tenant Dropdown */}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Organization</label>
                <div className="relative">
                  <select
                    value={tenant}
                    onChange={(e) => handleTenantChange(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2.5 text-sm appearance-none focus:outline-none focus:border-[#c4a574]/30 cursor-pointer"
                  >
                    {TENANTS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[#0a0a0a] border-white/10"
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#0a0a0a] border-white/10"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 space-y-2 text-center text-xs text-muted-foreground">
              <p>Demo per-tenant: <span className="text-[#c4a574]">sierra2026</span></p>
              <p className="text-white/30">— or —</p>
              <button
                type="button"
                onClick={() => {
                  setEmail(SUPERADMIN.email);
                  setPassword(SUPERADMIN.password);
                  setTenant("r-mobile");
                }}
                className="text-[#c4a574] hover:underline"
              >
                Use Super Admin ({SUPERADMIN.email})
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
