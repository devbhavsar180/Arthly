"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  FileSpreadsheet,
  Download,
  Trash2,
  RefreshCw,
  Plus,
  Check,
  Shield,
  Filter,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDisplayDate } from "@/lib/format";
import {
  ReconciliationMatch,
  ReconciliationMatchStatus,
  ReconciliationSession,
} from "@/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ReconciliationPage() {
  const { currencySymbol, currencyCode } = useAuth();
  const today = new Date();

  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [dateTolerance, setDateTolerance] = useState(3);
  const [file, setFile] = useState<File | null>(null);

  const [uploading, setUploading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [activeSession, setActiveSession] = useState<ReconciliationSession | null>(null);
  const [pastSessions, setPastSessions] = useState<ReconciliationSession[]>([]);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fmt = (v: number) => formatCurrency(v, currencySymbol, currencyCode);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const list = await api.getReconciliationSessions();
      setPastSessions(list);
      if (list.length > 0 && !activeSession) {
        setActiveSession(list[0]);
      }
    } catch {
      // Non-critical
    } finally {
      setLoadingSessions(false);
    }
  }, [activeSession]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Handle statement upload and verification
  const handleUploadAndVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMsg("Please select a bank statement file (PDF, CSV, or Excel).");
      return;
    }

    setUploading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const formData = new FormData();
      formData.append("month", selectedMonth.toString());
      formData.append("year", selectedYear.toString());
      formData.append("date_tolerance_days", dateTolerance.toString());
      formData.append("file", file);

      const session = await api.uploadBankStatement(formData);
      setActiveSession(session);
      setSuccessMsg(
        `Statement '${file.name}' verified successfully! Found ${session.summary_stats?.matched_count || 0} matches.`
      );
      setFile(null);
      loadSessions();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to process bank statement.");
    } finally {
      setUploading(false);
    }
  };

  // Perform manual match action: Create in App, Confirm, Reject, Ignore
  const handleMatchAction = async (
    matchId: string,
    action: "CREATED_EXPENSE" | "CREATED_INCOME" | "CONFIRMED" | "REJECTED" | "IGNORED",
    notes?: string
  ) => {
    if (!activeSession) return;
    setActionLoading(matchId);
    setErrorMsg("");

    try {
      const updatedMatch = await api.updateMatchAction(matchId, {
        action,
        notes,
      });

      // Update match in active session locally
      setActiveSession((prev) => {
        if (!prev) return null;
        const newMatches = prev.matches.map((m) =>
          m.id === matchId ? updatedMatch : m
        );
        return { ...prev, matches: newMatches };
      });

      setSuccessMsg(
        action.startsWith("CREATED")
          ? "Transaction created and matched successfully in MyMoney!"
          : `Match status updated to ${action}.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update match action.");
    } finally {
      setActionLoading(null);
    }
  };

  // Download reports
  const handleDownload = async (format: "pdf" | "excel" | "csv") => {
    if (!activeSession) return;
    try {
      await api.downloadReconciliationReport(activeSession.id, format);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to download report.");
    }
  };

  // Delete session
  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Are you sure you want to permanently delete this bank statement verification session?")) {
      return;
    }
    try {
      await api.deleteReconciliationSession(sessionId);
      setSuccessMsg("Reconciliation session and bank data deleted.");
      setActiveSession(null);
      loadSessions();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete session.");
    }
  };

  // Filter matches
  const filteredMatches = (activeSession?.matches || []).filter((m) => {
    if (statusFilter !== "ALL" && m.status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const bDesc = m.bank_transaction?.description?.toLowerCase() || "";
      const aTitle = m.app_transaction?.title?.toLowerCase() || "";
      return bDesc.includes(q) || aTitle.includes(q);
    }
    return true;
  });

  const stats = activeSession?.summary_stats || {};

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-soft">
                <CheckCircle2 className="w-5 h-5" />
              </span>
              Bank Statement Reconciliation
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Upload your bank statement (PDF, CSV, or Excel) to verify your finances with 1-click matching. No banking credentials required.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Shield className="w-3.5 h-3.5" />
              100% Secure &amp; Offline
            </span>
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
            <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1 font-medium">{successMsg}</div>
          </div>
        )}

        {/* Upload Form Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Upload className="w-4 h-4 text-emerald-600" />
            Upload Bank Statement for Verification
          </h2>

          <form onSubmit={handleUploadAndVerify} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Month */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Select Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i + 1} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Select Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500"
                >
                  {[today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].map(
                    (y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Date Tolerance */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 flex items-center justify-between">
                  <span>Date Tolerance (Posting Delay)</span>
                  <span className="text-emerald-600 font-bold">±{dateTolerance} Days</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="7"
                  value={dateTolerance}
                  onChange={(e) => setDateTolerance(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>
            </div>

            {/* File Dropzone */}
            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center transition bg-slate-50/50">
              <input
                type="file"
                id="statement-file"
                accept=".pdf,.csv,.xlsx,.xls,.txt"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <label
                htmlFor="statement-file"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    {file ? file.name : "Choose Bank Statement or Drag & Drop"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Supports text &amp; scanned PDF, CSV, and Excel (.xlsx) statements
                  </p>
                </div>
                {file && (
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                    {(file.size / 1024).toFixed(1)} KB • Ready to verify
                  </span>
                )}
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={uploading || !file}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold shadow-soft transition flex items-center gap-2"
              >
                {uploading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {uploading ? "Verifying Transactions..." : "Verify Transactions"}
              </button>
            </div>
          </form>
        </div>

        {/* Active Session Dashboard */}
        {activeSession && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Total Bank Tx */}
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-card">
                <p className="text-[11px] font-semibold text-slate-500 uppercase">Bank Total</p>
                <p className="text-xl font-bold text-slate-900 mt-1">
                  {stats.total_bank_transactions ?? 0}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Debits: {fmt(stats.total_bank_debits || 0)}
                </p>
              </div>

              {/* Matched */}
              <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 shadow-card">
                <p className="text-[11px] font-semibold text-emerald-700 uppercase flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Matched
                </p>
                <p className="text-xl font-bold text-emerald-800 mt-1">
                  {stats.matched_count ?? 0}
                </p>
                <p className="text-[10px] text-emerald-600 mt-0.5">In both bank &amp; app</p>
              </div>

              {/* Missing in App */}
              <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200 shadow-card">
                <p className="text-[11px] font-semibold text-amber-700 uppercase flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Missing in App
                </p>
                <p className="text-xl font-bold text-amber-800 mt-1">
                  {stats.missing_in_app_count ?? 0}
                </p>
                <p className="text-[10px] text-amber-600 mt-0.5">Needs 1-click addition</p>
              </div>

              {/* Not in Bank */}
              <div className="bg-purple-50/70 p-4 rounded-xl border border-purple-200 shadow-card">
                <p className="text-[11px] font-semibold text-purple-700 uppercase flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5" /> Not in Bank
                </p>
                <p className="text-xl font-bold text-purple-800 mt-1">
                  {stats.not_found_in_bank_count ?? 0}
                </p>
                <p className="text-[10px] text-purple-600 mt-0.5">Cash / pending transactions</p>
              </div>

              {/* Mismatches */}
              <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200 shadow-card">
                <p className="text-[11px] font-semibold text-rose-700 uppercase flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" /> Discrepancies
                </p>
                <p className="text-xl font-bold text-rose-800 mt-1">
                  {stats.mismatch_count ?? 0}
                </p>
                <p className="text-[10px] text-rose-600 mt-0.5">Amount/date mismatch</p>
              </div>

              {/* Needs Review */}
              <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200 shadow-card">
                <p className="text-[11px] font-semibold text-blue-700 uppercase flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> Needs Review
                </p>
                <p className="text-xl font-bold text-blue-800 mt-1">
                  {stats.needs_review_count ?? 0}
                </p>
                <p className="text-[10px] text-blue-600 mt-0.5">Ambiguous matches</p>
              </div>
            </div>

            {/* Reconciliation Comparison Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { key: "ALL", label: "All Items" },
                    { key: "MATCHED", label: "Matched" },
                    { key: "MISSING_IN_APP", label: "Missing in App" },
                    { key: "NOT_FOUND_IN_BANK", label: "Not in Bank" },
                    { key: "MISMATCH", label: "Mismatches" },
                    { key: "NEEDS_REVIEW", label: "Needs Review" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setStatusFilter(tab.key)}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${
                        statusFilter === tab.key
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Report Download Toolbar */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownload("pdf")}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1"
                    title="Download PDF"
                  >
                    <Download className="w-3.5 h-3.5 text-rose-500" /> PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload("excel")}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1"
                    title="Download Excel (.xlsx)"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" /> Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload("csv")}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center gap-1"
                    title="Download CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-blue-500" /> CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSession(activeSession.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                    title="Delete reconciliation session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/80">
                    <tr>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Bank Statement Entry</th>
                      <th className="px-4 py-3 text-right">Bank Amount</th>
                      <th className="px-4 py-3">App Record</th>
                      <th className="px-4 py-3 text-right">App Amount</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-right">Verification Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredMatches.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400">
                          No transactions found under this filter.
                        </td>
                      </tr>
                    ) : (
                      filteredMatches.map((m) => {
                        const b = m.bank_transaction;
                        const a = m.app_transaction;
                        const bAmt = b?.debit_amount && b.debit_amount > 0 ? b.debit_amount : b?.credit_amount || 0;
                        const isDebit = b?.raw_type === "DEBIT";

                        return (
                          <tr key={m.id} className="hover:bg-slate-50/80 transition">
                            {/* Status */}
                            <td className="px-4 py-3 font-semibold">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                                  m.status === "MATCHED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : m.status === "MISSING_IN_APP"
                                    ? "bg-amber-100 text-amber-800"
                                    : m.status === "NOT_FOUND_IN_BANK"
                                    ? "bg-purple-100 text-purple-800"
                                    : m.status === "MISMATCH"
                                    ? "bg-rose-100 text-rose-800"
                                    : "bg-blue-100 text-blue-800"
                                }`}
                              >
                                {m.status.replace(/_/g, " ")}
                              </span>
                              {m.review_action !== "NONE" && (
                                <span className="block text-[10px] text-slate-400 mt-0.5">
                                  Action: {m.review_action}
                                </span>
                              )}
                            </td>

                            {/* Bank Details */}
                            <td className="px-4 py-3">
                              {b ? (
                                <div>
                                  <p className="font-semibold text-slate-900">{b.description}</p>
                                  <p className="text-[11px] text-slate-400">
                                    {formatDisplayDate(b.transaction_date)} • Ref: {b.reference_no || "N/A"}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">Not in Statement</span>
                              )}
                            </td>

                            {/* Bank Amount */}
                            <td className="px-4 py-3 text-right font-bold">
                              {b ? (
                                <span className={isDebit ? "text-slate-800" : "text-emerald-600"}>
                                  {isDebit ? "-" : "+"}
                                  {fmt(bAmt)}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>

                            {/* App Record */}
                            <td className="px-4 py-3">
                              {a ? (
                                <div>
                                  <p className="font-semibold text-slate-900">{a.title}</p>
                                  <p className="text-[11px] text-slate-400">
                                    {formatDisplayDate(a.transaction_date)} • {a.category_name} ({a.transaction_type})
                                  </p>
                                </div>
                              ) : (
                                <span className="text-amber-600 font-medium">Missing in App</span>
                              )}
                            </td>

                            {/* App Amount */}
                            <td className="px-4 py-3 text-right font-bold">
                              {a ? (
                                <span
                                  className={
                                    a.transaction_type === "EXPENSE"
                                      ? "text-slate-800"
                                      : "text-emerald-600"
                                  }
                                >
                                  {a.transaction_type === "EXPENSE" ? "-" : "+"}
                                  {fmt(a.amount)}
                                </span>
                              ) : (
                                "-"
                              )}
                            </td>

                            {/* Match Score */}
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                  m.match_score >= 80
                                    ? "bg-emerald-50 text-emerald-700"
                                    : m.match_score >= 50
                                    ? "bg-amber-50 text-amber-700"
                                    : "text-slate-400"
                                }`}
                              >
                                {m.match_score.toFixed(0)}%
                              </span>
                            </td>

                            {/* Action */}
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {m.status === "MISSING_IN_APP" && b && (
                                  <button
                                    type="button"
                                    disabled={actionLoading === m.id}
                                    onClick={() =>
                                      handleMatchAction(
                                        m.id,
                                        isDebit ? "CREATED_EXPENSE" : "CREATED_INCOME"
                                      )
                                    }
                                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3" /> Create in App
                                  </button>
                                )}

                                {m.status === "MATCHED" && (
                                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" /> Confirmed
                                  </span>
                                )}

                                {m.status !== "MATCHED" && m.status !== "MISSING_IN_APP" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleMatchAction(m.id, "CONFIRMED")}
                                      className="px-2 py-1 text-[11px] font-semibold rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 transition"
                                      title="Confirm Match"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMatchAction(m.id, "IGNORED")}
                                      className="px-2 py-1 text-[11px] font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition"
                                      title="Ignore row"
                                    >
                                      Ignore
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Past Sessions Accordion */}
        {pastSessions.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Past Reconciliation Sessions
            </h3>
            <div className="divide-y divide-slate-100">
              {pastSessions.map((s) => (
                <div
                  key={s.id}
                  className="py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-semibold text-slate-800">
                      {MONTH_NAMES[s.month - 1]} {s.year} — {s.statement?.filename || "Statement"}
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      {s.summary_stats?.total_bank_transactions || 0} Bank Tx • {s.summary_stats?.matched_count || 0} Matched • {s.summary_stats?.missing_in_app_count || 0} Missing in App
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSession(s)}
                      className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 transition"
                    >
                      View Comparison
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSession(s.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
