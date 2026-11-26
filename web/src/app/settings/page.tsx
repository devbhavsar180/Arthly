"use client";

import { MobileVerificationCard } from "@/components/settings/MobileVerificationCard";

import React, { useCallback, useEffect, useState } from "react";
import {
  User,
  Coins,
  Tags,
  Lock,
  Download,
  Upload,
  Trash2,
  Pencil,
  Check,
  AlertTriangle,
  Mic,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Category, TransactionType } from "@/types";

const CURRENCY_PRESETS = [
  { code: "INR", symbol: "₹", label: "Indian Rupee (₹ INR)" },
  { code: "USD", symbol: "$", label: "US Dollar ($ USD)" },
  { code: "EUR", symbol: "€", label: "Euro (€ EUR)" },
  { code: "GBP", symbol: "£", label: "British Pound (£ GBP)" },
];

export default function SettingsPage() {
  const { user, refreshUser, logout } = useAuth();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Profile
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Currency
  const [currencyCode, setCurrencyCode] = useState("INR");
  const [currencySymbol, setCurrencySymbol] = useState("₹");
  const [savingCurrency, setSavingCurrency] = useState(false);

  // Voice Language
  const [voiceLang, setVoiceLang] = useState<"gu" | "en" | "hi" | "auto">("gu");
  const [savingVoiceLang, setSavingVoiceLang] = useState(false);

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [catName, setCatName] = useState("");
  const [catType, setCatType] = useState<TransactionType>("EXPENSE");
  const [catColor, setCatColor] = useState("#2563EB");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [editingCatColor, setEditingCatColor] = useState("#2563EB");

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  // Backup / Restore
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Delete Account
  const [delPassword, setDelPassword] = useState("");
  const [delConfirm, setDelConfirm] = useState("");
  const [deletingAcct, setDeletingAcct] = useState(false);

  const loadCategories = useCallback(async () => {
    const cats = await api.listCategories();
    setCategories(cats);
  }, []);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setEmail(user.email);
      setCurrencyCode(user.settings?.currency_code || "INR");
      setCurrencySymbol(user.settings?.currency_symbol || "₹");
      if (user.settings?.preferred_voice_language) {
        setVoiceLang(user.settings.preferred_voice_language);
      }
    }
    loadCategories();
  }, [user, loadCategories]);

  const showMessage = (msg: string) => {
    setError("");
    setNotice(msg);
  };

  const showError = (err: unknown, fallback: string) => {
    setNotice("");
    setError(err instanceof ApiError ? err.message : fallback);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.updateProfile({ full_name: fullName.trim(), email: email.trim() });
      await refreshUser();
      showMessage("Profile updated successfully.");
    } catch (err) {
      showError(err, "Failed to update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCurrency(true);
    try {
      await api.updateCurrency({ currency_code: currencyCode, currency_symbol: currencySymbol });
      await refreshUser();
      showMessage(`Currency updated to ${currencyCode} (${currencySymbol}).`);
    } catch (err) {
      showError(err, "Failed to update currency.");
    } finally {
      setSavingCurrency(false);
    }
  };

  const handleSaveVoiceLang = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingVoiceLang(true);
    try {
      await api.updateVoiceLanguage(voiceLang);
      await refreshUser();
      showMessage("Voice input language preference updated.");
    } catch (err) {
      showError(err, "Failed to update voice language.");
    } finally {
      setSavingVoiceLang(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      await api.createCategory({ name: catName.trim(), type: catType, color: catColor });
      setCatName("");
      await loadCategories();
      showMessage("Category added.");
    } catch (err) {
      showError(err, "Could not add category.");
    }
  };

  const handleUpdateCategory = async (id: string) => {
    try {
      await api.updateCategory(id, { name: editingCatName.trim(), color: editingCatColor });
      setEditingCatId(null);
      await loadCategories();
      showMessage("Category updated.");
    } catch (err) {
      showError(err, "Could not update category.");
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    const reassign = cat.transaction_count > 0;
    const confirmed = window.confirm(
      reassign
        ? `Category "${cat.name}" is used by ${cat.transaction_count} transaction(s). Delete it and reassign those transactions to Other?`
        : `Delete category "${cat.name}"?`
    );
    if (!confirmed) return;
    try {
      await api.deleteCategory(cat.id, reassign);
      await loadCategories();
      showMessage(`Category "${cat.name}" deleted.`);
    } catch (err) {
      showError(err, "Could not delete category.");
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setChangingPass(true);
    try {
      await api.changePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword("");
      setNewPassword("");
      showMessage("Password changed. Signing you out for security...");
      setTimeout(() => logout(), 1200);
    } catch (err) {
      showError(err, "Failed to change password.");
    } finally {
      setChangingPass(false);
    }
  };

  const handleExportAll = async () => {
    try {
      await api.exportAllData();
      showMessage("Full JSON backup downloaded.");
    } catch (err) {
      showError(err, "Failed to export data.");
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoring(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const res = await api.restoreBackup({ ...parsed, replace_existing: replaceExisting });
      await loadCategories();
      await refreshUser();
      showMessage(
        `Restored ${res.transactions_restored} transactions and ${res.categories_added} new categories.`
      );
    } catch (err) {
      showError(err, "Invalid backup file or restore failed.");
    } finally {
      setRestoring(false);
      e.target.value = "";
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (delConfirm.trim().toUpperCase() !== "DELETE") {
      setError("Type DELETE to confirm permanent account removal.");
      return;
    }
    setDeletingAcct(true);
    try {
      await api.deleteAccount({ password: delPassword, confirmation: delConfirm });
      await logout();
    } catch (err) {
      showError(err, "Account deletion failed.");
      setDeletingAcct(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-sm text-slate-500">
            Manage your profile, currency, categories, security, and data backups
          </p>
        </div>

        {notice && (
          <div className="p-3.5 rounded-xl bg-sage-50 border border-sage-200 text-xs font-semibold text-sage-800">
            {notice}
          </div>
        )}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        {/* User Profile & Currency */}
        <MobileVerificationCard />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form
            onSubmit={handleSaveProfile}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <User className="w-4 h-4 text-brand-600" />
              User Profile
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-ivory text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-ivory text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-60"
            >
              {savingProfile ? "Saving..." : "Update Profile"}
            </button>
          </form>

          <form
            onSubmit={handleSaveCurrency}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Coins className="w-4 h-4 text-sage-600" />
              Currency Settings
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Default Currency (INR Recommended)
              </label>
              <select
                value={currencyCode}
                onChange={(e) => {
                  const preset = CURRENCY_PRESETS.find((p) => p.code === e.target.value);
                  if (preset) {
                    setCurrencyCode(preset.code);
                    setCurrencySymbol(preset.symbol);
                  }
                }}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-ivory text-sm"
              >
                {CURRENCY_PRESETS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500">
              Active formatting preview: <strong className="text-slate-900">{currencySymbol}1,25,000.00</strong>
            </p>
            <button
              type="submit"
              disabled={savingCurrency}
              className="px-4 py-2 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-xs font-semibold disabled:opacity-60"
            >
              {savingCurrency ? "Saving..." : "Save Currency"}
            </button>
          </form>

          <form
            onSubmit={handleSaveVoiceLang}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Mic className="w-4 h-4 text-indigo-600" />
              Voice Recognition Language
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Preferred Speech Input Language
              </label>
              <select
                value={voiceLang}
                onChange={(e) => setVoiceLang(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-ivory text-sm"
              >
                <option value="gu">ગુજરાતી (Gujarati) — Default</option>
                <option value="hi">हिंदी (Hindi)</option>
                <option value="en">English</option>
                <option value="auto">Auto Detect Language</option>
              </select>
            </div>
            <p className="text-xs text-slate-500">
              You can speak colloquial Gujarati (e.g. &quot;nastama kharchya&quot;) and it will be converted to structured English transactions.
            </p>
            <button
              type="submit"
              disabled={savingVoiceLang}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-60"
            >
              {savingVoiceLang ? "Saving..." : "Save Voice Language"}
            </button>
          </form>
        </div>

        {/* Manage Categories */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Tags className="w-4 h-4 text-brand-600" />
            Manage Categories
          </div>

          <form onSubmit={handleCreateCategory} className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              required
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="New category name"
              className="flex-1 min-w-[180px] px-3.5 py-2 rounded-xl border border-slate-200 bg-ivory text-xs"
            />
            <select
              value={catType}
              onChange={(e) => setCatType(e.target.value as TransactionType)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-ivory text-xs font-medium"
            >
              <option value="EXPENSE">Expense Category</option>
              <option value="INCOME">Income Category</option>
            </select>
            <input
              type="color"
              value={catColor}
              onChange={(e) => setCatColor(e.target.value)}
              className="w-10 h-9 rounded-xl border border-slate-200 cursor-pointer"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold"
            >
              Add Category
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {(["EXPENSE", "INCOME"] as TransactionType[]).map((type) => (
              <div key={type} className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {type === "EXPENSE" ? "Expense Categories" : "Income Categories"}
                </p>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 overflow-hidden">
                  {categories
                    .filter((c) => c.type === type)
                    .map((cat) => (
                      <div key={cat.id} className="px-3.5 py-2.5 bg-white flex items-center justify-between gap-2">
                        {editingCatId === cat.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="color"
                              value={editingCatColor}
                              onChange={(e) => setEditingCatColor(e.target.value)}
                              className="w-7 h-7 rounded cursor-pointer"
                            />
                            <input
                              type="text"
                              value={editingCatName}
                              onChange={(e) => setEditingCatName(e.target.value)}
                              className="flex-1 px-2 py-1 rounded-lg border border-slate-200 text-xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateCategory(cat.id)}
                              className="p-1.5 rounded-lg bg-sage-600 text-white"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: cat.color }}
                              />
                              <span className="text-xs font-semibold text-slate-800 truncate">
                                {cat.name}
                              </span>
                              <span className="text-[10px] text-slate-400">({cat.transaction_count})</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCatId(cat.id);
                                  setEditingCatName(cat.name);
                                  setEditingCatColor(cat.color);
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Change Password & Backup/Restore */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form
            onSubmit={handleChangePassword}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Lock className="w-4 h-4 text-brand-600" />
              Change Password
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-ivory text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">New Password (min 8 chars)</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-ivory text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={changingPass}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-60"
            >
              {changingPass ? "Updating..." : "Change Password"}
            </button>
          </form>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Download className="w-4 h-4 text-sage-600" />
              Export All Data, Backup & Restore
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Download a full JSON backup of your categories, settings, and transactions, or restore
              from a previous backup file.
            </p>
            <button
              type="button"
              onClick={handleExportAll}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold"
            >
              <Download className="w-4 h-4" />
              Export All Data (JSON Backup)
            </button>

            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Replace existing transactions when restoring
              </label>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-ivory hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer">
                <Upload className="w-4 h-4" />
                {restoring ? "Restoring..." : "Restore from JSON Backup"}
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={handleRestoreFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Danger Zone: Delete Account */}
        <form
          onSubmit={handleDeleteAccount}
          className="bg-white rounded-2xl border border-rose-200 shadow-card p-5 space-y-4"
        >
          <div className="flex items-center gap-2 text-sm font-bold text-rose-700">
            <AlertTriangle className="w-4 h-4" />
            Delete Account & Personal Data
          </div>
          <p className="text-xs text-slate-600">
            This permanently deletes your profile, categories, settings, and all transaction history.
            This action cannot be undone.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="password"
              required
              value={delPassword}
              onChange={(e) => setDelPassword(e.target.value)}
              placeholder="Enter current password"
              className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50/30 text-xs"
            />
            <input
              type="text"
              required
              value={delConfirm}
              onChange={(e) => setDelConfirm(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50/30 text-xs"
            />
          </div>
          <button
            type="submit"
            disabled={deletingAcct}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold disabled:opacity-60"
          >
            {deletingAcct ? "Deleting..." : "Permanently Delete My Account"}
          </button>
        </form>
      </div>
    </AppShell>
  );
}
