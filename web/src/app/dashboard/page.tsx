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
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardCharts } from "@/components/dashboard/DashboardCharts";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDisplayDate, MONTH_NAMES } from "@/lib/format";
import { Category, DashboardResponse } from "@/types";

export default function DashboardPage() {
  const { currencySymbol, currencyCode } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [categoryId, setCategoryId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fmt = (val: number) => formatCurrency(val, currencySymbol, currencyCode);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dash, cats] = await Promise.all([
        api.getDashboard({
          month,
          year,
          category_id: categoryId || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
        }),
        api.listCategories(),
      ]);
      setData(dash);
      setCategories(cats);
    } catch {
      setError("Failed to load dashboard data. Please ensure the backend API is running.");
    } finally {
      setLoading(false);
    }
  }, [month, year, categoryId, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const goPrevMonth = () => {
    setStartDate("");
    setEndDate("");
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    setStartDate("");
    setEndDate("");
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const resetFilters = () => {
    const today = new Date();
    setMonth(today.getMonth() + 1);
    setYear(today.getFullYear());
    setCategoryId("");
    setStartDate("");
    setEndDate("");
  };

  const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 4 + i);

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Header + Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Dashboard</h1>
            <p className="text-sm text-slate-500">
              Overview of your daily expenses, manual income, and savings
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Sync
            </button>
            <Link
              href="/add-income"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              Add Income
            </Link>
            <Link
              href="/add-expense"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              Add Expense
            </Link>
          </div>
        </div>

        {/* Month Switcher & Filters Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goPrevMonth}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={month}
              onChange={(e) => {
                setStartDate("");
                setEndDate("");
                setMonth(Number(e.target.value));
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand-500"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={name} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => {
                setStartDate("");
                setEndDate("");
                setYear(Number(e.target.value));
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-xs font-semibold text-slate-800 focus:outline-none focus:border-brand-500"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              onClick={goNextMonth}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              Filters:
            </div>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-xs font-medium text-slate-700 focus:outline-none focus:border-brand-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type === "INCOME" ? "Income" : "Expense"})
                </option>
              ))}
            </select>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Start Date"
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-ivory text-xs text-slate-700 focus:outline-none focus:border-brand-500"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="End Date"
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-ivory text-xs text-slate-700 focus:outline-none focus:border-brand-500"
            />
            {(categoryId || startDate || endDate) && (
              <button
                onClick={resetFilters}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-brand-600 hover:bg-brand-50"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium">
            {error}
          </div>
        )}

        {/* 6 Dashboard KPI Cards */}
        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <KpiCard
                title="Total Income"
                value={fmt(data.cards.total_income)}
                subtitle="Manually entered income"
                icon={<TrendingUp className="w-5 h-5 text-sage-600" />}
                iconBg="bg-sage-50"
                valueColor="text-sage-700"
              />
              <KpiCard
                title="Total Expenses"
                value={fmt(data.cards.total_expenses)}
                subtitle="Recorded spending in period"
                icon={<TrendingDown className="w-5 h-5 text-rose-600" />}
                iconBg="bg-rose-50"
                valueColor="text-slate-900"
              />
              <KpiCard
                title="Remaining Balance"
                value={fmt(data.cards.remaining_balance)}
                subtitle="Total Income − Total Expenses"
                icon={<Wallet className="w-5 h-5 text-brand-600" />}
                iconBg="bg-brand-50"
                valueColor={data.cards.remaining_balance >= 0 ? "text-brand-700" : "text-rose-600"}
              />
              <KpiCard
                title="Total Savings"
                value={fmt(data.cards.total_savings)}
                subtitle={
                  data.cards.total_income > 0
                    ? `${Math.round((data.cards.total_savings / data.cards.total_income) * 100)}% savings rate`
                    : "Add income to track savings rate"
                }
                icon={<PiggyBank className="w-5 h-5 text-emerald-600" />}
                iconBg="bg-emerald-50"
                valueColor={data.cards.total_savings >= 0 ? "text-emerald-700" : "text-rose-600"}
              />
              <KpiCard
                title="This Month's Expenses"
                value={fmt(data.cards.this_month_expenses)}
                subtitle={data.monthly_summary.month_label}
                icon={<CalendarDays className="w-5 h-5 text-indigo-600" />}
                iconBg="bg-indigo-50"
                valueColor="text-slate-900"
              />
              <KpiCard
                title="Previous Month's Expenses"
                value={fmt(data.cards.previous_month_expenses)}
                subtitle={
                  data.cards.previous_month_expenses > 0
                    ? `${(((data.cards.this_month_expenses - data.cards.previous_month_expenses) / data.cards.previous_month_expenses) * 100).toFixed(1)}% vs prior month`
                    : "Baseline month"
                }
                icon={<History className="w-5 h-5 text-slate-600" />}
                iconBg="bg-slate-100"
                valueColor="text-slate-700"
              />
            </div>

            {/* Monthly Financial Summary Insights */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Monthly Financial Summary — {data.monthly_summary.month_label}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Automatic metrics across {data.monthly_summary.transaction_count} transactions
                  </p>
                </div>
                <Link
                  href="/reports"
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  Download Monthly Report →
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-ivory border border-slate-200/70">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Highest Expense Category
                  </p>
                  <p className="text-lg font-bold text-slate-900 mt-1">
                    {data.monthly_summary.highest_expense_category || "None yet"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {data.monthly_summary.highest_expense_category
                      ? fmt(data.monthly_summary.highest_expense_category_amount)
                      : "Add expenses to see top category"}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-ivory border border-slate-200/70">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Highest Single Transaction
                  </p>
                  <p className="text-lg font-bold text-slate-900 mt-1 truncate">
                    {data.monthly_summary.highest_single_transaction
                      ? fmt(data.monthly_summary.highest_single_transaction.amount)
                      : fmt(0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {data.monthly_summary.highest_single_transaction
                      ? `${data.monthly_summary.highest_single_transaction.title} • ${data.monthly_summary.highest_single_transaction.category_name}`
                      : "No expense recorded this month"}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-ivory border border-slate-200/70">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Average Daily Expense
                  </p>
                  <p className="text-lg font-bold text-slate-900 mt-1">
                    {fmt(data.monthly_summary.average_daily_expense)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Per day across {data.monthly_summary.month_label}</p>
                </div>
              </div>
            </div>

            {/* All 5 Interactive Charts */}
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
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Recent Transactions</h3>
                  <p className="text-xs text-slate-500">Latest expenses and income entries</p>
                </div>
                <Link
                  href="/transactions"
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  View All →
                </Link>
              </div>
              {data.recent_transactions.length === 0 ? (
                <div className="py-10 text-center rounded-xl bg-ivory border border-dashed border-slate-200">
                  <p className="text-sm font-medium text-slate-500">No transactions yet.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Start by adding a daily expense or your monthly salary.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.recent_transactions.map((tx) => {
                    const isIncome = tx.transaction_type === "INCOME";
                    return (
                      <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${tx.category_color}18`, color: tx.category_color }}
                          >
                            {isIncome ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{tx.title}</p>
                            <p className="text-xs text-slate-500 truncate">
                              {tx.category_name}
                              {tx.payment_mode ? ` • ${tx.payment_mode}` : ""} •{" "}
                              {formatDisplayDate(tx.transaction_date)}
                            </p>
                          </div>
                        </div>
                        <p
                          className={`text-sm font-bold shrink-0 ${
                            isIncome ? "text-sage-600" : "text-slate-900"
                          }`}
                        >
                          {isIncome ? "+" : "-"}
                          {fmt(tx.amount)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
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
  iconBg,
  valueColor,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  valueColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{title}</p>
        <p className={`text-2xl font-bold mt-1.5 tracking-tight truncate ${valueColor}`}>{value}</p>
        <p className="text-[11px] text-slate-400 mt-1 truncate">{subtitle}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
    </div>
  );
}
