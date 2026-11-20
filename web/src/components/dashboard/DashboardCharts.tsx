"use client";

import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from "recharts";
import {
  CategoryBreakdownItem,
  DailyTrendItem,
  MonthlyTrendItem,
} from "@/types";
import { formatCompactCurrency, formatCurrency } from "@/lib/format";

interface DashboardChartsProps {
  expenseBreakdown: CategoryBreakdownItem[];
  monthlyTrend: MonthlyTrendItem[];
  incomeVsExpense: MonthlyTrendItem[];
  categoryAnalysis: CategoryBreakdownItem[];
  dailyExpenseTrend: DailyTrendItem[];
  currencySymbol: string;
  currencyCode: string;
}

export function DashboardCharts({
  expenseBreakdown,
  monthlyTrend,
  incomeVsExpense,
  categoryAnalysis,
  dailyExpenseTrend,
  currencySymbol,
  currencyCode,
}: DashboardChartsProps) {
  const fmt = (v: number) => formatCurrency(v, currencySymbol, currencyCode);
  const fmtShort = (v: number) => formatCompactCurrency(v, currencySymbol);

  return (
    <div className="space-y-6">
      {/* Row 1: Expense Breakdown Donut + Monthly Expense Trend Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900">Expense Breakdown</h3>
            <p className="text-xs text-slate-500">Share of spending by category</p>
          </div>
          {expenseBreakdown.length === 0 ? (
            <EmptyChart message="No expenses recorded for the selected filters." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      dataKey="amount"
                      nameKey="category_name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {expenseBreakdown.map((entry) => (
                        <Cell key={entry.category_id} fill={entry.color} stroke="#FFFFFF" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => fmt(Number(value))}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #E2E8F0",
                        boxShadow: "0 6px 20px rgba(15,23,42,0.08)",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {expenseBreakdown.map((item) => (
                  <div key={item.category_id} className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium text-slate-700 truncate">{item.category_name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-semibold text-slate-900">{fmt(item.amount)}</span>
                      <span className="text-slate-400 ml-1.5">({item.percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900">Monthly Expense Trend</h3>
            <p className="text-xs text-slate-500">Month-by-month spending across the selected year</p>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={fmtShort}
                  tick={{ fill: "#64748B", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                />
                <Tooltip
                  formatter={(value: number) => fmt(Number(value))}
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid #E2E8F0",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="expenses" name="Expenses" fill="#2563EB" radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Income vs Expense Comparison + Daily Expense Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900">Income vs Expense</h3>
            <p className="text-xs text-slate-500">Monthly comparison of manually recorded income and expenses</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeVsExpense} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#64748B", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={fmtShort}
                  tick={{ fill: "#64748B", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={54}
                />
                <Tooltip
                  formatter={(value: number) => fmt(Number(value))}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="income" name="Income" fill="#059669" radius={[5, 5, 0, 0]} maxBarSize={18} />
                <Bar dataKey="expenses" name="Expenses" fill="#3B82F6" radius={[5, 5, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900">Daily Expense Trend</h3>
            <p className="text-xs text-slate-500">Day-by-day spending flow for the active period</p>
          </div>
          {dailyExpenseTrend.length === 0 ? (
            <EmptyChart message="No daily activity for this period." />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyExpenseTrend} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dailyExpGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#64748B", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickFormatter={fmtShort}
                    tick={{ fill: "#64748B", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={54}
                  />
                  <Tooltip
                    formatter={(value: number) => fmt(Number(value))}
                    contentStyle={{ borderRadius: "12px", border: "1px solid #E2E8F0", fontSize: "12px" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    name="Daily Spend"
                    stroke="#2563EB"
                    strokeWidth={2.2}
                    fill="url(#dailyExpGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Category-wise Expense Analysis */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
        <div className="mb-4">
          <h3 className="text-base font-bold text-slate-900">Category-wise Expense Analysis</h3>
          <p className="text-xs text-slate-500">Detailed category amounts, transaction counts, and share of total expenses</p>
        </div>
        {categoryAnalysis.length === 0 ? (
          <EmptyChart message="Add expenses to inspect category-wise spending analysis." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            {categoryAnalysis.map((cat) => (
              <div key={cat.category_id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="font-semibold text-slate-800">{cat.category_name}</span>
                    <span className="text-slate-400">({cat.transaction_count} tx)</span>
                  </div>
                  <div className="font-semibold text-slate-900">
                    {fmt(cat.amount)}{" "}
                    <span className="text-slate-400 font-normal">• {cat.percentage.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(2, cat.percentage))}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-52 rounded-xl bg-ivory border border-dashed border-slate-200 flex items-center justify-center px-4 text-center">
      <p className="text-xs font-medium text-slate-400">{message}</p>
    </div>
  );
}
