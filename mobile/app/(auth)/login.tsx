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
import { ApiError, getApiBaseUrl, mobileApi, setApiBaseUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COLORS } from "@/lib/format";

export default function LoginScreen() {
  const { login, loginWithOtp } = useAuth();
  const [mode, setMode] = useState<"PASSWORD" | "OTP">("PASSWORD");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [showServerBox, setShowServerBox] = useState(false);
  const [serverUrl, setServerUrl] = useState("");

  useEffect(() => {
    getApiBaseUrl().then(setServerUrl).catch(() => { });
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSaveServerUrl = async () => {
    const updated = await setApiBaseUrl(serverUrl);
    setServerUrl(updated);
    setInfo(`Connected to server: ${updated}`);
    setShowServerBox(false);
  };

  const handlePasswordLogin = async () => {
    setError("");
    setInfo("");
    if (!identifier.trim() || !password) {
      setError("Enter your registered mobile number or email and password.");
      return;
    }
    setBusy(true);
    try {
      await login(identifier.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  const handleSendOtp = async () => {
    setError("");
    setInfo("");
    if (!mobileNumber.trim()) {
      setError("Enter your verified mobile number.");
      return;
    }
    setBusy(true);
    try {
      const res = await mobileApi.sendOtp({
        mobile_number: mobileNumber.trim(),
        purpose: "LOGIN",
      });
      setOtpSent(true);
      setCooldown(res.cooldown_seconds || 60);
      setDevOtp(res.dev_otp || null);
      setInfo(`6-digit OTP sent to ${res.mobile_number}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send OTP.");
    } finally {
      setBusy(false);
    }
  };

  const handleOtpLogin = async () => {
    setError("");
    if (!otp.trim()) {
      setError("Enter the 6-digit OTP.");
      return;
    }
    setBusy(true);
    try {
      await loginWithOtp(mobileNumber.trim(), { otp: otp.trim() });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid or expired OTP.");
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
            <Text style={styles.brandName}>Arthly</Text>
            <Text style={styles.brandSub}>Personal Finance & Smart Wealth Tracker</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>Sign in with Password or Mobile OTP</Text>

            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, mode === "PASSWORD" && styles.tabBtnActive]}
                onPress={() => {
                  setMode("PASSWORD");
                  setError("");
                }}
              >
                <Text style={[styles.tabText, mode === "PASSWORD" && styles.tabTextActive]}>
                  Password
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, mode === "OTP" && styles.tabBtnActive]}
                onPress={() => {
                  setMode("OTP");
                  setError("");
                }}
              >
                <Text style={[styles.tabText, mode === "OTP" && styles.tabTextActive]}>
                  Mobile OTP
                </Text>
              </TouchableOpacity>
            </View>

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

            {mode === "PASSWORD" ? (
              <>
                <Text style={styles.label}>Mobile Number or Email</Text>
                <TextInput
                  style={styles.input}
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  placeholder="+91 9876543210 or name@example.com"
                  placeholderTextColor={COLORS.textLight}
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.textLight}
                />

                <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
                  Forgot Password? Reset via Mobile OTP
                </Link>

                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={handlePasswordLogin}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Sign In</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>Verified Mobile Number</Text>
                <TextInput
                  style={styles.input}
                  value={mobileNumber}
                  onChangeText={setMobileNumber}
                  keyboardType="phone-pad"
                  placeholder="+91 9876543210"
                  placeholderTextColor={COLORS.textLight}
                />

                {otpSent && (
                  <>
                    <Text style={styles.label}>6-Digit OTP</Text>
                    <TextInput
                      style={[styles.input, styles.otpInput]}
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="• • • • • •"
                      placeholderTextColor={COLORS.textLight}
                    />
                  </>
                )}

                {devOtp ? (
                  <Text style={styles.devOtpText}>Dev OTP: {devOtp}</Text>
                ) : null}

                {!otpSent ? (
                  <TouchableOpacity style={styles.primaryBtn} onPress={handleSendOtp} disabled={busy}>
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>Send OTP</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={{ gap: 10, marginTop: 6 }}>
                    <TouchableOpacity
                      style={styles.primaryBtn}
                      onPress={handleOtpLogin}
                      disabled={busy}
                    >
                      {busy ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>Verify & Sign In</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      disabled={cooldown > 0 || busy}
                      onPress={handleSendOtp}
                      style={styles.resendBtn}
                    >
                      <Text style={styles.resendText}>
                        {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}

            <View style={styles.footerRow}>
              <Text style={styles.footerMuted}>New to Arthly? </Text>
              <Link href="/(auth)/register" style={styles.footerLink}>
                Create Account
              </Link>
            </View>
          </View>

          <TouchableOpacity
            style={styles.serverToggle}
            onPress={() => setShowServerBox((v) => !v)}
          >
            <Ionicons name="server-outline" size={14} color={COLORS.textMuted} />
            <Text style={styles.serverToggleText}>
              {showServerBox ? "Hide Server URL Settings" : "Server Connection Settings"}
            </Text>
          </TouchableOpacity>

          {showServerBox && (
            <View style={styles.serverCard}>
              <Text style={styles.label}>Backend API URL</Text>
              <TextInput
                style={styles.input}
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
                placeholder="http://192.168.1.10:8000/api/v1"
              />
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleSaveServerUrl}>
                <Text style={styles.secondaryBtnText}>Save Server URL</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ivory },
  scroll: { flexGrow: 1, padding: 20, justifyContent: "center" },
  brandHeader: { alignItems: "center", marginBottom: 24 },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  brandName: { fontSize: 24, fontWeight: "800", color: COLORS.text },
  brandSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  cardSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2, marginBottom: 16 },
  tabRow: {
    flexDirection: "row",
    backgroundColor: COLORS.ivory,
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
  tabBtnActive: { backgroundColor: COLORS.surface },
  tabText: { fontSize: 13, fontWeight: "600", color: COLORS.textMuted },
  tabTextActive: { color: COLORS.brand, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "700", color: COLORS.text, marginBottom: 6, marginTop: 8 },
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
  forgotLink: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.brand,
    alignSelf: "flex-end",
    marginTop: 10,
    marginBottom: 14,
  },
  primaryBtn: {
    backgroundColor: COLORS.brand,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  primaryBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  resendBtn: { alignItems: "center", paddingVertical: 8 },
  resendText: { fontSize: 13, fontWeight: "600", color: COLORS.brand },
  errorBox: {
    backgroundColor: COLORS.roseSoft,
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  errorText: { color: COLORS.rose, fontSize: 12, fontWeight: "600" },
  infoBox: {
    backgroundColor: COLORS.sageSoft,
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
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
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
  footerMuted: { fontSize: 13, color: COLORS.textMuted },
  footerLink: { fontSize: 13, fontWeight: "700", color: COLORS.brand },
  serverToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
  },
  serverToggleText: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600" },
  serverCard: {
    marginTop: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtn: {
    marginTop: 10,
    backgroundColor: COLORS.text,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
