import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, getApiBaseUrl, mobileApi, setApiBaseUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COLORS } from "@/lib/format";
import { Category } from "@/types";

const CURRENCIES = [
  { code: "INR", symbol: "₹", label: "Indian Rupee (₹)" },
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "GBP", symbol: "£", label: "British Pound (£)" },
];

const VOICE_LANGUAGES: { code: "gu" | "en" | "hi" | "auto"; label: string }[] = [
  { code: "gu", label: "Gujarati" },
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "auto", label: "Auto" },
];

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [voiceLang, setVoiceLang] = useState<"gu" | "en" | "hi" | "auto">(
    user?.settings?.preferred_voice_language || "gu"
  );
  const [serverUrl, setServerUrl] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState("");

  // Mobile OTP Verification state
  const [mobileNum, setMobileNum] = useState(user?.mobile_number || "");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    getApiBaseUrl().then(setServerUrl).catch(() => { });
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useFocusEffect(
    useCallback(() => {
      mobileApi.listCategories().then(setCategories).catch(() => { });
    }, [])
  );

  const handleSaveProfile = async () => {
    try {
      await mobileApi.updateProfile({ full_name: fullName.trim(), email: email.trim() });
      await refreshUser();
      Alert.alert("Saved", "Profile updated.");
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Could not update profile.");
    }
  };

  const handleSendVerifyOtp = async () => {
    if (!mobileNum.trim()) {
      Alert.alert("Required", "Enter your mobile number.");
      return;
    }
    try {
      const res = await mobileApi.sendOtp({
        mobile_number: mobileNum.trim(),
        purpose: "VERIFY_MOBILE",
      });
      setOtpSent(true);
      setCooldown(res.cooldown_seconds || 60);
      setDevOtp(res.dev_otp || null);
      Alert.alert("OTP Sent", `Verification code sent to ${res.mobile_number}.`);
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Could not send OTP.");
    }
  };

  const handleVerifyMobile = async () => {
    try {
      await mobileApi.verifyMobile({ mobile_number: mobileNum.trim(), otp: otp.trim() });
      await refreshUser();
      setOtpSent(false);
      setOtp("");
      setDevOtp(null);
      Alert.alert("Verified", "Mobile number verified successfully.");
    } catch (err) {
      Alert.alert("Invalid OTP", err instanceof ApiError ? err.message : "Verification failed.");
    }
  };

  const exportBackup = async () => {
    try {
      await mobileApi.exportBackup();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Backup export failed.");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Account Header */}
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.full_name?.[0] || "A").toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.full_name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <Text style={styles.badgeLine}>
              {user?.mobile_verified
                ? `Verified Mobile: ${user.mobile_number}`
                : "Mobile Not Verified"}
              {user?.role === "ADMIN" ? " · ADMIN" : ""}
            </Text>
          </View>
        </View>

        {/* Arthly Shortcuts */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Arthly Features</Text>
          <ShortcutRow
            icon="speedometer-outline"
            label="Monthly Budgets & Limits"
            onPress={() => router.push("/budgets")}
          />
          <ShortcutRow
            icon="notifications-outline"
            label="Notifications & Smart Alerts"
            onPress={() => router.push("/notifications")}
          />
          <ShortcutRow
            icon="scan-outline"
            label="Scan Payment Screenshot"
            onPress={() => router.push("/screenshot-import")}
          />
          <ShortcutRow
            icon="bar-chart-outline"
            label="Analytics & PDF/Excel Reports"
            onPress={() => router.push("/(tabs)/reports")}
          />
          <ShortcutRow
            icon="checkmark-done-outline"
            label="Bank Statement Verification"
            onPress={() => router.push("/reconciliation")}
          />
          {user?.role === "ADMIN" && (
            <ShortcutRow
              icon="shield-checkmark-outline"
              label="Admin Control Panel"
              onPress={() => router.push("/admin")}
            />
          )}
        </View>

        {/* Mobile OTP Verification Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mobile Number & OTP Verification</Text>
          <TextInput
            style={styles.input}
            value={mobileNum}
            onChangeText={setMobileNum}
            keyboardType="phone-pad"
            placeholder="+91 9876543210"
          />
          <TouchableOpacity
            style={styles.secondaryBtn}
            disabled={cooldown > 0}
            onPress={handleSendVerifyOtp}
          >
            <Text style={styles.secondaryBtnText}>
              {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Send Verification OTP"}
            </Text>
          </TouchableOpacity>

          {otpSent && (
            <>
              <TextInput
                style={styles.input}
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="Enter 6-digit OTP"
              />
              {devOtp ? <Text style={styles.devOtp}>Dev OTP: {devOtp}</Text> : null}
              <TouchableOpacity style={styles.primaryBtn} onPress={handleVerifyMobile}>
                <Text style={styles.primaryBtnText}>Verify Mobile Number</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Voice Language */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Voice Recognition Language</Text>
          <View style={styles.chipRow}>
            {VOICE_LANGUAGES.map((l) => (
              <TouchableOpacity
                key={l.code}
                style={[styles.chip, voiceLang === l.code && styles.chipActive]}
                onPress={async () => {
                  setVoiceLang(l.code);
                  await mobileApi.updateVoiceLanguage(l.code);
                  await refreshUser();
                }}
              >
                <Text style={[styles.chipText, voiceLang === l.code && styles.chipTextActive]}>
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Currency */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Default Currency</Text>
          <View style={styles.chipRow}>
            {CURRENCIES.map((c) => {
              const active = user?.settings?.currency_code === c.code;
              return (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={async () => {
                    await mobileApi.updateCurrency({
                      currency_code: c.code,
                      currency_symbol: c.symbol,
                    });
                    await refreshUser();
                  }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {c.code} ({c.symbol})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Profile Edit */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account Details</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveProfile}>
            <Text style={styles.primaryBtnText}>Save Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Categories */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Custom Expense Category</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="e.g. Fuel, Subscriptions"
              value={newCatName}
              onChangeText={setNewCatName}
            />
            <TouchableOpacity
              style={styles.primarySmall}
              onPress={async () => {
                if (!newCatName.trim()) return;
                await mobileApi.createCategory({
                  name: newCatName.trim(),
                  type: "EXPENSE",
                  color: "#2563EB",
                });
                setNewCatName("");
                const updated = await mobileApi.listCategories();
                setCategories(updated);
              }}
            >
              <Text style={styles.primaryBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subMuted}>{categories.length} categories configured</Text>
        </View>

        {/* Server URL & Backup */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Server & Backup</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={async () => {
              const updated = await setApiBaseUrl(serverUrl);
              setServerUrl(updated);
              Alert.alert("Updated", `API Server: ${updated}`);
            }}
          >
            <Text style={styles.secondaryBtnText}>Update Server URL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.sage }]}
            onPress={exportBackup}
          >
            <Text style={styles.primaryBtnText}>Export JSON Backup</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.rose} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ShortcutRow({
  icon,
  label,
  onPress,
}: {
  icon: any;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.shortcutRow} onPress={onPress}>
      <View style={styles.shortcutIcon}>
        <Ionicons name={icon} size={18} color={COLORS.brand} />
      </View>
      <Text style={styles.shortcutLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ivory },
  scroll: { padding: 16, paddingBottom: 36, gap: 12 },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  name: { fontSize: 17, fontWeight: "800", color: COLORS.text },
  email: { fontSize: 12, color: COLORS.textMuted },
  badgeLine: { fontSize: 11, fontWeight: "700", color: COLORS.brand, marginTop: 3 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  shortcutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  shortcutIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  shortcutLabel: { flex: 1, fontSize: 13, fontWeight: "700", color: COLORS.text },
  input: {
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  chipText: { fontSize: 12, fontWeight: "600", color: COLORS.text },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  primaryBtn: {
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primarySmall: {
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  secondaryBtn: {
    backgroundColor: COLORS.brandSoft,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  secondaryBtnText: { color: COLORS.brand, fontSize: 13, fontWeight: "700" },
  devOtp: { fontSize: 12, fontWeight: "700", color: COLORS.amber },
  subMuted: { fontSize: 11, color: COLORS.textMuted },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.roseSoft,
    borderRadius: 14,
    paddingVertical: 14,
  },
  logoutText: { color: COLORS.rose, fontSize: 14, fontWeight: "700" },
});
