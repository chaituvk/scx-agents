"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Menu,
  X,
  Cpu,
  BarChart3,
  Phone,
  Users,
  Database,
  Sparkles,
  Shield,
  MessageSquare,
  ChevronDown,
  LogOut,
  User,
  Workflow,
  FlaskConical,
  BookOpen,
  Palette,
  Beaker,
  Building2,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const products = [
  { name: "Agent Studio", href: "/studio", icon: Cpu, desc: "No-code builder" },
  { name: "Agent SDK", href: "/sdk", icon: Sparkles, desc: "Developer toolkit" },
  { name: "Insights 2.0", href: "/insights", icon: BarChart3, desc: "Analytics" },
  { name: "Voice", href: "/voice", icon: Phone, desc: "Phone agents" },
  { name: "Live Assist", href: "/live-assist", icon: Users, desc: "Human copilot" },
  { name: "Data Platform", href: "/data-platform", icon: Database, desc: "Memory & personalization" },
  { name: "Ghostwriter", href: "/studio/ghostwriter", icon: Sparkles, desc: "AI agent builder" },
  { name: "Trust", href: "/trust", icon: Shield, desc: "Security & compliance" },
  { name: "Omnichannel", href: "/omnichannel", icon: MessageSquare, desc: "All channels" },
];

const studioTools = [
  { name: "Agent Studio", href: "/studio", icon: Cpu },
  { name: "Ghostwriter", href: "/studio/ghostwriter", icon: Sparkles },
  { name: "Flows", href: "/studio/flows", icon: Workflow },
  { name: "Simulation", href: "/studio/simulation", icon: FlaskConical },
  { name: "Knowledge", href: "/studio/knowledge", icon: BookOpen },
  { name: "Brand", href: "/studio/brand", icon: Palette },
  { name: "Playbooks", href: "/studio/playbooks", icon: ScrollText },
  { name: "Testing", href: "/studio/testing", icon: Beaker },
];

const TENANTS = [
  { id: "r-mobile", name: "R-Mobile", color: "#ef4444" },
  { id: "ichiba", name: "Ichiba", color: "#f97316" },
  { id: "r-travel", name: "RTravel", color: "#06b6d4" },
];

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
  isSuperAdmin: boolean;
}

export function Navigation() {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const [currentTenant, setCurrentTenant] = useState("r-mobile");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          setCurrentTenant(data.user.tenantId);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/login";
  }

  function switchTenant(tenantId: string) {
    document.cookie = `view_tenant=${tenantId};path=/;max-age=${60 * 60 * 24 * 7};SameSite=Lax`;
    setCurrentTenant(tenantId);
    setTenantMenuOpen(false);
    window.location.reload();
  }

  const tenantConfig = TENANTS.find((t) => t.id === currentTenant) || TENANTS[0];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#c4a574] to-[#8b7355]" />
            <span className="text-xl font-semibold tracking-tight text-foreground">
              Sierra
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            <div
              className="relative"
              onMouseEnter={() => setProductsOpen(true)}
              onMouseLeave={() => setProductsOpen(false)}
            >
              <button className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Products
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <AnimatePresence>
                {productsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-1 w-[520px] rounded-xl border border-white/10 bg-[#141414] p-4 shadow-2xl"
                  >
                    <div className="grid grid-cols-2 gap-1">
                      {products.map((product) => (
                        <Link
                          key={product.name}
                          href={product.href}
                          className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5 transition-colors"
                          onClick={() => setProductsOpen(false)}
                        >
                          <product.icon className="h-5 w-5 mt-0.5 text-[#c4a574]" />
                          <div>
                            <div className="text-sm font-medium text-foreground">
                              {product.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {product.desc}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div
              className="relative"
              onMouseEnter={() => setStudioOpen(true)}
              onMouseLeave={() => setStudioOpen(false)}
            >
              <button className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Studio
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <AnimatePresence>
                {studioOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 mt-1 w-[280px] rounded-xl border border-white/10 bg-[#141414] p-2 shadow-2xl"
                  >
                    <div className="space-y-0.5">
                      {studioTools.map((tool) => (
                        <Link
                          key={tool.name}
                          href={tool.href}
                          className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/5 transition-colors"
                          onClick={() => setStudioOpen(false)}
                        >
                          <tool.icon className="h-4 w-4 text-[#c4a574]" />
                          <span className="text-sm font-medium text-foreground">{tool.name}</span>
                        </Link>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Link
              href="/insights"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Insights
            </Link>
            <Link
              href="/trust"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Security
            </Link>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-3">
          {loading ? (
            <div className="h-8 w-8 rounded-full bg-white/5 animate-pulse" />
          ) : user ? (
            <div className="flex items-center gap-3">
              {/* Tenant Switcher (superadmin only) */}
              {user.isSuperAdmin && (
                <div className="relative">
                  <button
                    onClick={() => setTenantMenuOpen(!tenantMenuOpen)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0a0a0a] border border-white/10 text-xs hover:border-white/20 transition-colors"
                  >
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tenantConfig.color }} />
                    <span>{tenantConfig.name}</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${tenantMenuOpen ? "rotate-180" : ""}`} />
                  </button>
                  {tenantMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-40 bg-[#141414] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                      {TENANTS.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => switchTenant(t.id)}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center gap-2 ${currentTenant === t.id ? "bg-white/5" : ""}`}
                        >
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>{user.name}</span>
                {user.isSuperAdmin && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#c4a574]/20 text-[#c4a574]">Super</span>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </Button>
            </div>
          ) : (
            <>
              <Link href="/login">
                <Button
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Sign in
                </Button>
              </Link>
              <Button className="bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]">
                Get started
              </Button>
            </>
          )}
        </div>

        <button
          className="lg:hidden p-2 text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-white/5 bg-[#0a0a0a] overflow-hidden"
          >
            <div className="px-6 py-4 space-y-1">
              {products.map((product) => (
                <Link
                  key={product.name}
                  href={product.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-white/5 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  <product.icon className="h-5 w-5 text-[#c4a574]" />
                  <span className="text-sm font-medium">{product.name}</span>
                </Link>
              ))}
              <div className="pt-4 flex flex-col gap-2">
                {user ? (
                  <>
                    {user.isSuperAdmin && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Viewing: <span style={{ color: tenantConfig.color }}>{tenantConfig.name}</span>
                      </div>
                    )}
                    <Button variant="outline" className="w-full" onClick={handleLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Link href="/login">
                      <Button variant="outline" className="w-full">
                        Sign in
                      </Button>
                    </Link>
                    <Button className="w-full bg-[#c4a574] text-[#0a0a0a] hover:bg-[#d4c4b0]">
                      Get started
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
