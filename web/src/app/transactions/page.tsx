"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Pencil,
  Trash2,
  ArrowUpDown,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TransactionEditModal } from "@/components/transactions/TransactionEditModal";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDisplayDate, PAYMENT_MODES } from "@/lib/format";
import { Category, Transaction, TransactionListResponse, TransactionType } from "@/types";

export default function TransactionsPage() {
  const { currencySymbol, currencyCode } = useAuth();
  const [search, setSearch] = useState("");
  const [txType, setTxType] = useState<TransactionType | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [result, setResult] = useState<TransactionListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fmt = (v: number) => formatCurrency(v, currencySymbol, currencyCode);

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const [list, cats] = await Promise.all([
        api.listTransactions({
          search: search.trim() || undefined,
          transaction_type: txType || undefined,
          category_id: categoryId || undefined,
          payment_mode: paymentMode || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
          page,
          page_size: 25,
        }),
        api.listCategories(),
      ]);
      setResult(list);
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  }, [search, txType, categoryId, paymentMode, startDate, endDate, sortBy, sortOrder, page]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTransactions();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadTransactions]);

  const confirmDelete = async () => {
    if (!deletingTx) return;
    setDeleting(true);
    try {
      await api.deleteTransaction(deletingTx.id);
      setDeletingTx(null);
      await loadTransactions();
    } finally {
      setDeleting(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setTxType("");
    setCategoryId("");
    setPaymentMode("");
    setStartDate("");
    setEndDate("");
    setSortBy("date");
    setSortOrder("desc");
    setPage(1);
  };

  const totalPages = result ? Math.max(1, Math.ceil(result.total_count / result.page_size)) : 1;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Transactions</h1>
            <p className="text-sm text-slate-500">Search, filter, edit, and manage all income & expenses</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/add-income"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              Add Income
            </Link>
            <Link
              href="/add-expense"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              Add Expense
            </Link>
          </div>
        </div>

        {/* Summary Strip */}
        {result && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4">
              <p className="text-xs font-semibold text-slate-500">Filtered Income</p>
              <p className="text-xl font-bold text-sage-600 mt-1">{fmt(result.total_income)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4">
              <p className="text-xs font-semibold text-slate-500">Filtered Expenses</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{fmt(result.total_expenses)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4">
              <p className="text-xs font-semibold text-slate-500">Net Balance ({result.total_count} entries)</p>
              <p
                className={`text-xl font-bold mt-1 ${
                  result.net_balance >= 0 ? "text-brand-600" : "text-rose-600"
                }`}
              >
                {fmt(result.net_balance)}
              </p>
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by title..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-ivory text-xs focus:outline-none focus:border-brand-500 focus:bg-white"
              />
            </div>

            <select
              value={txType}
              onChange={(e) => {
                setTxType(e.target.value as TransactionType | "");
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-xs text-slate-700 focus:outline-none focus:border-brand-500"
            >
              <option value="">All Types (Income & Expense)</option>
              <option value="EXPENSE">Expenses Only</option>
              <option value="INCOME">Income Only</option>
            </select>

            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-xs text-slate-700 focus:outline-none focus:border-brand-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type === "INCOME" ? "Income" : "Expense"})
                </option>
              ))}
            </select>

            <select
              value={paymentMode}
              onChange={(e) => {
                setPaymentMode(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-xs text-slate-700 focus:outline-none focus:border-brand-500"
            >
              <option value="">All Payment Modes</option>
              {PAYMENT_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-ivory text-xs text-slate-700"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-ivory text-xs text-slate-700"
              />
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={`${sortBy}:${sortOrder}`}
                onChange={(e) => {
                  const [sb, so] = e.target.value.split(":") as ["date" | "amount", "asc" | "desc"];
                  setSortBy(sb);
                  setSortOrder(so);
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-ivory text-xs font-medium text-slate-700"
              >
                <option value="date:desc">Newest First</option>
                <option value="date:asc">Oldest First</option>
                <option value="amount:desc">Highest Amount</option>
                <option value="amount:asc">Lowest Amount</option>
              </select>
              <button
                onClick={resetFilters}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-brand-600 hover:bg-brand-50"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
          {loading ? (
            <div className="p-10 text-center text-sm text-slate-400">Loading transactions...</div>
          ) : !result || result.items.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-semibold text-slate-600">No matching transactions found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or add a new transaction.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-ivory border-b border-slate-200/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Transaction</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Mode</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {result.items.map((tx) => {
                    const isIncome = tx.transaction_type === "INCOME";
                    return (
                      <tr key={tx.id} className="hover:bg-ivory/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: `${tx.category_color}1A`, color: tx.category_color }}
                            >
                              {isIncome ? (
                                <ArrowUpRight className="w-4 h-4" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 truncate max-w-[240px]">
                                {tx.title}
                              </p>
                              {tx.notes && (
                                <p className="text-xs text-slate-400 truncate max-w-[240px]">
                                  {tx.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ backgroundColor: `${tx.category_color}18`, color: tx.category_color }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: tx.category_color }}
                            />
                            {tx.category_name}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                          {formatDisplayDate(tx.transaction_date)}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500">
                          {tx.payment_mode || "—"}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-bold whitespace-nowrap ${
                            isIncome ? "text-sage-600" : "text-slate-900"
                          }`}
                        >
                          {isIncome ? "+" : "-"}
                          {fmt(tx.amount)}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => setEditingTx(tx)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-brand-50 transition"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingTx(tx)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {result && totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                Page {result.page} of {totalPages} ({result.total_count} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <TransactionEditModal
        transaction={editingTx}
        categories={categories}
        currencySymbol={currencySymbol}
        onClose={() => setEditingTx(null)}
        onSaved={loadTransactions}
      />

      {/* Delete Confirmation Modal */}
      {deletingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-soft p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Delete Transaction?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-slate-900">{deletingTx.title}</span> (
              {fmt(deletingTx.amount)})? Your dashboard totals and savings will recalculate
              immediately.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingTx(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-60"
              >
                {deleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
