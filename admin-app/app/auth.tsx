import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { useAuth } from "@/src/context/auth";

const DEMO_ROLES = [
  { label: "General Manager (Admin)", email: "admin@grandpalacehotel.in", pass: "admin123" },
  { label: "Front Desk Officer", email: "frontdesk@grandpalacehotel.in", pass: "admin123" },
  { label: "Housekeeping Supervisor", email: "housekeeping@grandpalacehotel.in", pass: "admin123" },
  { label: "Finance & GST Controller", email: "finance@grandpalacehotel.in", pass: "admin123" },
];

export default function AdminAuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("admin@grandpalacehotel.in");
  const [password, setPassword] = useState("admin123");
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (e: any) {
      Alert.alert("Access Denied", e.message || "Invalid administrator credentials");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.shield}>
            <Ionicons name="shield-checkmark" size={28} color="#10B981" />
          </View>
          <Text style={styles.tag}>AUTHORIZED HOTEL STAFF ONLY</Text>
          <Text style={styles.title}>Grand Palace PMS Admin</Text>
          <Text style={styles.desc}>
            Manage reservations, front-desk check-in & KYC, housekeeping status, GST billing, and finance ledgers.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Staff Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              placeholderTextColor="#64748B"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
              placeholderTextColor="#64748B"
            />
          </View>

          <Pressable style={styles.loginBtn} onPress={handleLogin} disabled={busy}>
            {busy ? <ActivityIndicator color="#090D16" /> : <Text style={styles.loginText}>Sign In to Admin Console</Text>}
          </Pressable>
        </View>

        <Text style={styles.quickHeader}>Quick Role Switch (Demo Staff Accounts)</Text>
        {DEMO_ROLES.map((r) => (
          <Pressable
            key={r.email}
            style={styles.roleChip}
            onPress={() => {
              setEmail(r.email);
              setPassword(r.pass);
            }}
          >
            <Ionicons name="person-badge-outline" size={18} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={styles.roleTitle}>{r.label}</Text>
              <Text style={styles.roleEmail}>{r.email}</Text>
            </View>
            <Text style={styles.useText}>Select</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090D16" },
  scroll: { padding: 20, paddingBottom: 40 },
  hero: { alignItems: "center", marginBottom: 24 },
  shield: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#111827",
    borderWidth: 1.5,
    borderColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  tag: { color: "#10B981", fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title: { color: "#F8FAFC", fontSize: 26, fontWeight: "800", marginTop: 4 },
  desc: { color: "#94A3B8", fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 19 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#1F2937",
    gap: 14,
    marginBottom: 24,
  },
  field: { gap: 6 },
  label: { color: "#CBD5E1", fontSize: 13, fontWeight: "600" },
  input: {
    backgroundColor: "#090D16",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#F8FAFC",
    fontSize: 15,
  },
  loginBtn: {
    backgroundColor: "#10B981",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
  },
  loginText: { color: "#090D16", fontSize: 16, fontWeight: "800" },
  quickHeader: { color: "#94A3B8", fontSize: 12, fontWeight: "700", marginBottom: 10, letterSpacing: 1 },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 8,
  },
  roleTitle: { color: "#F8FAFC", fontSize: 13, fontWeight: "700" },
  roleEmail: { color: "#94A3B8", fontSize: 11 },
  useText: { color: "#10B981", fontSize: 12, fontWeight: "800" },
});
