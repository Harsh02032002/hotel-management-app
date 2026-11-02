import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import dayjs from "dayjs";

import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/auth";

export default function HotelHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [checkIn] = useState(dayjs().format("YYYY-MM-DD"));
  const [checkOut] = useState(dayjs().add(2, "day").format("YYYY-MM-DD"));
  const [guests] = useState(2);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/hotel?check_in=${checkIn}&check_out=${checkOut}&guests=${guests}`);
      setData(res);
    } catch {
      // keep previous
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [checkIn, checkOut, guests]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const hotel = data?.hotel || {};
  const categories = data?.categories || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#D4AF37" />}
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.brandTag}>ROYAL PALACE COLLECTION</Text>
            <Text style={styles.hotelName}>{hotel.name || "The Grand Palace Hotel"}</Text>
          </View>
          <Pressable style={styles.userPill} onPress={() => router.push("/(tabs)/profile")}>
            <Ionicons name="person-circle" size={22} color="#D4AF37" />
            <Text style={styles.userName}>{user?.name?.split(" ")[0] || "Guest"}</Text>
          </Pressable>
        </View>

        {/* Hero Banner */}
        <View style={styles.heroCard}>
          <Image
            source={{
              uri:
                hotel.hero_image ||
                "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1200&auto=format&fit=crop",
            }}
            style={styles.heroImg}
          />
          <View style={styles.heroOverlay}>
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={13} color="#0F172A" />
              <Text style={styles.ratingText}>
                {hotel.rating || "4.9"} ({hotel.reviews_count || 428} Guest Reviews)
              </Text>
            </View>
            <Text style={styles.heroTitle}>{hotel.tagline || "Heritage Luxury & Bespoke Hospitality"}</Text>
            <Text style={styles.heroAddress}>{hotel.address || "MG Road, Royal Enclave, Jaipur"}</Text>
          </View>
        </View>

        {/* Quick Availability Search Bar */}
        <Pressable style={styles.searchBar} onPress={() => router.push("/(tabs)/explore")}>
          <View style={styles.searchItem}>
            <Text style={styles.searchLabel}>CHECK-IN</Text>
            <Text style={styles.searchVal}>{checkIn}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.searchItem}>
            <Text style={styles.searchLabel}>CHECK-OUT</Text>
            <Text style={styles.searchVal}>{checkOut}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.searchItem}>
            <Text style={styles.searchLabel}>GUESTS</Text>
            <Text style={styles.searchVal}>{guests} Adults</Text>
          </View>
          <View style={styles.searchAction}>
            <Ionicons name="search" size={18} color="#0F172A" />
          </View>
        </Pressable>

        {/* Hotel Amenities */}
        <Text style={styles.sectionTitle}>Signature Hotel Amenities</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.amenitiesRow}>
          {(hotel.amenities || [
            "High-Speed Wi-Fi",
            "Rooftop Infinity Pool",
            "24x7 Room Service",
            "Fine Dining Restaurant",
            "Luxury Spa & Wellness",
            "Airport Chauffeur Pickup",
          ]).map((a: string) => (
            <View key={a} style={styles.amenityChip}>
              <Ionicons name="checkmark-circle" size={14} color="#D4AF37" />
              <Text style={styles.amenityText}>{a}</Text>
            </View>
          ))}
        </ScrollView>

        {/* Room Categories */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Luxury Rooms & Suites</Text>
          <Text style={styles.sectionSub}>{categories.length} Categories</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 32 }} />
        ) : (
          categories.map((cat: any) => (
            <Pressable
              key={cat.id}
              style={styles.roomCard}
              onPress={() =>
                router.push({
                  pathname: "/room/[id]",
                  params: { id: cat.id, check_in: checkIn, check_out: checkOut, guests: String(guests) },
                })
              }
            >
              <Image
                source={{ uri: (cat.images && cat.images[0]) || hotel.hero_image }}
                style={styles.roomImage}
              />
              <View style={styles.availBadge}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: cat.available_rooms_count > 0 ? "#22C55E" : "#EF4444" },
                  ]}
                />
                <Text style={styles.availText}>
                  {cat.available_rooms_count > 0
                    ? `${cat.available_rooms_count} Room(s) Available`
                    : "Sold Out for Dates"}
                </Text>
              </View>
              <View style={styles.roomBody}>
                <View style={styles.roomHeaderRow}>
                  <Text style={styles.roomName}>{cat.name}</Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.roomPrice}>₹{cat.base_price.toLocaleString()}</Text>
                    <Text style={styles.perNight}>+ GST / night</Text>
                  </View>
                </View>

                <Text style={styles.roomMeta}>
                  {cat.size_sqft} sq.ft • {cat.bed_type} • Up to {cat.max_guests} Guests
                </Text>
                <Text style={styles.roomDesc} numberOfLines={2}>
                  {cat.description}
                </Text>

                <View style={styles.tagsWrap}>
                  {(cat.amenities || []).slice(0, 4).map((am: string) => (
                    <View key={am} style={styles.tag}>
                      <Text style={styles.tagText}>{am}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.roomsListText}>
                    Rooms:{" "}
                    {(cat.available_rooms || []).map((r: any) => `#${r.room_number}`).join(", ") || "None"}
                  </Text>
                  <View style={styles.bookBtn}>
                    <Text style={styles.bookBtnText}>Select & Book</Text>
                    <Ionicons name="arrow-forward" size={14} color="#0F172A" />
                  </View>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  scroll: { padding: 16, paddingBottom: 40 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  brandTag: { color: "#D4AF37", fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  hotelName: { color: "#F8FAFC", fontSize: 22, fontWeight: "800" },
  userPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  userName: { color: "#F8FAFC", fontSize: 13, fontWeight: "700" },
  heroCard: {
    height: 210,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  heroImg: { width: "100%", height: "100%" },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 23, 42, 0.52)",
    justifyContent: "flex-end",
    padding: 16,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#D4AF37",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  ratingText: { color: "#0F172A", fontSize: 11, fontWeight: "800" },
  heroTitle: { color: "#F8FAFC", fontSize: 20, fontWeight: "800" },
  heroAddress: { color: "#E2E8F0", fontSize: 12, marginTop: 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D4AF37",
    marginBottom: 20,
  },
  searchItem: { flex: 1 },
  searchLabel: { color: "#94A3B8", fontSize: 10, fontWeight: "700" },
  searchVal: { color: "#F8FAFC", fontSize: 13, fontWeight: "800", marginTop: 2 },
  divider: { width: 1, height: 28, backgroundColor: "#334155", marginHorizontal: 10 },
  searchAction: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#D4AF37",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: { color: "#F8FAFC", fontSize: 18, fontWeight: "800", marginBottom: 8 },
  sectionSub: { color: "#D4AF37", fontSize: 12, fontWeight: "700" },
  amenitiesRow: { gap: 8, paddingBottom: 4 },
  amenityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#334155",
  },
  amenityText: { color: "#E2E8F0", fontSize: 12, fontWeight: "600" },
  roomCard: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 16,
  },
  roomImage: { width: "100%", height: 180 },
  availBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  availText: { color: "#F8FAFC", fontSize: 11, fontWeight: "700" },
  roomBody: { padding: 16, gap: 8 },
  roomHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  roomName: { color: "#F8FAFC", fontSize: 18, fontWeight: "800", flex: 1, paddingRight: 8 },
  roomPrice: { color: "#D4AF37", fontSize: 20, fontWeight: "800" },
  perNight: { color: "#94A3B8", fontSize: 11 },
  roomMeta: { color: "#D4AF37", fontSize: 12, fontWeight: "600" },
  roomDesc: { color: "#94A3B8", fontSize: 13, lineHeight: 18 },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tag: { backgroundColor: "#0F172A", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  tagText: { color: "#CBD5E1", fontSize: 11, fontWeight: "600" },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  roomsListText: { color: "#94A3B8", fontSize: 12, flex: 1 },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#D4AF37",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bookBtnText: { color: "#0F172A", fontSize: 13, fontWeight: "800" },
});
