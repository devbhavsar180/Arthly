"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ScanLine,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  FileImage,
  History,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDisplayDate, getTodayIso, PAYMENT_MODES } from "@/lib/format";
import { PaymentScreenshotRecord, ScreenshotAnalyzeResponse } from "@/types";

export default function ScreenshotScanPage() {
  const { currencySymbol, currencyCode } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrHintText, setOcrHintText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [analysis, setAnalysis] = useState<ScreenshotAnalyzeResponse | null>(null);
  const [history, setHistory] = useState<PaymentScreenshotRecord[]>([]);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Editable confirmation fields
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryName, setCategoryName] = useState("Others");
  const [txDate, setTxDate] = useState(getTodayIso());
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [upiTxId, setUpiTxId] = useState("");
  const [notes, setNotes] = useState("");

  const loadHistory = useCallback(async () => {
    try {
      const items = await api.getScreenshotHistory();
      setHistory(items);
    } catch {
      // ignore non-fatal
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSelectFile = (selected: File | null) => {
    if (!selected) return;
    setFile(selected);
    setError("");
    setSuccessMsg("");
    setAnalysis(null);
    const url = URL.createObjectURL(selected);
    setPreviewUrl(url);
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError("Please select a GPay, PhonePe, Paytm, or UPI screenshot first.");
      return;
    }
    setAnalyzing(true);
    setError("");
    setSuccessMsg("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (ocrHintText.trim()) {
        formData.append("ocr_text", ocrHintText.trim());
      }
      const res = await api.analyzeScreenshot(formData);
      setAnalysis(res);
      const s = res.screenshot;
      setTitle(s.merchant_name || s.payment_description || "UPI Payment");
      setAmount(s.extracted_amount ? String(s.extracted_amount) : "");
      setCategoryName(s.extracted_category || "Others");
      setTxDate(s.extracted_date || getTodayIso());
      setPaymentMode("UPI");
      setUpiTxId(s.upi_transaction_id || "");
      setNotes(
        s.payment_description ||
          (s.payment_app ? `Paid via ${s.payment_app}` : "Imported from payment screenshot")
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to analyze payment screenshot.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analysis) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Please verify and enter a positive transaction amount before saving.");
      return;
    }
    setConfirming(true);
    setError("");
    try {
      const tx = await api.confirmScreenshot(analysis.screenshot.id, {
        title: title.trim() || "UPI Payment",
        amount: amt,
        category_name: categoryName || "Others",
        transaction_date: txDate || getTodayIso(),
        payment_mode: paymentMode,
        transaction_id: upiTxId.trim() || null,
        notes: notes.trim() || null,
      });
      setSuccessMsg(
        `Saved "${tx.title}" (${formatCurrency(tx.amount, currencySymbol, currencyCode)}) under ${tx.category_name}.`
      );
      setAnalysis(null);
      setFile(null);
      setPreviewUrl(null);
      setOcrHintText("");
      await loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save confirmed expense.");
    } finally {
      setConfirming(false);
    }
  };

  const handleDiscard = async () => {
    if (!analysis) return;
    try {
      await api.discardScreenshot(analysis.screenshot.id);
      setAnalysis(null);
      setSuccessMsg("Screenshot discarded without saving any transaction.");
      await loadHistory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to discard screenshot.");
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-[11px] font-semibold mb-1.5">
            <Sparkles className="w-3 h-3" />
            AI & OCR Expense Extraction
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Smart Payment Screenshot Scan
          </h1>
          <p className="text-sm text-slate-500">
            Upload a Google Pay, PhonePe, Paytm, or UPI screenshot. Review and confirm extracted
            details before saving—nothing is ever auto-saved unverified.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700 font-medium">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="p-3.5 rounded-xl bg-sage-50 border border-sage-200 text-sm text-sage-700 font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upload Panel */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 space-y-4">
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-2xl p-6 cursor-pointer bg-ivory transition-colors text-center">
              <UploadCloud className="w-9 h-9 text-brand-600 mb-2" />
              <p className="text-sm font-bold text-slate-800">
                {file ? file.name : "Choose or drop UPI payment screenshot"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                PNG, JPG, or WEBP from Google Pay, PhonePe, Paytm, BHIM, or Amazon Pay
              </p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleSelectFile(e.target.files?.[0] || null)}
              />
            </label>

            {previewUrl && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Screenshot preview"
                  className="max-h-64 rounded-lg object-contain"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Optional Copied Receipt Text (if image text is blurry)
              </label>
              <textarea
                rows={2}
                value={ocrHintText}
                onChange={(e) => setOcrHintText(e.target.value)}
                placeholder="e.g. Paid ₹450 to Swiggy via Google Pay UPI Ref 412399887766"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-ivory text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={analyzing || !file}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              <ScanLine className="w-4 h-4" />
              {analyzing ? "Extracting Payment Details..." : "Analyze Screenshot"}
            </button>
          </div>

          {/* Confirmation Form Panel */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
            {!analysis ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-2 text-slate-400">
                <FileImage className="w-10 h-10 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">
                  Extracted details will appear here for review
                </p>
                <p className="text-xs max-w-xs">
                  Verify amount, merchant, category, date, and UPI transaction ID before saving.
                </p>
              </div>
            ) : (
              <form onSubmit={handleConfirmSave} className="space-y-4">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Verify Extracted Payment
                    </h2>
                    <p className="text-xs text-slate-500">
                      Detected app: {analysis.screenshot.payment_app || "UPI"} · Confidence:{" "}
                      {(analysis.screenshot.confidence_score * 100).toFixed(0)}%
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      analysis.requires_attention
                        ? "bg-amber-50 text-amber-700"
                        : "bg-sage-50 text-sage-700"
                    }`}
                  >
                    {analysis.requires_attention ? "Needs Review" : "Ready"}
                  </span>
                </div>

                {analysis.screenshot.is_duplicate && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Possible Duplicate Detected</p>
                      <p>{analysis.screenshot.duplicate_reason}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Merchant / Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Amount ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Category
                    </label>
                    <select
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                    >
                      {analysis.available_categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Transaction Date
                    </label>
                    <input
                      type="date"
                      required
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Payment Mode
                    </label>
                    <select
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm"
                    >
                      {PAYMENT_MODES.map((pm) => (
                        <option key={pm} value={pm}>
                          {pm}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    UPI Transaction ID / UTR
                  </label>
                  <input
                    type="text"
                    value={upiTxId}
                    onChange={(e) => setUpiTxId(e.target.value)}
                    placeholder="Optional UTR / Reference number"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Description / Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Discard
                  </button>
                  <button
                    type="submit"
                    disabled={confirming}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-xs font-semibold disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {confirming ? "Saving..." : "Confirm & Save Expense"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* History */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-brand-600" />
            <h3 className="text-base font-bold text-slate-900">Recent Screenshot Scans</h3>
          </div>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400">No screenshots scanned yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase">
                    <th className="py-2 pr-3">File / App</th>
                    <th className="py-2 pr-3">Merchant</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">UTR</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 pr-3 font-medium text-slate-800">
                        {item.payment_app || item.filename}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">{item.merchant_name || "—"}</td>
                      <td className="py-2.5 pr-3 font-bold tabular-nums text-slate-900">
                        {item.extracted_amount
                          ? formatCurrency(item.extracted_amount, currencySymbol, currencyCode)
                          : "—"}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-500">
                        {item.extracted_date ? formatDisplayDate(item.extracted_date) : "—"}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-slate-500">
                        {item.upi_transaction_id || "—"}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === "CONFIRMED"
                              ? "bg-sage-50 text-sage-700"
                              : item.status === "DISCARDED"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
