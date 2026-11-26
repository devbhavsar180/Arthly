"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Plus,
  Trash2,
  ShieldAlert,
  TrendingUp,
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
import { formatCompactCurrency, formatCurrency, MONTH_NAMES } from "@/lib/format";
import { BudgetHistoryItem, BudgetItem, BudgetPeriodSummary, Category } from "@/types";

export default function BudgetsPage() {
  const { currencySymbol, currencyCode } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [summary, setSummary] = useState<BudgetPeriodSummary | null>(null);
  const [history, setHistory] = useState<BudgetHistoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Form state
  const [selectedCatId, setSelectedCatId] = useState<string>("OVERALL");
  const [limitAmount, setLimitAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [budRes, histRes, catRes] = await Promise.all([
        api.getBudgets({ month, year }),
        api.getBudgetHistory(6),
        api.listCategories("EXPENSE"),
      ]);
      setSummary(budRes);
      setHistory(histRes);
      setCategories(catRes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load budgets.");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(limitAmount);
    if (!Number.isFinite(val) || val <= 0) {
      setError("Please enter a valid positive budget limit.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.upsertBudget({
        category_id: selectedCatId === "OVERALL" ? null : selectedCatId,
        month,
        year,
        limit_amount: val,
      });
      setLimitAmount("");
      setMessage("Monthly budget saved and alert thresholds evaluated.");
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save budget.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPrevious = async () => {
    setError("");
    setMessage("");
    try {
      const res = await api.copyPreviousBudgets(month, year);
      setMessage(`${res.message} (${res.copied} budget(s) copied).`);
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not copy previous budgets.");
    }
  };

  const handleDelete = async (item: BudgetItem) => {
    if (!window.confirm(`Remove budget for ${item.is_overall ? "Overall Monthly Limit" : item.category_name}?`)) {
      return;
    }
    try {
      await api.deleteBudget(item.id);
      setMessage("Budget deleted.");
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete budget.");
    }
  };

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Monthly Budgets & Expense Limits
            </h1>
            <p className="text-sm text-slate-500">
              Set overall and category spending limits with automatic 80%, 90%, 100% & exceeded alerts
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
              onClick={handleCopyPrevious}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-card"
            >
              <Copy className="w-3.5 h-3.5 text-brand-600" />
              Copy Last Month
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
          {/* Set / Update Budget Form */}
          <form
            onSubmit={handleSaveBudget}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-brand-600" />
              <h2 className="text-base font-bold text-slate-900">
                Set Monthly Limit ({MONTH_NAMES[month - 1]})
              </h2>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Budget Scope
              </label>
              <select
                value={selectedCatId}
                onChange={(e) => setSelectedCatId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-ivory text-sm font-medium text-slate-800"
              >
                <option value="OVERALL">Overall Monthly Budget (All Expenses)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Monthly Limit ({currencySymbol})
              </label>
              <input
                type="number"
                required
                min="1"
                step="0.01"
                value={limitAmount}
                onChange={(e) => setLimitAmount(e.target.value)}
                placeholder="15000"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-ivory text-sm tabular-nums"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              {saving ? "Saving..." : "Save Monthly Budget"}
            </button>

            <div className="p-3 rounded-xl bg-ivory border border-slate-100 text-[11px] text-slate-500 space-y-1">
              <p className="font-semibold text-slate-700">Automatic Deduplicated Alerts</p>
              <p>
                Arthly alerts you once per threshold per month when spending crosses 80%, 90%,
                100%, or exceeds your budget.
              </p>
            </div>
          </form>

          {/* Active Budgets Summary */}
          <div className="lg:col-span-2 space-y-5">
            {loading && !summary ? (
              <div className="h-52 bg-white rounded-2xl border border-slate-200 animate-pulse" />
            ) : (
              summary && (
                <>
                  {/* Overall Monthly Budget Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Overall Monthly Budget
                        </p>
                        <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                          {summary.month_label}
                        </h3>
                      </div>
                      <span className="text-xs font-semibold text-slate-500 tabular-nums">
                        Total Spent:{" "}
                        <strong className="text-slate-900">
                          {formatCurrency(
                            summary.total_monthly_expenses,
                            currencySymbol,
                            currencyCode
                          )}
                        </strong>
                      </span>
                    </div>

                    {summary.overall_budget ? (
                      <BudgetCardRow
                        item={summary.overall_budget}
                        currencySymbol={currencySymbol}
                        currencyCode={currencyCode}
                        onEdit={() => {
                          setSelectedCatId("OVERALL");
                          setLimitAmount(String(summary.overall_budget!.limit_amount));
                        }}
                        onDelete={() => handleDelete(summary.overall_budget!)}
                      />
                    ) : (
                      <div className="p-4 rounded-xl bg-ivory border border-dashed border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                        <span>No overall monthly cap configured for {summary.month_label}.</span>
                        <button
                          onClick={() => {
                            setSelectedCatId("OVERALL");
                            setLimitAmount("25000");
                          }}
                          className="font-semibold text-brand-600 hover:text-brand-700"
                        >
                          Quick Fill ₹25,000 →
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Category Budgets */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Category Budgets ({summary.total_budgeted_categories})
                        </h3>
                        <p className="text-xs text-slate-500">
                          {summary.alerts_triggered_count} budget alert(s) triggered this month
                        </p>
                      </div>
                    </div>

                    {summary.category_budgets.length === 0 ? (
                      <p className="text-sm text-slate-400 py-6 text-center">
                        No category limits set for this month yet. Select a category on the left to
                        create one.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {summary.category_budgets.map((b) => (
                          <BudgetCardRow
                            key={b.id}
                            item={b}
                            currencySymbol={currencySymbol}
                            currencyCode={currencyCode}
                            onEdit={() => {
                              setSelectedCatId(b.category_id || "OVERALL");
                              setLimitAmount(String(b.limit_amount));
                            }}
                            onDelete={() => handleDelete(b)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )
            )}
          </div>
        </div>

        {/* Historical Budget Performance */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-brand-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  6-Month Budget vs Actual Spending
                </h3>
                <p className="text-xs text-slate-500">
                  Compare historical monthly caps against actual recorded expenses
                </p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={history}>
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
                  <Bar
                    dataKey="overall_limit"
                    name="Budget Limit"
                    fill="#94A3B8"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="total_spent"
                    name="Actual Spent"
                    fill="#2563EB"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function BudgetCardRow({
  item,
  currencySymbol,
  currencyCode,
  onEdit,
  onDelete,
}: {
  item: BudgetItem;
  currencySymbol: string;
  currencyCode: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusStyles = {
    OK: { bar: "bg-sage-500", badge: "bg-sage-50 text-sage-700", label: "On Track" },
    WARNING_80: { bar: "bg-amber-500", badge: "bg-amber-50 text-amber-700", label: "80% Reached" },
    WARNING_90: { bar: "bg-orange-500", badge: "bg-orange-50 text-orange-700", label: "90% Reached" },
    REACHED_100: { bar: "bg-rose-500", badge: "bg-rose-50 text-rose-700", label: "100% Limit" },
    EXCEEDED: { bar: "bg-rose-600", badge: "bg-rose-100 text-rose-800", label: "Exceeded" },
  }[item.alert_status];

  return (
    <div className="p-4 rounded-xl bg-ivory border border-slate-200/70 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: item.category_color || "#2563EB" }}
          />
          <span className="text-sm font-bold text-slate-900">
            {item.is_overall ? "Overall Monthly Budget" : item.category_name}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusStyles.badge}`}
          >
            {item.alert_status === "OK" ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : item.alert_status === "EXCEEDED" ? (
              <ShieldAlert className="w-3 h-3" />
            ) : (
              <AlertTriangle className="w-3 h-3" />
            )}
            {statusStyles.label} ({item.utilization_percentage.toFixed(1)}%)
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={onEdit}
            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
            title="Remove Budget"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${statusStyles.bar}`}
          style={{ width: `${Math.min(100, item.utilization_percentage)}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 tabular-nums gap-2">
        <span>
          Spent: <strong>{formatCurrency(item.spent_amount, currencySymbol, currencyCode)}</strong> of{" "}
          {formatCurrency(item.limit_amount, currencySymbol, currencyCode)}
        </span>
        <span className={item.remaining_amount < 0 ? "text-rose-600 font-bold" : "text-slate-600"}>
          {item.remaining_amount < 0
            ? `Over by ${formatCurrency(Math.abs(item.remaining_amount), currencySymbol, currencyCode)}`
            : `${formatCurrency(item.remaining_amount, currencySymbol, currencyCode)} remaining`}
        </span>
      </div>
    </div>
  );
}
