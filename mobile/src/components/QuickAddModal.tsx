import React from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/lib/format";

export function QuickAddModal({
  visible,
  onClose,
  onSelectExpense,
  onSelectIncome,
  onSelectVoice,
  onSelectReconciliation,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectExpense: () => void;
  onSelectIncome: () => void;
  onSelectVoice: () => void;
  onSelectReconciliation: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Quick Actions</Text>
          <Text style={styles.subtitle}>Choose an action to record or verify finances</Text>

          <View style={styles.actions}>
            {/* Voice Expense Entry */}
            <TouchableOpacity style={[styles.option, styles.voiceOpt]} onPress={onSelectVoice}>
              <View style={[styles.iconCircle, { backgroundColor: "#6366F1" }]}>
                <Ionicons name="mic" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.optionTitle}>Voice Expense Entry</Text>
                  <View style={styles.newBadge}>
                    <Text style={styles.newBadgeText}>AI VOICE</Text>
                  </View>
                </View>
                <Text style={styles.optionSub}>Speak naturally in Gujarati, Hindi or English</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
            </TouchableOpacity>

            {/* Add Expense */}
            <TouchableOpacity style={[styles.option, styles.expenseOpt]} onPress={onSelectExpense}>
              <View style={[styles.iconCircle, { backgroundColor: COLORS.brand }]}>
                <Ionicons name="arrow-down" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Add Expense</Text>
                <Text style={styles.optionSub}>Food, Travel, Rent, UPI, Cash &amp; more</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
            </TouchableOpacity>

            {/* Add Income */}
            <TouchableOpacity style={[styles.option, styles.incomeOpt]} onPress={onSelectIncome}>
              <View style={[styles.iconCircle, { backgroundColor: COLORS.sage }]}>
                <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Add Income</Text>
                <Text style={styles.optionSub}>Monthly Salary, Freelancing, Bonus</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
            </TouchableOpacity>

            {/* Bank Statement Verification */}
            <TouchableOpacity style={[styles.option, styles.reconOpt]} onPress={onSelectReconciliation}>
              <View style={[styles.iconCircle, { backgroundColor: "#0D9488" }]}>
                <Ionicons name="document-text" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Bank Reconciliation</Text>
                <Text style={styles.optionSub}>Upload &amp; verify PDF, CSV or Excel statement</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.42)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
    marginBottom: 16,
  },
  actions: {
    gap: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  voiceOpt: {
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
  },
  expenseOpt: {
    backgroundColor: COLORS.brandSoft,
    borderColor: "#BFDBFE",
  },
  incomeOpt: {
    backgroundColor: COLORS.sageSoft,
    borderColor: "#A7F3D0",
  },
  reconOpt: {
    backgroundColor: "#F0FDFA",
    borderColor: "#99F6E4",
  },
  newBadge: {
    backgroundColor: "#4F46E5",
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  newBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  optionSub: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: COLORS.ivory,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
});
