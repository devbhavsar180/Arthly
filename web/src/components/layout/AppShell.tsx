"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  MinusCircle,
  PlusCircle,
  FileBarChart2,
  Settings,
  LogOut,
  Menu,
  X,
  Wallet,
  Mic,
  CheckCircle2,
  PiggyBank,
  Gauge,
  Bell,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const NAV_GROUPS = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/savings", label: "Savings & Goals", icon: PiggyBank },
      { href: "/budgets", label: "Budgets & Limits", icon: Gauge },
    ],
  },
  {
    title: "Transactions",
    items: [
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/add-expense", label: "Add Expense", icon: MinusCircle },
      { href: "/add-income", label: "Add Income", icon: PlusCircle },
    ],
  },
  {
    title: "Smart Capture",
    items: [
      { href: "/screenshot-scan", label: "Screenshot Scan", icon: ScanLine },
      { href: "/voice-entry", label: "Voice Entry", icon: Mic },
      { href: "/reconciliation", label: "Bank Verification", icon: CheckCircle2 },
    ],
  },
  {
    title: "Insights & Account",
    items: [
      { href: "/reports", label: "Analytics & Reports", icon: FileBarChart2 },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/settings", label: "Profile & Settings", icon: Settings },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    api
      .listNotifications(true)
      .then((res) => setUnreadCount(res.unread_count || 0))
      .catch(() => {});
  }, [user, pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-600 to-indigo-600 flex items-center justify-center text-white shadow-soft animate-pulse">
            <Wallet className="w-5 h-5" />
          </div>
          <p className="text-sm text-slate-500 font-medium">Loading Arthly workspace...</p>
        </div>
      </div>
    );
  }

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/80">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 via-indigo-600 to-emerald-600 flex items-center justify-center text-white shadow-sm">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-slate-900 leading-tight tracking-tight">Arthly</p>
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 rounded-md">
                AI
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-400">Personal Finance</p>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                const isNotif = item.href === "/notifications";
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                      active
                        ? "bg-brand-50/90 text-brand-700 font-semibold shadow-2xs border border-brand-100"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${active ? "text-brand-600" : "text-slate-400"}`} />
                      <span>{item.label}</span>
                    </span>
                    {isNotif && unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 min-w-[20px] text-center rounded-full bg-rose-500 text-white text-[10px] font-bold tabular-nums">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {user.role === "ADMIN" && (
          <div>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-500">
              Administration
            </p>
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                pathname.startsWith("/admin")
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : "text-indigo-700/80 hover:bg-indigo-50/60"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Admin Console</span>
            </Link>
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-slate-100">
        <div className="px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200/70 mb-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-800 truncate">{user.full_name}</p>
            {user.mobile_verified && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[9px] font-bold">
                VERIFIED
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">
            {user.mobile_number || user.email}
          </p>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/35 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-64 max-w-[82vw] h-full z-10">{sidebarContent}</div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Utility Header */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-xl text-slate-600 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="lg:hidden text-sm font-bold text-slate-900">Arthly</span>
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500">
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              <span>AI-Powered Personal Finance</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/screenshot-scan"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-semibold transition"
            >
              <ScanLine className="w-3.5 h-3.5 text-indigo-600" />
              Scan Receipt
            </Link>
            <Link
              href="/add-income"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-xs font-semibold shadow-xs transition"
            >
              + Income
            </Link>
            <Link
              href="/add-expense"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs transition"
            >
              + Expense
            </Link>
            <Link
              href="/notifications"
              className="relative p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
