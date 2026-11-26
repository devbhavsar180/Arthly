import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { mobileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COLORS, formatCurrency, formatDisplayDate } from "@/lib/format";
import { Transaction, TransactionType } from "@/types";

export default function TransactionsScreen() {
  const { currencySymbol } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "">("");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [items, setItems] = useState<Transaction[]>([]);
  const [totals, setTotals] = useState({ income: 0, expenses: 0, net: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fmt = (v: number) => formatCurrency(v, currencySymbol);

  const loadList = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const res = await mobileApi.listTransactions({
          search: search.trim() || undefined,
          transaction_type: typeFilter || undefined,
          sort_by: sortBy,
          sort_order: "desc",
          page_size: 100,
        });
        setItems(res.items);
        setTotals({
          income: res.total_income,
          expenses: res.total_expenses,
          net: res.net_balance,
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [search, typeFilter, sortBy]
  );

  useFocusEffect(
    useCallback(() => {
      loadList(false);
    }, [loadList])
  );

  const confirmDelete = (tx: Transaction) => {
    Alert.alert("Delete Transaction", `Remove "${tx.title}" (${fmt(tx.amount)})?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await mobileApi.deleteTransaction(tx.id);
          loadList(false);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.top}>
        <Text style={styles.title}>Transactions</Text>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by title..."
            placeholderTextColor={COLORS.textLight}
            returnKeyType="search"
            onSubmitEditing={() => loadList(false)}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {(["", "EXPENSE", "INCOME"] as const).map((t) => (
            <TouchableOpacity
              key={t || "ALL"}
              onPress={() => setTypeFilter(t)}
              style={[styles.chip, typeFilter === t && styles.chipActive]}
            >
              <Text style={[styles.chipText, typeFilter === t && styles.chipTextActive]}>
                {t === "" ? "All" : t === "EXPENSE" ? "Expenses" : "Income"}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setSortBy((s) => (s === "date" ? "amount" : "date"))}
            style={[styles.chip, { marginLeft: 6 }]}
          >
            <Text style={styles.chipText}>Sort: {sortBy === "date" ? "Date" : "Amount"}</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.summaryStrip}>
          <View style={styles.stripItem}>
            <Text style={styles.stripLabel}>Income</Text>
            <Text style={[styles.stripVal, { color: COLORS.sage }]}>{fmt(totals.income)}</Text>
          </View>
          <View style={styles.stripItem}>
            <Text style={styles.stripLabel}>Expenses</Text>
            <Text style={styles.stripVal}>{fmt(totals.expenses)}</Text>
          </View>
          <View style={styles.stripItem}>
            <Text style={styles.stripLabel}>Net</Text>
            <Text style={[styles.stripVal, { color: COLORS.brand }]}>{fmt(totals.net)}</Text>
          </View>
        </View>
      </View>

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color={COLORS.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadList(true)} tintColor={COLORS.brand} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No transactions found</Text>
              <Text style={styles.emptySub}>Tap the + button below to record an expense or income.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isInc = item.transaction_type === "INCOME";
            return (
              <TouchableOpacity
                style={styles.txCard}
                onPress={() =>
                  router.push({ pathname: "/edit-transaction", params: { id: item.id } })
                }
                onLongPress={() => confirmDelete(item)}
              >
                <View style={[styles.txIcon, { backgroundColor: `${item.category_color}1F` }]}>
                  <Ionicons
                    name={isInc ? "arrow-up" : "arrow-down"}
                    size={17}
                    color={item.category_color}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.txTitle}>
                    {item.title}
                  </Text>
                  <Text style={styles.txMeta}>
                    {item.category_name}
                    {item.payment_mode ? ` • ${item.payment_mode}` : ""} •{" "}
                    {formatDisplayDate(item.transaction_date)}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={[styles.txAmt, { color: isInc ? COLORS.sage : COLORS.text }]}>
                    {isInc ? "+" : "-"}
                    {fmt(item.amount)}
                  </Text>
                  <TouchableOpacity onPress={() => confirmDelete(item)}>
                    <Ionicons name="trash-outline" size={16} color={COLORS.textLight} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ivory },
  top: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 10 },
  title: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, padding: 0 },
  chipRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
  chipText: { fontSize: 12, fontWeight: "600", color: COLORS.textMuted },
  chipTextActive: { color: "#FFFFFF" },
  summaryStrip: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
  },
  stripItem: { flex: 1, alignItems: "center" },
  stripLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: "600" },
  stripVal: { fontSize: 13, fontWeight: "800", color: COLORS.text, marginTop: 2 },
  listContent: { padding: 16, paddingTop: 6, gap: 10, paddingBottom: 32 },
  txCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
  },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  txTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  txMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  txAmt: { fontSize: 14, fontWeight: "800" },
  emptyBox: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: COLORS.textMuted },
  emptySub: { fontSize: 12, color: COLORS.textLight, marginTop: 4 },
});
