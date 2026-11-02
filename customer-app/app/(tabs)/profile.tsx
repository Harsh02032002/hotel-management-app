import React, { useState } from "react";
import {
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

export default function CustomerProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, updateProfile, signOut } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");
  const [idType, setIdType] = useState(user?.id_type || "Aadhaar Card");
  const [idNumber, setIdNumber] = useState(user?.id_number || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ name, phone, address, id_type: idType, id_number: idNumber });
      Alert.alert("Profile Saved", "Your guest profile and KYC details have been updated.");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sub}>GUEST IDENTITY & PREFERENCES</Text>
        <Text style={styles.title}>Guest Profile</Text>

        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={28} color="#0F172A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal & KYC Information</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholderTextColor="#64748B" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput value={phone} onChangeText={setPhone} style={styles.input} placeholderTextColor="#64748B" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Residential Address</Text>
            <TextInput value={address} onChangeText={setAddress} style={styles.input} placeholder="City, State" placeholderTextColor="#64748B" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Government ID Type (Express Check-in)</Text>
            <TextInput value={idType} onChangeText={setIdType} style={styles.input} placeholder="Aadhaar Card / Passport" placeholderTextColor="#64748B" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Government ID Number</Text>
            <TextInput value={idNumber} onChangeText={setIdNumber} style={styles.input} placeholder="XXXX-XXXX-1234" placeholderTextColor="#64748B" />
          </View>

          <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Profile & KYC"}</Text>
          </Pressable>
        </View>

        <View style={styles.policyCard}>
          <Text style={styles.policyTitle}>Hotel Check-in & Cancellation Policy</Text>
          <Text style={styles.policyText}>• Check-in: 02:00 PM | Check-out: 11:00 AM</Text>
          <Text style={styles.policyText}>• Valid Government Photo ID is mandatory at check-in.</Text>
          <Text style={styles.policyText}>• Free cancellation up to 24 hours prior to check-in.</Text>
          <Text style={styles.policyText}>• 24x7 Front Desk Concierge: +91 98765 43210</Text>
        </View>

        <Pressable style={styles.logoutBtn} onPress={signOut}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  scroll: { padding: 16, paddingBottom: 40 },
  sub: { color: "#D4AF37", fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { color: "#F8FAFC", fontSize: 24, fontWeight: "800", marginBottom: 14 },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#1E293B",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#D4AF37",
    alignItems: "center",
    justifyContent: "center",
  },
  userName: { color: "#F8FAFC", fontSize: 18, fontWeight: "800" },
  userEmail: { color: "#94A3B8", fontSize: 13, marginTop: 2 },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: { color: "#D4AF37", fontSize: 14, fontWeight: "800", marginBottom: 4 },
  field: { gap: 5 },
  label: { color: "#CBD5E1", fontSize: 12, fontWeight: "600" },
  input: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#F8FAFC",
    fontSize: 14,
  },
  saveBtn: {
    backgroundColor: "#D4AF37",
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: { color: "#0F172A", fontSize: 14, fontWeight: "800" },
  policyCard: {
    backgroundColor: "#1E293B",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 6,
    marginBottom: 16,
  },
  policyTitle: { color: "#F8FAFC", fontSize: 14, fontWeight: "800", marginBottom: 4 },
  policyText: { color: "#94A3B8", fontSize: 12, lineHeight: 18 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  logoutText: { color: "#EF4444", fontSize: 14, fontWeight: "800" },
});
