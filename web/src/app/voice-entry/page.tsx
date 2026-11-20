"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Calendar,
  Tag,
  CreditCard,
  History,
  Languages,
  Check,
  RefreshCw,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDisplayDate, getTodayIso, PAYMENT_MODES } from "@/lib/format";
import {
  CandidateTransaction,
  Category,
  PaymentMode,
  TransactionType,
  VoiceEntryHistory,
} from "@/types";

const LANGUAGES = [
  { code: "gu", label: "ગુજરાતી (Gujarati)", speechLang: "gu-IN" },
  { code: "hi", label: "हिंदी (Hindi)", speechLang: "hi-IN" },
  { code: "en", label: "English", speechLang: "en-IN" },
  { code: "auto", label: "Auto Detect", speechLang: "gu-IN" },
] as const;

const VOICE_EXAMPLES = [
  "Aaje me 150 rupiya nastama kharchya ane 80 rupiya rikshama aapya.",
  "Aaje 500 rupiyanu petrol bharavyu.",
  "Yesterday I spent 300 rupees on groceries.",
  "Aaje salary na 40000 rupiya malya.",
  "Light bill 1200 bharyu ane wifi recharge 799 karyu.",
];

export default function VoiceEntryPage() {
  const { user, currencySymbol, currencyCode } = useAuth();
  const [selectedLang, setSelectedLang] = useState<"gu" | "en" | "hi" | "auto">("gu");
  const [rawText, setRawText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const [candidates, setCandidates] = useState<CandidateTransaction[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [history, setHistory] = useState<VoiceEntryHistory[]>([]);

  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const recognitionRef = useRef<any>(null);

  const fmt = (v: number) => formatCurrency(v, currencySymbol, currencyCode);

  // Initialize preferred voice language from user settings
  useEffect(() => {
    if (user?.settings?.preferred_voice_language) {
      setSelectedLang(user.settings.preferred_voice_language);
    }
  }, [user]);

  // Load categories and past voice history
  const loadInitialData = useCallback(async () => {
    try {
      const [cats, hist] = await Promise.all([
        api.listCategories(),
        api.getVoiceHistory(10),
      ]);
      setCategories(cats);
      setHistory(hist);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechSupported(false);
      }
    }
  }, []);

  const handleLanguageChange = async (lang: "gu" | "en" | "hi" | "auto") => {
    setSelectedLang(lang);
    try {
      await api.updateVoiceLanguage(lang);
    } catch {
      // Ignored
    }
  };

  const startRecording = () => {
    setErrorMsg("");
    setSuccessMsg("");
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg("Web Speech Recognition is not supported in this browser. You can type or paste speech text below.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      const langConfig = LANGUAGES.find((l) => l.code === selectedLang);
      recognition.lang = langConfig?.speechLang || "gu-IN";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setRawText(transcript);
      };

      recognition.onerror = (event: any) => {
        setIsRecording(false);
        if (event.error === "not-allowed") {
          setErrorMsg("Microphone access was denied. Please allow microphone permissions in browser settings.");
        } else if (event.error !== "no-speech") {
          setErrorMsg(`Voice recognition notice: ${event.error}. You can also type your sentence.`);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setIsRecording(false);
      setErrorMsg(err.message || "Failed to initialize microphone.");
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  // Process and parse speech text into structured candidates
  const handleParseText = async (textToParse?: string) => {
    const text = (textToParse || rawText).trim();
    if (!text) {
      setErrorMsg("Please speak into the mic or enter transaction text.");
      return;
    }

    setParsing(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await api.parseVoiceText({
        text,
        language: selectedLang,
      });
      setCandidates(res.transactions);
      setWarnings(res.warnings || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to parse voice command.");
    } finally {
      setParsing(false);
    }
  };

  // Edit candidate transactions
  const handleCandidateChange = (
    index: number,
    field: keyof CandidateTransaction,
    value: any
  ) => {
    setCandidates((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeCandidate = (index: number) => {
    setCandidates((prev) => prev.filter((_, i) => i !== index));
  };

  const addEmptyCandidate = () => {
    setCandidates((prev) => [
      ...prev,
      {
        title: "Expense",
        amount: 100,
        category_name: "Food",
        transaction_type: "EXPENSE",
        transaction_date: getTodayIso(),
        payment_mode: "Cash",
        confidence: 1.0,
        requires_attention: false,
      },
    ]);
  };

  // Confirm & Save
  const handleConfirmAndSave = async () => {
    if (candidates.length === 0) {
      setErrorMsg("No transactions to save.");
      return;
    }

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (!c.amount || c.amount <= 0) {
        setErrorMsg(`Transaction #${i + 1} (${c.title}) is missing a valid positive amount.`);
        return;
      }
      if (!c.title.trim()) {
        setErrorMsg(`Transaction #${i + 1} must have a title.`);
        return;
      }
    }

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const payload = {
        raw_text: rawText || "Voice entry",
        language: selectedLang,
        transactions: candidates.map((c) => ({
          title: c.title.trim(),
          amount: Number(c.amount),
          category_name: c.category_name,
          transaction_type: c.transaction_type,
          transaction_date: c.transaction_date,
          payment_mode: c.payment_mode || "Cash",
          notes: c.notes || undefined,
        })),
      };

      const res = await api.confirmVoiceTransactions(payload);
      setSuccessMsg(res.message);
      setCandidates([]);
      setRawText("");
      loadInitialData();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save confirmed transactions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-soft">
                <Mic className="w-5 h-5" />
              </span>
              Voice Expense Entry
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Speak naturally in Gujarati, Hindi, or English. Multiple expenses in a single sentence are auto-structured.
            </p>
          </div>

          {/* Language selector toggle */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleLanguageChange(lang.code as any)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  selectedLang === lang.code
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {lang.label.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1 font-medium">{successMsg}</div>
          </div>
        )}

        {/* Microphone Recording Hub */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-3 right-3 text-xs text-slate-400 flex items-center gap-1 font-medium">
            <Languages className="w-3.5 h-3.5 text-slate-400" />
            Mode: {LANGUAGES.find((l) => l.code === selectedLang)?.label}
          </div>

          <div className="my-3">
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none ${
                isRecording
                  ? "bg-rose-500 text-white shadow-lg shadow-rose-500/40 animate-pulse scale-105"
                  : "bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-soft hover:shadow-card hover:scale-105 active:scale-95"
              }`}
            >
              {isRecording ? (
                <MicOff className="w-9 h-9" />
              ) : (
                <Mic className="w-9 h-9" />
              )}
            </button>
          </div>

          <p className="text-sm font-semibold text-slate-800">
            {isRecording
              ? "Listening... Speak your expenses now"
              : "Tap microphone to speak"}
          </p>
          <p className="text-xs text-slate-500 max-w-md mt-1">
            Try saying: &quot;Aaje me 150 rupiya nastama kharchya ane 80 rupiya rikshama aapya&quot;
          </p>

          {/* Editable Speech Text Area */}
          <div className="w-full mt-5">
            <label className="block text-xs font-semibold text-slate-600 text-left mb-1.5">
              Recognized Speech or Type Directly:
            </label>
            <div className="relative">
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Spoken words will appear here. Or type sentence in Gujarati/Hindi/English..."
                rows={2}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-slate-800"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-slate-400 font-medium mr-1">Examples:</span>
                {VOICE_EXAMPLES.slice(0, 3).map((ex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setRawText(ex);
                      handleParseText(ex);
                    }}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                  >
                    Ex {idx + 1}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={parsing || !rawText.trim()}
                onClick={() => handleParseText()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
              >
                {parsing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                Convert to Transactions
              </button>
            </div>
          </div>
        </div>

        {/* Warnings from parsing */}
        {warnings.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1">
            <div className="font-semibold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              Please review the following details:
            </div>
            <ul className="list-disc list-inside space-y-0.5 pl-1">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Confirmation Screen / Candidate Transactions */}
        {candidates.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                  Confirmation Screen
                </h2>
                <p className="text-xs text-slate-500">
                  Review and edit before saving. Transactions are never saved automatically.
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                {candidates.length} {candidates.length === 1 ? "Item" : "Items"}
              </span>
            </div>

            <div className="space-y-3">
              {candidates.map((c, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-xl border transition-all ${
                    c.requires_attention
                      ? "border-amber-300 bg-amber-50/40"
                      : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleCandidateChange(
                            index,
                            "transaction_type",
                            c.transaction_type === "EXPENSE" ? "INCOME" : "EXPENSE"
                          )
                        }
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full transition ${
                          c.transaction_type === "EXPENSE"
                            ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                            : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        }`}
                      >
                        {c.transaction_type}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeCandidate(index)}
                      className="text-slate-400 hover:text-rose-600 p-1 transition"
                      title="Remove transaction"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Title */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        English Title
                      </label>
                      <input
                        type="text"
                        value={c.title}
                        onChange={(e) =>
                          handleCandidateChange(index, "title", e.target.value)
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-900 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Amount ({currencySymbol})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={c.amount ?? ""}
                        placeholder="0.00"
                        onChange={(e) =>
                          handleCandidateChange(
                            index,
                            "amount",
                            e.target.value === "" ? null : Number(e.target.value)
                          )
                        }
                        className={`w-full px-3 py-1.5 text-xs rounded-lg border font-bold text-slate-900 focus:ring-1 focus:ring-indigo-500 ${
                          !c.amount || c.amount <= 0
                            ? "border-rose-400 bg-rose-50/50"
                            : "border-slate-300 bg-white"
                        }`}
                      />
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Category
                      </label>
                      <input
                        type="text"
                        value={c.category_name}
                        onChange={(e) =>
                          handleCandidateChange(index, "category_name", e.target.value)
                        }
                        list={`cat-list-${index}`}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-1 focus:ring-indigo-500"
                      />
                      <datalist id={`cat-list-${index}`}>
                        {categories
                          .filter((cat) => cat.type === c.transaction_type)
                          .map((cat) => (
                            <option key={cat.id} value={cat.name} />
                          ))}
                      </datalist>
                    </div>

                    {/* Payment Mode */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Payment Mode
                      </label>
                      <select
                        value={c.payment_mode}
                        onChange={(e) =>
                          handleCandidateChange(
                            index,
                            "payment_mode",
                            e.target.value as PaymentMode
                          )
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-1 focus:ring-indigo-500"
                      >
                        {PAYMENT_MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
                    {/* Date */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Transaction Date
                      </label>
                      <input
                        type="date"
                        value={c.transaction_date}
                        onChange={(e) =>
                          handleCandidateChange(index, "transaction_date", e.target.value)
                        }
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Notes / Original Clause
                      </label>
                      <input
                        type="text"
                        value={c.notes || ""}
                        onChange={(e) =>
                          handleCandidateChange(index, "notes", e.target.value)
                        }
                        placeholder="Optional details"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={addEmptyCandidate}
                className="w-full sm:w-auto px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Another Transaction
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setCandidates([]);
                    setRawText("");
                  }}
                  className="w-1/2 sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleConfirmAndSave}
                  className="w-1/2 sm:w-auto px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  {saving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  Confirm & Save ({candidates.length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recent Voice Entries */}
        {history.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-slate-500" />
              Recent Voice Entries
            </h3>
            <div className="divide-y divide-slate-100">
              {history.slice(0, 5).map((h) => (
                <div key={h.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium text-slate-800">&quot;{h.raw_text}&quot;</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="uppercase font-bold text-slate-500">{h.language}</span>
                      <span>•</span>
                      <span>{formatDisplayDate(h.created_at.split("T")[0])}</span>
                      <span>•</span>
                      <span className="text-emerald-600 font-medium">
                        {h.recognized_transactions?.length || 0} saved
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRawText(h.raw_text);
                      handleParseText(h.raw_text);
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded hover:bg-indigo-50 transition"
                  >
                    Reuse
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
