import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, mobileApi } from "@/lib/api";
import { COLORS } from "@/lib/format";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requestReset = async () => {
    setError("");
    setMsg("");
    setLoading(true);
    try {
      const res = await mobileApi.forgotPassword(email.trim());
      setMsg(res.message);
      if (res.reset_token) setToken(res.reset_token);
      setStep("reset");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to request reset.");
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = async () => {
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await mobileApi.resetPassword(token.trim(), newPassword);
      setMsg(res.message);
      setTimeout(() => router.replace("/(auth)/login"), 1200);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Reset failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Recover your account securely</Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {msg ? <Text style={styles.infoText}>{msg}</Text> : null}

          {step === "email" ? (
            <>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={requestReset} disabled={loading}>
                <Text style={styles.primaryBtnText}>
                  {loading ? "Requesting..." : "Request Reset Token"}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.label}>Reset Token</Text>
              <TextInput
                style={styles.input}
                value={token}
                onChangeText={setToken}
                placeholder="Paste reset token"
                autoCapitalize="none"
              />
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="At least 8 characters"
                secureTextEntry
              />
              <TouchableOpacity style={styles.primaryBtn} onPress={confirmReset} disabled={loading}>
                <Text style={styles.primaryBtnText}>
                  {loading ? "Updating..." : "Set New Password"}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ivory },
  container: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: "600", color: COLORS.text, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  primaryBtn: {
    marginTop: 18,
    backgroundColor: COLORS.brand,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  backBtn: { marginTop: 16, alignItems: "center" },
  backText: { color: COLORS.textMuted, fontWeight: "600", fontSize: 13 },
  errorText: { color: COLORS.rose, fontSize: 12, fontWeight: "600", marginBottom: 8 },
  infoText: { color: COLORS.sage, fontSize: 12, fontWeight: "600", marginBottom: 8 },
});
