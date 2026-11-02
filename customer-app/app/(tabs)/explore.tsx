import React, { useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import dayjs from "dayjs";

import { apiFetch } from "@/src/api/client";

export default function AvailabilityExploreScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [checkIn, setCheckIn] = useState(dayjs().format("YYYY-MM-DD"));
  const [checkOut, setCheckOut] = useState(dayjs().add(2, "day").format("YYYY-MM-DD"));
  const [guests, setGuests] = useState(2);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const searchAvailability = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(
        `/api/availability?check_in=${encodeURIComponent(checkIn)}&check_out=${encodeURIComponent(checkOut)}&guests=${guests}`
      );
      setResults(data.categories || []);
    } catch (e: any) {
      Alert.alert("Availability Check Failed", e.message || "Please verify your dates (YYYY-MM-DD).");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    searchAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.headerSub}>LIVE INVENTORY CHECK</Text>
        <Text style={styles.headerTitle}>Check Room Availability</Text>

        <View style={styles.filterCard}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Check-in Date (YYYY-MM-DD)</Text>
              <TextInput
                value={checkIn}
                onChangeText={setCheckIn}
                placeholder="2026-11-05"
                placeholderTextColor="#64748B"
                style={styles.input}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Check-out Date (YYYY-MM-DD)</Text>
              <TextInput
                value={checkOut}
                onChangeText={setCheckOut}
                placeholder="2026-11-07"
                placeholderTextColor="#64748B"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.guestRow}>
            <Text style={styles.label}>Number of Guests</Text>
            <View style={styles.stepper}>
              <Pressable style={styles.stepBtn} onPress={() => setGuests(Math.max(1, guests - 1))}>
                <Ionicons name="remove" size={18} color="#F8FAFC" />
              </Pressable>
              <Text style={styles.guestCount}>{guests} Guests</Text>
              <Pressable style={styles.stepBtn} onPress={() => setGuests(Math.min(6, guests + 1))}>
                <Ionicons name="add" size={18} color="#F8FAFC" />
              </Pressable>
            </View>
          </View>

          <Pressable style={styles.searchBtn} onPress={searchAvailability} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <>
                <Ionicons name="search" size={18} color="#0F172A" />
                <Text style={styles.searchBtnText}>Check Live Availability</Text>
              </>
            )}
          </Pressable>
        </View>

        {results.map((cat) => (
          <View key={cat.id} style={styles.resultCard}>
            <View style={styles.resultTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.catName}>{cat.name}</Text>
                <Text style={styles.catSub}>
                  Max {cat.max_guests} Guests • {cat.bed_type}
                </Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{cat.available_rooms_count} Left</Text>
              </View>
            </View>

            {cat.pricing && (
              <View style={styles.priceBreakdown}>
                <Text style={styles.priceItem}>
                  {cat.pricing.nights} Night(s) × ₹{cat.pricing.price_per_night.toLocaleString()} = ₹
                  {cat.pricing.subtotal.toLocaleString()}
                </Text>
                <Text style={styles.priceItem}>
                  GST ({cat.pricing.gst_rate}%): ₹{cat.pricing.gst_total.toLocaleString()}
                </Text>
                <Text style={styles.priceTotal}>
                  Total: ₹{cat.pricing.grand_total.toLocaleString()}
                </Text>
              </View>
            )}

            <Text style={styles.roomsLabel}>
              Available Room Numbers:{" "}
              {(cat.available_rooms || []).map((r: any) => `#${r.room_number}`).join(", ") || "None"}
            </Text>

            <Pressable
              style={[styles.bookNowBtn, cat.available_rooms_count === 0 && { opacity: 0.4 }]}
              disabled={cat.available_rooms_count === 0}
              onPress={() =>
                router.push({
                  pathname: "/room/[id]",
                  params: { id: cat.id, check_in: checkIn, check_out: checkOut, guests: String(guests) },
                })
              }
            >
              <Text style={styles.bookNowText}>
                {cat.available_rooms_count > 0 ? "Proceed to Book Room" : "Unavailable for Selected Dates"}
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  scroll: { padding: 16, paddingBottom: 40 },
  headerSub: { color: "#D4AF37", fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  headerTitle: { color: "#F8FAFC", fontSize: 24, fontWeight: "800", marginBottom: 14 },
  filterCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 14,
    marginBottom: 20,
  },
  row: { flexDirection: "row", gap: 10 },
  label: { color: "#CBD5E1", fontSize: 12, fontWeight: "600", marginBottom: 6 },
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
  guestRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  guestCount: { color: "#F8FAFC", fontSize: 15, fontWeight: "800" },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#D4AF37",
    paddingVertical: 13,
    borderRadius: 12,
  },
  searchBtnText: { color: "#0F172A", fontSize: 15, fontWeight: "800" },
  resultCard: {
    backgroundColor: "#1E293B",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 14,
    gap: 10,
  },
  resultTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  catName: { color: "#F8FAFC", fontSize: 17, fontWeight: "800" },
  catSub: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  countBadge: {
    backgroundColor: "#0F172A",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D4AF37",
  },
  countText: { color: "#D4AF37", fontSize: 12, fontWeight: "800" },
  priceBreakdown: {
    backgroundColor: "#0F172A",
    padding: 12,
    borderRadius: 10,
    gap: 4,
  },
  priceItem: { color: "#CBD5E1", fontSize: 13 },
  priceTotal: { color: "#D4AF37", fontSize: 15, fontWeight: "800", marginTop: 4 },
  roomsLabel: { color: "#94A3B8", fontSize: 12 },
  bookNowBtn: {
    backgroundColor: "#D4AF37",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  bookNowText: { color: "#0F172A", fontSize: 14, fontWeight: "800" },
});
