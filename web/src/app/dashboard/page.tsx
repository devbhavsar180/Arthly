"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  CalendarDays,
  History,
  Plus,
  Filter,
  RotateCcw,
  ArrowUpRight,
  ArrowDownRight,
  ScanLine,
  Mic,
  Gauge,
  AlertTriangle,
  Sparkles,
  Target,
  ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDisplayDate, MONTH_NAMES } from "@/lib/format";
import {
  BudgetPeriodSummary,
  Category,
  DashboardResponse,
  SavingsDashboardResponse,
} from "@/types";

export default function DashboardPage() {
  const { user, currencySymbol, currencyCode } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year, setYear] = useState<number>(now.getFullYear());
  const [categoryId, setCategoryId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [budgets, setBudgets] = useState<BudgetPeriodSummary | null>(null);
  const [savings, setSavings] = useState<SavingsDashboardResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashRes, catsRes, budRes, savRes] = await Promise.allSettled([
        api.getDashboard({
          month,
          year,
          category_id: categoryId || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        }),
        api.listCategories(),
        api.getBudgets({ month, year }),
        api.getSavingsDashboard({ month, year }),
      ]);

      if (dashRes.status === "fulfilled") {
        setData(dashRes.value);
      } else {
        const err = dashRes.reason;
        setError(err instanceof ApiError ? err.message : "Failed to load dashboard.");
      }
      if (catsRes.status === "fulfilled") setCategories(catsRes.value);
      if (budRes.status === "fulfilled") setBudgets(budRes.value);
      if (savRes.status === "fulfilled") setSavings(savRes.value);
    } finally {
      setLoading(false);
    }
  }, [month, year, categoryId, startDate, endDate]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const handleResetFilters = () => {
    setMonth(now.getMonth() + 1);
    setYear(now.getFullYear());
    setCategoryId("");
    setStartDate("");
    setEndDate("");
  };

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i);
  const firstName = user?.full_name?.split(" ")[0] || "there";

  const warningBudgets = [
    ...(budgets?.overall_budget && budgets.overall_budget.alert_status !== "OK"
      ? [budgets.overall_budget]
      : []),
    ...(budgets?.category_budgets.filter((b) => b.alert_status !== "OK") || []),
  ];

  const activeGoals = (savings?.goals || []).filter((g) => g.status === "ACTIVE").slice(0, 3);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[11px] font-semibold mb-1.5">
              <Sparkles className="w-3 h-3" />
              Arthly Financial Overview
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Welcome back, {firstName}
            </h1>
            <p className="text-sm text-slate-500">
              Cash flow, savings goals, and spending limits for {MONTH_NAMES[month - 1]} {year}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/screenshot-scan"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-card"
            >
              <ScanLine className="w-4 h-4 text-brand-600" />
              Scan Screenshot
            </Link>
            <Link
              href="/voice-entry"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-card"
            >
              <Mic className="w-4 h-4 text-indigo-600" />
              Voice Entry
            </Link>
            <Link
              href="/add-expense"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-all shadow-card"
            >
              <Plus className="w-4 h-4" />
              Add Expense
            </Link>
            <Link
              href="/add-income"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-xs font-semibold transition-all shadow-card"
            >
              <Plus className="w-4 h-4" />
              Add Income
            </Link>
          </div>
        </div>

        {/* Budget Alert Strip */}
        {warningBudgets.length > 0 && (
          <div className="rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 border border-amber-200/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {warningBudgets.length} Budget Limit Alert{warningBudgets.length > 1 ? "s" : ""} Active
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  {warningBudgets
                    .slice(0, 3)
                    .map(
                      (b) =>
                        `${b.is_overall ? "Overall" : b.category_name} (${b.utilization_percentage.toFixed(0)}%)`
                    )
                    .join(" · ")}
                </p>
              </div>
            </div>
            <Link
              href="/budgets"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-amber-200 text-xs font-semibold text-amber-800 hover:bg-amber-50 shrink-0"
            >
              Review Budgets
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mr-2 pb-2">
              <Filter className="w-4 h-4 text-brand-600" />
              Filters
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Month
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-ivory text-sm text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-ivory text-sm text-slate-800"
              />
            </div>
            <button
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-28 bg-white rounded-2xl border border-slate-200/80 animate-pulse"
              />
            ))}
          </div>
        ) : (
          data && (
            <>
              {/* Hero Cashflow Card + 6 Summary Cards */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-brand-900 to-brand-700 text-white p-6 shadow-soft flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                        All-Time Net Balance
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-semibold">
                        {currencyCode}
                      </span>
                    </div>
                    <p className="text-3xl font-bold tabular-nums mt-2">
                      {formatCurrency(data.cards.remaining_balance, currencySymbol, currencyCode)}
                    </p>
                    <p className="text-xs text-blue-100/80 mt-1">
                      Net cumulative cash position across recorded accounts
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-white/15">
                    <div>
                      <p className="text-[11px] text-blue-200">Monthly Savings</p>
                      <p className="text-base font-bold tabular-nums mt-0.5">
                        {formatCurrency(
                          data.monthly_summary.total_savings,
                          currencySymbol,
                          currencyCode
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-blue-200">Savings Rate</p>
                      <p className="text-base font-bold tabular-nums mt-0.5">
                        {savings?.monthly
                          ? `${savings.monthly.savings_rate.toFixed(1)}%`
                          : "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <KpiCard
                    title="Total Income"
                    value={formatCurrency(data.cards.total_income, currencySymbol, currencyCode)}
                    subtitle="Cumulative inflows"
                    icon={<TrendingUp className="w-5 h-5" />}
                    tone="emerald"
                  />
                  <KpiCard
                    title="Total Expenses"
                    value={formatCurrency(data.cards.total_expenses, currencySymbol, currencyCode)}
                    subtitle="Cumulative outflows"
                    icon={<TrendingDown className="w-5 h-5" />}
                    tone="rose"
                  />
                  <KpiCard
                    title="Total Savings"
                    value={formatCurrency(data.cards.total_savings, currencySymbol, currencyCode)}
                    subtitle="All-time net retained"
                    icon={<PiggyBank className="w-5 h-5" />}
                    tone="blue"
                  />
                  <KpiCard
                    title="This Month Expenses"
                    value={formatCurrency(
                      data.cards.this_month_expenses,
                      currencySymbol,
                      currencyCode
                    )}
                    subtitle={data.monthly_summary.month_label}
                    icon={<CalendarDays className="w-5 h-5" />}
                    tone="amber"
                  />
                  <KpiCard
                    title="Previous Month"
                    value={formatCurrency(
                      data.cards.previous_month_expenses,
                      currencySymbol,
                      currencyCode
                    )}
                    subtitle="Prior month expenses"
                    icon={<History className="w-5 h-5" />}
                    tone="slate"
                  />
                  <KpiCard
                    title="Monthly Budget"
                    value={
                      budgets?.overall_budget
                        ? `${budgets.overall_budget.utilization_percentage.toFixed(0)}% used`
                        : "Not Set"
                    }
                    subtitle={
                      budgets?.overall_budget
                        ? `${formatCurrency(budgets.overall_budget.remaining_amount, currencySymbol, currencyCode)} left`
                        : "Configure monthly limit"
                    }
                    icon={<Gauge className="w-5 h-5" />}
                    tone={
                      budgets?.overall_budget &&
                      (budgets.overall_budget.alert_status === "EXCEEDED" ||
                        budgets.overall_budget.alert_status === "REACHED_100")
                        ? "rose"
                        : "indigo"
                    }
                  />
                </div>
              </div>

              {/* Monthly Financial Summary Box */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Monthly Financial Summary — {data.monthly_summary.month_label}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Snapshot of income, expenses, savings, and peak spending for the selected month
                    </p>
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold">
                    {data.monthly_summary.transaction_count} transactions
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="p-4 rounded-xl bg-ivory border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Cash Flow
                    </p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Monthly Income</span>
                        <span className="font-bold text-sage-700 tabular-nums">
                          {formatCurrency(
                            data.monthly_summary.total_monthly_income,
                            currencySymbol,
                            currencyCode
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Monthly Expenses</span>
                        <span className="font-bold text-rose-600 tabular-nums">
                          {formatCurrency(
                            data.monthly_summary.total_monthly_expenses,
                            currencySymbol,
                            currencyCode
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-200/60">
                        <span className="font-semibold text-slate-800">Net Savings</span>
                        <span className="font-bold text-slate-900 tabular-nums">
                          {formatCurrency(
                            data.monthly_summary.total_savings,
                            currencySymbol,
                            currencyCode
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-ivory border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Peak Category & Daily Pace
                    </p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Highest Category</span>
                        <span className="font-semibold text-slate-900">
                          {data.monthly_summary.highest_expense_category || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Category Spend</span>
                        <span className="font-bold text-slate-900 tabular-nums">
                          {formatCurrency(
                            data.monthly_summary.highest_expense_category_amount,
                            currencySymbol,
                            currencyCode
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-200/60">
                        <span className="text-slate-600">Avg. Daily Spend</span>
                        <span className="font-bold text-brand-700 tabular-nums">
                          {formatCurrency(
                            data.monthly_summary.average_daily_expense,
                            currencySymbol,
                            currencyCode
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-ivory border border-slate-100">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Highest Single Expense
                    </p>
                    {data.monthly_summary.highest_single_transaction ? (
                      <div className="mt-3 space-y-1.5">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {data.monthly_summary.highest_single_transaction.title}
                        </p>
                        <p className="text-xl font-bold text-rose-600 tabular-nums">
                          {formatCurrency(
                            data.monthly_summary.highest_single_transaction.amount,
                            currencySymbol,
                            currencyCode
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {data.monthly_summary.highest_single_transaction.category_name} ·{" "}
                          {formatDisplayDate(
                            data.monthly_summary.highest_single_transaction.transaction_date
                          )}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-400">No expenses recorded this month.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Savings Goals Highlight */}
              {activeGoals.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-brand-600" />
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Active Savings Goals</h3>
                        <p className="text-xs text-slate-500">
                          Track milestones and stay on pace for your targets
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/savings"
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                    >
                      Manage Goals →
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {activeGoals.map((g) => (
                      <div
                        key={g.id}
                        className="p-4 rounded-xl bg-ivory border border-slate-200/70 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900 truncate">
                            {g.name}
                          </span>
                          <span className="text-xs font-bold text-brand-700 tabular-nums">
                            {g.completion_percentage.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, g.completion_percentage)}%`,
                              backgroundColor: g.color || "#2563EB",
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500 tabular-nums">
                          <span>
                            {formatCurrency(g.current_amount, currencySymbol, currencyCode)} saved
                          </span>
                          <span>
                            Goal: {formatCurrency(g.target_amount, currencySymbol, currencyCode)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Charts */}
              <DashboardCharts
                expenseBreakdown={data.expense_breakdown}
                monthlyTrend={data.monthly_trend}
                incomeVsExpense={data.income_vs_expense}
                categoryAnalysis={data.category_analysis}
                dailyExpenseTrend={data.daily_expense_trend}
                currencySymbol={currencySymbol}
                currencyCode={currencyCode}
              />

              {/* Recent Transactions */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Recent Transactions</h3>
                    <p className="text-xs text-slate-500">Latest activity matching active filters</p>
                  </div>
                  <Link
                    href="/transactions"
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    View all →
                  </Link>
                </div>

                {data.recent_transactions.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-400">
                    No transactions found for the current filters.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {data.recent_transactions.map((t) => {
                      const isIncome = t.transaction_type === "INCOME";
                      return (
                        <div
                          key={t.id}
                          className="py-3.5 flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                              style={{
                                backgroundColor: `${t.category_color}18`,
                                color: t.category_color,
                              }}
                            >
                              {isIncome ? (
                                <ArrowUpRight className="w-4 h-4" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {t.title}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>{t.category_name}</span>
                                {t.payment_mode && (
                                  <>
                                    <span>·</span>
                                    <span>{t.payment_mode}</span>
                                  </>
                                )}
                                <span>·</span>
                                <span>{formatDisplayDate(t.transaction_date)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p
                              className={`text-sm font-bold tabular-nums ${
                                isIncome ? "text-sage-600" : "text-slate-900"
                              }`}
                            >
                              {isIncome ? "+" : "-"}
                              {formatCurrency(t.amount, currencySymbol, currencyCode)}
                            </p>
                            <span
                              className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                isIncome
                                  ? "bg-sage-50 text-sage-700"
                                  : "bg-rose-50 text-rose-600"
                              }`}
                            >
                              {t.transaction_type}
                            </span>
                          </div>
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
    </AppShell>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  tone,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  tone: "emerald" | "rose" | "blue" | "amber" | "slate" | "indigo";
}) {
  const toneClasses = {
    emerald: "bg-sage-50 text-sage-700",
    rose: "bg-rose-50 text-rose-600",
    blue: "bg-brand-50 text-brand-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700",
    indigo: "bg-indigo-50 text-indigo-700",
  }[tone];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{title}</p>
          <p className="text-xl font-bold text-slate-900 tabular-nums mt-1.5 truncate">
            {value}
          </p>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${toneClasses}`}>
          {icon}
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mt-3 truncate">{subtitle}</p>
    </div>
  );
}
