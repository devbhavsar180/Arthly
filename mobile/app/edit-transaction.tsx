import React, { useEffect, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, mobileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COLORS, PAYMENT_MODES } from "@/lib/format";
import { Category, PaymentMode, TransactionType } from "@/types";

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currencySymbol } = useAuth();

  const [loading, setLoading] = useState(true);
  const [txType, setTxType] = useState<TransactionType>("EXPENSE");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("UPI");
  const [txDate, setTxDate] = useState("");
  const [notes, setNotes] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([mobileApi.getTransaction(id), mobileApi.listCategories()])
      .then(([tx, cats]) => {
        setTxType(tx.transaction_type);
        setTitle(tx.title);
        setAmount(String(tx.amount));
        setCategoryId(tx.category_id);
        setPaymentMode((tx.payment_mode as PaymentMode) || "UPI");
        setTxDate(tx.transaction_date);
        setNotes(tx.notes || "");
        setCategories(cats);
      })
      .catch(() => Alert.alert("Error", "Could not load transaction"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    const val = Number(amount);
    if (!title.trim() || !Number.isFinite(val) || val <= 0) {
      Alert.alert("Validation", "Enter a valid title and positive amount.");
      return;
    }
    setSaving(true);
    try {
      await mobileApi.updateTransaction(id, {
        transaction_type: txType,
        title: title.trim(),
        amount: val,
        category_id: categoryId,
        payment_mode: txType === "EXPENSE" ? paymentMode : null,
        transaction_date: txDate.trim(),
        notes: notes.trim() || null,
      });
      router.back();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Could not update transaction.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert("Delete Transaction", "Are you sure you want to remove this entry?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await mobileApi.deleteTransaction(id);
          router.back();
        },
      },
    ]);
  };

  const filteredCats = categories.filter((c) => c.type === txType);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Transaction</Text>
        <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
          <Ionicons name="trash-outline" size={20} color={COLORS.rose} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.brand} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} />

          <Text style={styles.label}>Amount ({currencySymbol})</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Category</Text>
          <View style={styles.chipWrap}>
            {filteredCats.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setCategoryId(cat.id)}
                style={[styles.chip, categoryId === cat.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, categoryId === cat.id && { color: COLORS.brand }]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {txType === "EXPENSE" && (
            <>
              <Text style={styles.label}>Payment Mode</Text>
              <View style={styles.chipWrap}>
                {PAYMENT_MODES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setPaymentMode(m)}
                    style={[styles.chip, paymentMode === m && styles.modeActive]}
                  >
                    <Text style={[styles.chipText, paymentMode === m && { color: "#FFFFFF" }]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={txDate} onChangeText={setTxDate} />

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, { minHeight: 70, textAlignVertical: "top" }]}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Update Transaction"}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.ivory },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  iconBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  scroll: { padding: 18, paddingBottom: 36 },
  label: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted, marginTop: 14, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { borderColor: COLORS.brand, backgroundColor: COLORS.brandSoft },
  modeActive: { borderColor: COLORS.brand, backgroundColor: COLORS.brand },
  chipText: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  saveBtn: {
    marginTop: 24,
    backgroundColor: COLORS.brand,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});
