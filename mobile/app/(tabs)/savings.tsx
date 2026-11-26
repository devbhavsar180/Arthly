import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
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
import { COLORS, formatCompact, formatCurrency, formatDisplayDate, getTodayIso } from "@/lib/format";
import { SavingsDashboardResponse, SavingsGoal } from "@/types";

const GOAL_COLORS = ["#2563EB", "#10B981", "#7C3AED", "#D97706", "#E11D48"];

export default function SavingsScreen() {
  const { currencySymbol, currencyCode } = useAuth();
  const router = useRouter();
  const now = new Date();
  const [data, setData] = useState<SavingsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create Goal Modal
  const [goalModal, setGoalModal] = useState(false);
  const [name, setName] = useState("");
  const [targetAmt, setTargetAmt] = useState("");
  const [initialAmt, setInitialAmt] = useState("");
  const [targetDate, setTargetDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    return d.toISOString().split("T")[0];
  });
  const [color, setColor] = useState(GOAL_COLORS[0]);
  const [savingGoal, setSavingGoal] = useState(false);

  // Contribute Modal
  const [contribGoal, setContribGoal] = useState<SavingsGoal | null>(null);
  const [contribAmt, setContribAmt] = useState("");
  const [contribNotes, setContribNotes] = useState("");
  const [savingContrib, setSavingContrib] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await mobileApi.getSavingsDashboard({
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      });
      setData(res);
    } catch {
      // ignore transient error
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

  const handleCreateGoal = async () => {
    const amt = Number(targetAmt);
    if (!name.trim() || !Number.isFinite(amt) || amt <= 0) {
      Alert.alert("Invalid Input", "Enter a goal name and positive target amount.");
      return;
    }
    setSavingGoal(true);
    try {
      await mobileApi.createSavingsGoal({
        name: name.trim(),
        target_amount: amt,
        current_amount: Number(initialAmt) || 0,
        target_date: targetDate,
        color,
      });
      setGoalModal(false);
      setName("");
      setTargetAmt("");
      setInitialAmt("");
      await loadData();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Could not create goal.");
    } finally {
      setSavingGoal(false);
    }
  };

  const handleContribute = async () => {
    if (!contribGoal) return;
    const amt = Number(contribAmt);
    if (!Number.isFinite(amt) || amt <= 0) {
      Alert.alert("Invalid Amount", "Enter a positive amount to contribute.");
      return;
    }
    setSavingContrib(true);
    try {
      const updated = await mobileApi.contributeToGoal(contribGoal.id, {
        amount: amt,
        contribution_date: getTodayIso(),
        notes: contribNotes.trim() || undefined,
      });
      setContribGoal(null);
      setContribAmt("");
      setContribNotes("");
      if (updated.status === "COMPLETED") {
        Alert.alert("Goal Reached!", `"${updated.name}" is now 100% completed!`);
      }
      await loadData();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Contribution failed.");
    } finally {
      setSavingContrib(false);
    }
  };

  const handleDeleteGoal = (g: SavingsGoal) => {
    Alert.alert("Delete Goal", `Remove "${g.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await mobileApi.deleteSavingsGoal(g.id);
          await loadData();
        },
      },
    ]);
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
          <View>
            <Text style={styles.title}>Savings & Goals</Text>
            <Text style={styles.sub}>Track net savings rate and target milestones</Text>
          </View>
          <TouchableOpacity style={styles.budgetLinkBtn} onPress={() => router.push("/budgets")}>
            <Ionicons name="speedometer-outline" size={16} color={COLORS.brand} />
            <Text style={styles.budgetLinkText}>Budgets</Text>
          </TouchableOpacity>
        </View>

        {loading && !data ? (
          <ActivityIndicator style={{ marginTop: 32 }} color={COLORS.brand} />
        ) : (
          data && (
            <>
              {/* 4 Savings Period Tiles */}
              <View style={styles.periodGrid}>
                {[data.weekly, data.monthly, data.yearly, data.all_time].map((p) => {
                  const pos = p.savings >= 0;
                  return (
                    <View key={p.label} style={styles.periodCard}>
                      <View style={styles.periodTop}>
                        <Text style={styles.periodLabel}>{p.label}</Text>
                        <Text
                          style={[
                            styles.rateChip,
                            {
                              color: pos ? COLORS.sage : COLORS.rose,
                              backgroundColor: pos ? COLORS.sageSoft : COLORS.roseSoft,
                            },
                          ]}
                        >
                          {p.savings_rate.toFixed(0)}%
                        </Text>
                      </View>
                      <Text style={[styles.periodAmt, !pos && { color: COLORS.rose }]}>
                        {formatCompact(p.savings, currencySymbol)}
                      </Text>
                      <Text style={styles.periodMeta}>
                        In {formatCompact(p.income, currencySymbol)} · Out{" "}
                        {formatCompact(p.expenses, currencySymbol)}
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* Goals Summary & CTA */}
              <View style={styles.goalsHeader}>
                <View>
                  <Text style={styles.sectionTitle}>
                    Your Targets ({data.goals_summary.active_goals} Active)
                  </Text>
                  <Text style={styles.sub}>
                    Saved in goals:{" "}
                    {formatCurrency(
                      data.goals_summary.total_saved_in_goals,
                      currencySymbol,
                      currencyCode
                    )}
                  </Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => setGoalModal(true)}>
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.addBtnText}>New Goal</Text>
                </TouchableOpacity>
              </View>

              {data.goals.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="flag-outline" size={32} color={COLORS.brand} />
                  <Text style={styles.emptyTitle}>No savings goals yet</Text>
                  <Text style={styles.emptyDesc}>
                    Set your first financial target to receive smart pace tracking and milestone
                    notifications.
                  </Text>
                </View>
              ) : (
                data.goals.map((g) => (
                  <View key={g.id} style={styles.goalCard}>
                    <View style={styles.goalTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.goalName}>{g.name}</Text>
                        <Text style={styles.goalDate}>
                          Target: {formatDisplayDate(g.target_date)} ·{" "}
                          {g.status === "COMPLETED"
                            ? "Completed"
                            : `${Math.max(0, g.days_remaining)}d left`}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor:
                              g.status === "COMPLETED"
                                ? COLORS.sageSoft
                                : g.pace_status === "BEHIND_SCHEDULE"
                                ? COLORS.amberSoft
                                : COLORS.brandSoft,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            {
                              color:
                                g.status === "COMPLETED"
                                  ? COLORS.sage
                                  : g.pace_status === "BEHIND_SCHEDULE"
                                  ? COLORS.amber
                                  : COLORS.brand,
                            },
                          ]}
                        >
                          {g.pace_status.replace("_", " ")}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${Math.min(100, g.completion_percentage)}%`,
                            backgroundColor: g.color || COLORS.brand,
                          },
                        ]}
                      />
                    </View>

                    <View style={styles.goalAmounts}>
                      <Text style={styles.goalSaved}>
                        {formatCurrency(g.current_amount, currencySymbol, currencyCode)} /{" "}
                        {formatCurrency(g.target_amount, currencySymbol, currencyCode)}
                      </Text>
                      <Text style={styles.goalPct}>{g.completion_percentage.toFixed(1)}%</Text>
                    </View>

                    <Text style={styles.suggestion}>{g.suggestion}</Text>

                    <View style={styles.goalActions}>
                      {g.status !== "COMPLETED" && (
                        <TouchableOpacity
                          style={styles.contribBtn}
                          onPress={() => {
                            setContribGoal(g);
                            setContribAmt("");
                            setContribNotes("");
                          }}
                        >
                          <Ionicons name="add-circle-outline" size={16} color="#fff" />
                          <Text style={styles.contribText}>Add Money</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={styles.delBtn}
                        onPress={() => handleDeleteGoal(g)}
                      >
                        <Ionicons name="trash-outline" size={16} color={COLORS.rose} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </>
          )
        )}
      </ScrollView>

      {/* New Goal Modal */}
      <Modal visible={goalModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Savings Goal</Text>
            <TextInput
              style={styles.input}
              placeholder="Goal Name (e.g. Emergency Fund)"
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder={`Target Amount (${currencySymbol})`}
              keyboardType="numeric"
              value={targetAmt}
              onChangeText={setTargetAmt}
            />
            <TextInput
              style={styles.input}
              placeholder={`Initial Saved (${currencySymbol}) - Optional`}
              keyboardType="numeric"
              value={initialAmt}
              onChangeText={setInitialAmt}
            />
            <TextInput
              style={styles.input}
              placeholder="Target Date (YYYY-MM-DD)"
              value={targetDate}
              onChangeText={setTargetDate}
            />
            <View style={styles.colorRow}>
              {GOAL_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setColor(c)}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    color === c && styles.colorDotActive,
                  ]}
                />
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setGoalModal(false)}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveModalBtn}
                onPress={handleCreateGoal}
                disabled={savingGoal}
              >
                <Text style={styles.saveModalText}>
                  {savingGoal ? "Saving..." : "Create Goal"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Contribute Modal */}
      <Modal visible={Boolean(contribGoal)} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add to {contribGoal?.name}</Text>
            <TextInput
              style={styles.input}
              placeholder={`Amount (${currencySymbol})`}
              keyboardType="numeric"
              value={contribAmt}
              onChangeText={setContribAmt}
            />
            <TextInput
              style={styles.input}
              placeholder="Note (Optional)"
              value={contribNotes}
              onChangeText={setContribNotes}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setContribGoal(null)}
              >
                <Text style={styles.cancelModalText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveModalBtn}
                onPress={handleContribute}
                disabled={savingContrib}
              >
                <Text style={styles.saveModalText}>
                  {savingContrib ? "Adding..." : "Confirm Deposit"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ivory },
  scroll: { padding: 16, paddingBottom: 32, gap: 14 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  sub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  budgetLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.brandSoft,
  },
  budgetLinkText: { fontSize: 12, fontWeight: "700", color: COLORS.brand },
  periodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  periodCard: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  periodTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  periodLabel: { fontSize: 11, fontWeight: "700", color: COLORS.textMuted },
  rateChip: { fontSize: 10, fontWeight: "800", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 99 },
  periodAmt: { fontSize: 20, fontWeight: "800", color: COLORS.text, marginTop: 6 },
  periodMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  goalsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.brand,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  addBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  emptyDesc: { fontSize: 12, color: COLORS.textMuted, textAlign: "center" },
  goalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  goalTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  goalName: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  goalDate: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99, alignSelf: "flex-start" },
  statusText: { fontSize: 10, fontWeight: "800" },
  progressTrack: { height: 9, backgroundColor: "#E2E8F0", borderRadius: 99, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 99 },
  goalAmounts: { flexDirection: "row", justifyContent: "space-between" },
  goalSaved: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  goalPct: { fontSize: 12, fontWeight: "800", color: COLORS.brand },
  suggestion: {
    fontSize: 11,
    color: COLORS.textMuted,
    backgroundColor: COLORS.ivory,
    padding: 9,
    borderRadius: 10,
  },
  goalActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  contribBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.sage,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  contribText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  delBtn: { padding: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: COLORS.text },
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
  colorRow: { flexDirection: "row", gap: 10 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotActive: { borderWidth: 3, borderColor: COLORS.text },
  modalBtns: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 6 },
  cancelModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  cancelModalText: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted },
  saveModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.brand,
  },
  saveModalText: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
