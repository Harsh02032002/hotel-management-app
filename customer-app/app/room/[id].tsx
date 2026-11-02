import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import Ionicons from "@react-native-vector-icons/ionicons";
import dayjs from "dayjs";

import { API_URL, apiFetch } from "@/src/api/client";

export default function RoomCategoryDetailAndBookScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; check_in?: string; check_out?: string; guests?: string }>();

  const [category, setCategory] = useState<any>(null);
  const [checkIn, setCheckIn] = useState(params.check_in || dayjs().format("YYYY-MM-DD"));
  const [checkOut, setCheckOut] = useState(params.check_out || dayjs().add(2, "day").format("YYYY-MM-DD"));
  const [guests, setGuests] = useState(Number(params.guests) || 2);
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"ONLINE" | "PAY_AT_HOTEL">("ONLINE");
  const [loading, setLoading] = useState(true);
  const [bookingBusy, setBookingBusy] = useState(false);
  const [checkoutBookingId, setCheckoutBookingId] = useState<string | null>(null);

  const loadRoomDetails = useCallback(async () => {
    try {
      const data = await apiFetch(
        `/api/room-categories/${params.id}?check_in=${encodeURIComponent(checkIn)}&check_out=${encodeURIComponent(checkOut)}`
      );
      setCategory(data);
      if (data.available_rooms?.length > 0) {
        setSelectedRoomId((prev) =>
          data.available_rooms.some((r: any) => r.id === prev) ? prev : data.available_rooms[0].id
        );
      } else {
        setSelectedRoomId("");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to load room details");
    } finally {
      setLoading(false);
    }
  }, [params.id, checkIn, checkOut]);

  useEffect(() => {
    loadRoomDetails();
  }, [loadRoomDetails]);

  const nights = Math.max(1, dayjs(checkOut).diff(dayjs(checkIn), "day") || 1);
  const basePrice = category?.base_price || 4500;
  const subtotal = basePrice * nights;
  const gstRate = basePrice > 7500 ? 18 : 12;
  const gstAmount = Math.round((subtotal * gstRate) / 100);
  const grandTotal = subtotal + gstAmount;

  const handleCreateBooking = async () => {
    if (!category) return;
    if ((category.available_rooms || []).length === 0) {
      Alert.alert("No Rooms Available", "Please choose different check-in / check-out dates.");
      return;
    }
    setBookingBusy(true);
    try {
      const res = await apiFetch<{ booking: any; payment_gateway: any }>("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          category_id: category.id,
          room_id: selectedRoomId || undefined,
          check_in: checkIn,
          check_out: checkOut,
          guests,
          special_requests: specialRequests,
          payment_method: paymentMethod,
        }),
      });

      const created = res.booking;
      if (paymentMethod === "ONLINE") {
        setCheckoutBookingId(created.id);
      } else {
        Alert.alert(
          "Booking Received!",
          `Booking Ref: ${created.booking_ref}\nRoom #${created.room_number} reserved from ${checkIn} to ${checkOut}.`,
          [{ text: "View My Bookings", onPress: () => router.replace("/(tabs)/bookings") }]
        );
      }
    } catch (e: any) {
      Alert.alert("Booking Failed", e.message || "Unable to complete booking");
    } finally {
      setBookingBusy(false);
    }
  };

  if (loading || !category) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color="#D4AF37" size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#F8FAFC" />
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          {category.name}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Photo Carousel */}
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
          {(category.images || []).map((img: string, idx: number) => (
            <Image key={idx} source={{ uri: img }} style={styles.heroImg} />
          ))}
        </ScrollView>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.roomName}>{category.name}</Text>
              <Text style={styles.roomMeta}>
                {category.size_sqft} sq.ft • {category.bed_type} • Max {category.max_guests} Guests
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={styles.price}>₹{category.base_price.toLocaleString()}</Text>
              <Text style={styles.perNight}>per night + GST</Text>
            </View>
          </View>

          <Text style={styles.desc}>{category.description}</Text>

          {/* Amenities */}
          <Text style={styles.sectionTitle}>Suite Amenities</Text>
          <View style={styles.amenitiesGrid}>
            {(category.amenities || []).map((a: string) => (
              <View key={a} style={styles.amenityChip}>
                <Ionicons name="checkmark-circle" size={14} color="#D4AF37" />
                <Text style={styles.amenityText}>{a}</Text>
              </View>
            ))}
          </View>

          {/* Dates & Guests */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Select Stay Dates & Guests</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Check-in Date</Text>
                <TextInput
                  value={checkIn}
                  onChangeText={setCheckIn}
                  onBlur={loadRoomDetails}
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#64748B"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Check-out Date</Text>
                <TextInput
                  value={checkOut}
                  onChangeText={setCheckOut}
                  onBlur={loadRoomDetails}
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#64748B"
                />
              </View>
            </View>

            <View style={styles.guestRow}>
              <Text style={styles.label}>Guests (Max {category.max_guests})</Text>
              <View style={styles.stepper}>
                <Pressable style={styles.stepBtn} onPress={() => setGuests(Math.max(1, guests - 1))}>
                  <Ionicons name="remove" size={16} color="#F8FAFC" />
                </Pressable>
                <Text style={styles.guestVal}>{guests}</Text>
                <Pressable
                  style={styles.stepBtn}
                  onPress={() => setGuests(Math.min(category.max_guests || 4, guests + 1))}
                >
                  <Ionicons name="add" size={16} color="#F8FAFC" />
                </Pressable>
              </View>
            </View>
          </View>

          {/* Select Specific Available Room Number */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Choose Available Room ({(category.available_rooms || []).length} Available)
            </Text>
            <View style={styles.roomsGrid}>
              {(category.rooms || []).map((r: any) => {
                const avail = r.is_available_for_dates;
                const selected = selectedRoomId === r.id;
                return (
                  <Pressable
                    key={r.id}
                    disabled={!avail}
                    onPress={() => setSelectedRoomId(r.id)}
                    style={[
                      styles.roomChip,
                      !avail && styles.roomChipDisabled,
                      selected && styles.roomChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.roomChipNum,
                        !avail && { color: "#475569" },
                        selected && { color: "#0F172A" },
                      ]}
                    >
                      Room #{r.room_number}
                    </Text>
                    <Text
                      style={[
                        styles.roomChipStatus,
                        !avail && { color: "#475569" },
                        selected && { color: "#0F172A" },
                      ]}
                    >
                      {avail ? "Available" : r.status}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Special Requests & Payment Mode */}
          <View style={styles.card}>
            <Text style={styles.label}>Special Requests (Optional)</Text>
            <TextInput
              value={specialRequests}
              onChangeText={setSpecialRequests}
              placeholder="Airport pickup, early check-in, high floor..."
              placeholderTextColor="#64748B"
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 8 }]}>Payment Method</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.payModeBtn, paymentMethod === "ONLINE" && styles.payModeActive]}
                onPress={() => setPaymentMethod("ONLINE")}
              >
                <Ionicons
                  name="card"
                  size={16}
                  color={paymentMethod === "ONLINE" ? "#0F172A" : "#D4AF37"}
                />
                <Text
                  style={[
                    styles.payModeText,
                    paymentMethod === "ONLINE" && { color: "#0F172A" },
                  ]}
                >
                  Pay Online (Instant)
                </Text>
              </Pressable>

              <Pressable
                style={[styles.payModeBtn, paymentMethod === "PAY_AT_HOTEL" && styles.payModeActive]}
                onPress={() => setPaymentMethod("PAY_AT_HOTEL")}
              >
                <Ionicons
                  name="business"
                  size={16}
                  color={paymentMethod === "PAY_AT_HOTEL" ? "#0F172A" : "#D4AF37"}
                />
                <Text
                  style={[
                    styles.payModeText,
                    paymentMethod === "PAY_AT_HOTEL" && { color: "#0F172A" },
                  ]}
                >
                  Pay at Hotel
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Bill & GST Summary */}
          <View style={styles.billCard}>
            <Text style={styles.sectionTitle}>Tariff & GST Breakdown</Text>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>
                Room Tariff (₹{basePrice.toLocaleString()} × {nights} night{nights > 1 ? "s" : ""})
              </Text>
              <Text style={styles.billVal}>₹{subtotal.toLocaleString()}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>CGST + SGST ({gstRate}%)</Text>
              <Text style={styles.billVal}>₹{gstAmount.toLocaleString()}</Text>
            </View>
            <View style={[styles.billRow, styles.billTotalRow]}>
              <Text style={styles.billTotalLabel}>Total Payable</Text>
              <Text style={styles.billTotalVal}>₹{grandTotal.toLocaleString()}</Text>
            </View>
          </View>

          <Pressable style={styles.confirmBtn} onPress={handleCreateBooking} disabled={bookingBusy}>
            {bookingBusy ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <Text style={styles.confirmBtnText}>
                {paymentMethod === "ONLINE"
                  ? `Book & Pay ₹${grandTotal.toLocaleString()} Online`
                  : `Confirm Booking • ₹${grandTotal.toLocaleString()}`}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {/* Online Payment Gateway Modal */}
      <Modal visible={!!checkoutBookingId} animationType="slide" onRequestClose={() => setCheckoutBookingId(null)}>
        <View style={[styles.modalWrap, { paddingTop: insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Complete Online Payment</Text>
            <Pressable
              onPress={() => {
                setCheckoutBookingId(null);
                router.replace("/(tabs)/bookings");
              }}
            >
              <Ionicons name="close" size={24} color="#F8FAFC" />
            </Pressable>
          </View>
          {checkoutBookingId && (
            <WebView
              source={{ uri: `${API_URL}/api/payments/checkout-page/${checkoutBookingId}` }}
              onShouldStartLoadWithRequest={(req) => {
                if (req.url.startsWith("grandpalace://payment-success")) {
                  setCheckoutBookingId(null);
                  Alert.alert(
                    "Booking & Payment Confirmed!",
                    "Your room reservation and online payment are complete.",
                    [{ text: "View My Bookings", onPress: () => router.replace("/(tabs)/bookings") }]
                  );
                  return false;
                }
                if (req.url.startsWith("grandpalace://payment-cancelled")) {
                  setCheckoutBookingId(null);
                  router.replace("/(tabs)/bookings");
                  return false;
                }
                return true;
              }}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: { color: "#F8FAFC", fontSize: 17, fontWeight: "800", flex: 1, textAlign: "center" },
  scroll: { paddingBottom: 44 },
  heroImg: { width: 380, height: 220 },
  body: { padding: 16, gap: 16 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  roomName: { color: "#F8FAFC", fontSize: 22, fontWeight: "800" },
  roomMeta: { color: "#D4AF37", fontSize: 13, fontWeight: "600", marginTop: 4 },
  price: { color: "#D4AF37", fontSize: 22, fontWeight: "800" },
  perNight: { color: "#94A3B8", fontSize: 11 },
  desc: { color: "#CBD5E1", fontSize: 14, lineHeight: 20 },
  sectionTitle: { color: "#F8FAFC", fontSize: 15, fontWeight: "800", marginBottom: 6 },
  amenitiesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  amenityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1E293B",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  amenityText: { color: "#E2E8F0", fontSize: 12, fontWeight: "600" },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 10,
  },
  row: { flexDirection: "row", gap: 10 },
  label: { color: "#CBD5E1", fontSize: 12, fontWeight: "600", marginBottom: 4 },
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
  guestRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  guestVal: { color: "#F8FAFC", fontSize: 15, fontWeight: "800" },
  roomsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  roomChip: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 102,
  },
  roomChipDisabled: { opacity: 0.45 },
  roomChipSelected: { backgroundColor: "#D4AF37", borderColor: "#D4AF37" },
  roomChipNum: { color: "#F8FAFC", fontSize: 13, fontWeight: "800" },
  roomChipStatus: { color: "#22C55E", fontSize: 10, fontWeight: "700", marginTop: 2 },
  payModeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#D4AF37",
    paddingVertical: 11,
    borderRadius: 10,
  },
  payModeActive: { backgroundColor: "#D4AF37" },
  payModeText: { color: "#D4AF37", fontSize: 12, fontWeight: "800" },
  billCard: {
    backgroundColor: "#1E293B",
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: "#D4AF37",
    gap: 8,
  },
  billRow: { flexDirection: "row", justifyContent: "space-between" },
  billLabel: { color: "#CBD5E1", fontSize: 13 },
  billVal: { color: "#F8FAFC", fontSize: 13, fontWeight: "700" },
  billTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "#334155",
    paddingTop: 8,
    marginTop: 4,
  },
  billTotalLabel: { color: "#D4AF37", fontSize: 15, fontWeight: "800" },
  billTotalVal: { color: "#D4AF37", fontSize: 18, fontWeight: "800" },
  confirmBtn: {
    backgroundColor: "#D4AF37",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmBtnText: { color: "#0F172A", fontSize: 16, fontWeight: "800" },
  modalWrap: { flex: 1, backgroundColor: "#0F172A" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  modalTitle: { color: "#F8FAFC", fontSize: 17, fontWeight: "800" },
});
