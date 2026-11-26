"use client";

import React, { useEffect, useState } from "react";
import { Smartphone, CheckCircle2, ShieldAlert, Send } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export function MobileVerificationCard() {
  const { user, refreshUser } = useAuth();
  const [mobile, setMobile] = useState(user?.mobile_number || "");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (user?.mobile_number && !mobile) {
      setMobile(user.mobile_number);
    }
  }, [user?.mobile_number, mobile]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSendOtp = async () => {
    if (!mobile.trim()) {
      setError("Enter a valid mobile number (e.g. 9876543210 or +919876543210).");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const res = await api.sendOtp({
        mobile_number: mobile.trim(),
        purpose: "VERIFY_MOBILE",
      });
      setOtpSent(true);
      setCooldown(res.cooldown_seconds || 60);
      setDevOtp(res.dev_otp || null);
      setSuccess(`OTP sent to ${res.mobile_number}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send verification OTP.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError("Enter the 6-digit OTP code.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await api.verifyMobile({
        mobile_number: mobile.trim(),
        otp: otp.trim(),
      });
      await refreshUser();
      setOtpSent(false);
      setOtp("");
      setDevOtp(null);
      setSuccess("Mobile number verified and linked to your Arthly account!");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid or expired OTP.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Mobile Number & OTP Security</h2>
            <p className="text-xs text-slate-500">
              Required for OTP login and mobile password recovery
            </p>
          </div>
        </div>
        {user?.mobile_verified ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage-50 border border-sage-200 text-sage-700 text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Verified ({user.mobile_number})
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold">
            <ShieldAlert className="w-3.5 h-3.5" />
            Not Verified
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-sage-50 border border-sage-200 text-xs text-sage-700 font-medium">
          {success}
        </div>
      )}

      <form onSubmit={handleVerifyMobile} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">
            Mobile Number
          </label>
          <input
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            placeholder="+91 9876543210"
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-ivory text-sm"
          />
        </div>

        <div>
          <button
            type="button"
            onClick={handleSendOtp}
            disabled={busy || cooldown > 0}
            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-brand-200 bg-brand-50 text-brand-700 text-xs font-semibold hover:bg-brand-100 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {cooldown > 0 ? `Resend in ${cooldown}s` : otpSent ? "Resend OTP" : "Send Verification OTP"}
          </button>
        </div>

        {otpSent && (
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6-digit OTP"
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-mono tracking-widest"
            />
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 rounded-xl bg-sage-600 hover:bg-sage-700 text-white text-xs font-semibold"
            >
              Verify
            </button>
          </div>
        )}
      </form>

      {devOtp && (
        <p className="text-[11px] font-mono bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-lg inline-block">
          Dev Mode OTP: {devOtp}
        </p>
      )}
    </div>
  );
}
