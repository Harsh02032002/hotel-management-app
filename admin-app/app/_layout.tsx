import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { AuthProvider, useAuth } from "@/src/context/auth";

function AdminGuard() {
  const { admin, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 1200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (loading || splash) return;
    const inAuth = segments[0] === "auth";
    if (!admin && !inAuth) {
      router.replace("/auth");
    } else if (admin && inAuth) {
      router.replace("/(tabs)");
    }
  }, [admin, loading, splash, segments, router]);

  if (loading || splash) {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />
        <View style={styles.iconWrap}>
          <Ionicons name="shield-checkmark" size={38} color="#10B981" />
        </View>
        <Text style={styles.sub}>THE GRAND PALACE HOTEL</Text>
        <Text style={styles.title}>PMS & Admin Control</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#090D16" } }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AdminGuard />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: "#090D16",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#111827",
    borderWidth: 2,
    borderColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  sub: { color: "#10B981", fontSize: 11, fontWeight: "700", letterSpacing: 2.5 },
  title: { color: "#F8FAFC", fontSize: 28, fontWeight: "800", marginTop: 6 },
});
