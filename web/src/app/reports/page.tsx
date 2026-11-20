"use client";

import React, { useEffect, useState } from "react";
import { FileText, FileSpreadsheet, FileDown, Download, Filter } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, MONTH_NAMES, PAYMENT_MODES } from "@/lib/format";
import { Category, DashboardResponse } from "@/types";

export default function ReportsPage() {
  const { currencySymbol, currencyCode } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMode, setPaymentMode] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [preview, setPreview] = useState<DashboardResponse | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fmt = (v: number) => formatCurrency(v, currencySymbol, currencyCode);

  useEffect(() => {
    api.listCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    api
      .getDashboard({
        month,
        year,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        category_id: categoryId || undefined,
      })
      .then(setPreview)
      .catch(() => {});
  }, [month, year, startDate, endDate, categoryId]);

  const triggerDownload = async (
    type: "pdf/expense" | "pdf/income" | "pdf/summary" | "excel" | "csv"
  ) => {
    setError("");
    setDownloading(type);
    try {
      await api.downloadReport(type, {
        month,
        year,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        category_id: categoryId || undefined,
        payment_mode: paymentMode || undefined,
      });
    } catch {
      setError("Failed to generate report. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  const years = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 4 + i);

  const reportCards = [
    {
      key: "pdf/summary" as const,
      title: "Complete Monthly Financial Summary (PDF)",
      desc: "Full executive report with Income vs Expense chart, Expense Donut chart, category shares, and complete transaction table.",
      badge: "PDF + Charts",
      accent: "bg-brand-50 text-brand-700",
      icon: FileText,
    },
    {
      key: "pdf/expense" as const,
      title: "Monthly Expense Report (PDF)",
      desc: "Detailed spending breakdown by category with horizontal bar chart, payment modes, and expense entries.",
      badge: "PDF + Chart",
      accent: "bg-rose-50 text-rose-700",
      icon: FileText,
    },
    {
      key: "pdf/income" as const,
      title: "Monthly Income Report (PDF)",
      desc: "All manually recorded salary, freelancing, and other income sources with source distribution chart.",
      badge: "PDF + Chart",
      accent: "bg-sage-50 text-sage-700",
      icon: FileText,
    },
    {
      key: "excel" as const,
      title: "Excel Financial Workbook (.xlsx)",
      desc: "Formatted multi-sheet spreadsheet (Financial Summary, Category Breakdown, Transactions) built with OpenPyXL.",
      badge: "XLSX Workbook",
      accent: "bg-emerald-50 text-emerald-700",
      icon: FileSpreadsheet,
    },
    {
      key: "csv" as const,
      title: "CSV Transaction Export (.csv)",
      desc: "Clean UTF-8 CSV file with period totals and every filtered transaction for spreadsheets or accounting.",
      badge: "CSV Data",
      accent: "bg-slate-100 text-slate-700",
      icon: FileDown,
    },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reports & Downloads</h1>
          <p className="text-sm text-slate-500">
            Filter your period and export professional PDF, Excel (.xlsx), and CSV financial reports
          </p>
        </div>

        {/* Report Filters */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Filter className="w-4 h-4 text-brand-600" />
            Report Filters
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Month</label>
              <select
                value={month}
                onChange={(e) => {
                  setStartDate("");
                  setEndDate("");
                  setMonth(Number(e.target.value));
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-xs font-medium"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Year</label>
              <select
                value={year}
                onChange={(e) => {
                  setStartDate("");
                  setEndDate("");
                  setYear(Number(e.target.value));
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-xs font-medium"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Category (Optional)</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-xs font-medium"
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
              <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Mode (Optional)</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-xs font-medium"
              >
                <option value="">All Payment Modes</option>
                {PAYMENT_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Custom Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Custom End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-xs"
              />
            </div>
          </div>

          {preview && (
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-ivory">
                <span className="text-slate-500">Selected Period Income:</span>
                <p className="text-base font-bold text-sage-600 mt-0.5">
                  {fmt(preview.cards.total_income)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-ivory">
                <span className="text-slate-500">Selected Period Expenses:</span>
                <p className="text-base font-bold text-slate-900 mt-0.5">
                  {fmt(preview.cards.total_expenses)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-ivory">
                <span className="text-slate-500">Remaining Balance / Savings:</span>
                <p className="text-base font-bold text-brand-600 mt-0.5">
                  {fmt(preview.cards.remaining_balance)}
                </p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* Download Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reportCards.map((card) => {
            const Icon = card.icon;
            const isLoading = downloading === card.key;
            return (
              <div
                key={card.key}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 flex flex-col justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${card.accent}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900">{card.title}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${card.accent}`}>
                        {card.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{card.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => triggerDownload(card.key)}
                  disabled={downloading !== null}
                  className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-60"
                >
                  <Download className="w-4 h-4" />
                  {isLoading ? "Generating..." : "Download Report"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
