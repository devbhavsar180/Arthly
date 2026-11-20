"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Plus, ArrowDownRight, Shield } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDisplayDate, getTodayIso, PAYMENT_MODES } from "@/lib/format";
import { Category, PaymentMode, Transaction } from "@/types";

export default function AddExpensePage() {
  const { currencySymbol, currencyCode } = useAuth();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("UPI");
  const [txDate, setTxDate] = useState(getTodayIso());
  const [notes, setNotes] = useState("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Transaction[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");

  // Quick custom category inline form
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#2563EB");

  const fmt = (v: number) => formatCurrency(v, currencySymbol, currencyCode);

  const loadData = useCallback(async () => {
    const [cats, txList] = await Promise.all([
      api.listCategories("EXPENSE"),
      api.listTransactions({ transaction_type: "EXPENSE", page_size: 8 }),
    ]);
    setCategories(cats);
    if (cats.length > 0 && !categoryId) {
      setCategoryId(cats[0].id);
    }
    setRecentExpenses(txList.items);
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
      setError("Please enter a valid positive amount.");
      return;
    }
    if (!categoryId) {
      setError("Please select a category.");
      return;
    }

    setSubmitting(true);
    try {
      await api.createTransaction({
        transaction_type: "EXPENSE",
        title: title.trim(),
        amount: parsedAmount,
        category_id: categoryId,
        payment_mode: paymentMode,
        transaction_date: txDate,
        notes: notes.trim() || null,
      });
      setTitle("");
      setAmount("");
      setNotes("");
      setTxDate(getTodayIso());
      setSuccessMsg("Expense recorded and synced with your dashboard.");
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save expense.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const created = await api.createCategory({
        name: newCatName.trim(),
        type: "EXPENSE",
        color: newCatColor,
      });
      setCategories((prev) => [...prev, created]);
      setCategoryId(created.id);
      setNewCatName("");
      setShowNewCat(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add category.");
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Add Daily Expense</h1>
          <p className="text-sm text-slate-500">
            Quickly record an expense — totals and charts update automatically
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Expense Form */}
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
                    Expense Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Lunch, Metro Ticket, Electricity Bill"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-ivory/70 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white"
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
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-ivory/70 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Category Chips */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-700">Category *</label>
                  <button
                    type="button"
                    onClick={() => setShowNewCat((s) => !s)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Category
                  </button>
                </div>

                {showNewCat && (
                  <div className="mb-3 p-3 rounded-xl bg-ivory border border-slate-200 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="Custom category name"
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
                      className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold"
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
                            ? "border-brand-600 bg-brand-50 text-brand-700 shadow-xs"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-ivory/70 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Payment Mode *
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PAYMENT_MODES.map((mode) => (
                      <button
                        type="button"
                        key={mode}
                        onClick={() => setPaymentMode(mode)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                          paymentMode === mode
                            ? "bg-brand-600 border-brand-600 text-white"
                            : "bg-ivory border-slate-200 text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional details for your personal records"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-ivory/70 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Shield className="w-3.5 h-3.5 text-sage-600" />
                  Payment mode is a label only — no card or UPI credentials needed
                </span>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-sm transition disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Save Expense"}
                </button>
              </div>
            </form>
          </div>

          {/* Recent Expenses Sidebar */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Recent Expenses</h3>
            <p className="text-xs text-slate-500 mb-4">Your latest recorded spending</p>
            {recentExpenses.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">No expenses added yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentExpenses.map((tx) => (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${tx.category_color}1A`, color: tx.category_color }}
                      >
                        <ArrowDownRight className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">{tx.title}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {tx.category_name} • {tx.payment_mode} • {formatDisplayDate(tx.transaction_date)}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-900 shrink-0">
                      -{fmt(tx.amount)}
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
