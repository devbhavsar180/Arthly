import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, mobileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COLORS, getTodayIso, PAYMENT_MODES } from "@/lib/format";
import { Category, PaymentMode } from "@/types";

export default function AddExpenseScreen() {
  const router = useRouter();
  const { currencySymbol } = useAuth();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("UPI");
  const [txDate, setTxDate] = useState(getTodayIso());
  const [notes, setNotes] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    mobileApi.listCategories("EXPENSE").then((cats) => {
      setCategories(cats);
      if (cats.length > 0) setCategoryId(cats[0].id);
    });
  }, []);

  const handleSave = async () => {
    const val = Number(amount);
    if (!title.trim()) {
      Alert.alert("Validation", "Please enter an expense title.");
      return;
    }
    if (!Number.isFinite(val) || val <= 0) {
      Alert.alert("Validation", "Please enter a valid positive amount.");
      return;
    }
    if (!categoryId) {
      Alert.alert("Validation", "Please select a category.");
      return;
    }

    setSaving(true);
    try {
      await mobileApi.createTransaction({
        transaction_type: "EXPENSE",
        title: title.trim(),
        amount: val,
        category_id: categoryId,
        payment_mode: paymentMode,
        transaction_date: txDate.trim() || getTodayIso(),
        notes: notes.trim() || null,
      });
      router.back();
    } catch (err) {
      Alert.alert("Error", err instanceof ApiError ? err.message : "Could not save expense.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Daily Expense</Text>
        <View style={{ width: 34 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.amountBox}>
            <Text style={styles.currencySym}>{currencySymbol}</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={COLORS.textLight}
              keyboardType="decimal-pad"
            />
          </View>

          <Text style={styles.label}>Expense Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Lunch, Metro, Groceries"
            placeholderTextColor={COLORS.textLight}
          />

          <Text style={styles.label}>Category *</Text>
          <View style={styles.chipWrap}>
            {categories.map((cat) => {
              const active = categoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setCategoryId(cat.id)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <View style={[styles.dot, { backgroundColor: cat.color }]} />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.label}>Payment Mode *</Text>
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

          <Text style={styles.label}>Expense Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={txDate}
            onChangeText={setTxDate}
            placeholder="YYYY-MM-DD"
          />

          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Optional personal note"
            placeholderTextColor={COLORS.textLight}
          />

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Expense"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  closeBtn: { padding: 6 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  scroll: { padding: 18, paddingBottom: 36 },
  amountBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  currencySym: { fontSize: 30, fontWeight: "800", color: COLORS.brand, marginRight: 6 },
  amountInput: { fontSize: 32, fontWeight: "800", color: COLORS.text, minWidth: 120 },
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  chipTextActive: { color: COLORS.brand },
  dot: { width: 8, height: 8, borderRadius: 4 },
  saveBtn: {
    marginTop: 24,
    backgroundColor: COLORS.brand,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});
