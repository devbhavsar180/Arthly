import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { mobileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COLORS, formatCurrency, formatDisplayDate } from "@/lib/format";
import { ReconciliationMatch, ReconciliationSession } from "@/types";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

export default function MobileReconciliationScreen() {
  const router = useRouter();
  const { currencySymbol } = useAuth();
  const today = new Date();

  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [dateTolerance, setDateTolerance] = useState(3);
  const [selectedDoc, setSelectedDoc] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);

  const [uploading, setUploading] = useState(false);
  const [activeSession, setActiveSession] = useState<ReconciliationSession | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    mobileApi.getReconciliationSessions().then((list) => {
      if (list.length > 0) setActiveSession(list[0]);
    }).catch(() => {});
  }, []);

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "*/*"],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setSelectedDoc({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || "application/octet-stream",
        });
      }
    } catch (err: any) {
      Alert.alert("Picker Error", err.message || "Failed to pick statement file.");
    }
  };

  const handleUploadAndVerify = async () => {
    if (!selectedDoc) {
      Alert.alert("File Required", "Please choose a bank statement file (PDF, CSV, or Excel).");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("month", selectedMonth.toString());
      formData.append("year", selectedYear.toString());
      formData.append("date_tolerance_days", dateTolerance.toString());

      formData.append("file", {
        uri: selectedDoc.uri,
        name: selectedDoc.name,
        type: selectedDoc.mimeType || "application/octet-stream",
      } as any);

      const session = await mobileApi.uploadBankStatement(formData);
      setActiveSession(session);
      Alert.alert(
        "Verification Complete",
        `Statement reconciled! Matched: ${session.summary_stats?.matched_count || 0}, Missing in App: ${session.summary_stats?.missing_in_app_count || 0}`
      );
      setSelectedDoc(null);
    } catch (err: any) {
      Alert.alert("Reconciliation Error", err.message || "Failed to process bank statement.");
    } finally {
      setUploading(false);
    }
  };

  const handleMatchAction = async (
    matchId: string,
    action: "CREATED_EXPENSE" | "CREATED_INCOME" | "CONFIRMED" | "IGNORED"
  ) => {
    setActionLoading(matchId);
    try {
      const updated = await mobileApi.updateMatchAction(matchId, { action });
      setActiveSession((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          matches: prev.matches.map((m) => (m.id === matchId ? updated : m)),
        };
      });
      Alert.alert("Success", action.startsWith("CREATED") ? "Added to your app transactions!" : `Marked as ${action}.`);
    } catch (err: any) {
      Alert.alert("Action Error", err.message || "Failed to update match action.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleShareReport = async (format: "pdf" | "excel" | "csv") => {
    if (!activeSession) return;
    try {
      await mobileApi.downloadReconciliationReport(activeSession.id, format);
    } catch (err: any) {
      Alert.alert("Report Error", err.message || "Failed to share reconciliation report.");
    }
  };

  const stats = activeSession?.summary_stats || {};
  const filteredMatches = (activeSession?.matches || []).filter((m) => {
    if (statusFilter !== "ALL" && m.status !== statusFilter) return false;
    return true;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Bank Reconciliation</Text>
          <Text style={styles.headerSub}>Verify bank statement vs app entries</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Upload Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Upload Monthly Statement</Text>

          {/* Month selector chips */}
          <Text style={styles.label}>Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {MONTH_NAMES.map((m, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.monthChip, selectedMonth === idx + 1 && styles.monthChipActive]}
                onPress={() => setSelectedMonth(idx + 1)}
              >
                <Text style={[styles.monthChipText, selectedMonth === idx + 1 && styles.monthChipTextActive]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* File Picker */}
          <TouchableOpacity style={styles.dropzone} onPress={handlePickDocument}>
            <Ionicons name="cloud-upload-outline" size={28} color="#0D9488" />
            <Text style={styles.dropzoneTitle}>
              {selectedDoc ? selectedDoc.name : "Select Statement File (PDF, CSV, Excel)"}
            </Text>
            <Text style={styles.dropzoneSub}>
              Tap to browse files from your device
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.verifyBtn, (!selectedDoc || uploading) && styles.btnDisabled]}
            disabled={!selectedDoc || uploading}
            onPress={handleUploadAndVerify}
          >
            <Ionicons name="checkmark-done-circle" size={20} color="#FFFFFF" />
            <Text style={styles.verifyBtnText}>
              {uploading ? "Verifying Bank Transactions..." : "Verify Transactions"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Active Session Results */}
        {activeSession && (
          <View style={styles.resultsWrap}>
            {/* KPI Cards Grid */}
            <View style={styles.kpiGrid}>
              <View style={[styles.kpiCard, { backgroundColor: "#F0FDFA", borderColor: "#99F6E4" }]}>
                <Text style={styles.kpiVal}>{stats.total_bank_transactions || 0}</Text>
                <Text style={styles.kpiLabel}>Bank Total</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: COLORS.sageSoft, borderColor: "#A7F3D0" }]}>
                <Text style={[styles.kpiVal, { color: COLORS.sage }]}>{stats.matched_count || 0}</Text>
                <Text style={styles.kpiLabel}>Matched</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
                <Text style={[styles.kpiVal, { color: "#D97706" }]}>{stats.missing_in_app_count || 0}</Text>
                <Text style={styles.kpiLabel}>Missing in App</Text>
              </View>
              <View style={[styles.kpiCard, { backgroundColor: "#F3E8FF", borderColor: "#E9D5FF" }]}>
                <Text style={[styles.kpiVal, { color: "#7E22CE" }]}>{stats.not_found_in_bank_count || 0}</Text>
                <Text style={styles.kpiLabel}>Not in Bank</Text>
              </View>
            </View>

            {/* Share / Download Toolbar */}
            <View style={styles.reportBar}>
              <Text style={styles.reportBarTitle}>Share Report:</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={styles.reportBtn} onPress={() => handleShareReport("pdf")}>
                  <Ionicons name="document-text" size={14} color={COLORS.rose} />
                  <Text style={styles.reportBtnText}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reportBtn} onPress={() => handleShareReport("excel")}>
                  <Ionicons name="grid" size={14} color={COLORS.sage} />
                  <Text style={styles.reportBtnText}>Excel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.reportBtn} onPress={() => handleShareReport("csv")}>
                  <Ionicons name="list" size={14} color={COLORS.brand} />
                  <Text style={styles.reportBtnText}>CSV</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Filter Tabs */}
            <View style={styles.filterRow}>
              {["ALL", "MATCHED", "MISSING_IN_APP", "NOT_FOUND_IN_BANK"].map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.filterTab, statusFilter === tab && styles.filterTabActive]}
                  onPress={() => setStatusFilter(tab)}
                >
                  <Text style={[styles.filterTabText, statusFilter === tab && styles.filterTabTextActive]}>
                    {tab.replace(/_/g, " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Matches List */}
            {filteredMatches.map((m) => {
              const b = m.bank_transaction;
              const a = m.app_transaction;
              const isDebit = b?.raw_type === "DEBIT";
              const bAmt = b?.debit_amount && b.debit_amount > 0 ? b.debit_amount : b?.credit_amount || 0;

              return (
                <View key={m.id} style={styles.matchCard}>
                  <View style={styles.matchHeader}>
                    <View
                      style={[
                        styles.statusBadge,
                        m.status === "MATCHED" && styles.badgeMatched,
                        m.status === "MISSING_IN_APP" && styles.badgeMissing,
                        m.status === "NOT_FOUND_IN_BANK" && styles.badgeNotBank,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          m.status === "MATCHED" && styles.badgeMatchedText,
                          m.status === "MISSING_IN_APP" && styles.badgeMissingText,
                          m.status === "NOT_FOUND_IN_BANK" && styles.badgeNotBankText,
                        ]}
                      >
                        {m.status.replace(/_/g, " ")}
                      </Text>
                    </View>
                    <Text style={styles.scoreText}>{m.match_score.toFixed(0)}% Match</Text>
                  </View>

                  {/* Bank Row */}
                  <View style={styles.dataBlock}>
                    <Text style={styles.blockLabel}>Bank Entry</Text>
                    <Text style={styles.entryDesc}>{b?.description || "Not in statement"}</Text>
                    {b && (
                      <Text style={styles.entryAmount}>
                        {isDebit ? "- " : "+ "}
                        {formatCurrency(bAmt, currencySymbol)} • {formatDisplayDate(b.transaction_date)}
                      </Text>
                    )}
                  </View>

                  {/* App Row */}
                  <View style={styles.dataBlock}>
                    <Text style={styles.blockLabel}>MyMoney Entry</Text>
                    <Text style={styles.entryDesc}>{a?.title || "Missing in App"}</Text>
                    {a && (
                      <Text style={styles.entryAmount}>
                        {a.transaction_type === "EXPENSE" ? "- " : "+ "}
                        {formatCurrency(a.amount, currencySymbol)} • {formatDisplayDate(a.transaction_date)}
                      </Text>
                    )}
                  </View>

                  {/* Action for Missing in App */}
                  {m.status === "MISSING_IN_APP" && b && (
                    <TouchableOpacity
                      style={styles.createBtn}
                      disabled={actionLoading === m.id}
                      onPress={() =>
                        handleMatchAction(
                          m.id,
                          isDebit ? "CREATED_EXPENSE" : "CREATED_INCOME"
                        )
                      }
                    >
                      <Ionicons name="add-circle" size={16} color="#FFFFFF" />
                      <Text style={styles.createBtnText}>
                        {actionLoading === m.id ? "Adding..." : "Add to App Transactions"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.ivory,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  backBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: COLORS.ivory,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
  },
  headerSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  scroll: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textMuted,
    marginBottom: 6,
  },
  chipRow: {
    marginBottom: 14,
  },
  monthChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 6,
  },
  monthChipActive: {
    backgroundColor: "#0D9488",
    borderColor: "#0F766E",
  },
  monthChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  monthChipTextActive: {
    color: "#FFFFFF",
  },
  dropzone: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#99F6E4",
    backgroundColor: "#F0FDFA",
    borderRadius: 14,
    padding: 18,
    alignItems: "center",
    gap: 4,
    marginBottom: 14,
  },
  dropzoneTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    textAlign: "center",
  },
  dropzoneSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  verifyBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0D9488",
    paddingVertical: 13,
    borderRadius: 14,
  },
  verifyBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  resultsWrap: {
    gap: 12,
  },
  kpiGrid: {
    flexDirection: "row",
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  kpiVal: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
  },
  kpiLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },
  reportBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reportBarTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reportBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.text,
  },
  filterRow: {
    flexDirection: "row",
    gap: 6,
  },
  filterTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterTabActive: {
    backgroundColor: COLORS.text,
    borderColor: COLORS.text,
  },
  filterTabText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  filterTabTextActive: {
    color: "#FFFFFF",
  },
  matchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  matchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeMatched: {
    backgroundColor: COLORS.sageSoft,
  },
  badgeMissing: {
    backgroundColor: "#FEF3C7",
  },
  badgeNotBank: {
    backgroundColor: "#F3E8FF",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  badgeMatchedText: {
    color: COLORS.sage,
  },
  badgeMissingText: {
    color: "#D97706",
  },
  badgeNotBankText: {
    color: "#7E22CE",
  },
  scoreText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textLight,
  },
  dataBlock: {
    gap: 2,
  },
  blockLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textLight,
    textTransform: "uppercase",
  },
  entryDesc: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
  },
  entryAmount: {
    fontSize: 11.5,
    color: COLORS.textMuted,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.sage,
    paddingVertical: 9,
    borderRadius: 10,
    marginTop: 4,
  },
  createBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
});
