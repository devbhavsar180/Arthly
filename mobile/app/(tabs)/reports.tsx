import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, mobileApi } from "@/lib/api";
import { COLORS, MONTH_NAMES } from "@/lib/format";

export default function ReportsScreen() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [downloading, setDownloading] = useState<string | null>(null);

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

  const handleDownload = async (
    kind: "pdf/summary" | "pdf/expense" | "pdf/income" | "excel" | "csv"
  ) => {
    setDownloading(kind);
    try {
      await mobileApi.downloadReport(kind, { month, year });
    } catch (err) {
      Alert.alert(
        "Report Download Failed",
        err instanceof ApiError ? err.message : "Unable to download report. Check backend connection."
      );
    } finally {
      setDownloading(null);
    }
  };

  const reports = [
    {
      key: "pdf/summary" as const,
      title: "Complete Monthly Financial Summary",
      sub: "PDF with Income vs Expense & Donut charts, totals, and full ledger",
      badge: "PDF",
      color: COLORS.brand,
      icon: "document-text-outline" as const,
    },
    {
      key: "pdf/expense" as const,
      title: "Monthly Expense Report",
      sub: "PDF category breakdown chart + detailed expense table",
      badge: "PDF",
      color: COLORS.rose,
      icon: "trending-down-outline" as const,
    },
    {
      key: "pdf/income" as const,
      title: "Monthly Income Report",
      sub: "PDF summary of manually recorded salary & income sources",
      badge: "PDF",
      color: COLORS.sage,
      icon: "trending-up-outline" as const,
    },
    {
      key: "excel" as const,
      title: "Excel Financial Workbook (.xlsx)",
      sub: "Multi-sheet Excel workbook with Summary, Categories & Transactions",
      badge: "XLSX",
      color: "#047857",
      icon: "grid-outline" as const,
    },
    {
      key: "csv" as const,
      title: "CSV Export (.csv)",
      sub: "Clean UTF-8 CSV spreadsheet export for the selected month",
      badge: "CSV",
      color: "#475569",
      icon: "download-outline" as const,
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Financial Reports</Text>
        <Text style={styles.subtitle}>Select a month and download or share reports directly</Text>

        <View style={styles.monthBar}>
          <TouchableOpacity onPress={prevMonth} style={styles.arrow}>
            <Ionicons name="chevron-back" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.monthText}>
            {MONTH_NAMES[month - 1]} {year}
          </Text>
          <TouchableOpacity onPress={nextMonth} style={styles.arrow}>
            <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <View style={{ gap: 12 }}>
          {reports.map((r) => {
            const busy = downloading === r.key;
            return (
              <TouchableOpacity
                key={r.key}
                style={styles.card}
                disabled={downloading !== null}
                onPress={() => handleDownload(r.key)}
              >
                <View style={[styles.iconBox, { backgroundColor: `${r.color}18` }]}>
                  <Ionicons name={r.icon} size={22} color={r.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>{r.title}</Text>
                  </View>
                  <Text style={styles.cardSub}>{r.sub}</Text>
                </View>
                {busy ? (
                  <ActivityIndicator size="small" color={COLORS.brand} />
                ) : (
                  <Ionicons name="share-outline" size={20} color={COLORS.brand} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ivory },
  scroll: { padding: 16, paddingBottom: 32, gap: 14 },
  title: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  subtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: -8 },
  monthBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  arrow: { padding: 6 },
  monthText: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 15,
  },
  iconBox: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  cardSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
});
