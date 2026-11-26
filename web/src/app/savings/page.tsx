"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  PiggyBank,
  Target,
  Plus,
  TrendingUp,
  CheckCircle2,
  Trash2,
  Edit3,
  Clock,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  formatCompactCurrency,
  formatCurrency,
  formatDisplayDate,
  getTodayIso,
  MONTH_NAMES,
} from "@/lib/format";
import { SavingsDashboardResponse, SavingsGoal } from "@/types";

const GOAL_COLORS = [
  "#2563EB",
  "#10B981",
  "#8B5CF6",
  "#F59E0B",
  "#EC4899",
  "#0EA5E9",
];

export default function SavingsPage() {
  const { currencySymbol, currencyCode } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<SavingsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bannerMsg, setBannerMsg] = useState("");

  // Goal Create / Edit Modal
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalInitial, setGoalInitial] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [goalColor, setGoalColor] = useState(GOAL_COLORS[0]);
  const [goalNotes, setGoalNotes] = useState("");
  const [goalStatus, setGoalStatus] = useState<"ACTIVE" | "COMPLETED" | "PAUSED">("ACTIVE");
  const [savingGoal, setSavingGoal] = useState(false);

  // Contribution Modal
  const [contributeGoal, setContributeGoal] = useState<SavingsGoal | null>(null);
  const [contribAmount, setContribAmount] = useState("");
  const [contribDate, setContribDate] = useState(getTodayIso());
  const [contribNotes, setContribNotes] = useState("");
  const [submittingContrib, setSubmittingContrib] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getSavingsDashboard({ month, year });
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load savings dashboard.");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openNewGoal = () => {
    setEditingGoal(null);
    setGoalName("");
    setGoalTarget("");
    setGoalInitial("");
    const defaultDate = new Date();
    defaultDate.setMonth(defaultDate.getMonth() + 6);
    setGoalDate(defaultDate.toISOString().split("T")[0]);
    setGoalColor(GOAL_COLORS[0]);
    setGoalNotes("");
    setGoalStatus("ACTIVE");
    setGoalModalOpen(true);
  };

  const openEditGoal = (g: SavingsGoal) => {
    setEditingGoal(g);
    setGoalName(g.name);
    setGoalTarget(String(g.target_amount));
    setGoalInitial(String(g.current_amount));
    setGoalDate(g.target_date);
    setGoalColor(g.color || GOAL_COLORS[0]);
    setGoalNotes(g.notes || "");
    setGoalStatus(g.status);
    setGoalModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetAmt = Number(goalTarget);
    if (!goalName.trim() || !Number.isFinite(targetAmt) || targetAmt <= 0) {
      setError("Enter a valid goal name and positive target amount.");
      return;
    }
    setSavingGoal(true);
    setError("");
    try {
      if (editingGoal) {
        await api.updateSavingsGoal(editingGoal.id, {
          name: goalName.trim(),
          target_amount: targetAmt,
          target_date: goalDate,
          status: goalStatus,
          color: goalColor,
          notes: goalNotes.trim() || undefined,
        });
        setBannerMsg(`Updated goal "${goalName.trim()}".`);
      } else {
        await api.createSavingsGoal({
          name: goalName.trim(),
          target_amount: targetAmt,
          current_amount: Number(goalInitial) || 0,
          target_date: goalDate,
          color: goalColor,
          notes: goalNotes.trim() || undefined,
        });
        setBannerMsg(`Created savings goal "${goalName.trim()}".`);
      }
      setGoalModalOpen(false);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save goal.");
    } finally {
      setSavingGoal(false);
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributeGoal) return;
    const amt = Number(contribAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Please enter a positive contribution amount.");
      return;
    }
    setSubmittingContrib(true);
    setError("");
    try {
      const updated = await api.contributeToGoal(contributeGoal.id, {
        amount: amt,
        contribution_date: contribDate,
        notes: contribNotes.trim() || undefined,
      });
      setBannerMsg(
        updated.status === "COMPLETED"
          ? `Goal "${updated.name}" reached 100% completion!`
          : `Added ${formatCurrency(amt, currencySymbol, currencyCode)} to "${updated.name}".`
      );
      setContributeGoal(null);
      setContribAmount("");
      setContribNotes("");
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record contribution.");
    } finally {
      setSubmittingContrib(false);
    }
  };

  const handleMarkCompleted = async (g: SavingsGoal) => {
    try {
      await api.updateSavingsGoal(g.id, { status: "COMPLETED" });
      setBannerMsg(`Marked "${g.name}" as completed.`);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update goal.");
    }
  };

  const handleDeleteGoal = async (g: SavingsGoal) => {
    if (!window.confirm(`Delete savings goal "${g.name}"?`)) return;
    try {
      await api.deleteSavingsGoal(g.id);
      setBannerMsg(`Deleted goal "${g.name}".`);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete goal.");
    }
  };

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Smart Savings & Goals
            </h1>
            <p className="text-sm text-slate-500">
              Monitor weekly, monthly, and yearly net savings alongside automated goal milestones
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800"
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-800"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              onClick={openNewGoal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-card"
            >
              <Plus className="w-4 h-4" />
              New Savings Goal
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium">
            {error}
          </div>
        )}
        {bannerMsg && (
          <div className="p-3.5 rounded-xl bg-sage-50 border border-sage-200 text-sm text-sage-700 font-medium flex items-center justify-between">
            <span>{bannerMsg}</span>
            <button onClick={() => setBannerMsg("")} className="text-sage-600 hover:text-sage-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading && !data ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 bg-white rounded-2xl border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : (
          data && (
            <>
              {/* 4 Savings Period Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[data.weekly, data.monthly, data.yearly, data.all_time].map((period) => {
                  const positive = period.savings >= 0;
                  return (
                    <div
                      key={period.label}
                      className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {period.label}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                            positive ? "bg-sage-50 text-sage-700" : "bg-rose-50 text-rose-600"
                          }`}
                        >
                          {period.savings_rate.toFixed(1)}% rate
                        </span>
                      </div>
                      <p
                        className={`text-2xl font-bold tabular-nums ${
                          positive ? "text-slate-900" : "text-rose-600"
                        }`}
                      >
                        {formatCurrency(period.savings, currencySymbol, currencyCode)}
                      </p>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 tabular-nums">
                        <span>
                          In: {formatCompactCurrency(period.income, currencySymbol)}
                        </span>
                        <span>
                          Out: {formatCompactCurrency(period.expenses, currencySymbol)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Month Comparison + Monthly History Chart */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-emerald-900 via-sage-700 to-teal-600 text-white rounded-2xl p-6 shadow-soft flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-100 text-xs font-semibold uppercase tracking-wider">
                      <TrendingUp className="w-4 h-4" />
                      Month-over-Month Savings
                    </div>
                    <p className="text-3xl font-bold tabular-nums mt-3">
                      {formatCurrency(data.monthly.savings, currencySymbol, currencyCode)}
                    </p>
                    <p className="text-xs text-emerald-100/90 mt-1">
                      Previous month:{" "}
                      {formatCurrency(data.previous_month_savings, currencySymbol, currencyCode)}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/20 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-emerald-100">Change vs Prior Month</span>
                      <span className="font-bold tabular-nums">
                        {data.savings_change_amount >= 0 ? "+" : ""}
                        {formatCurrency(data.savings_change_amount, currencySymbol, currencyCode)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-100">Goal Funds Allocated</span>
                      <span className="font-bold tabular-nums">
                        {formatCurrency(
                          data.goals_summary.total_saved_in_goals,
                          currencySymbol,
                          currencyCode
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-emerald-100">Overall Goal Progress</span>
                      <span className="font-bold tabular-nums">
                        {data.goals_summary.overall_goal_progress.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Monthly Savings Trend
                      </h3>
                      <p className="text-xs text-slate-500">
                        Income, expenses, and net retained savings over recent months
                      </p>
                    </div>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.monthly_history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} />
                        <YAxis
                          tick={{ fontSize: 11, fill: "#64748B" }}
                          tickFormatter={(v) => formatCompactCurrency(Number(v), currencySymbol)}
                        />
                        <Tooltip
                          formatter={(val: any) =>
                            formatCurrency(Number(val), currencySymbol, currencyCode)
                          }
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="income" name="Income" fill="#10B981" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="expenses" name="Expenses" fill="#F43F5E" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="savings" name="Net Savings" fill="#2563EB" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Savings Goals */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Target className="w-5 h-5 text-brand-600" />
                      Your Savings Goals ({data.goals.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Automatic milestone alerts at 25%, 50%, 75%, and 100% completion
                    </p>
                  </div>
                </div>

                {data.goals.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-3">
                    <PiggyBank className="w-10 h-10 text-brand-500 mx-auto" />
                    <p className="text-base font-bold text-slate-900">No savings goals yet</p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Create targets for your emergency fund, vacation, gadget upgrade, or home
                      down payment and track contributions effortlessly.
                    </p>
                    <button
                      onClick={openNewGoal}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-xs font-semibold hover:bg-brand-700"
                    >
                      <Plus className="w-4 h-4" />
                      Create First Goal
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {data.goals.map((goal) => {
                      const paceBadge =
                        goal.pace_status === "COMPLETED"
                          ? "bg-sage-50 text-sage-700 border-sage-200"
                          : goal.pace_status === "ON_TRACK"
                          ? "bg-brand-50 text-brand-700 border-brand-200"
                          : goal.pace_status === "BEHIND_SCHEDULE"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-rose-50 text-rose-700 border-rose-200";

                      return (
                        <div
                          key={goal.id}
                          className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className="w-11 h-11 rounded-xl flex items-center justify-center text-white shrink-0"
                                style={{ backgroundColor: goal.color || "#2563EB" }}
                              >
                                <Wallet className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="text-base font-bold text-slate-900 truncate">
                                  {goal.name}
                                </h3>
                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Target {formatDisplayDate(goal.target_date)} ·{" "}
                                  {goal.days_remaining > 0
                                    ? `${goal.days_remaining}d left`
                                    : goal.status === "COMPLETED"
                                    ? "Completed"
                                    : "Due date reached"}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${paceBadge}`}
                            >
                              {goal.pace_status.replace("_", " ")}
                            </span>
                          </div>

                          {/* Progress bar + Milestone ticks */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span className="text-slate-700 tabular-nums">
                                {formatCurrency(goal.current_amount, currencySymbol, currencyCode)}{" "}
                                <span className="text-slate-400 font-normal">
                                  of {formatCurrency(goal.target_amount, currencySymbol, currencyCode)}
                                </span>
                              </span>
                              <span className="text-brand-700 font-bold tabular-nums">
                                {goal.completion_percentage.toFixed(1)}%
                              </span>
                            </div>
                            <div className="relative h-2.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(100, goal.completion_percentage)}%`,
                                  backgroundColor: goal.color || "#2563EB",
                                }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-400">
                              <span>Remaining: {formatCurrency(goal.remaining_amount, currencySymbol, currencyCode)}</span>
                              {goal.status !== "COMPLETED" && goal.required_monthly_saving > 0 && (
                                <span>
                                  Need {formatCurrency(goal.required_monthly_saving, currencySymbol, currencyCode)}/mo
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Smart pacing suggestion */}
                          <div className="p-3 rounded-xl bg-ivory border border-slate-100 flex items-start gap-2 text-xs text-slate-600">
                            <Sparkles className="w-3.5 h-3.5 text-brand-600 shrink-0 mt-0.5" />
                            <span>{goal.suggestion}</span>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-2">
                              {goal.status !== "COMPLETED" && (
                                <button
                                  onClick={() => {
                                    setContributeGoal(goal);
                                    setContribAmount("");
                                    setContribDate(getTodayIso());
                                    setContribNotes("");
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Add Money
                                </button>
                              )}
                              {goal.status !== "COMPLETED" && (
                                <button
                                  onClick={() => handleMarkCompleted(goal)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-sage-200 bg-sage-50 text-sage-700 text-xs font-semibold hover:bg-sage-100"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Complete
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditGoal(goal)}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                                title="Edit Goal"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteGoal(goal)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                                title="Delete Goal"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Recent contributions */}
                          {goal.contributions.length > 0 && (
                            <div className="pt-2 border-t border-slate-100 space-y-1.5">
                              <p className="text-[11px] font-semibold text-slate-400 uppercase">
                                Recent Contributions
                              </p>
                              {goal.contributions.slice(0, 3).map((c) => (
                                <div
                                  key={c.id}
                                  className="flex items-center justify-between text-xs text-slate-600"
                                >
                                  <span>
                                    {formatDisplayDate(c.contribution_date)}
                                    {c.notes ? ` · ${c.notes}` : ""}
                                  </span>
                                  <span className="font-semibold text-sage-700 tabular-nums">
                                    +{formatCurrency(c.amount, currencySymbol, currencyCode)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )
        )}
      </div>

      {/* Create / Edit Goal Modal */}
      {goalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingGoal ? "Edit Savings Goal" : "Create Savings Goal"}
              </h3>
              <button
                onClick={() => setGoalModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveGoal} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Goal Name
                </label>
                <input
                  type="text"
                  required
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="Emergency Fund, Laptop, Europe Trip..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Target Amount ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm tabular-nums"
                  />
                </div>
                {!editingGoal ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Initial Saved ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={goalInitial}
                      onChange={(e) => setGoalInitial(e.target.value)}
                      placeholder="0"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm tabular-nums"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Status
                    </label>
                    <select
                      value={goalStatus}
                      onChange={(e) =>
                        setGoalStatus(e.target.value as "ACTIVE" | "COMPLETED" | "PAUSED")
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="PAUSED">PAUSED</option>
                      <option value="COMPLETED">COMPLETED</option>
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Target Date
                </label>
                <input
                  type="date"
                  required
                  value={goalDate}
                  onChange={(e) => setGoalDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Theme Color
                </label>
                <div className="flex items-center gap-2">
                  {GOAL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setGoalColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        goalColor === c ? "border-slate-900 scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={goalNotes}
                  onChange={(e) => setGoalNotes(e.target.value)}
                  placeholder="Monthly SIP or bonus allocation..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGoalModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingGoal}
                  className="px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60"
                >
                  {savingGoal ? "Saving..." : editingGoal ? "Save Changes" : "Create Goal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribute Money Modal */}
      {contributeGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                Contribute to {contributeGoal.name}
              </h3>
              <button
                onClick={() => setContributeGoal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleContribute} className="p-6 space-y-4">
              <div className="p-3 rounded-xl bg-ivory border border-slate-100 text-xs text-slate-600">
                Remaining to target:{" "}
                <span className="font-bold text-slate-900 tabular-nums">
                  {formatCurrency(
                    contributeGoal.remaining_amount,
                    currencySymbol,
                    currencyCode
                  )}
                </span>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                  placeholder="2500"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Contribution Date
                </label>
                <input
                  type="date"
                  required
                  value={contribDate}
                  onChange={(e) => setContribDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  value={contribNotes}
                  onChange={(e) => setContribNotes(e.target.value)}
                  placeholder="Salary transfer"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setContributeGoal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingContrib}
                  className="px-5 py-2 rounded-xl bg-sage-600 text-white text-sm font-semibold hover:bg-sage-700 disabled:opacity-60"
                >
                  {submittingContrib ? "Adding..." : "Add Contribution"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
