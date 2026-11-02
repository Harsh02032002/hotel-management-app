import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { AuthProvider, useAuth } from "@/src/context/auth";

function NavigationGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (loading || showSplash) return;
    const inAuth = segments[0] === "auth";
    if (!user && !inAuth) {
      router.replace("/auth");
    } else if (user && inAuth) {
      router.replace("/(tabs)");
    }
  }, [user, loading, showSplash, segments, router]);

  if (loading || showSplash) {
    return (
      <View style={styles.splash}>
        <StatusBar style="light" />
        <View style={styles.crest}>
          <Ionicons name="Sparkles" size={38} color="#D4AF37" />
        </View>
        <Text style={styles.brandSub}>ROYAL HERITAGE HOSPITALITY</Text>
        <Text style={styles.brandTitle}>The Grand Palace</Text>
        <Text style={styles.brandCity}>JAIPUR • EST. 1928</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0F172A" } }}>
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="room/[id]" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationGuard />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  crest: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: "#D4AF37",
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  brandSub: {
    color: "#D4AF37",
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "700",
    marginBottom: 6,
  },
  brandTitle: {
    color: "#F8FAFC",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  brandCity: {
    color: "#94A3B8",
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 8,
  },
});
