import React, { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  NativeModules,
  Platform,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { COLORS } from "@/lib/format";

const { ShareIntentModule } = NativeModules;

function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pendingShareUri = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android" || !ShareIntentModule) return;

    ShareIntentModule.getInitialSharedImage?.()
      .then((uri: string | null) => {
        if (uri) {
          pendingShareUri.current = uri;
          if (user) {
            pendingShareUri.current = null;
            router.push({
              pathname: "/screenshot-import",
              params: { sharedUri: uri },
            });
          }
        }
      })
      .catch(() => {});

    const sub = DeviceEventEmitter.addListener("ArthlySharedImage", (uri: string) => {
      if (!uri) return;
      if (user) {
        router.push({
          pathname: "/screenshot-import",
          params: { sharedUri: uri },
        });
      } else {
        pendingShareUri.current = uri;
      }
    });

    return () => sub.remove();
  }, [user, router]);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    } else if (user && pendingShareUri.current) {
      const uri = pendingShareUri.current;
      pendingShareUri.current = null;
      router.push({
        pathname: "/screenshot-import",
        params: { sharedUri: uri },
      });
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.ivory,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator size="large" color={COLORS.brand} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" backgroundColor={COLORS.ivory} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.ivory },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-expense" options={{ presentation: "modal" }} />
        <Stack.Screen name="add-income" options={{ presentation: "modal" }} />
        <Stack.Screen name="edit-transaction" options={{ presentation: "modal" }} />
        <Stack.Screen name="voice-entry" options={{ presentation: "modal" }} />
        <Stack.Screen name="reconciliation" options={{ presentation: "modal" }} />
        <Stack.Screen name="screenshot-import" options={{ presentation: "modal" }} />
        <Stack.Screen name="budgets" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="admin" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
