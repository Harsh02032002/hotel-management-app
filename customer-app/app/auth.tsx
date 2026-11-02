import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signUp, sendOtp, verifyOtp } = useAuth();

  const [mode, setMode] = useState<"login" | "register" | "otp">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("guest@grandpalacehotel.in");
  const [phone, setPhone] = useState("+91 98111 22334");
  const [password, setPassword] = useState("guest123");
  const [otpTarget, setOtpTarget] = useState("guest@grandpalacehotel.in");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpHint, setOtpHint] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    setBusy(true);
    try {
      if (mode === "login") {
        await signIn(email.trim(), password);
      } else if (mode === "register") {
        if (!name.trim() || !email.trim() || !phone.trim() || password.length < 6) {
          Alert.alert("Missing Details", "Please fill name, email, phone, and a 6+ character password.");
          return;
        }
        await signUp(name.trim(), email.trim(), phone.trim(), password);
      } else {
        if (!otpSent) {
          const res = await sendOtp(otpTarget.trim());
          setOtpSent(true);
          if (res.otp_preview) {
            setOtpHint(res.otp_preview);
            setOtpCode(res.otp_preview);
          }
          Alert.alert("OTP Sent", `${res.message}${res.otp_preview ? ` (Demo OTP: ${res.otp_preview})` : ""}`);
        } else {
          await verifyOtp(otpTarget.trim(), otpCode.trim());
        }
      }
    } catch (e: any) {
      Alert.alert("Authentication Error", e.message || "Unable to authenticate");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 16 }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Ionicons name="business" size={24} color="#D4AF37" />
          </View>
          <Text style={styles.subtitle}>THE GRAND PALACE HOTEL</Text>
          <Text style={styles.title}>Guest Reservations Portal</Text>
          <Text style={styles.desc}>
            Book luxury suites directly, enjoy instant confirmation, online payments, and digital GST invoices.
          </Text>
        </View>

        <View style={styles.tabs}>
          {(["login", "register", "otp"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => {
                setMode(t);
                setOtpSent(false);
              }}
              style={[styles.tab, mode === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, mode === t && styles.tabTextActive]}>
                {t === "login" ? "Sign In" : t === "register" ? "Register" : "OTP Login"}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          {mode === "register" && (
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Aarav Khanna"
                placeholderTextColor="#64748B"
                style={styles.input}
              />
            </View>
          )}

          {mode !== "otp" ? (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="guest@grandpalacehotel.in"
                  placeholderTextColor="#64748B"
                  style={styles.input}
                />
              </View>

              {mode === "register" && (
                <View style={styles.field}>
                  <Text style={styles.label}>Mobile Number</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="+91 98765 43210"
                    placeholderTextColor="#64748B"
                    style={styles.input}
                  />
                </View>
              )}

              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor="#64748B"
                  style={styles.input}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Mobile Number or Email</Text>
                <TextInput
                  value={otpTarget}
                  onChangeText={setOtpTarget}
                  autoCapitalize="none"
                  placeholder="+91 98111 22334 or email"
                  placeholderTextColor="#64748B"
                  style={styles.input}
                />
              </View>
              {otpSent && (
                <View style={styles.field}>
                  <Text style={styles.label}>6-Digit OTP {otpHint ? `(Code: ${otpHint})` : ""}</Text>
                  <TextInput
                    value={otpCode}
                    onChangeText={setOtpCode}
                    keyboardType="number-pad"
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor="#64748B"
                    style={styles.input}
                  />
                </View>
              )}
            </>
          )}

          <Pressable style={styles.primaryBtn} onPress={handleSubmit} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === "login"
                  ? "Sign In to Hotel"
                  : mode === "register"
                    ? "Create Guest Account"
                    : otpSent
                      ? "Verify OTP & Login"
                      : "Send Instant OTP"}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.demoBtn}
            onPress={() => {
              setMode("login");
              setEmail("guest@grandpalacehotel.in");
              setPassword("guest123");
            }}
          >
            <Ionicons name="key-outline" size={16} color="#D4AF37" />
            <Text style={styles.demoText}>Use Demo Guest: guest@grandpalacehotel.in / guest123</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  scroll: { padding: 20, paddingBottom: 48 },
  hero: { alignItems: "center", marginBottom: 24 },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#1E293B",
    borderWidth: 1,
    borderColor: "#D4AF37",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  subtitle: { color: "#D4AF37", fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { color: "#F8FAFC", fontSize: 26, fontWeight: "800", marginTop: 4 },
  desc: { color: "#94A3B8", fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 19 },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  tabActive: { backgroundColor: "#D4AF37" },
  tabText: { color: "#94A3B8", fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: "#0F172A" },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 14,
  },
  field: { gap: 6 },
  label: { color: "#CBD5E1", fontSize: 13, fontWeight: "600" },
  input: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#F8FAFC",
    fontSize: 15,
  },
  primaryBtn: {
    backgroundColor: "#D4AF37",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
  },
  primaryBtnText: { color: "#0F172A", fontSize: 16, fontWeight: "800" },
  demoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  demoText: { color: "#D4AF37", fontSize: 12, fontWeight: "600" },
});
