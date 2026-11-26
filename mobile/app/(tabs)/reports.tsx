import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, mobileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COLORS, formatCompact, formatCurrency, MONTH_NAMES } from "@/lib/format";
import { EnhancedAnalyticsResponse } from "@/types";

export default function ReportsAndAnalyticsScreen() {
  const { currencySymbol, currencyCode } = useAuth();
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [analytics, setAnalytics] = useState<EnhancedAnalyticsResponse | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadAnalytics = useCallback(() => {
    mobileApi
      .getEnhancedAnalytics({ month, year })
      .then(setAnalytics)
      .catch(() => {});
  }, [month, year]);

  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
    }, [loadAnalytics])
  );

  const handleDownload = async (
    type: "pdf/summary" | "pdf/expense" | "pdf/income" | "excel" | "csv",
    title: string
  ) => {
    setDownloading(type);
    try {
      await mobileApi.downloadReport(type, { month, year });
    } catch (err) {
      Alert.alert("Export Error", err instanceof ApiError ? err.message : `Failed ${title}`);
    } finally {
      setDownloading(null);
    }
  };

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

  const reports: {
    type: "pdf/summary" | "pdf/expense" | "pdf/income" | "excel" | "csv";
    title: string;
    sub: string;
    icon: any;
    color: string;
  }[] = [
    {
      type: "pdf/summary",
      title: "Monthly Financial Summary PDF",
      sub: "Income, expenses, savings & category peaks",
      icon: "document-text-outline",
      color: COLORS.brand,
    },
    {
      type: "pdf/expense",
      title: "Expense Report PDF",
      sub: "All monthly expense transactions",
      icon: "trending-down-outline",
      color: COLORS.rose,
    },
    {
      type: "pdf/income",
      title: "Income Report PDF",
      sub: "Salary, bonus & inflow ledger",
      icon: "trending-up-outline",
      color: COLORS.sage,
    },
    {
      type: "excel",
      title: "Excel Workbook (.xlsx)",
      sub: "Formatted spreadsheet for analysis",
      icon: "grid-outline",
      color: "#059669",
    },
    {
      type: "csv",
      title: "CSV Export (.csv)",
      sub: "Raw tabular ledger export",
      icon: "download-outline",
      color: COLORS.textMuted,
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Analytics & Reports</Text>
            <Text style={styles.sub}>Insights and shareable PDF, Excel & CSV statements</Text>
          </View>
        </View>

        <View style={styles.monthBar}>
          <TouchableOpacity onPress={prevMonth} style={styles.arrow}>
            <Ionicons name="chevron-back" size={18} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {MONTH_NAMES[month - 1]} {year}
          </Text>
          <TouchableOpacity onPress={nextMonth} style={styles.arrow}>
            <Ionicons name="chevron-forward" size={18} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {analytics && (
          <>
            {/* Yearly Totals */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiTile}>
                <Text style={styles.kpiLabel}>{analytics.year} Income</Text>
                <Text style={[styles.kpiVal, { color: COLORS.sage }]}>
                  {formatCompact(analytics.yearly_income, currencySymbol)}
                </Text>
              </View>
              <View style={styles.kpiTile}>
                <Text style={styles.kpiLabel}>{analytics.year} Expense</Text>
                <Text style={[styles.kpiVal, { color: COLORS.rose }]}>
                  {formatCompact(analytics.yearly_expenses, currencySymbol)}
                </Text>
              </View>
              <View style={styles.kpiTile}>
                <Text style={styles.kpiLabel}>Savings Rate</Text>
                <Text style={[styles.kpiVal, { color: COLORS.brand }]}>
                  {analytics.yearly_savings_rate.toFixed(0)}%
                </Text>
              </View>
            </View>

            {/* Weekly Spending */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Weekly Spending Breakdown</Text>
              {analytics.weekly_analysis.map((w) => (
                <View key={w.week_label} style={styles.dataRow}>
                  <Text style={styles.rowName}>{w.week_label}</Text>
                  <Text style={styles.rowVal}>
                    Spent {formatCurrency(w.expenses, currencySymbol, currencyCode)} · In{" "}
                    {formatCompact(w.income, currencySymbol)}
                  </Text>
                </View>
              ))}
            </View>

            {/* Budget vs Actual */}
            {analytics.budget_vs_actual.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Budget vs Actual</Text>
                {analytics.budget_vs_actual.map((b) => (
                  <View key={b.category_name} style={styles.dataRow}>
                    <Text style={styles.rowName}>{b.category_name}</Text>
                    <Text style={styles.rowVal}>
                      {formatCompact(b.actual_spent, currencySymbol)} /{" "}
                      {formatCompact(b.budget_limit, currencySymbol)} (
                      {b.utilization_percentage.toFixed(0)}%)
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <Text style={styles.sectionHeading}>Download & Share Statements</Text>
        {reports.map((r) => (
          <TouchableOpacity
            key={r.type}
            style={styles.reportCard}
            disabled={downloading !== null}
            onPress={() => handleDownload(r.type, r.title)}
          >
            <View style={[styles.reportIcon, { backgroundColor: `${r.color}18` }]}>
              <Ionicons name={r.icon} size={20} color={r.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reportTitle}>{r.title}</Text>
              <Text style={styles.reportSub}>{r.sub}</Text>
            </View>
            {downloading === r.type ? (
              <ActivityIndicator size="small" color={COLORS.brand} />
            ) : (
              <Ionicons name="share-outline" size={20} color={COLORS.brand} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
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
  monthBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  arrow: { padding: 4 },
  monthText: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  kpiRow: { flexDirection: "row", gap: 8 },
  kpiTile: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  kpiLabel: { fontSize: 10, fontWeight: "700", color: COLORS.textMuted },
  kpiVal: { fontSize: 16, fontWeight: "800", marginTop: 4 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  rowName: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  rowVal: { fontSize: 12, color: COLORS.textMuted },
  sectionHeading: { fontSize: 15, fontWeight: "800", color: COLORS.text, marginTop: 4 },
  reportCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reportIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  reportTitle: { fontSize: 13, fontWeight: "800", color: COLORS.text },
  reportSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
});
