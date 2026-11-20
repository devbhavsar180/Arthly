"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { PAYMENT_MODES } from "@/lib/format";
import { Category, PaymentMode, Transaction, TransactionType } from "@/types";

interface EditModalProps {
  transaction: Transaction | null;
  categories: Category[];
  currencySymbol: string;
  onClose: () => void;
  onSaved: () => void;
}

export function TransactionEditModal({
  transaction,
  categories,
  currencySymbol,
  onClose,
  onSaved,
}: EditModalProps) {
  const [txType, setTxType] = useState<TransactionType>("EXPENSE");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("UPI");
  const [txDate, setTxDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (transaction) {
      setTxType(transaction.transaction_type);
      setTitle(transaction.title);
      setAmount(String(transaction.amount));
      setCategoryId(transaction.category_id);
      setPaymentMode((transaction.payment_mode as PaymentMode) || "UPI");
      setTxDate(transaction.transaction_date);
      setNotes(transaction.notes || "");
      setError("");
    }
  }, [transaction]);

  if (!transaction) return null;

  const filteredCategories = categories.filter((c) => c.type === txType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid positive amount.");
      return;
    }
    setSaving(true);
    try {
      await api.updateTransaction(transaction.id, {
        transaction_type: txType,
        title: title.trim(),
        amount: parsedAmount,
        category_id: categoryId,
        payment_mode: txType === "EXPENSE" ? paymentMode : null,
        transaction_date: txDate,
        notes: notes.trim() || null,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update transaction.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Edit Transaction</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 p-1 bg-ivory rounded-xl border border-slate-200/70">
            {(["EXPENSE", "INCOME"] as TransactionType[]).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => {
                  setTxType(t);
                  const firstCat = categories.find((c) => c.type === t);
                  if (firstCat) setCategoryId(firstCat.id);
                }}
                className={`py-2 rounded-lg text-xs font-semibold transition ${
                  txType === t
                    ? t === "EXPENSE"
                      ? "bg-brand-600 text-white shadow-xs"
                      : "bg-sage-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {t === "EXPENSE" ? "Expense" : "Income"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-ivory/60 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount ({currencySymbol})
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-ivory/60 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-ivory/60 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white"
              >
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                required
                value={txDate}
                onChange={(e) => setTxDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-ivory/60 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white"
              />
            </div>
          </div>

          {txType === "EXPENSE" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Mode</label>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_MODES.map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setPaymentMode(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                      paymentMode === m
                        ? "bg-brand-50 border-brand-500 text-brand-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-ivory/60 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
