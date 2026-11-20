"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Plus, ArrowUpRight, Info } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDisplayDate, getTodayIso } from "@/lib/format";
import { Category, Transaction } from "@/types";

export default function AddIncomePage() {
  const { currencySymbol, currencyCode } = useAuth();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [receivedDate, setReceivedDate] = useState(getTodayIso());
  const [notes, setNotes] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [recentIncome, setRecentIncome] = useState<Transaction[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");

  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#059669");

  const fmt = (v: number) => formatCurrency(v, currencySymbol, currencyCode);

  const loadData = useCallback(async () => {
    const [cats, txList] = await Promise.all([
      api.listCategories("INCOME"),
      api.listTransactions({ transaction_type: "INCOME", page_size: 8 }),
    ]);
    setCategories(cats);
    if (cats.length > 0 && !categoryId) {
      setCategoryId(cats[0].id);
    }
    setRecentIncome(txList.items);
  }, [categoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid positive income amount.");
      return;
    }
    if (!categoryId) {
      setError("Please select an income category.");
      return;
    }

    setSubmitting(true);
    try {
      await api.createTransaction({
        transaction_type: "INCOME",
        title: title.trim(),
        amount: parsedAmount,
        category_id: categoryId,
        payment_mode: null,
        transaction_date: receivedDate,
        notes: notes.trim() || null,
      });
      setTitle("");
      setAmount("");
      setNotes("");
      setReceivedDate(getTodayIso());
      setSuccessMsg("Income recorded. Your remaining balance and savings are updated.");
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save income.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const created = await api.createCategory({
        name: newCatName.trim(),
        type: "INCOME",
        color: newCatColor,
      });
      setCategories((prev) => [...prev, created]);
      setCategoryId(created.id);
      setNewCatName("");
      setShowNewCat(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add income category.");
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Income Management</h1>
          <p className="text-sm text-slate-500">
            Manually record your monthly salary, freelancing earnings, bonuses, or business income
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-sage-50 border border-sage-200/80 flex items-center gap-2.5 text-xs text-sage-800">
          <Info className="w-4 h-4 shrink-0 text-sage-600" />
          <span>
            Income is never assumed automatically — only the salary or income entries you manually
            add here are counted in your balance and savings.
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Income Form */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
            {successMsg && (
              <div className="mb-4 p-3.5 rounded-xl bg-sage-50 border border-sage-200 text-xs font-semibold text-sage-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {successMsg}
              </div>
            )}
            {error && (
              <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Income Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., November Monthly Salary"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-ivory/70 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-600 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Amount ({currencySymbol} {currencyCode}) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-ivory/70 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-600 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Income Category *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewCat((s) => !s)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-sage-600 hover:text-sage-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Income Category
                  </button>
                </div>

                {showNewCat && (
                  <div className="mb-3 p-3 rounded-xl bg-ivory border border-slate-200 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Custom income category"
                      className="flex-1 min-w-[160px] px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                    />
                    <input
                      type="color"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="w-9 h-8 rounded-lg border border-slate-200 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="px-3 py-1.5 rounded-lg bg-sage-600 text-white text-xs font-semibold"
                    >
                      Add
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => {
                    const selected = categoryId === cat.id;
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setCategoryId(cat.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                          selected
                            ? "border-sage-600 bg-sage-50 text-sage-700 shadow-xs"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Received Date *
                </label>
                <input
                  type="date"
                  required
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="w-full sm:w-64 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-ivory/70 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-600 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional reference or notes"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-ivory/70 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-600 focus:bg-white"
                />
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold shadow-sm transition disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Add Income"}
                </button>
              </div>
            </form>
          </div>

          {/* Recent Income Sidebar */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Recent Income Entries</h3>
            <p className="text-xs text-slate-500 mb-4">Manually recorded income history</p>
            {recentIncome.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No income entries yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentIncome.map((tx) => (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${tx.category_color}1A`, color: tx.category_color }}
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{tx.title}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {tx.category_name} • {formatDisplayDate(tx.transaction_date)}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-sage-600 shrink-0">
                      +{fmt(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
