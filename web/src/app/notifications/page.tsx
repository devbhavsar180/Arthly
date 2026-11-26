"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BellRing,
  CheckCheck,
  Trash2,
  Sparkles,
  Check,
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api, ApiError } from "@/lib/api";
import { AppNotification, NotificationPreferences } from "@/types";

export default function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingReminders, setCheckingReminders] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [browserPerm, setBrowserPerm] = useState<string>("default");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [notifRes, prefRes] = await Promise.all([
        api.listNotifications(unreadOnly),
        api.getNotificationPreferences(),
      ]);
      setItems(notifRes.items);
      setUnreadCount(notifRes.unread_count);
      setPrefs(prefRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setBrowserPerm(Notification.permission);
    }
    loadData();
  }, [loadData]);

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not mark notification read.");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await api.markAllNotificationsRead();
      setMessage(`Marked ${res.updated} notification(s) as read.`);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to mark all read.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteNotification(id);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete notification.");
    }
  };

  const handleCheckReminders = async () => {
    setCheckingReminders(true);
    setMessage("");
    setError("");
    try {
      const res = await api.checkSmartReminders();
      setMessage(
        res.new_reminders_count > 0
          ? `Generated ${res.new_reminders_count} new smart financial alert(s).`
          : "All reminders and goal checks are already up to date."
      );
      if (
        res.new_reminders_count > 0 &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification("Arthly Financial Update", {
          body: res.notifications[0]?.title || "New savings or budget update available.",
        });
      }
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not run smart reminder check.");
    } finally {
      setCheckingReminders(false);
    }
  };

  const handleTogglePref = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      const updated = await api.updateNotificationPreferences({ [key]: value });
      setPrefs(updated);
    } catch (err) {
      setPrefs(prefs);
      setError(err instanceof ApiError ? err.message : "Failed to save preference.");
    }
  };

  const handleEnableBrowserAlerts = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setError("Browser Web Notifications are not supported on this device.");
      return;
    }
    const perm = await Notification.requestPermission();
    setBrowserPerm(perm);
    if (perm === "granted") {
      await handleTogglePref("web_push_enabled", true);
      new Notification("Arthly Alerts Active", {
        body: "You will now receive browser notifications for budgets and goals.",
      });
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Notifications & Smart Alerts
            </h1>
            <p className="text-sm text-slate-500">
              Budget threshold warnings, goal milestones, unusual spending insights, and announcements
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCheckReminders}
              disabled={checkingReminders}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-card disabled:opacity-60"
            >
              <Sparkles className="w-3.5 h-3.5 text-brand-600" />
              {checkingReminders ? "Checking..." : "Run Smart Check"}
            </button>
            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-50"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark All Read ({unreadCount})
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium">
            {error}
          </div>
        )}
        {message && (
          <div className="p-3.5 rounded-xl bg-sage-50 border border-sage-200 text-sm text-sage-700 font-medium">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notification List */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUnreadOnly(false)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    !unreadOnly
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  All Alerts
                </button>
                <button
                  onClick={() => setUnreadOnly(true)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    unreadOnly
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl bg-ivory animate-pulse" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Bell className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-sm font-medium text-slate-600">
                  {unreadOnly ? "You're all caught up!" : "No notifications yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((n) => {
                  const badgeStyle =
                    n.severity === "danger"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : n.severity === "warning"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : n.severity === "success"
                      ? "bg-sage-50 text-sage-700 border-sage-200"
                      : "bg-brand-50 text-brand-700 border-brand-200";

                  return (
                    <div
                      key={n.id}
                      className={`p-4 rounded-xl border transition-all ${
                        n.is_read
                          ? "bg-white border-slate-200/70"
                          : "bg-brand-50/30 border-brand-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {!n.is_read && (
                              <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0" />
                            )}
                            <p className="text-sm font-bold text-slate-900">{n.title}</p>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeStyle}`}
                            >
                              {n.notification_type.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                          <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-400">
                            <span>{new Date(n.created_at).toLocaleString()}</span>
                            {n.action_url && (
                              <Link
                                href={n.action_url}
                                className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline"
                              >
                                Open
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {!n.is_read && (
                            <button
                              onClick={() => handleMarkRead(n.id)}
                              className="p-1.5 rounded-lg text-brand-600 hover:bg-brand-50"
                              title="Mark as read"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(n.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preferences Panel */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4 h-fit">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <SlidersHorizontal className="w-4 h-4 text-brand-600" />
              <h2 className="text-base font-bold text-slate-900">Alert Preferences</h2>
            </div>

            {prefs && (
              <div className="space-y-3">
                {(
                  [
                    ["budget_alerts_enabled", "Budget Threshold Warnings"],
                    ["goal_alerts_enabled", "Savings Goal Milestones"],
                    ["unusual_spending_enabled", "Unusual Spending Spikes"],
                    ["monthly_summary_enabled", "Monthly Financial Summaries"],
                    ["reminders_enabled", "Goal Pacing Reminders"],
                    ["push_enabled", "Mobile Push Alerts"],
                    ["web_push_enabled", "Web Browser Notifications"],
                  ] as [keyof NotificationPreferences, string][]
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-3 py-1.5 cursor-pointer"
                  >
                    <span className="text-xs font-medium text-slate-700">{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(prefs[key])}
                      onChange={(e) => handleTogglePref(key, e.target.checked)}
                      className="w-4 h-4 accent-brand-600 rounded"
                    />
                  </label>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <p className="text-[11px] text-slate-500">
                Browser permission status:{" "}
                <strong className="text-slate-800 uppercase">{browserPerm}</strong>
              </p>
              {browserPerm !== "granted" && (
                <button
                  onClick={handleEnableBrowserAlerts}
                  className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl border border-brand-200 bg-brand-50 text-brand-700 text-xs font-semibold hover:bg-brand-100"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  Enable Browser Alerts
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
