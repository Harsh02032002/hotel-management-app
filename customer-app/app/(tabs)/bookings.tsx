import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import Ionicons from "@react-native-vector-icons/ionicons";

import { API_URL, apiFetch } from "@/src/api/client";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#F59E0B",
  CONFIRMED: "#22C55E",
  CHECKED_IN: "#3B82F6",
  CHECKED_OUT: "#94A3B8",
  CANCELLED: "#EF4444",
};

export default function CustomerBookingsScreen() {
  const insets = useSafeAreaInsets();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkoutBookingId, setCheckoutBookingId] = useState<string | null>(null);
  const [invoiceBookingId, setInvoiceBookingId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    try {
      const res = await apiFetch<{ bookings: any[] }>("/api/bookings");
      setBookings(res.bookings || []);
    } catch {
      // keep previous
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
    const t = setInterval(loadBookings, 5000);
    return () => clearInterval(t);
  }, [loadBookings]);

  const handleCancel = (b: any) => {
    Alert.alert(
      "Cancel Reservation",
      `Cancel booking ${b.booking_ref} for Room #${b.room_number}?`,
      [
        { text: "Keep Booking", style: "cancel" },
        {
          text: "Confirm Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(`/api/bookings/${b.id}/cancel`, {
                method: "POST",
                body: JSON.stringify({ reason: "Cancelled by customer from mobile app" }),
              });
              loadBookings();
              Alert.alert("Booking Cancelled", `Reservation ${b.booking_ref} has been cancelled.`);
            } catch (e: any) {
              Alert.alert("Error", e.message || "Could not cancel booking");
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.sub}>RESERVATIONS & INVOICES</Text>
        <Text style={styles.title}>My Hotel Bookings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadBookings(); }} tintColor="#D4AF37" />}
      >
        {loading ? (
          <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
        ) : bookings.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bed-outline" size={48} color="#475569" />
            <Text style={styles.emptyTitle}>No Bookings Yet</Text>
            <Text style={styles.emptySub}>Explore our luxury suites and book your royal stay.</Text>
          </View>
        ) : (
          bookings.map((b) => (
            <View key={b.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.ref}>{b.booking_ref}</Text>
                  <Text style={styles.catName}>
                    {b.category_name} • Room #{b.room_number}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[b.status] || "#64748B" }]}>
                  <Text style={styles.statusText}>{b.status}</Text>
                </View>
              </View>

              <View style={styles.datesRow}>
                <View style={styles.dateBox}>
                  <Text style={styles.dateLabel}>CHECK-IN</Text>
                  <Text style={styles.dateVal}>{b.check_in}</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color="#D4AF37" />
                <View style={styles.dateBox}>
                  <Text style={styles.dateLabel}>CHECK-OUT</Text>
                  <Text style={styles.dateVal}>{b.check_out}</Text>
                </View>
                <View style={styles.dateBox}>
                  <Text style={styles.dateLabel}>GUESTS</Text>
                  <Text style={styles.dateVal}>{b.guests}</Text>
                </View>
              </View>

              <View style={styles.payRow}>
                <View>
                  <Text style={styles.totalText}>Grand Total: ₹{b.pricing?.grand_total?.toLocaleString()}</Text>
                  <Text style={styles.payMeta}>
                    Payment: {b.payment_status} • Paid: ₹{(b.amount_paid || 0).toLocaleString()} • Balance: ₹
                    {(b.balance_due || 0).toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionsRow}>
                {b.payment_status !== "PAID" && b.status !== "CANCELLED" && (
                  <Pressable style={styles.payBtn} onPress={() => setCheckoutBookingId(b.id)}>
                    <Ionicons name="card" size={15} color="#0F172A" />
                    <Text style={styles.payBtnText}>Pay Online</Text>
                  </Pressable>
                )}

                <Pressable style={styles.invoiceBtn} onPress={() => setInvoiceBookingId(b.id)}>
                  <Ionicons name="document-text-outline" size={15} color="#D4AF37" />
                  <Text style={styles.invoiceBtnText}>GST Invoice</Text>
                </Pressable>

                <Pressable
                  style={styles.invoiceBtn}
                  onPress={() => Linking.openURL(`${API_URL}/api/bookings/${b.id}/invoice`)}
                >
                  <Ionicons name="download-outline" size={15} color="#D4AF37" />
                  <Text style={styles.invoiceBtnText}>Download PDF</Text>
                </Pressable>

                {["PENDING", "CONFIRMED"].includes(b.status) && (
                  <Pressable style={styles.cancelBtn} onPress={() => handleCancel(b)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Online Payment Gateway WebView Modal */}
      <Modal visible={!!checkoutBookingId} animationType="slide" onRequestClose={() => setCheckoutBookingId(null)}>
        <View style={[styles.modalWrap, { paddingTop: insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Secure Payment Gateway</Text>
            <Pressable onPress={() => setCheckoutBookingId(null)}>
              <Ionicons name="close" size={24} color="#F8FAFC" />
            </Pressable>
          </View>
          {checkoutBookingId && (
            <WebView
              source={{ uri: `${API_URL}/api/payments/checkout-page/${checkoutBookingId}` }}
              onShouldStartLoadWithRequest={(req) => {
                if (req.url.startsWith("grandpalace://payment-success")) {
                  setCheckoutBookingId(null);
                  loadBookings();
                  Alert.alert("Payment Successful", "Your online payment has been verified and updated!");
                  return false;
                }
                if (req.url.startsWith("grandpalace://payment-cancelled")) {
                  setCheckoutBookingId(null);
                  return false;
                }
                return true;
              }}
            />
          )}
        </View>
      </Modal>

      {/* GST Invoice Viewer Modal */}
      <Modal visible={!!invoiceBookingId} animationType="slide" onRequestClose={() => setInvoiceBookingId(null)}>
        <View style={[styles.modalWrap, { paddingTop: insets.top + 8 }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>GST Tax Invoice</Text>
            <Pressable onPress={() => setInvoiceBookingId(null)}>
              <Ionicons name="close" size={24} color="#F8FAFC" />
            </Pressable>
          </View>
          {invoiceBookingId && (
            <WebView source={{ uri: `${API_URL}/api/bookings/${invoiceBookingId}/invoice` }} />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  sub: { color: "#D4AF37", fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { color: "#F8FAFC", fontSize: 24, fontWeight: "800" },
  scroll: { padding: 16, paddingBottom: 40 },
  empty: { alignItems: "center", marginTop: 64, gap: 8 },
  emptyTitle: { color: "#F8FAFC", fontSize: 18, fontWeight: "700" },
  emptySub: { color: "#94A3B8", fontSize: 13 },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 14,
    gap: 12,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  ref: { color: "#D4AF37", fontSize: 12, fontWeight: "800" },
  catName: { color: "#F8FAFC", fontSize: 16, fontWeight: "800", marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: "#0F172A", fontSize: 11, fontWeight: "800" },
  datesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0F172A",
    padding: 12,
    borderRadius: 10,
  },
  dateBox: { gap: 2 },
  dateLabel: { color: "#94A3B8", fontSize: 10, fontWeight: "700" },
  dateVal: { color: "#F8FAFC", fontSize: 13, fontWeight: "800" },
  payRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalText: { color: "#F8FAFC", fontSize: 15, fontWeight: "800" },
  payMeta: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#D4AF37",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  payBtnText: { color: "#0F172A", fontSize: 12, fontWeight: "800" },
  invoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "#D4AF37",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 8,
  },
  invoiceBtnText: { color: "#D4AF37", fontSize: 12, fontWeight: "700" },
  cancelBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelBtnText: { color: "#EF4444", fontSize: 12, fontWeight: "700" },
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
