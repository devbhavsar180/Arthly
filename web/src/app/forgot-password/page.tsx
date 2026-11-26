"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  KeyRound,
  Smartphone,
  Lock,
  ArrowLeft,
  CheckCircle2,
  Mail,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [method, setMethod] = useState<"mobile" | "email">("mobile");
  const [step, setStep] = useState<"request" | "verify_otp" | "new_password" | "done">("request");

  // Mobile OTP state
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [verToken, setVerToken] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  // Email fallback state
  const [email, setEmail] = useState("");
  const [emailToken, setEmailToken] = useState("");

  // New passwords
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleRequestMobileOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await api.sendOtp({
        mobile_number: mobile.trim(),
        purpose: "FORGOT_PASSWORD",
      });
      setInfo(res.message);
      setDevOtpHint(res.dev_otp || null);
      setCooldown(res.cooldown_seconds || 60);
      setStep("verify_otp");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMobileOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.verifyOtp({
        mobile_number: mobile.trim(),
        otp: otp.trim(),
        purpose: "FORGOT_PASSWORD",
      });
      setVerToken(res.verification_token || "");
      setInfo("OTP verified. Please create your new password.");
      setStep("new_password");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetMobilePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.resetPasswordWithOtp({
        mobile_number: mobile.trim(),
        verification_token: verToken || undefined,
        otp: verToken ? undefined : otp.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setInfo(res.message);
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const res = await api.forgotPassword(email.trim());
      setInfo(res.message);
      if (res.reset_token) setEmailToken(res.reset_token);
      setStep("new_password");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to initiate email reset.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.resetPassword(emailToken.trim(), newPassword);
      setInfo(res.message);
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-soft p-7 sm:p-8">
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Reset Password</h1>
            <p className="text-xs text-slate-500">Recover your Arthly account securely</p>
          </div>
        </div>

        {step === "request" && (
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 border border-slate-200/70 mb-5">
            <button
              type="button"
              onClick={() => {
                setMethod("mobile");
                setError("");
                setInfo("");
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition ${
                method === "mobile" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
              }`}
            >
              Mobile OTP
            </button>
            <button
              type="button"
              onClick={() => {
                setMethod("email");
                setError("");
                setInfo("");
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition ${
                method === "email" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-500"
              }`}
            >
              Email Token
            </button>
          </div>
        )}

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

        {step === "request" && method === "mobile" && (
          <form onSubmit={handleRequestMobileOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Registered Mobile Number
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="9876543210 or +919876543210"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-60"
            >
              {loading ? "Sending OTP..." : "Send Recovery OTP"}
            </button>
          </form>
        )}

        {step === "request" && method === "email" && (
          <form onSubmit={handleEmailRequest} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Registered Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-60"
            >
              {loading ? "Requesting..." : "Request Reset Token"}
            </button>
          </form>
        )}

        {step === "verify_otp" && (
          <form onSubmit={handleVerifyMobileOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Enter 6-Digit OTP sent to {mobile}
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-base tracking-[0.4em] font-mono font-bold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white"
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setStep("request")}
                className="text-slate-500 hover:text-slate-800"
              >
                Change number
              </button>
              <button
                type="button"
                disabled={cooldown > 0 || loading}
                onClick={handleRequestMobileOtp as any}
                className="font-semibold text-brand-600 disabled:text-slate-400"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition disabled:opacity-60"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
          </form>
        )}

        {step === "new_password" && (
          <form
            onSubmit={method === "mobile" ? handleResetMobilePassword : handleEmailReset}
            className="space-y-4"
          >
            {method === "email" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  One-Time Reset Token
                </label>
                <input
                  type="text"
                  required
                  value={emailToken}
                  onChange={(e) => setEmailToken(e.target.value)}
                  placeholder="Paste reset token"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-mono"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                New Password (min. 8 characters)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Create new password"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 focus:bg-white"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold transition disabled:opacity-60"
            >
              {loading ? "Updating password..." : "Update Password"}
            </button>
          </form>
        )}

        {step === "done" && (
          <div className="text-center py-4 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-sage-600 mx-auto" />
            <p className="text-sm text-slate-700 font-medium">
              Your password has been updated securely.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold"
            >
              Return to Sign In
            </Link>
          </div>
        )}

        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
