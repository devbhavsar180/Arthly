"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Wallet,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  KeyRound,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login, loginWithOtp } = useAuth();
  const [mode, setMode] = useState<"password" | "otp">("password");

  // Password login state (accepts Email or Verified Mobile)
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  // Mobile OTP login state
  const [mobile, setMobile] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendOtp = async () => {
    setError("");
    setInfo("");
    if (!mobile.trim()) {
      setError("Please enter your registered mobile number.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.sendOtp({ mobile_number: mobile.trim(), purpose: "LOGIN" });
      setOtpSent(true);
      setCooldown(res.cooldown_seconds || 60);
      setInfo(res.message);
      setDevOtpHint(res.dev_otp || null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to send OTP.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (otp.trim().length !== 6) {
      setError("Please enter the 6-digit OTP.");
      return;
    }
    setSubmitting(true);
    try {
      await loginWithOtp(mobile.trim(), { otp: otp.trim() });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid or expired OTP.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-soft p-7 sm:p-8">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-600 via-indigo-600 to-emerald-600 flex items-center justify-center text-white shadow-sm">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sign in to Arthly</h1>
            <p className="text-xs text-slate-500">Smart personal expenses, savings & budgets</p>
          </div>
        </div>

        {/* Auth Method Toggle */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-slate-200/70 mb-5">
          <button
            type="button"
            onClick={() => {
              setMode("password");
              setError("");
              setInfo("");
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition ${
              mode === "password" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Password Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("otp");
              setError("");
              setInfo("");
            }}
            className={`py-2 text-xs font-semibold rounded-lg transition ${
              mode === "otp" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Mobile OTP Login
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-4 p-3 rounded-xl bg-brand-50 border border-brand-200 text-xs font-medium text-brand-800">
            <p>{info}</p>
            {devOtpHint && (
              <p className="mt-1 font-mono font-bold text-brand-700">
                Sandbox OTP (dev mode): {devOtpHint}
              </p>
            )}
          </div>
        )}

        {mode === "password" ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Mobile Number or Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="9876543210 or you@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">Password</label>
                <Link href="/forgot-password" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-sm transition disabled:opacity-60"
            >
              {submitting ? "Signing in..." : "Sign In"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtpLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Verified Mobile Number
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={submitting || cooldown > 0}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap disabled:opacity-50"
                >
                  {cooldown > 0 ? `${cooldown}s` : otpSent ? "Resend" : "Send OTP"}
                </button>
              </div>
            </div>

            {otpSent && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Enter 6-Digit OTP
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm tracking-[0.35em] font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !otpSent || otp.length !== 6}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              {submitting ? "Verifying..." : "Verify & Sign In"}
            </button>
          </form>
        )}

        <div className="mt-6 pt-5 border-t border-slate-100 text-center space-y-3">
          <p className="text-xs text-slate-600">
            New to Arthly?{" "}
            <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700">
              Create your verified account
            </Link>
          </p>
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-sage-600" />
            <span>Encrypted auth • Strict personal financial privacy</span>
          </div>
        </div>
      </div>
    </div>
  );
}
