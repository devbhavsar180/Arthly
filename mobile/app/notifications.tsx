import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { mobileApi } from "@/lib/api";
import { COLORS } from "@/lib/format";
import { AppNotification, NotificationPreferences } from "@/types";

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [listRes, prefRes] = await Promise.all([
        mobileApi.listNotifications(false),
        mobileApi.getNotificationPreferences(),
      ]);
      setItems(listRes.items);
      setUnreadCount(listRes.unread_count);
      setPrefs(prefRes);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleCheckReminders = async () => {
    try {
      const res = await mobileApi.checkSmartReminders();
      Alert.alert(
        "Smart Alerts",
        res.new_reminders_count > 0
          ? `Found ${res.new_reminders_count} new alert(s).`
          : "All goal and budget alerts are up to date."
      );
      await loadData();
    } catch {
      // ignore
    }
  };

  const handleMarkAll = async () => {
    await mobileApi.markAllNotificationsRead().catch(() => {});
    await loadData();
  };

  const handleTogglePref = async (key: keyof NotificationPreferences, val: boolean) => {
    if (!prefs) return;
    setPrefs({ ...prefs, [key]: val });
    try {
      const updated = await mobileApi.updateNotificationPreferences({ [key]: val });
      setPrefs(updated);
    } catch {
      setPrefs(prefs);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
          />
        }
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Notifications</Text>
            <Text style={styles.sub}>{unreadCount} unread alert(s)</Text>
          </View>
          <TouchableOpacity onPress={handleCheckReminders} style={styles.iconAction}>
            <Ionicons name="sparkles-outline" size={18} color={COLORS.brand} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleMarkAll} style={styles.iconAction}>
            <Ionicons name="checkmark-done-outline" size={18} color={COLORS.sage} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.brand} />
        ) : items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="notifications-off-outline" size={32} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        ) : (
          items.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[styles.card, !n.is_read && styles.unreadCard]}
              onPress={async () => {
                if (!n.is_read) {
                  await mobileApi.markNotificationRead(n.id).catch(() => {});
                  loadData();
                }
              }}
            >
              <View style={styles.rowBetween}>
                <Text style={styles.nTitle}>{n.title}</Text>
                <TouchableOpacity
                  onPress={async () => {
                    await mobileApi.deleteNotification(n.id).catch(() => {});
                    loadData();
                  }}
                >
                  <Ionicons name="trash-outline" size={15} color={COLORS.textLight} />
                </TouchableOpacity>
              </View>
              <Text style={styles.nMsg}>{n.message}</Text>
              <Text style={styles.nDate}>{new Date(n.created_at).toLocaleString()}</Text>
            </TouchableOpacity>
          ))
        )}

        {prefs && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Alert Preferences</Text>
            {(
              [
                ["budget_alerts_enabled", "Budget Threshold Alerts"],
                ["goal_alerts_enabled", "Goal Milestones & Reminders"],
                ["unusual_spending_enabled", "Unusual Spending Alerts"],
                ["push_enabled", "Mobile Alerts Enabled"],
              ] as [keyof NotificationPreferences, string][]
            ).map(([k, label]) => (
              <View key={k} style={styles.prefRow}>
                <Text style={styles.prefLabel}>{label}</Text>
                <Switch
                  value={Boolean(prefs[k])}
                  onValueChange={(v) => handleTogglePref(k, v)}
                  trackColor={{ false: COLORS.border, true: COLORS.brand }}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ivory },
  scroll: { padding: 16, paddingBottom: 32, gap: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
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
  iconAction: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 28,
    alignItems: "center",
    gap: 8,
  },
  emptyText: { fontSize: 13, color: COLORS.textMuted },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 5,
  },
  unreadCard: { borderColor: COLORS.brand, backgroundColor: "#F8FAFF" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  nTitle: { flex: 1, fontSize: 14, fontWeight: "800", color: COLORS.text, paddingRight: 8 },
  nMsg: { fontSize: 12, color: COLORS.textMuted, lineHeight: 17 },
  nDate: { fontSize: 10, color: COLORS.textLight },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text, marginBottom: 4 },
  prefRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  prefLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text },
});
