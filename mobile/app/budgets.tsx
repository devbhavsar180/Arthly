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
import { COLORS, formatCurrency, MONTH_NAMES } from "@/lib/format";
import { BudgetHistoryItem, BudgetItem, BudgetPeriodSummary, Category } from "@/types";

export default function BudgetsScreen() {
  const { currencySymbol, currencyCode } = useAuth();
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState<BudgetPeriodSummary | null>(null);
  const [history, setHistory] = useState<BudgetHistoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<string>("OVERALL");
  const [limitAmount, setLimitAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [budRes, histRes, catRes] = await Promise.all([
        mobileApi.getBudgets({ month, year }),
        mobileApi.getBudgetHistory(6),
        mobileApi.listCategories("EXPENSE"),
      ]);
      setSummary(budRes);
      setHistory(histRes);
      setCategories(catRes);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleSave = async () => {
    const val = Number(limitAmount);
    if (!Number.isFinite(val) || val <= 0) {
      Alert.alert("Invalid Amount", "Enter a positive monthly budget limit.");
      return;
    }
    setSaving(true);
    try {
      await mobileApi.upsertBudget({
        category_id: selectedCatId === "OVERALL" ? null : selectedCatId,
        month,
        year,
        limit_amount: val,
      });
      setLimitAmount("");
      await loadData();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Could not save budget.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPrevious = async () => {
    try {
      const res = await mobileApi.copyPreviousBudgets(month, year);
      Alert.alert("Copied Budgets", `${res.copied} budget(s) copied from last month.`);
      await loadData();
    } catch (err) {
      Alert.alert("Notice", err instanceof ApiError ? err.message : "No prior budgets found.");
    }
  };

  const handleDelete = (item: BudgetItem) => {
    Alert.alert("Delete Budget", `Remove ${item.is_overall ? "Overall" : item.category_name} limit?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await mobileApi.deleteBudget(item.id);
          await loadData();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Monthly Budgets</Text>
            <Text style={styles.sub}>
              {MONTH_NAMES[month - 1]} {year} · Alerts at 80%, 90%, 100% & Over
            </Text>
          </View>
          <TouchableOpacity onPress={handleCopyPrevious} style={styles.copyBtn}>
            <Ionicons name="copy-outline" size={16} color={COLORS.brand} />
          </TouchableOpacity>
        </View>

        {/* Set Budget Form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Configure Limit</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TouchableOpacity
                onPress={() => setSelectedCatId("OVERALL")}
                style={[styles.chip, selectedCatId === "OVERALL" && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, selectedCatId === "OVERALL" && styles.chipTextActive]}
                >
                  Overall Monthly
                </Text>
              </TouchableOpacity>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => setSelectedCatId(c.id)}
                  style={[styles.chip, selectedCatId === c.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, selectedCatId === c.id && styles.chipTextActive]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.formRow}>
            <TextInput
              style={styles.input}
              placeholder={`Limit (${currencySymbol})`}
              keyboardType="numeric"
              value={limitAmount}
              onChangeText={setLimitAmount}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading && !summary ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.brand} />
        ) : (
          summary && (
            <>
              {summary.overall_budget && (
                <BudgetRowCard
                  item={summary.overall_budget}
                  currencySymbol={currencySymbol}
                  currencyCode={currencyCode}
                  onDelete={() => handleDelete(summary.overall_budget!)}
                />
              )}

              {summary.category_budgets.map((item) => (
                <BudgetRowCard
                  key={item.id}
                  item={item}
                  currencySymbol={currencySymbol}
                  currencyCode={currencyCode}
                  onDelete={() => handleDelete(item)}
                />
              ))}

              {history.length > 0 && (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>6-Month History</Text>
                  {history.map((h) => (
                    <View key={`${h.year}-${h.month}`} style={styles.histRow}>
                      <Text style={styles.histLabel}>{h.label}</Text>
                      <Text style={styles.histMeta}>
                        {formatCurrency(h.total_spent, currencySymbol, currencyCode)} /{" "}
                        {formatCurrency(h.overall_limit, currencySymbol, currencyCode)} (
                        {h.utilization_percentage.toFixed(0)}%)
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function BudgetRowCard({
  item,
  currencySymbol,
  currencyCode,
  onDelete,
}: {
  item: BudgetItem;
  currencySymbol: string;
  currencyCode: string;
  onDelete: () => void;
}) {
  const barColor =
    item.alert_status === "EXCEEDED" || item.alert_status === "REACHED_100"
      ? COLORS.rose
      : item.alert_status === "WARNING_80" || item.alert_status === "WARNING_90"
      ? COLORS.amber
      : COLORS.sage;

  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>
          {item.is_overall ? "Overall Monthly Budget" : item.category_name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={[styles.pctText, { color: barColor }]}>
            {item.utilization_percentage.toFixed(1)}%
          </Text>
          <TouchableOpacity onPress={onDelete}>
            <Ionicons name="trash-outline" size={16} color={COLORS.rose} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.min(100, item.utilization_percentage)}%`, backgroundColor: barColor },
          ]}
        />
      </View>
      <View style={styles.rowBetween}>
        <Text style={styles.metaText}>
          Spent {formatCurrency(item.spent_amount, currencySymbol, currencyCode)}
        </Text>
        <Text style={styles.metaText}>
          Limit {formatCurrency(item.limit_amount, currencySymbol, currencyCode)}
        </Text>
      </View>
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
  copyBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text },
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
  formRow: { flexDirection: "row", gap: 10 },
  input: {
    flex: 1,
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: COLORS.brand,
    paddingHorizontal: 18,
    borderRadius: 12,
    justifyContent: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pctText: { fontSize: 13, fontWeight: "800" },
  track: { height: 8, backgroundColor: "#E2E8F0", borderRadius: 99, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 99 },
  metaText: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
  histRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  histLabel: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  histMeta: { fontSize: 12, color: COLORS.textMuted },
});
