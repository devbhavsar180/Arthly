import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, getApiBaseUrl, mobileApi, setApiBaseUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COLORS } from "@/lib/format";
import { Category, TransactionType } from "@/types";

const CURRENCIES = [
  { code: "INR", symbol: "₹" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
];

export default function ProfileSettingsScreen() {
  const { user, refreshUser, logout, currencyCode } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [serverUrl, setServerUrl] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<TransactionType>("EXPENSE");
  const [currPass, setCurrPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [voiceLang, setVoiceLang] = useState<"gu" | "en" | "hi" | "auto">("gu");

  useEffect(() => {
    getApiBaseUrl().then(setServerUrl);
    mobileApi.listCategories().then(setCategories).catch(() => {});
    if (user?.settings?.preferred_voice_language) {
      setVoiceLang(user.settings.preferred_voice_language);
    }
  }, [user]);

  const selectVoiceLang = async (lang: "gu" | "en" | "hi" | "auto") => {
    try {
      setVoiceLang(lang);
      await mobileApi.updateVoiceLanguage(lang);
      await refreshUser();
      Alert.alert("Saved", "Voice input language updated.");
    } catch {
      Alert.alert("Error", "Could not update voice language.");
    }
  };

  const saveProfile = async () => {
    try {
      await mobileApi.updateProfile({ full_name: fullName.trim(), email: email.trim() });
      await refreshUser();
      Alert.alert("Saved", "Profile updated.");
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Could not update profile.");
    }
  };

  const selectCurrency = async (code: string, symbol: string) => {
    try {
      await mobileApi.updateCurrency({ currency_code: code, currency_symbol: symbol });
      await refreshUser();
    } catch {
      Alert.alert("Error", "Could not update currency.");
    }
  };

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const cat = await mobileApi.createCategory({
        name: newCatName.trim(),
        type: newCatType,
        color: newCatType === "EXPENSE" ? "#2563EB" : "#059669",
      });
      setCategories((prev) => [...prev, cat]);
      setNewCatName("");
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Could not add category.");
    }
  };

  const removeCategory = (cat: Category) => {
    Alert.alert("Delete Category", `Delete "${cat.name}"? Any transactions will move to Other.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await mobileApi.deleteCategory(cat.id, true);
          setCategories((prev) => prev.filter((c) => c.id !== cat.id));
        },
      },
    ]);
  };

  const updatePass = async () => {
    if (newPass.length < 8) {
      Alert.alert("Validation", "New password must be at least 8 characters.");
      return;
    }
    try {
      await mobileApi.changePassword({ current_password: currPass, new_password: newPass });
      Alert.alert("Success", "Password changed. Please sign in again.");
      logout();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Password update failed.");
    }
  };

  const saveServer = async () => {
    await setApiBaseUrl(serverUrl);
    Alert.alert("Saved", "Backend server URL updated.");
  };

  const exportBackup = async () => {
    try {
      await mobileApi.exportBackup();
    } catch {
      Alert.alert("Error", "Could not export backup.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Profile & Settings</Text>

        {/* Profile */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>User Profile</Text>
          <Text style={styles.label}>Full Name</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
          <TouchableOpacity style={styles.primaryBtn} onPress={saveProfile}>
            <Text style={styles.primaryBtnText}>Save Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Currency */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Currency (Default INR)</Text>
          <View style={styles.rowWrap}>
            {CURRENCIES.map((c) => (
              <TouchableOpacity
                key={c.code}
                onPress={() => selectCurrency(c.code, c.symbol)}
                style={[styles.pill, currencyCode === c.code && styles.pillActive]}
              >
                <Text style={[styles.pillText, currencyCode === c.code && styles.pillTextActive]}>
                  {c.symbol} {c.code}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Voice Input Language */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Voice Input Language</Text>
          <View style={styles.rowWrap}>
            {[
              { code: "gu", label: "ગુજરાતી" },
              { code: "hi", label: "हिंदी" },
              { code: "en", label: "English" },
              { code: "auto", label: "Auto" },
            ].map((l) => (
              <TouchableOpacity
                key={l.code}
                onPress={() => selectVoiceLang(l.code as any)}
                style={[styles.pill, voiceLang === l.code && styles.pillActive]}
              >
                <Text style={[styles.pillText, voiceLang === l.code && styles.pillTextActive]}>
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Categories */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Custom Categories</Text>
          <View style={styles.rowGap}>
            {(["EXPENSE", "INCOME"] as TransactionType[]).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setNewCatType(t)}
                style={[styles.pill, newCatType === t && styles.pillActive]}
              >
                <Text style={[styles.pillText, newCatType === t && styles.pillTextActive]}>
                  {t === "EXPENSE" ? "Expense" : "Income"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.rowGap}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={newCatName}
              onChangeText={setNewCatName}
              placeholder="New category name"
              placeholderTextColor={COLORS.textLight}
            />
            <TouchableOpacity style={styles.smallBtn} onPress={addCategory}>
              <Text style={styles.primaryBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          <View style={{ marginTop: 10, gap: 6 }}>
            {categories
              .filter((c) => c.type === newCatType)
              .map((cat) => (
                <View key={cat.id} style={styles.catRow}>
                  <View style={styles.rowGap}>
                    <View style={[styles.dot, { backgroundColor: cat.color }]} />
                    <Text style={styles.catName}>{cat.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeCategory(cat)}>
                    <Ionicons name="trash-outline" size={16} color={COLORS.textLight} />
                  </TouchableOpacity>
                </View>
              ))}
          </View>
        </View>

        {/* Change Password */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Change Password</Text>
          <TextInput
            style={styles.input}
            value={currPass}
            onChangeText={setCurrPass}
            placeholder="Current password"
            placeholderTextColor={COLORS.textLight}
            secureTextEntry
          />
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={newPass}
            onChangeText={setNewPass}
            placeholder="New password (min. 8 chars)"
            placeholderTextColor={COLORS.textLight}
            secureTextEntry
          />
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: "#0F172A" }]} onPress={updatePass}>
            <Text style={styles.primaryBtnText}>Update Password</Text>
          </TouchableOpacity>
        </View>

        {/* Backup & Server Sync URL */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Backup & Backend Sync</Text>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: COLORS.sage }]} onPress={exportBackup}>
            <Text style={styles.primaryBtnText}>Export Full Data Backup (JSON)</Text>
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 14 }]}>FastAPI Server URL</Text>
          <TextInput
            style={styles.input}
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.outlineBtn} onPress={saveServer}>
            <Text style={styles.outlineBtnText}>Save Server URL</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ivory },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
  title: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text, marginBottom: 10 },
  label: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted, marginBottom: 5, marginTop: 8 },
  input: {
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
  },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  smallBtn: {
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  outlineBtn: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  outlineBtnText: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  rowGap: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.ivory,
  },
  pillActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  pillText: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted },
  pillTextActive: { color: "#FFFFFF" },
  catRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  catName: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.roseSoft,
    borderWidth: 1,
    borderColor: "#FECDD3",
    borderRadius: 14,
    paddingVertical: 14,
  },
  logoutText: { color: COLORS.rose, fontSize: 14, fontWeight: "700" },
});
