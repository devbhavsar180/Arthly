"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  Tags,
  Megaphone,
  Sliders,
  Activity,
  Lock,
  Plus,
  Trash2,
  Send,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  AdminAnnouncementItem,
  AdminDashboardStats,
  AdminUserItem,
  AppConfigItem,
  SystemCategoryItem,
  TransactionType,
} from "@/types";

type AdminTab = "overview" | "users" | "categories" | "announcements" | "configs" | "logs";

export default function AdminPanelPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [categories, setCategories] = useState<SystemCategoryItem[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<TransactionType>("EXPENSE");
  const [newCatColor, setNewCatColor] = useState("#2563EB");

  const [announcements, setAnnouncements] = useState<AdminAnnouncementItem[]>([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annMsg, setAnnMsg] = useState("");
  const [annSeverity, setAnnSeverity] = useState("info");

  const [configs, setConfigs] = useState<AppConfigItem[]>([]);
  const [logs, setLogs] = useState<{ admin_logs: any[]; system_logs: any[] }>({
    admin_logs: [],
    system_logs: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const loadAll = useCallback(async () => {
    if (user?.role !== "ADMIN") return;
    setLoading(true);
    setError("");
    try {
      const [dashRes, usersRes, catRes, annRes, cfgRes, logRes] = await Promise.all([
        api.getAdminDashboard(),
        api.getAdminUsers({ search: userSearch || undefined, status_filter: statusFilter }),
        api.listSystemCategories(),
        api.listAdminAnnouncements(),
        api.listAdminConfigs(),
        api.getAdminLogs(),
      ]);
      setStats(dashRes);
      setUsers(usersRes);
      setCategories(catRes);
      setAnnouncements(annRes);
      setConfigs(cfgRes);
      setLogs(logRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load admin console.");
    } finally {
      setLoading(false);
    }
  }, [user?.role, userSearch, statusFilter]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (user && user.role !== "ADMIN") {
    return (
      <AppShell>
        <div className="max-w-lg mx-auto mt-12 bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-card">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Admin Access Required</h1>
          <p className="text-sm text-slate-500">
            This management console is strictly restricted to platform administrators.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  const handleToggleUserStatus = async (u: AdminUserItem) => {
    try {
      await api.updateAdminUserStatus(u.id, !u.is_active);
      setFeedback(`Updated status for ${u.full_name}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update user status.");
    }
  };

  const handleToggleRole = async (u: AdminUserItem) => {
    const nextRole = u.role === "ADMIN" ? "USER" : "ADMIN";
    if (!window.confirm(`Change role for ${u.full_name} to ${nextRole}?`)) return;
    try {
      await api.updateAdminUserRole(u.id, nextRole);
      setFeedback(`Updated role for ${u.full_name} to ${nextRole}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update user role.");
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await api.createSystemCategory({
        name: newCatName.trim(),
        type: newCatType,
        color: newCatColor,
        icon: "tag",
      });
      setNewCatName("");
      setFeedback("Global default category created.");
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create system category.");
    }
  };

  const handleToggleSystemCategory = async (c: SystemCategoryItem) => {
    try {
      await api.updateSystemCategory(c.id, { is_active: !c.is_active });
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not toggle category.");
    }
  };

  const handleDeleteSystemCategory = async (id: string) => {
    try {
      await api.deleteSystemCategory(id);
      setFeedback("Global category deleted.");
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete category.");
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annMsg.trim()) return;
    try {
      const res = await api.createAdminAnnouncement({
        title: annTitle.trim(),
        message: annMsg.trim(),
        severity: annSeverity,
      });
      setAnnTitle("");
      setAnnMsg("");
      setFeedback(`Announcement sent to ${res.recipients_count} active user(s).`);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send announcement.");
    }
  };

  const handleToggleConfig = async (cfg: AppConfigItem) => {
    const nextVal = cfg.value === "true" ? "false" : cfg.value === "false" ? "true" : cfg.value;
    try {
      await api.updateAdminConfig(cfg.key, nextVal);
      setFeedback(`Updated config ${cfg.key} = ${nextVal}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update config.");
    }
  };

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <ShieldCheck className="w-4 h-4" /> },
    { id: "users", label: "Users", icon: <Users className="w-4 h-4" /> },
    { id: "categories", label: "Global Categories", icon: <Tags className="w-4 h-4" /> },
    { id: "announcements", label: "Announcements", icon: <Megaphone className="w-4 h-4" /> },
    { id: "configs", label: "Feature Flags", icon: <Sliders className="w-4 h-4" /> },
    { id: "logs", label: "Audit Logs", icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Arthly Admin Control Center
            </h1>
            <p className="text-sm text-slate-500">
              Aggregate platform metrics, user access controls, global defaults, and feature flags
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sage-50 border border-sage-200 text-sage-700 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            Privacy Protected · Zero Raw Financial Access
          </span>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-card">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                tab === t.id
                  ? "bg-brand-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium">
            {error}
          </div>
        )}
        {feedback && (
          <div className="p-3.5 rounded-xl bg-sage-50 border border-sage-200 text-sm text-sage-700 font-medium">
            {feedback}
          </div>
        )}

        {/* Overview Tab */}
        {tab === "overview" && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <StatTile label="Total Users" value={stats.total_users} />
              <StatTile label="Active Users" value={stats.active_users} />
              <StatTile label="Verified Mobile" value={`${stats.verified_mobile_rate}%`} />
              <StatTile label="New (7 Days)" value={stats.new_registrations_7d} />
              <StatTile label="Active (30d)" value={stats.active_last_30d} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <StatTile label="Transactions" value={stats.total_transactions_count} />
              <StatTile label="Voice Entries" value={stats.total_voice_entries_count} />
              <StatTile label="Screenshot Scans" value={stats.total_screenshots_count} />
              <StatTile label="Bank Reconcil." value={stats.total_reconciliations_count} />
              <StatTile label="Savings Goals" value={stats.total_goals_count} />
              <StatTile label="Active Budgets" value={stats.total_budgets_count} />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
              <h3 className="text-base font-bold text-slate-900 mb-4">
                7-Day New User Registration Trend
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.registration_trend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748B" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="count"
                      name="New Users"
                      stroke="#2563EB"
                      fill="#DBEAFE"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {tab === "users" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search name, email, or mobile..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Deactivated</option>
                <option value="VERIFIED">Verified Mobile</option>
                <option value="UNVERIFIED">Unverified Mobile</option>
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase">
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Mobile</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Joined</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 pr-3">
                        <p className="font-bold text-slate-900">{u.full_name}</p>
                        <p className="text-slate-500">{u.email}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="font-mono text-slate-700">
                          {u.mobile_number || "—"}
                        </span>{" "}
                        {u.mobile_number && (
                          <span
                            className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              u.mobile_verified
                                ? "bg-sage-50 text-sage-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {u.mobile_verified ? "Verified" : "Unverified"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.role === "ADMIN"
                              ? "bg-indigo-50 text-indigo-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.is_active
                              ? "bg-sage-50 text-sage-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {u.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-slate-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right space-x-2">
                        <button
                          onClick={() => handleToggleUserStatus(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {u.is_active ? (
                            <>
                              <UserX className="w-3.5 h-3.5 text-rose-600" />
                              Disable
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5 text-sage-600" />
                              Activate
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleRole(u)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 font-semibold text-indigo-700 hover:bg-indigo-50"
                        >
                          Make {u.role === "ADMIN" ? "USER" : "ADMIN"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* System Categories Tab */}
        {tab === "categories" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form
              onSubmit={handleAddCategory}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4 h-fit"
            >
              <h3 className="text-base font-bold text-slate-900">Add Global Category</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Subscriptions, Fuel, Dividends..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                  <select
                    value={newCatType}
                    onChange={(e) => setNewCatType(e.target.value as TransactionType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                  >
                    <option value="EXPENSE">EXPENSE</option>
                    <option value="INCOME">INCOME</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Color</label>
                  <input
                    type="color"
                    value={newCatColor}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="w-full h-9 rounded-xl border border-slate-200 p-1"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700"
              >
                <Plus className="w-4 h-4" />
                Create Global Default
              </button>
            </form>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-3">
              <h3 className="text-base font-bold text-slate-900">
                Global System Categories ({categories.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-xl bg-ivory border border-slate-200/70 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: c.color }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{c.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {c.type} · {c.is_active ? "Active" : "Hidden"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleToggleSystemCategory(c)}
                        className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-600"
                      >
                        {c.is_active ? "Disable" : "Enable"}
                      </button>
                      <button
                        onClick={() => handleDeleteSystemCategory(c.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Announcements Tab */}
        {tab === "announcements" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form
              onSubmit={handleBroadcast}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4 h-fit"
            >
              <h3 className="text-base font-bold text-slate-900">Broadcast Announcement</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Scheduled maintenance or new release"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Severity</label>
                <select
                  value={annSeverity}
                  onChange={(e) => setAnnSeverity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                >
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Message</label>
                <textarea
                  rows={4}
                  required
                  value={annMsg}
                  onChange={(e) => setAnnMsg(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700"
              >
                <Send className="w-4 h-4" />
                Send to Active Users
              </button>
            </form>

            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-3">
              <h3 className="text-base font-bold text-slate-900">Announcement History</h3>
              {announcements.length === 0 ? (
                <p className="text-xs text-slate-400">No broadcasts sent yet.</p>
              ) : (
                <div className="space-y-3">
                  {announcements.map((a) => (
                    <div
                      key={a.id}
                      className="p-4 rounded-xl bg-ivory border border-slate-200/70 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-900">{a.title}</p>
                        <span className="text-[11px] font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-full">
                          {a.recipients_count} recipients
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{a.message}</p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(a.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feature Flags Tab */}
        {tab === "configs" && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 space-y-3">
            <h3 className="text-base font-bold text-slate-900">Platform Feature Controls</h3>
            <div className="divide-y divide-slate-100">
              {configs.map((cfg) => (
                <div
                  key={cfg.key}
                  className="py-3.5 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900 font-mono">{cfg.key}</p>
                    <p className="text-xs text-slate-500">{cfg.description || "System config"}</p>
                  </div>
                  <button
                    onClick={() => handleToggleConfig(cfg)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${
                      cfg.value === "true"
                        ? "bg-sage-50 text-sage-700 border border-sage-200"
                        : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {cfg.value === "true" ? "Enabled" : cfg.value === "false" ? "Disabled" : cfg.value}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Logs Tab */}
        {tab === "logs" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-3">
              <h3 className="text-base font-bold text-slate-900">Admin Activity Logs</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.admin_logs.map((l) => (
                  <div key={l.id} className="p-3 rounded-xl bg-ivory text-xs">
                    <p className="font-bold text-slate-900">{l.action}</p>
                    <p className="text-slate-600">
                      {l.admin_email} · {l.target_type} {l.details || ""}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(l.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
                {logs.admin_logs.length === 0 && (
                  <p className="text-xs text-slate-400">No admin logs recorded yet.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-3">
              <h3 className="text-base font-bold text-slate-900">System Events</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {logs.system_logs.map((l) => (
                  <div key={l.id} className="p-3 rounded-xl bg-ivory text-xs">
                    <p className="font-bold text-slate-900">{l.event_type}</p>
                    <p className="text-slate-600">{l.message}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(l.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
                {logs.system_logs.length === 0 && (
                  <p className="text-xs text-slate-400">No system logs recorded yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {loading && !stats && (
          <div className="h-32 bg-white rounded-2xl border border-slate-200 animate-pulse" />
        )}
      </div>
    </AppShell>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-slate-900 tabular-nums mt-1">{value}</p>
    </div>
  );
}
