import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CategoryBarsList,
  ExpenseDonutChart,
  IncomeVsExpenseChart,
} from "@/components/Charts";
import { mobileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COLORS, formatCurrency, formatDisplayDate, MONTH_NAMES } from "@/lib/format";
import { DashboardResponse } from "@/types";

export default function HomeDashboardScreen() {
  const { user, currencySymbol } = useAuth();
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fmt = (v: number) => formatCurrency(v, currencySymbol);

  const loadDashboard = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const res = await mobileApi.getDashboard({ month, year });
        setData(res);
      } catch {
        setError("Unable to sync with backend. Pull down to retry or verify Server URL in Profile.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [month, year]
  );

  useFocusEffect(
    useCallback(() => {
      loadDashboard(false);
    }, [loadDashboard])
  );

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(true)} tintColor={COLORS.brand} />
        }
      >
        {/* Top Greeting & Month Navigator */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.full_name?.split(" ")[0] || "There"}</Text>
            <Text style={styles.subGreeting}>Personal Expense & Income Overview</Text>
          </View>
          <View style={styles.quickBtns}>
            <TouchableOpacity style={styles.quickChipExp} onPress={() => router.push("/add-expense")}>
              <Ionicons name="remove-circle-outline" size={16} color={COLORS.brand} />
              <Text style={styles.quickChipExpText}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickChipInc} onPress={() => router.push("/add-income")}>
              <Ionicons name="add-circle-outline" size={16} color={COLORS.sage} />
              <Text style={styles.quickChipIncText}>Income</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Month Switcher */}
        <View style={styles.monthBar}>
          <TouchableOpacity onPress={prevMonth} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>
            {MONTH_NAMES[month - 1]} {year}
          </Text>
          <TouchableOpacity onPress={nextMonth} style={styles.monthArrow}>
            <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading && !data ? (
          <View style={{ paddingVertical: 48 }}>
            <ActivityIndicator size="large" color={COLORS.brand} />
          </View>
        ) : data ? (
          <>
            {/* Hero Balance Card */}
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>Remaining Balance & Savings</Text>
              <Text style={styles.heroAmount}>{fmt(data.cards.remaining_balance)}</Text>
              <View style={styles.heroRow}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>Total Income</Text>
                  <Text style={styles.heroStatVal}>{fmt(data.cards.total_income)}</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>Total Expenses</Text>
                  <Text style={styles.heroStatVal}>{fmt(data.cards.total_expenses)}</Text>
                </View>
              </View>
            </View>

            {/* Secondary KPI Grid */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiTitle}>This Month</Text>
                <Text style={styles.kpiVal}>{fmt(data.cards.this_month_expenses)}</Text>
                <Text style={styles.kpiSub}>Avg/day: {fmt(data.monthly_summary.average_daily_expense)}</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiTitle}>Previous Month</Text>
                <Text style={styles.kpiVal}>{fmt(data.cards.previous_month_expenses)}</Text>
                <Text style={styles.kpiSub}>
                  Top: {data.monthly_summary.highest_expense_category || "None"}
                </Text>
              </View>
            </View>

            {/* Expense Breakdown Donut */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Expense Breakdown</Text>
              <Text style={styles.sectionSub}>Category shares for {data.monthly_summary.month_label}</Text>
              <ExpenseDonutChart data={data.expense_breakdown} currencySymbol={currencySymbol} />
            </View>

            {/* Income vs Expense Chart */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Income vs Expense</Text>
              <Text style={styles.sectionSub}>Monthly comparison ({year})</Text>
              <IncomeVsExpenseChart data={data.income_vs_expense} currencySymbol={currencySymbol} />
            </View>

            {/* Category Analysis */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Category-wise Analysis</Text>
              <Text style={styles.sectionSub}>Top spending categories & percentages</Text>
              <CategoryBarsList data={data.category_analysis} currencySymbol={currencySymbol} />
            </View>

            {/* Recent Transactions */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionRow}>
                <View>
                  <Text style={styles.sectionTitle}>Recent Transactions</Text>
                  <Text style={styles.sectionSub}>Tap any entry to edit</Text>
                </View>
                <TouchableOpacity onPress={() => router.push("/(tabs)/transactions")}>
                  <Text style={styles.viewAll}>View All</Text>
                </TouchableOpacity>
              </View>
              {data.recent_transactions.length === 0 ? (
                <Text style={styles.emptyRecent}>No transactions yet. Tap + below to add one.</Text>
              ) : (
                data.recent_transactions.slice(0, 6).map((tx) => {
                  const isInc = tx.transaction_type === "INCOME";
                  return (
                    <TouchableOpacity
                      key={tx.id}
                      style={styles.txRow}
                      onPress={() =>
                        router.push({ pathname: "/edit-transaction", params: { id: tx.id } })
                      }
                    >
                      <View
                        style={[
                          styles.txIcon,
                          { backgroundColor: `${tx.category_color}1F` },
                        ]}
                      >
                        <Ionicons
                          name={isInc ? "arrow-up" : "arrow-down"}
                          size={16}
                          color={tx.category_color}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={styles.txTitle}>
                          {tx.title}
                        </Text>
                        <Text style={styles.txMeta}>
                          {tx.category_name}
                          {tx.payment_mode ? ` • ${tx.payment_mode}` : ""} •{" "}
                          {formatDisplayDate(tx.transaction_date)}
                        </Text>
                      </View>
                      <Text style={[styles.txAmt, { color: isInc ? COLORS.sage : COLORS.text }]}>
                        {isInc ? "+" : "-"}
                        {fmt(tx.amount)}
                      </Text>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ivory },
  scroll: { padding: 16, paddingBottom: 32, gap: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  greeting: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  subGreeting: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  quickBtns: { flexDirection: "row", gap: 6 },
  quickChipExp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: COLORS.brandSoft,
  },
  quickChipExpText: { fontSize: 11, fontWeight: "700", color: COLORS.brand },
  quickChipInc: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: COLORS.sageSoft,
  },
  quickChipIncText: { fontSize: 11, fontWeight: "700", color: COLORS.sage },
  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  monthArrow: { padding: 6 },
  monthLabel: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  heroCard: {
    backgroundColor: COLORS.brand,
    borderRadius: 22,
    padding: 20,
  },
  heroLabel: { fontSize: 12, fontWeight: "600", color: "#DBEAFE" },
  heroAmount: { fontSize: 28, fontWeight: "800", color: "#FFFFFF", marginTop: 4 },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.22)",
  },
  heroStat: { flex: 1 },
  heroDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.22)", marginHorizontal: 12 },
  heroStatLabel: { fontSize: 11, color: "#DBEAFE" },
  heroStatVal: { fontSize: 15, fontWeight: "700", color: "#FFFFFF", marginTop: 2 },
  kpiGrid: { flexDirection: "row", gap: 12 },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  kpiTitle: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted },
  kpiVal: { fontSize: 17, fontWeight: "800", color: COLORS.text, marginTop: 4 },
  kpiSub: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  sectionSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2, marginBottom: 14 },
  viewAll: { fontSize: 12, fontWeight: "700", color: COLORS.brand },
  emptyRecent: { fontSize: 12, color: COLORS.textLight, textAlign: "center", paddingVertical: 16 },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  txIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  txMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  txAmt: { fontSize: 14, fontWeight: "800" },
  errorBox: {
    backgroundColor: COLORS.roseSoft,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECDD3",
  },
  errorText: { fontSize: 12, color: COLORS.rose, fontWeight: "600" },
});
