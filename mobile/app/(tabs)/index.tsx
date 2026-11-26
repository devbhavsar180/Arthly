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
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  CategoryBarsList,
  ExpenseDonutChart,
  IncomeVsExpenseChart,
} from "@/components/Charts";
import { mobileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COLORS, formatCurrency, formatDisplayDate, MONTH_NAMES } from "@/lib/format";
import { BudgetPeriodSummary, DashboardResponse } from "@/types";

export default function HomeDashboardScreen() {
  const { user, currencySymbol, currencyCode } = useAuth();
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [budgets, setBudgets] = useState<BudgetPeriodSummary | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [dashRes, budRes, notifRes] = await Promise.allSettled([
        mobileApi.getDashboard({ month, year }),
        mobileApi.getBudgets({ month, year }),
        mobileApi.listNotifications(true),
      ]);
      if (dashRes.status === "fulfilled") setData(dashRes.value);
      if (budRes.status === "fulfilled") setBudgets(budRes.value);
      if (notifRes.status === "fulfilled") setUnreadCount(notifRes.value.unread_count || 0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
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

  const firstName = user?.full_name?.split(" ")[0] || "Friend";
  const warningBudgets = [
    ...(budgets?.overall_budget && budgets.overall_budget.alert_status !== "OK"
      ? [budgets.overall_budget]
      : []),
    ...(budgets?.category_budgets.filter((b) => b.alert_status !== "OK") || []),
  ];

  const monthlyIncome = data?.monthly_summary.total_monthly_income || 0;
  const monthlyExpenses = data?.monthly_summary.total_monthly_expenses || 0;
  const monthlySavings = data?.monthly_summary.total_savings || 0;
  const savingsRate =
    monthlyIncome > 0 ? Math.max(0, (monthlySavings / monthlyIncome) * 100) : 0;

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
        {/* Top Bar */}
        <View style={styles.topRow}>
          <View>
            <Text style={styles.brandBadge}>ARTHLY</Text>
            <Text style={styles.greeting}>Hi, {firstName}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push("/(tabs)/reports")}
            >
              <Ionicons name="bar-chart-outline" size={20} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push("/notifications")}
            >
              <Ionicons name="notifications-outline" size={20} color={COLORS.text} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Month Switcher */}
        <View style={styles.monthBar}>
          <TouchableOpacity onPress={prevMonth} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={18} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {MONTH_NAMES[month - 1]} {year}
          </Text>
          <TouchableOpacity onPress={nextMonth} style={styles.monthArrow}>
            <Ionicons name="chevron-forward" size={18} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Hero Balance Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroLabel}>Net Remaining Balance</Text>
            <Text style={styles.ratePill}>{savingsRate.toFixed(1)}% savings rate</Text>
          </View>
          <Text style={styles.heroValue}>
            {formatCurrency(data?.cards.remaining_balance || 0, currencySymbol, currencyCode)}
          </Text>
          <View style={styles.heroSplit}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroSubLabel}>Month Income</Text>
              <Text style={styles.heroIncome}>
                {formatCurrency(monthlyIncome, currencySymbol, currencyCode)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroSubLabel}>Month Expenses</Text>
              <Text style={styles.heroExpense}>
                {formatCurrency(monthlyExpenses, currencySymbol, currencyCode)}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Primary Buttons (Expense + Income explicitly visible) */}
        <View style={styles.primaryActions}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.rose }]}
            onPress={() => router.push("/add-expense")}
          >
            <Ionicons name="remove-circle-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Add Expense</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: COLORS.sage }]}
            onPress={() => router.push("/add-income")}
          >
            <Ionicons name="add-circle-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Add Income</Text>
          </TouchableOpacity>
        </View>

        {/* Smart Capture Strip */}
        <View style={styles.smartRow}>
          <TouchableOpacity
            style={styles.smartPill}
            onPress={() => router.push("/screenshot-import")}
          >
            <Ionicons name="scan-outline" size={16} color={COLORS.brand} />
            <Text style={styles.smartPillText}>Scan UPI</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smartPill}
            onPress={() => router.push("/voice-entry")}
          >
            <Ionicons name="mic-outline" size={16} color={COLORS.indigo} />
            <Text style={styles.smartPillText}>Voice</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smartPill}
            onPress={() => router.push("/budgets")}
          >
            <Ionicons name="speedometer-outline" size={16} color={COLORS.amber} />
            <Text style={styles.smartPillText}>Budgets</Text>
          </TouchableOpacity>
        </View>

        {/* Budget Alert Banner */}
        {warningBudgets.length > 0 && (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => router.push("/budgets")}
          >
            <Ionicons name="warning-outline" size={20} color={COLORS.amber} />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>
                {warningBudgets.length} Budget Alert{warningBudgets.length > 1 ? "s" : ""}
              </Text>
              <Text style={styles.alertSub} numberOfLines={1}>
                {warningBudgets
                  .map(
                    (b) =>
                      `${b.is_overall ? "Overall" : b.category_name} (${b.utilization_percentage.toFixed(0)}%)`
                  )
                  .join(" · ")}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.amber} />
          </TouchableOpacity>
        )}

        {loading && !data ? (
          <ActivityIndicator style={{ marginVertical: 24 }} color={COLORS.brand} />
        ) : (
          data && (
            <>
              {/* Summary Tiles */}
              <View style={styles.kpiGrid}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Total Income</Text>
                  <Text style={[styles.kpiVal, { color: COLORS.sage }]}>
                    {formatCurrency(data.cards.total_income, currencySymbol, currencyCode)}
                  </Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Total Expenses</Text>
                  <Text style={[styles.kpiVal, { color: COLORS.rose }]}>
                    {formatCurrency(data.cards.total_expenses, currencySymbol, currencyCode)}
                  </Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Total Savings</Text>
                  <Text style={[styles.kpiVal, { color: COLORS.brand }]}>
                    {formatCurrency(data.cards.total_savings, currencySymbol, currencyCode)}
                  </Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>Avg Daily Spend</Text>
                  <Text style={styles.kpiVal}>
                    {formatCurrency(
                      data.monthly_summary.average_daily_expense,
                      currencySymbol,
                      currencyCode
                    )}
                  </Text>
                </View>
              </View>

              {/* Charts */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Expense Breakdown</Text>
                <ExpenseDonutChart
                  data={data.expense_breakdown}
                  currencySymbol={currencySymbol}
                />
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Income vs Expenses</Text>
                <IncomeVsExpenseChart
                  data={data.income_vs_expense}
                  currencySymbol={currencySymbol}
                />
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Top Categories</Text>
                <CategoryBarsList
                  data={data.category_analysis.slice(0, 5)}
                  currencySymbol={currencySymbol}
                />
              </View>

              {/* Recent Transactions */}
              <View style={styles.sectionCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.sectionTitle}>Recent Activity</Text>
                  <TouchableOpacity onPress={() => router.push("/(tabs)/transactions")}>
                    <Text style={styles.viewAll}>View all →</Text>
                  </TouchableOpacity>
                </View>

                {data.recent_transactions.length === 0 ? (
                  <Text style={styles.emptyText}>No transactions logged for this month.</Text>
                ) : (
                  data.recent_transactions.map((tx) => {
                    const isIncome = tx.transaction_type === "INCOME";
                    return (
                      <TouchableOpacity
                        key={tx.id}
                        style={styles.txRow}
                        onPress={() =>
                          router.push({
                            pathname: "/edit-transaction",
                            params: { id: tx.id },
                          })
                        }
                      >
                        <View
                          style={[
                            styles.txIcon,
                            { backgroundColor: `${tx.category_color || COLORS.brand}20` },
                          ]}
                        >
                          <Ionicons
                            name={isIncome ? "arrow-up" : "arrow-down"}
                            size={16}
                            color={tx.category_color || COLORS.brand}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.txTitle} numberOfLines={1}>
                            {tx.title}
                          </Text>
                          <Text style={styles.txMeta}>
                            {tx.category_name} · {formatDisplayDate(tx.transaction_date)}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.txAmount,
                            { color: isIncome ? COLORS.sage : COLORS.text },
                          ]}
                        >
                          {isIncome ? "+" : "-"}
                          {formatCurrency(tx.amount, currencySymbol, currencyCode)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ivory },
  scroll: { padding: 16, paddingBottom: 32, gap: 14 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brandBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: COLORS.brand,
    letterSpacing: 1.5,
  },
  greeting: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.rose,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  monthArrow: { padding: 4 },
  monthTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  heroCard: {
    backgroundColor: COLORS.brandDark,
    borderRadius: 22,
    padding: 20,
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroLabel: { color: "#BFDBFE", fontSize: 12, fontWeight: "600" },
  ratePill: {
    color: "#ECFDF5",
    backgroundColor: "rgba(16, 185, 129, 0.25)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    fontSize: 11,
    fontWeight: "700",
  },
  heroValue: { color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 6 },
  heroSplit: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  heroSubLabel: { color: "#93C5FD", fontSize: 11, fontWeight: "600" },
  heroIncome: { color: "#6EE7B7", fontSize: 15, fontWeight: "700", marginTop: 2 },
  heroExpense: { color: "#FDA4AF", fontSize: 15, fontWeight: "700", marginTop: 2 },
  primaryActions: { flexDirection: "row", gap: 10 },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  smartRow: { flexDirection: "row", gap: 8 },
  smartPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 10,
  },
  smartPillText: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.amberSoft,
    borderColor: "#FDE68A",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  alertTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  alertSub: { fontSize: 11, color: COLORS.amber, marginTop: 1 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: {
    width: "48%",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  kpiLabel: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted },
  kpiVal: { fontSize: 15, fontWeight: "800", color: COLORS.text, marginTop: 4 },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  viewAll: { fontSize: 12, fontWeight: "700", color: COLORS.brand },
  emptyText: { fontSize: 12, color: COLORS.textMuted, paddingVertical: 10 },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  txIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  txTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  txMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  txAmount: { fontSize: 13, fontWeight: "800" },
});
