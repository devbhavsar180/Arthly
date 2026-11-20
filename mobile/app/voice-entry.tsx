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
import { mobileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COLORS, getTodayIso, PAYMENT_MODES } from "@/lib/format";
import { CandidateTransaction, Category, PaymentMode, TransactionType } from "@/types";

const LANGUAGES = [
  { code: "gu", label: "ગુજરાતી" },
  { code: "hi", label: "हिंदी" },
  { code: "en", label: "English" },
  { code: "auto", label: "Auto" },
] as const;

const QUICK_EXAMPLES = [
  "Aaje me 150 rupiya nastama kharchya ane 80 rupiya rikshama aapya.",
  "Aaje 500 rupiyanu petrol bharavyu.",
  "Yesterday I spent 300 rupees on groceries.",
  "Aaje salary na 40000 rupiya malya.",
];

export default function MobileVoiceEntryScreen() {
  const router = useRouter();
  const { user, currencySymbol } = useAuth();
  const [selectedLang, setSelectedLang] = useState<"gu" | "en" | "hi" | "auto">("gu");
  const [rawText, setRawText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidates, setCandidates] = useState<CandidateTransaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    if (user?.settings?.preferred_voice_language) {
      setSelectedLang(user.settings.preferred_voice_language);
    }
    mobileApi.listCategories().then(setCategories).catch(() => {});
  }, [user]);

  const handleLangChange = async (lang: "gu" | "en" | "hi" | "auto") => {
    setSelectedLang(lang);
    try {
      await mobileApi.updateVoiceLanguage(lang);
    } catch {}
  };

  const handleParse = async (overrideText?: string) => {
    const textToProcess = (overrideText || rawText).trim();
    if (!textToProcess) {
      Alert.alert("Voice Input", "Please speak into keyboard microphone or enter your expense sentence.");
      return;
    }

    setParsing(true);
    try {
      const res = await mobileApi.parseVoiceText({
        text: textToProcess,
        language: selectedLang,
      });
      setCandidates(res.transactions);
      if (res.warnings && res.warnings.length > 0) {
        Alert.alert("Notice", res.warnings.join("\n"));
      }
    } catch (err: any) {
      Alert.alert("Parsing Error", err.message || "Failed to process voice command.");
    } finally {
      setParsing(false);
    }
  };

  const handleUpdateCandidate = (index: number, field: keyof CandidateTransaction, val: any) => {
    setCandidates((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const handleRemoveCandidate = (index: number) => {
    setCandidates((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddAnother = () => {
    setCandidates((prev) => [
      ...prev,
      {
        title: "Expense",
        amount: 100,
        category_name: "Food",
        transaction_type: "EXPENSE",
        transaction_date: getTodayIso(),
        payment_mode: "Cash",
        confidence: 1.0,
        requires_attention: false,
      },
    ]);
  };

  const handleConfirmAndSave = async () => {
    if (candidates.length === 0) {
      Alert.alert("Confirmation", "No candidate transactions to save.");
      return;
    }

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (!c.amount || c.amount <= 0) {
        Alert.alert("Invalid Amount", `Transaction #${i + 1} (${c.title}) requires a positive amount.`);
        return;
      }
      if (!c.title.trim()) {
        Alert.alert("Invalid Title", `Transaction #${i + 1} requires a title.`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await mobileApi.confirmVoiceTransactions({
        raw_text: rawText || "Voice entry",
        language: selectedLang,
        transactions: candidates.map((c) => ({
          title: c.title.trim(),
          amount: Number(c.amount),
          category_name: c.category_name,
          transaction_type: c.transaction_type,
          transaction_date: c.transaction_date,
          payment_mode: c.payment_mode || "Cash",
          notes: c.notes || null,
        })),
      });

      Alert.alert("Success", res.message, [
        {
          text: "OK",
          onPress: () => router.replace("/(tabs)/transactions"),
        },
      ]);
    } catch (err: any) {
      Alert.alert("Save Error", err.message || "Failed to save transactions.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Voice Expense Entry</Text>
            <Text style={styles.headerSub}>Multilingual speech to structured finances</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Language Selector */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Preferred Language</Text>
            <View style={styles.langRow}>
              {LANGUAGES.map((l) => (
                <TouchableOpacity
                  key={l.code}
                  style={[
                    styles.langChip,
                    selectedLang === l.code && styles.langChipActive,
                  ]}
                  onPress={() => handleLangChange(l.code as any)}
                >
                  <Text
                    style={[
                      styles.langChipText,
                      selectedLang === l.code && styles.langChipTextActive,
                    ]}
                  >
                    {l.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Voice Prompt & Input */}
          <View style={styles.card}>
            <View style={styles.micCircle}>
              <Ionicons name="mic" size={32} color="#FFFFFF" />
            </View>

            <Text style={styles.micPrompt}>
              Speak in Gujarati, Hindi or English
            </Text>
            <Text style={styles.micHint}>
              Tap your keyboard mic icon below to speak, or type your sentence directly.
            </Text>

            <TextInput
              style={styles.textArea}
              placeholder="e.g. Aaje me 150 rupiya nastama kharchya ane 80 rupiya rikshama aapya..."
              placeholderTextColor={COLORS.textLight}
              multiline
              numberOfLines={3}
              value={rawText}
              onChangeText={setRawText}
            />

            {/* Quick Examples */}
            <Text style={styles.exLabel}>Tap to try an example:</Text>
            <View style={styles.exWrap}>
              {QUICK_EXAMPLES.map((ex, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.exChip}
                  onPress={() => {
                    setRawText(ex);
                    handleParse(ex);
                  }}
                >
                  <Text style={styles.exChipText}>Example {idx + 1}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.parseBtn, (!rawText.trim() || parsing) && styles.btnDisabled]}
              disabled={!rawText.trim() || parsing}
              onPress={() => handleParse()}
            >
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <Text style={styles.parseBtnText}>
                {parsing ? "Parsing Sentence..." : "Convert to Transactions"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Candidate Transactions / Confirmation Screen */}
          {candidates.length > 0 && (
            <View style={styles.candidatesCard}>
              <View style={styles.candidatesHeader}>
                <View>
                  <Text style={styles.candidatesTitle}>Confirmation Preview</Text>
                  <Text style={styles.candidatesSub}>
                    Review &amp; edit before saving. Never auto-saved.
                  </Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{candidates.length} ITEMS</Text>
                </View>
              </View>

              {candidates.map((c, i) => (
                <View key={i} style={styles.candidateItem}>
                  <View style={styles.candTopRow}>
                    <TouchableOpacity
                      style={[
                        styles.typeToggle,
                        c.transaction_type === "EXPENSE" ? styles.typeExpense : styles.typeIncome,
                      ]}
                      onPress={() =>
                        handleUpdateCandidate(
                          i,
                          "transaction_type",
                          c.transaction_type === "EXPENSE" ? "INCOME" : "EXPENSE"
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.typeToggleText,
                          c.transaction_type === "EXPENSE"
                            ? styles.typeExpenseText
                            : styles.typeIncomeText,
                        ]}
                      >
                        {c.transaction_type}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleRemoveCandidate(i)}
                      style={styles.deleteBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color={COLORS.rose} />
                    </TouchableOpacity>
                  </View>

                  {/* Title & Amount */}
                  <View style={styles.inputRow}>
                    <View style={{ flex: 3 }}>
                      <Text style={styles.label}>English Title</Text>
                      <TextInput
                        style={styles.input}
                        value={c.title}
                        onChangeText={(t) => handleUpdateCandidate(i, "title", t)}
                      />
                    </View>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.label}>Amount ({currencySymbol})</Text>
                      <TextInput
                        style={[styles.input, styles.amountInput]}
                        keyboardType="decimal-pad"
                        value={c.amount !== null ? String(c.amount) : ""}
                        placeholder="0.00"
                        onChangeText={(t) =>
                          handleUpdateCandidate(i, "amount", t === "" ? null : Number(t))
                        }
                      />
                    </View>
                  </View>

                  {/* Category & Date */}
                  <View style={styles.inputRow}>
                    <View style={{ flex: 3 }}>
                      <Text style={styles.label}>Category</Text>
                      <TextInput
                        style={styles.input}
                        value={c.category_name}
                        onChangeText={(t) => handleUpdateCandidate(i, "category_name", t)}
                      />
                    </View>
                    <View style={{ flex: 2 }}>
                      <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
                      <TextInput
                        style={styles.input}
                        value={c.transaction_date}
                        onChangeText={(t) => handleUpdateCandidate(i, "transaction_date", t)}
                      />
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.addMoreBtn} onPress={handleAddAnother}>
                <Ionicons name="add-circle-outline" size={18} color="#6366F1" />
                <Text style={styles.addMoreText}>Add Another Transaction</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, saving && styles.btnDisabled]}
                disabled={saving}
                onPress={handleConfirmAndSave}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.confirmBtnText}>
                  {saving ? "Saving Transactions..." : `Confirm & Save (${candidates.length})`}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  langRow: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  langChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  langChipActive: {
    backgroundColor: "#6366F1",
    borderColor: "#4F46E5",
  },
  langChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  langChipTextActive: {
    color: "#FFFFFF",
  },
  micCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#6366F1",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
    shadowColor: "#6366F1",
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  micPrompt: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 4,
  },
  micHint: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    textAlign: "center",
    marginHorizontal: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  textArea: {
    width: "100%",
    backgroundColor: COLORS.ivory,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    fontSize: 13,
    color: COLORS.text,
    textAlignVertical: "top",
    minHeight: 70,
  },
  exLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.textMuted,
    alignSelf: "flex-start",
    marginTop: 10,
    marginBottom: 6,
  },
  exWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    width: "100%",
    marginBottom: 12,
  },
  exChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  exChipText: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: "600",
  },
  parseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#6366F1",
    paddingVertical: 13,
    borderRadius: 14,
    width: "100%",
  },
  parseBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.5,
  },
  candidatesCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  candidatesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
  },
  candidatesTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  candidatesSub: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  badge: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: "#4F46E5",
    fontSize: 10,
    fontWeight: "800",
  },
  candidateItem: {
    backgroundColor: COLORS.ivory,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  candTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  typeToggle: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeExpense: {
    backgroundColor: COLORS.brandSoft,
  },
  typeIncome: {
    backgroundColor: COLORS.sageSoft,
  },
  typeToggleText: {
    fontSize: 11,
    fontWeight: "800",
  },
  typeExpenseText: {
    color: COLORS.brand,
  },
  typeIncomeText: {
    color: COLORS.sage,
  },
  deleteBtn: {
    padding: 4,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textMuted,
    marginBottom: 3,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: COLORS.text,
  },
  amountInput: {
    fontWeight: "700",
  },
  addMoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
  },
  addMoreText: {
    color: "#6366F1",
    fontSize: 12,
    fontWeight: "700",
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.sage,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
