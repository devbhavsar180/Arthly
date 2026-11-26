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
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, mobileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COLORS } from "@/lib/format";

export default function RegisterScreen() {
  const { registerWithOtp } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSendOtp = async () => {
    setError("");
    setInfo("");
    if (!fullName.trim() || !mobileNumber.trim() || password.length < 6) {
      setError("Enter full name, mobile number, and password (6+ characters).");
      return;
    }
    setBusy(true);
    try {
      const res = await mobileApi.sendOtp({
        mobile_number: mobileNumber.trim(),
        purpose: "REGISTER",
      });
      setStep(2);
      setCooldown(res.cooldown_seconds || 60);
      setDevOtp(res.dev_otp || null);
      setInfo(`Verification OTP sent to ${res.mobile_number}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send registration OTP.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyAndRegister = async () => {
    setError("");
    if (!otp.trim()) {
      setError("Enter the 6-digit OTP sent to your mobile.");
      return;
    }
    setBusy(true);
    try {
      const verify = await mobileApi.verifyOtp({
        mobile_number: mobileNumber.trim(),
        otp: otp.trim(),
        purpose: "REGISTER",
      });
      await registerWithOtp({
        full_name: fullName.trim(),
        mobile_number: verify.mobile_number,
        email: email.trim() || undefined,
        password,
        verification_token: verify.verification_token || undefined,
        otp: otp.trim(),
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed.");
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
          <View style={styles.brandHeader}>
            <View style={styles.logoBox}>
              <Ionicons name="wallet" size={26} color="#fff" />
            </View>
            <Text style={styles.brandName}>Join Arthly</Text>
            <Text style={styles.brandSub}>Step {step} of 2 · Mobile OTP Verification</Text>
          </View>

          <View style={styles.card}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {info ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>{info}</Text>
              </View>
            ) : null}

            {step === 1 ? (
              <>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Aarav Patel"
                />

                <Text style={styles.label}>Mobile Number (Required)</Text>
                <TextInput
                  style={styles.input}
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  keyboardType="phone-pad"
                  placeholder="+91 9876543210"
                />

                <Text style={styles.label}>Email (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="aarav@example.com"
                />

                <Text style={styles.label}>Password (Min 6 characters)</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                />

                <TouchableOpacity style={styles.primaryBtn} onPress={handleSendOtp} disabled={busy}>
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Send Verification OTP</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>Enter 6-Digit OTP</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="• • • • • •"
                />

                {devOtp ? <Text style={styles.devOtpText}>Dev OTP: {devOtp}</Text> : null}

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handleVerifyAndRegister}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Verify Mobile & Create Account</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.rowBetween}>
                  <TouchableOpacity onPress={() => setStep(1)}>
                    <Text style={styles.linkText}>← Edit Number</Text>
                  </TouchableOpacity>
                  <TouchableOpacity disabled={cooldown > 0 || busy} onPress={handleSendOtp}>
                    <Text style={styles.linkText}>
                      {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <View style={styles.footerRow}>
              <Text style={styles.footerMuted}>Already have an account? </Text>
              <Link href="/(auth)/login" style={styles.footerLink}>
                Sign In
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ivory },
  scroll: { flexGrow: 1, padding: 20, justifyContent: "center" },
  brandHeader: { alignItems: "center", marginBottom: 22 },
  logoBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  brandName: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  brandSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
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
    marginTop: 18,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  linkText: { fontSize: 13, fontWeight: "700", color: COLORS.brand },
  errorBox: { backgroundColor: COLORS.roseSoft, padding: 10, borderRadius: 10, marginBottom: 8 },
  errorText: { color: COLORS.rose, fontSize: 12, fontWeight: "600" },
  infoBox: { backgroundColor: COLORS.sageSoft, padding: 10, borderRadius: 10, marginBottom: 8 },
  infoText: { color: COLORS.sage, fontSize: 12, fontWeight: "600" },
  devOtpText: {
    marginTop: 10,
    padding: 8,
    backgroundColor: COLORS.amberSoft,
    color: COLORS.amber,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
  footerMuted: { fontSize: 13, color: COLORS.textMuted },
  footerLink: { fontSize: 13, fontWeight: "700", color: COLORS.brand },
});
