"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
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
  Webhook,
  Inbox,
  Key,
  Settings,
  Megaphone,
  UserCircle,
  AlertCircle,
  TrendingUp,
  Plug,
  Zap,
  GitBranch,
  Clock,
  Bell,
  Search,
  MessageSquare as MsgSquare,
  UserCircle as UC,
  BookOpen as BO,
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
  { name: "Integrations", href: "/integrations", icon: Plug, desc: "Connect your stack" },
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
  { name: "Experiments", href: "/studio/experiments", icon: FlaskConical },
  { name: "Proactive", href: "/studio/proactive", icon: Zap },
  { name: "Routing", href: "/studio/routing", icon: GitBranch },
  { name: "Webhooks", href: "/studio/webhooks", icon: Webhook },
  { name: "Profiles", href: "/studio/profiles", icon: Settings },
];

const accountTools = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { name: "Inbox", href: "/inbox", icon: Inbox },
  { name: "Handover", href: "/handover", icon: AlertCircle },
  { name: "Analytics", href: "/analytics", icon: TrendingUp },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Integrations", href: "/integrations", icon: Plug },
  { name: "Campaigns", href: "/campaigns", icon: Megaphone },
  { name: "Customers", href: "/customers", icon: UserCircle },
  { name: "Team", href: "/settings/team", icon: Users },
  { name: "SLA", href: "/settings/sla", icon: Clock },
  { name: "Canned Replies", href: "/settings/canned-responses", icon: MessageSquare },
  { name: "Quality", href: "/settings/quality", icon: Shield },
  { name: "Audit Log", href: "/settings/audit-log", icon: ScrollText },
  { name: "Settings", href: "/settings", icon: Settings },
  { name: "API Keys", href: "/settings/api-keys", icon: Key },
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
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<{id: string; type: string; title: string; body: string; href: string}[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<{conversations: Record<string, unknown>[]; customers: Record<string, unknown>[]; knowledge: {title: string; content: string; source: string}[]}>({ conversations: [], customers: [], knowledge: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    function fetchNotifs() {
      fetch("/api/notifications?limit=10")
        .then(r => r.json())
        .then(d => {
          setNotifications(d.notifications ?? []);
          setUnreadCount(d.unread_count ?? 0);
        })
        .catch(() => {});
    }
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(o => !o);
      }
      if (e.key === "Escape") { setSearchOpen(false); setBellOpen(false); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchRef.current?.focus(), 50);
    if (!searchOpen) { setSearchQ(""); setSearchResults({ conversations: [], customers: [], knowledge: [] }); }
  }, [searchOpen]);

  function handleSearchInput(val: string) {
    setSearchQ(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!val.trim()) { setSearchResults({ conversations: [], customers: [], knowledge: [] }); return; }
    setSearchLoading(true);
    searchTimeout.current = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(val)}&limit=5`)
        .then(r => r.json())
        .then(d => setSearchResults(d))
        .catch(() => {})
        .finally(() => setSearchLoading(false));
    }, 300);
  }

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
              href="/inbox"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Inbox className="w-3.5 h-3.5" />
              Inbox
            </Link>
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
          {/* Global search trigger */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">Search…</span>
            <kbd className="hidden xl:inline text-[10px] px-1 rounded bg-white/10 text-muted-foreground">⌘K</kbd>
          </button>
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

              {/* Notification bell */}
              <div className="relative">
                <button
                  onClick={() => setBellOpen(o => !o)}
                  className="relative p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {bellOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-white/10 bg-[#141414] shadow-2xl overflow-hidden z-50"
                    >
                      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                        <span className="text-sm font-medium">Notifications</span>
                        <button onClick={() => setBellOpen(false)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          <Bell className="h-6 w-6 mx-auto mb-2 opacity-30" />
                          No notifications
                        </div>
                      ) : (
                        <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                          {notifications.map((n) => (
                            <Link
                              key={n.id}
                              href={n.href}
                              onClick={() => setBellOpen(false)}
                              className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                            >
                              <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${n.type === "escalation" ? "bg-red-500" : n.type === "unassigned_urgent" ? "bg-orange-400" : "bg-blue-400"}`} />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">{n.title}</p>
                                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{n.body}</p>
                              </div>
                              <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                            </Link>
                          ))}
                        </div>
                      )}
                      <div className="px-4 py-2 border-t border-white/5">
                        <Link href="/inbox" onClick={() => setBellOpen(false)} className="text-xs text-[#c4a574] hover:underline">
                          View all in Inbox →
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

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

      {/* Global search modal */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4"
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="relative w-full max-w-2xl bg-[#141414] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQ}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  placeholder="Search conversations, customers, knowledge…"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                {searchLoading && <div className="h-3 w-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin shrink-0" />}
                <button onClick={() => setSearchOpen(false)} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {searchQ.trim() && (
                <div className="max-h-[60vh] overflow-y-auto">
                  {searchResults.conversations.length > 0 && (
                    <div className="p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 mb-2">Conversations</p>
                      {searchResults.conversations.map((c) => (
                        <Link
                          key={c.id as string}
                          href="/inbox"
                          onClick={() => setSearchOpen(false)}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                        >
                          <MsgSquare className="h-4 w-4 text-blue-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{(c.customer_name as string) || "Anonymous"}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.customer_email as string} · {c.channel as string} · {c.status as string}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {searchResults.customers.length > 0 && (
                    <div className="p-3 border-t border-white/5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 mb-2">Customers</p>
                      {searchResults.customers.map((c) => (
                        <Link
                          key={c.id as string}
                          href="/customers"
                          onClick={() => setSearchOpen(false)}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                        >
                          <UC className="h-4 w-4 text-green-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{(c.name as string) || "Anonymous"}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.email as string} · {c.total_conversations as number} conversations</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {searchResults.knowledge.length > 0 && (
                    <div className="p-3 border-t border-white/5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 mb-2">Knowledge Base</p>
                      {searchResults.knowledge.map((k, i) => (
                        <Link
                          key={i}
                          href="/studio/knowledge"
                          onClick={() => setSearchOpen(false)}
                          className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
                        >
                          <BO className="h-4 w-4 text-[#c4a574] shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{k.title || k.source}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{k.content}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                  {!searchLoading && searchResults.conversations.length === 0 && searchResults.customers.length === 0 && searchResults.knowledge.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No results for "{searchQ}"
                    </div>
                  )}
                </div>
              )}
              {!searchQ.trim() && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Start typing to search across your workspace
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
