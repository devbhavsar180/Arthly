import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS } from "@/lib/format";

export function QuickAddModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();

  const goTo = (
    path: "/screenshot-import" | "/voice-entry" | "/add-expense" | "/add-income" | "/reconciliation"
  ) => {
    onClose();
    setTimeout(() => router.push(path), 120);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.heading}>Quick Action</Text>
          <Text style={styles.subheading}>Choose how you want to record or verify activity</Text>

          <TouchableOpacity style={styles.actionRow} onPress={() => goTo("/screenshot-import")}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.brandSoft }]}>
              <Ionicons name="scan-outline" size={22} color={COLORS.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Scan Payment Screenshot</Text>
              <Text style={styles.actionSub}>Auto-extract GPay, PhonePe & Paytm UPI receipts</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} onPress={() => goTo("/voice-entry")}>
            <View style={[styles.iconCircle, { backgroundColor: "#EEF2FF" }]}>
              <Ionicons name="mic-outline" size={22} color={COLORS.indigo} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Voice Entry (Gujarati / EN / HI)</Text>
              <Text style={styles.actionSub}>Speak naturally to parse transactions</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} onPress={() => goTo("/add-expense")}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.roseSoft }]}>
              <Ionicons name="arrow-down-circle-outline" size={22} color={COLORS.rose} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Add Expense</Text>
              <Text style={styles.actionSub}>Record daily spending manually</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} onPress={() => goTo("/add-income")}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.sageSoft }]}>
              <Ionicons name="arrow-up-circle-outline" size={22} color={COLORS.sage} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Add Income</Text>
              <Text style={styles.actionSub}>Log salary, bonus, refund, or inflow</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionRow} onPress={() => goTo("/reconciliation")}>
            <View style={[styles.iconCircle, { backgroundColor: COLORS.amberSoft }]}>
              <Ionicons name="checkmark-done-outline" size={22} color={COLORS.amber} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionTitle}>Bank Verification</Text>
              <Text style={styles.actionSub}>Reconcile bank statement against entries</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 99,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: 14,
  },
  heading: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  subheading: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, marginBottom: 14 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: COLORS.ivory,
    marginBottom: 8,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  actionSub: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  cancelBtn: {
    marginTop: 6,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
  },
  cancelText: { fontSize: 14, fontWeight: "700", color: COLORS.textMuted },
});
