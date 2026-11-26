import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ApiError, mobileApi } from "@/lib/api";
import { COLORS } from "@/lib/format";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSendOtp = async () => {
    setError("");
    setSuccess("");
    if (!mobileNumber.trim()) {
      setError("Enter your registered mobile number.");
      return;
    }
    setBusy(true);
    try {
      const res = await mobileApi.sendOtp({
        mobile_number: mobileNumber.trim(),
        purpose: "FORGOT_PASSWORD",
      });
      setStep(2);
      setCooldown(res.cooldown_seconds || 60);
      setDevOtp(res.dev_otp || null);
      setSuccess(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send recovery OTP.");
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setError("");
    setSuccess("");
    if (!otp.trim()) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await mobileApi.resetPasswordWithOtp({
        mobile_number: mobileNumber.trim(),
        otp: otp.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setSuccess(res.message || "Password reset successful.");
      setTimeout(() => router.replace("/(auth)/login"), 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reset password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Reset Password via Mobile OTP</Text>
            <Text style={styles.subtitle}>
              Verify your registered mobile number to set a new Arthly password
            </Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {success ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>{success}</Text>
              </View>
            ) : null}

            {step === 1 ? (
              <>
                <Text style={styles.label}>Registered Mobile Number</Text>
                <TextInput
                  style={styles.input}
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  keyboardType="phone-pad"
                  placeholder="+91 9876543210"
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={handleSendOtp} disabled={busy}>
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Send Reset OTP</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>6-Digit OTP</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="• • • • • •"
                />
                {devOtp ? <Text style={styles.devOtpText}>Dev OTP: {devOtp}</Text> : null}

                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="••••••••"
                />

                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="••••••••"
                />

                <TouchableOpacity style={styles.primaryBtn} onPress={handleReset} disabled={busy}>
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Verify OTP & Update Password</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={cooldown > 0 || busy}
                  onPress={handleSendOtp}
                  style={styles.backBtn}
                >
                  <Text style={styles.linkText}>
                    {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={() => router.replace("/(auth)/login")} style={styles.backBtn}>
              <Text style={styles.backMuted}>← Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ivory },
  scroll: { flexGrow: 1, padding: 20, justifyContent: "center" },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "700", color: COLORS.text, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.text,
  },
  otpInput: { fontSize: 18, letterSpacing: 6, fontWeight: "700", textAlign: "center" },
  primaryBtn: {
    backgroundColor: COLORS.brand,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  errorBox: { backgroundColor: COLORS.roseSoft, padding: 10, borderRadius: 10, marginBottom: 8 },
  errorText: { color: COLORS.rose, fontSize: 12, fontWeight: "600" },
  infoBox: { backgroundColor: COLORS.sageSoft, padding: 10, borderRadius: 10, marginBottom: 8 },
  infoText: { color: COLORS.sage, fontSize: 12, fontWeight: "600" },
  devOtpText: {
    marginTop: 8,
    padding: 8,
    backgroundColor: COLORS.amberSoft,
    color: COLORS.amber,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  backBtn: { alignItems: "center", marginTop: 14 },
  linkText: { fontSize: 13, fontWeight: "700", color: COLORS.brand },
  backMuted: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
});
