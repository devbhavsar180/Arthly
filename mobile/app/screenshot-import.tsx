import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, mobileApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COLORS, formatCurrency, getTodayIso, PAYMENT_MODES } from "@/lib/format";
import { PaymentScreenshotRecord, ScreenshotAnalyzeResponse } from "@/types";

export default function ScreenshotImportScreen() {
  const { currencySymbol, currencyCode } = useAuth();
  const router = useRouter();
  const { sharedUri } = useLocalSearchParams<{ sharedUri?: string }>();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("payment_screenshot.jpg");
  const [imageType, setImageType] = useState<string>("image/jpeg");
  const [ocrHintText, setOcrHintText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [analysis, setAnalysis] = useState<ScreenshotAnalyzeResponse | null>(null);
  const [history, setHistory] = useState<PaymentScreenshotRecord[]>([]);

  // Confirmation editable state
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryName, setCategoryName] = useState("Others");
  const [txDate, setTxDate] = useState(getTodayIso());
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [upiTxId, setUpiTxId] = useState("");
  const [notes, setNotes] = useState("");

  const loadHistory = useCallback(() => {
    mobileApi.getScreenshotHistory().then(setHistory).catch(() => {});
  }, []);

  const runAnalysis = useCallback(
    async (uri: string, filename: string, mimeType: string, hintText?: string) => {
      setAnalyzing(true);
      setAnalysis(null);
      try {
        const formData = new FormData();
        formData.append("file", {
          uri,
          name: filename,
          type: mimeType,
        } as any);
        if (hintText && hintText.trim()) {
          formData.append("ocr_text", hintText.trim());
        }
        const res = await mobileApi.analyzeScreenshot(formData);
        setAnalysis(res);
        const s = res.screenshot;
        setTitle(s.merchant_name || s.payment_description || "UPI Payment");
        setAmount(s.extracted_amount ? String(s.extracted_amount) : "");
        setCategoryName(s.extracted_category || "Others");
        setTxDate(s.extracted_date || getTodayIso());
        setPaymentMode("UPI");
        setUpiTxId(s.upi_transaction_id || "");
        setNotes(
          s.payment_description ||
            (s.payment_app ? `Paid via ${s.payment_app}` : "Shared payment screenshot")
        );
      } catch (err) {
        Alert.alert(
          "Extraction Failed",
          err instanceof ApiError ? err.message : "Could not analyze payment screenshot."
        );
      } finally {
        setAnalyzing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (sharedUri) {
      const decoded = decodeURIComponent(sharedUri);
      const isPng = decoded.toLowerCase().endsWith(".png");
      const name = isPng ? "shared_payment.png" : "shared_payment.jpg";
      const mime = isPng ? "image/png" : "image/jpeg";
      setImageUri(decoded);
      setImageName(name);
      setImageType(mime);
      runAnalysis(decoded, name, mime);
    }
  }, [sharedUri, runAnalysis]);

  const handlePickFromGallery = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const mime = asset.mimeType || "image/jpeg";
    const name = asset.name || "payment_screenshot.jpg";
    setImageUri(asset.uri);
    setImageName(name);
    setImageType(mime);
    await runAnalysis(asset.uri, name, mime, ocrHintText);
  };

  const handleConfirm = async () => {
    if (!analysis) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      Alert.alert("Amount Required", "Verify and enter a positive payment amount before saving.");
      return;
    }
    setConfirming(true);
    try {
      const saved = await mobileApi.confirmScreenshot(analysis.screenshot.id, {
        title: title.trim() || "UPI Payment",
        amount: amt,
        category_name: categoryName || "Others",
        transaction_date: txDate || getTodayIso(),
        payment_mode: paymentMode,
        transaction_id: upiTxId.trim() || null,
        notes: notes.trim() || null,
      });
      Alert.alert(
        "Expense Saved",
        `Recorded "${saved.title}" (${formatCurrency(saved.amount, currencySymbol, currencyCode)})`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err) {
      Alert.alert("Save Failed", err instanceof ApiError ? err.message : "Could not save expense.");
    } finally {
      setConfirming(false);
    }
  };

  const handleDiscard = async () => {
    if (!analysis) return;
    await mobileApi.discardScreenshot(analysis.screenshot.id).catch(() => {});
    setAnalysis(null);
    setImageUri(null);
    loadHistory();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="close" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Smart Screenshot Import</Text>
            <Text style={styles.sub}>Share directly from GPay / PhonePe / Paytm or pick image</Text>
          </View>
        </View>

        <View style={styles.card}>
          <TouchableOpacity style={styles.pickBtn} onPress={handlePickFromGallery}>
            <Ionicons name="images-outline" size={20} color="#fff" />
            <Text style={styles.pickBtnText}>
              {imageUri ? "Choose Another Screenshot" : "Pick Payment Screenshot"}
            </Text>
          </TouchableOpacity>

          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
          )}

          <Text style={styles.label}>Optional Receipt Text Override</Text>
          <TextInput
            style={styles.input}
            value={ocrHintText}
            onChangeText={setOcrHintText}
            placeholder="Paste copied SMS/UPI receipt text if screenshot is blurred"
          />

          {imageUri && !analyzing && (
            <TouchableOpacity
              style={styles.reanalyzeBtn}
              onPress={() => runAnalysis(imageUri, imageName, imageType, ocrHintText)}
            >
              <Ionicons name="scan-outline" size={16} color={COLORS.brand} />
              <Text style={styles.reanalyzeText}>Re-Analyze Image</Text>
            </TouchableOpacity>
          )}
        </View>

        {analyzing && (
          <View style={styles.card}>
            <ActivityIndicator color={COLORS.brand} />
            <Text style={styles.analyzingText}>
              Extracting amount, merchant, category, date & UTR...
            </Text>
          </View>
        )}

        {analysis && (
          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>
                Review Extracted Expense ({analysis.screenshot.payment_app || "UPI"})
              </Text>
              <Text style={styles.confBadge}>
                {(analysis.screenshot.confidence_score * 100).toFixed(0)}% conf
              </Text>
            </View>

            {analysis.screenshot.is_duplicate && (
              <View style={styles.dupBox}>
                <Ionicons name="warning-outline" size={18} color={COLORS.amber} />
                <Text style={styles.dupText}>
                  Duplicate Warning: {analysis.screenshot.duplicate_reason}
                </Text>
              </View>
            )}

            <Text style={styles.label}>Merchant / Title</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} />

            <Text style={styles.label}>Amount ({currencySymbol})</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholder="Enter extracted amount"
            />

            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {analysis.available_categories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategoryName(cat)}
                    style={[styles.chip, categoryName === cat && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, categoryName === cat && styles.chipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={txDate} onChangeText={setTxDate} />

            <Text style={styles.label}>Payment Mode</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {PAYMENT_MODES.map((pm) => (
                  <TouchableOpacity
                    key={pm}
                    onPress={() => setPaymentMode(pm)}
                    style={[styles.chip, paymentMode === pm && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, paymentMode === pm && styles.chipTextActive]}>
                      {pm}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={styles.label}>UPI Transaction ID / UTR</Text>
            <TextInput
              style={styles.input}
              value={upiTxId}
              onChangeText={setUpiTxId}
              placeholder="Optional UTR"
            />

            <Text style={styles.label}>Description / Notes</Text>
            <TextInput style={styles.input} value={notes} onChangeText={setNotes} />

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.discardBtn} onPress={handleDiscard}>
                <Text style={styles.discardText}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirm}
                disabled={confirming}
              >
                <Text style={styles.confirmText}>
                  {confirming ? "Saving..." : "Confirm & Save Expense"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {history.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Scans</Text>
            {history.slice(0, 5).map((h) => (
              <View key={h.id} style={styles.histRow}>
                <Text style={styles.histTitle} numberOfLines={1}>
                  {h.merchant_name || h.filename}
                </Text>
                <Text style={styles.histMeta}>
                  {h.extracted_amount
                    ? formatCurrency(h.extracted_amount, currencySymbol, currencyCode)
                    : "—"}{" "}
                  · {h.status}
                </Text>
              </View>
            ))}
          </View>
        )}
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
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.brand,
    paddingVertical: 13,
    borderRadius: 14,
  },
  pickBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  preview: { width: "100%", height: 220, borderRadius: 12, backgroundColor: "#F1F5F9" },
  reanalyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.brandSoft,
  },
  reanalyzeText: { color: COLORS.brand, fontSize: 13, fontWeight: "700" },
  analyzingText: { textAlign: "center", fontSize: 12, color: COLORS.textMuted },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  confBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.brand,
    backgroundColor: COLORS.brandSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  dupBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.amberSoft,
    padding: 10,
    borderRadius: 10,
  },
  dupText: { flex: 1, fontSize: 11, fontWeight: "700", color: COLORS.amber },
  label: { fontSize: 12, fontWeight: "700", color: COLORS.text, marginTop: 4 },
  input: {
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
  },
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
  actionRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  discardBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
  },
  discardText: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted },
  confirmBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.sage,
    alignItems: "center",
  },
  confirmText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  histRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  histTitle: { flex: 1, fontSize: 12, fontWeight: "700", color: COLORS.text, paddingRight: 8 },
  histMeta: { fontSize: 11, color: COLORS.textMuted },
});
