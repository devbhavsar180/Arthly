import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, getApiBaseUrl, setApiBaseUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COLORS } from "@/lib/format";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState("");
  const [serverSaved, setServerSaved] = useState(false);

  useEffect(() => {
    getApiBaseUrl().then(setServerUrl);
  }, []);

  const handleLogin = async () => {
    setError("");
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Cannot reach backend server. Tap 'Server Settings' below to set your API URL."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveServer = async () => {
    if (!serverUrl.trim()) return;
    await setApiBaseUrl(serverUrl);
    setServerSaved(true);
    setTimeout(() => setServerSaved(false), 2000);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.brandHeader}>
            <View style={styles.logoBox}>
              <Ionicons name="wallet" size={28} color="#FFFFFF" />
            </View>
            <Text style={styles.appTitle}>My Expense Tracker</Text>
            <Text style={styles.appSubtitle}>Simple, private personal expense & income tracking</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={styles.rowBetween}>
              <Text style={styles.label}>Password</Text>
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>Forgot password?</Text>
                </TouchableOpacity>
              </Link>
            </View>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
              placeholderTextColor={COLORS.textLight}
              secureTextEntry
            />

            <TouchableOpacity
              style={[styles.primaryBtn, submitting && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={submitting}
            >
              <Text style={styles.primaryBtnText}>{submitting ? "Signing in..." : "Sign In"}</Text>
            </TouchableOpacity>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>New here? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text style={styles.linkText}>Create Account</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>

          <TouchableOpacity
            style={styles.serverToggle}
            onPress={() => setShowServerConfig((v) => !v)}
          >
            <Ionicons name="server-outline" size={15} color={COLORS.textMuted} />
            <Text style={styles.serverToggleText}>Backend Server Settings</Text>
          </TouchableOpacity>

          {showServerConfig && (
            <View style={styles.serverCard}>
              <Text style={styles.label}>FastAPI Backend URL</Text>
              <TextInput
                style={styles.input}
                value={serverUrl}
                onChangeText={setServerUrl}
                placeholder="http://192.168.1.10:8000/api/v1"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.secondaryBtn} onPress={handleSaveServer}>
                <Text style={styles.secondaryBtnText}>
                  {serverSaved ? "Saved!" : "Save Server URL"}
                </Text>
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
  container: { flexGrow: 1, justifyContent: "center", padding: 20 },
  brandHeader: { alignItems: "center", marginBottom: 24 },
  logoBox: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  appTitle: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  appSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, textAlign: "center" },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: "600", color: COLORS.text, marginBottom: 6, marginTop: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
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
    marginTop: 20,
    backgroundColor: COLORS.brand,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
  footerText: { fontSize: 13, color: COLORS.textMuted },
  linkText: { fontSize: 13, fontWeight: "700", color: COLORS.brand },
  errorBox: {
    backgroundColor: COLORS.roseSoft,
    borderColor: "#FECDD3",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  errorText: { fontSize: 12, color: COLORS.rose, fontWeight: "600" },
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
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtn: {
    marginTop: 10,
    backgroundColor: COLORS.sage,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
});
