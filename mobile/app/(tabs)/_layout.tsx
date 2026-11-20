import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { QuickAddModal } from "@/components/QuickAddModal";
import { COLORS } from "@/lib/format";

export default function TabsLayout() {
  const router = useRouter();
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.brand,
          tabBarInactiveTintColor: COLORS.textLight,
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.border,
            height: 66,
            paddingBottom: 8,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "600",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: "Transactions",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="swap-horizontal-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: "",
            tabBarButton: () => (
              <View style={styles.fabContainer}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.fab}
                  onPress={() => setQuickAddOpen(true)}
                >
                  <Ionicons name="add" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: "Reports",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bar-chart-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>

      <QuickAddModal
        visible={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSelectExpense={() => {
          setQuickAddOpen(false);
          router.push("/add-expense");
        }}
        onSelectIncome={() => {
          setQuickAddOpen(false);
          router.push("/add-income");
        }}
        onSelectVoice={() => {
          setQuickAddOpen(false);
          router.push("/voice-entry");
        }}
        onSelectReconciliation={() => {
          setQuickAddOpen(false);
          router.push("/reconciliation");
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.brand,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -22,
    elevation: 6,
    shadowColor: COLORS.brand,
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
});
