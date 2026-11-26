"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  FileText,
  FileSpreadsheet,
  FileDown,
  Filter,
  RotateCcw,
  Download,
  TrendingUp,
  Target,
  BarChart3,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
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
  MONTH_NAMES,
  PAYMENT_MODES,
} from "@/lib/format";
import { Category, EnhancedAnalyticsResponse } from "@/types";

export default function ReportsPage() {
  const { currencySymbol, currencyCode } = useAuth();
  const now = new Date();

  const [month, setMonth] = useState<string>(String(now.getMonth() + 1));
  const [year, setYear] = useState<string>(String(now.getFullYear()));
  const [categoryId, setCategoryId] = useState<string>("");
  const [paymentMode, setPaymentMode] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);

  const [analytics, setAnalytics] = useState<EnhancedAnalyticsResponse | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api.listCategories().then(setCategories).catch(() => {});
  }, []);

  const loadAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await api.getEnhancedAnalytics({
        month: month ? Number(month) : undefined,
        year: year ? Number(year) : undefined,
      });
      setAnalytics(res);
    } catch {
      // keep exports usable even if analytics query returns empty
    } finally {
      setLoadingAnalytics(false);
    }
  }, [month, year]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const handleDownload = async (
    type: "pdf/summary" | "pdf/expense" | "pdf/income" | "excel" | "csv",
    label: string
  ) => {
    setDownloading(type);
    setError("");
    setSuccess("");
    try {
      await api.downloadReport(type, {
        month: month ? Number(month) : undefined,
        year: year ? Number(year) : undefined,
        category_id: categoryId || undefined,
        payment_mode: paymentMode || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setSuccess(`Downloaded ${label} successfully.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to download ${label}.`);
    } finally {
      setDownloading(null);
    }
  };

  const resetFilters = () => {
    setMonth(String(now.getMonth() + 1));
    setYear(String(now.getFullYear()));
    setCategoryId("");
    setPaymentMode("");
    setStartDate("");
    setEndDate("");
  };

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i);

  const reportCards: {
    type: "pdf/summary" | "pdf/expense" | "pdf/income" | "excel" | "csv";
    title: string;
    description: string;
    formatLabel: string;
    icon: React.ReactNode;
    accent: string;
  }[] = [
    {
      type: "pdf/summary",
      title: "Monthly Financial Summary PDF",
      description:
        "Executive breakdown with income, expenses, net savings, top category, and recent ledger.",
      formatLabel: "PDF Document",
      icon: <FileText className="w-5 h-5" />,
      accent: "bg-brand-50 text-brand-700",
    },
    {
      type: "pdf/expense",
      title: "Expense Report PDF",
      description:
        "Detailed list of all expense entries matching your selected date, category, and payment mode.",
      formatLabel: "PDF Document",
      icon: <FileText className="w-5 h-5" />,
      accent: "bg-rose-50 text-rose-600",
    },
    {
      type: "pdf/income",
      title: "Income Report PDF",
      description:
        "Complete inflow record across salary, freelance, refunds, and passive income.",
      formatLabel: "PDF Document",
      icon: <FileText className="w-5 h-5" />,
      accent: "bg-sage-50 text-sage-700",
    },
    {
      type: "excel",
      title: "Full Workbook Export (.xlsx)",
      description:
        "Formatted Excel workbook with transaction rows, summaries, and category totals.",
      formatLabel: "Excel Spreadsheet",
      icon: <FileSpreadsheet className="w-5 h-5" />,
      accent: "bg-emerald-50 text-emerald-700",
    },
    {
      type: "csv",
      title: "Raw Data Export (.csv)",
      description:
        "Clean UTF-8 comma-separated ledger compatible with Google Sheets, Tally, or tax tools.",
      formatLabel: "CSV Data",
      icon: <FileDown className="w-5 h-5" />,
      accent: "bg-slate-100 text-slate-700",
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Financial Analytics & Reports
          </h1>
          <p className="text-sm text-slate-500">
            Explore weekly spending, budget vs actual trends, savings growth, and export statements
          </p>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mr-2 pb-2">
              <Filter className="w-4 h-4 text-brand-600" />
              Report Scope
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-sm font-medium text-slate-800"
              >
                <option value="">All Months</option>
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Year</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-sm font-medium text-slate-800"
              >
                <option value="">All Years</option>
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
                className="px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-sm font-medium text-slate-800"
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
                Payment Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-sm font-medium text-slate-800"
              >
                <option value="">All Modes</option>
                {PAYMENT_MODES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-ivory text-sm text-slate-800"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-ivory text-sm text-slate-800"
              />
            </div>
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>

        {/* Analytics Section */}
        {!loadingAnalytics && analytics && (
          <div className="space-y-6">
            {/* Yearly Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
                <p className="text-xs font-semibold text-slate-500">
                  {analytics.year} Yearly Income
                </p>
                <p className="text-xl font-bold text-sage-700 tabular-nums mt-1">
                  {formatCurrency(analytics.yearly_income, currencySymbol, currencyCode)}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
                <p className="text-xs font-semibold text-slate-500">
                  {analytics.year} Yearly Expenses
                </p>
                <p className="text-xl font-bold text-rose-600 tabular-nums mt-1">
                  {formatCurrency(analytics.yearly_expenses, currencySymbol, currencyCode)}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
                <p className="text-xs font-semibold text-slate-500">
                  {analytics.year} Yearly Net Savings
                </p>
                <p className="text-xl font-bold text-brand-700 tabular-nums mt-1">
                  {formatCurrency(analytics.yearly_savings, currencySymbol, currencyCode)}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
                <p className="text-xs font-semibold text-slate-500">Yearly Savings Rate</p>
                <p className="text-xl font-bold text-slate-900 tabular-nums mt-1">
                  {analytics.yearly_savings_rate.toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-brand-600" />
                  <h3 className="text-base font-bold text-slate-900">Weekly Spending Analysis</h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.weekly_analysis}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="week_label" tick={{ fontSize: 11, fill: "#64748B" }} />
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
                      <Bar dataKey="income" name="Income" fill="#10B981" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#F43F5E" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-sage-600" />
                  <h3 className="text-base font-bold text-slate-900">Monthly Savings Trend</h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.monthly_savings_trend}>
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
                      <Area
                        type="monotone"
                        dataKey="savings"
                        name="Net Savings"
                        stroke="#2563EB"
                        fill="#DBEAFE"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Budget vs Actual & Top Categories & Goals Progress */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
                <h3 className="text-base font-bold text-slate-900 mb-4">
                  Budget vs Actual Comparison
                </h3>
                {analytics.budget_vs_actual.length === 0 ? (
                  <p className="text-xs text-slate-400 py-8 text-center">
                    No category budgets configured for this period.
                  </p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.budget_vs_actual}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="category_name" tick={{ fontSize: 11, fill: "#64748B" }} />
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
                        <Bar
                          dataKey="budget_limit"
                          name="Budget Limit"
                          fill="#94A3B8"
                          radius={[5, 5, 0, 0]}
                        />
                        <Bar
                          dataKey="actual_spent"
                          name="Actual Spent"
                          fill="#2563EB"
                          radius={[5, 5, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 space-y-5">
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-3">
                    Top Spending Categories
                  </h3>
                  {analytics.top_spending_categories.length === 0 ? (
                    <p className="text-xs text-slate-400">No expenses logged for this period.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {analytics.top_spending_categories.slice(0, 5).map((cat) => (
                        <div key={cat.category_name} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="font-semibold text-slate-800">
                              {cat.category_name} ({cat.count})
                            </span>
                            <span className="font-bold text-slate-900 tabular-nums">
                              {formatCurrency(cat.amount, currencySymbol, currencyCode)} (
                              {cat.percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, cat.percentage)}%`,
                                backgroundColor: cat.color || "#2563EB",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {analytics.goals_progress.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-brand-600" />
                      Goals Progress
                    </h4>
                    <div className="space-y-2">
                      {analytics.goals_progress.slice(0, 4).map((g) => (
                        <div key={g.id} className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700 truncate pr-2">{g.name}</span>
                          <span className="font-bold text-brand-700 tabular-nums shrink-0">
                            {g.percentage.toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3.5 rounded-xl bg-sage-50 border border-sage-200 text-sm text-sage-700 font-medium">
            {success}
          </div>
        )}

        {/* Export Download Cards */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-3">Download Statements & Exports</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportCards.map((card) => (
              <div
                key={card.type}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.accent}`}
                    >
                      {card.icon}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500 bg-ivory px-2.5 py-1 rounded-full border border-slate-200/70">
                      {card.formatLabel}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{card.title}</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDownload(card.type, card.title)}
                  disabled={downloading !== null}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-brand-600 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloading === card.type ? "Generating..." : "Download"}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
