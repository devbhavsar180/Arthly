import React from "react";
import { View } from "react-native";
import { COLORS } from "@/lib/format";

// Placeholder tab screen; the center + tab button opens QuickAddModal directly.
export default function AddPlaceholderScreen() {
  return <View style={{ flex: 1, backgroundColor: COLORS.ivory }} />;
}
