import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
import { ApiError, mobileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COLORS } from "@/lib/format";
import { AdminDashboardStats, AdminUserItem, AppConfigItem, SystemCategoryItem } from "@/types";

export default function MobileAdminScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "users" | "categories" | "broadcast">("overview");
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [categories, setCategories] = useState<SystemCategoryItem[]>([]);
  const [configs, setConfigs] = useState<AppConfigItem[]>([]);
  const [search, setSearch] = useState("");
  const [newCatName, setNewCatName] = useState("");
  const [annTitle, setAnnTitle] = useState("");
  const [annMsg, setAnnMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (user?.role !== "ADMIN") return;
    try {
      const [sRes, uRes, cRes, cfgRes] = await Promise.all([
        mobileApi.getAdminDashboard(),
        mobileApi.getAdminUsers({ search: search || undefined }),
        mobileApi.listSystemCategories(),
        mobileApi.listAdminConfigs(),
      ]);
      setStats(sRes);
      setUsers(uRes);
      setCategories(cRes);
      setConfigs(cfgRes);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user?.role, search]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  if (user?.role !== "ADMIN") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.deniedBox}>
          <Ionicons name="lock-closed" size={36} color={COLORS.rose} />
          <Text style={styles.deniedTitle}>Admin Access Required</Text>
          <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.back()}>
            <Text style={styles.backHomeText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Arthly Admin Panel</Text>
            <Text style={styles.sub}>Zero raw financial exposure · Aggregate metrics only</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          {(["overview", "users", "categories", "broadcast"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabPill, tab === t && styles.tabPillActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading && !stats ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.brand} />
        ) : (
          <>
            {tab === "overview" && stats && (
              <View style={styles.grid}>
                <Tile label="Total Users" value={stats.total_users} />
                <Tile label="Active Users" value={stats.active_users} />
                <Tile label="Verified Mobile" value={`${stats.verified_mobile_rate}%`} />
                <Tile label="7d Signups" value={stats.new_registrations_7d} />
                <Tile label="Transactions" value={stats.total_transactions_count} />
                <Tile label="Screenshot Scans" value={stats.total_screenshots_count} />
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Feature Flags</Text>
                  {configs.map((cfg) => (
                    <View key={cfg.key} style={styles.rowBetween}>
                      <Text style={styles.cfgKey}>{cfg.key}</Text>
                      <TouchableOpacity
                        style={styles.toggleBtn}
                        onPress={async () => {
                          const nextVal = cfg.value === "true" ? "false" : "true";
                          await mobileApi.updateAdminConfig(cfg.key, nextVal);
                          loadAll();
                        }}
                      >
                        <Text style={styles.toggleText}>{cfg.value}</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {tab === "users" && (
              <View style={styles.card}>
                <TextInput
                  style={styles.input}
                  placeholder="Search name, email or mobile..."
                  value={search}
                  onChangeText={setSearch}
                />
                {users.map((u) => (
                  <View key={u.id} style={styles.userRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.uName}>
                        {u.full_name} ({u.role})
                      </Text>
                      <Text style={styles.uSub}>
                        {u.email} · {u.mobile_number || "No mobile"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.statusBtn,
                        { backgroundColor: u.is_active ? COLORS.roseSoft : COLORS.sageSoft },
                      ]}
                      onPress={async () => {
                        try {
                          await mobileApi.updateAdminUserStatus(u.id, !u.is_active);
                          loadAll();
                        } catch (err) {
                          Alert.alert("Error", err instanceof ApiError ? err.message : "Failed");
                        }
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: u.is_active ? COLORS.rose : COLORS.sage,
                        }}
                      >
                        {u.is_active ? "Disable" : "Activate"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {tab === "categories" && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Global Categories</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="New expense category"
                    value={newCatName}
                    onChangeText={setNewCatName}
                  />
                  <TouchableOpacity
                    style={styles.primarySmall}
                    onPress={async () => {
                      if (!newCatName.trim()) return;
                      await mobileApi.createSystemCategory({
                        name: newCatName.trim(),
                        type: "EXPENSE",
                        color: "#2563EB",
                      });
                      setNewCatName("");
                      loadAll();
                    }}
                  >
                    <Text style={styles.primarySmallText}>Add</Text>
                  </TouchableOpacity>
                </View>
                {categories.map((c) => (
                  <View key={c.id} style={styles.userRow}>
                    <Text style={styles.uName}>
                      {c.name} ({c.type})
                    </Text>
                    <TouchableOpacity
                      onPress={async () => {
                        await mobileApi.deleteSystemCategory(c.id);
                        loadAll();
                      }}
                    >
                      <Ionicons name="trash-outline" size={16} color={COLORS.rose} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {tab === "broadcast" && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Send Announcement</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Title"
                  value={annTitle}
                  onChangeText={setAnnTitle}
                />
                <TextInput
                  style={[styles.input, { height: 90, textAlignVertical: "top" }]}
                  placeholder="Announcement message to all active users..."
                  multiline
                  value={annMsg}
                  onChangeText={setAnnMsg}
                />
                <TouchableOpacity
                  style={styles.sendBtn}
                  onPress={async () => {
                    if (!annTitle.trim() || !annMsg.trim()) return;
                    const res = await mobileApi.createAdminAnnouncement({
                      title: annTitle.trim(),
                      message: annMsg.trim(),
                      severity: "info",
                    });
                    setAnnTitle("");
                    setAnnMsg("");
                    Alert.alert("Broadcast Sent", `Delivered to ${res.recipients_count} user(s).`);
                  }}
                >
                  <Text style={styles.sendBtnText}>Broadcast Announcement</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ivory },
  scroll: { padding: 16, paddingBottom: 32, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  sub: { fontSize: 11, color: COLORS.textMuted },
  tabRow: { flexDirection: "row", gap: 6 },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  tabPillActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  tabText: { fontSize: 10, fontWeight: "700", color: COLORS.textMuted },
  tabTextActive: { color: "#fff" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tileLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
  tileValue: { fontSize: 20, fontWeight: "800", color: COLORS.text, marginTop: 4 },
  card: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cfgKey: { fontSize: 12, fontWeight: "600", color: COLORS.text },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.brandSoft,
  },
  toggleText: { fontSize: 11, fontWeight: "700", color: COLORS.brand },
  input: {
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  userRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  uName: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  uSub: { fontSize: 11, color: COLORS.textMuted },
  statusBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  primarySmall: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: "center",
  },
  primarySmallText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  sendBtn: {
    backgroundColor: COLORS.brand,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
  },
  sendBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  deniedBox: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  deniedTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  backHomeBtn: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  backHomeText: { color: "#fff", fontWeight: "700" },
});
