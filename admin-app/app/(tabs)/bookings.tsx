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
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import dayjs from "dayjs";

import { API_URL, apiFetch } from "@/src/api/client";

const FILTERS = ["ALL", "PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED"] as const;

export default function AdminBookingsAndFrontDeskScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<string>("ALL");
  const [bookings, setBookings] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [checkInTarget, setCheckInTarget] = useState<any>(null);
  const [roomChangeTarget, setRoomChangeTarget] = useState<any>(null);
  const [extendTarget, setExtendTarget] = useState<any>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<any>(null);

  // Walk-in / Advance Reservation state
  const [wName, setWName] = useState("");
  const [wPhone, setWPhone] = useState("");
  const [wEmail, setWEmail] = useState("");
  const [wCategoryId, setWCategoryId] = useState("");
  const [wCheckIn, setWCheckIn] = useState(dayjs().format("YYYY-MM-DD"));
  const [wCheckOut, setWCheckOut] = useState(dayjs().add(1, "day").format("YYYY-MM-DD"));
  const [wType, setWType] = useState<"WALK_IN" | "ADVANCE">("WALK_IN");
  const [wAdvancePaid, setWAdvancePaid] = useState("0");
  const [wAutoCheckIn, setWAutoCheckIn] = useState(true);
  const [wIdNumber, setWIdNumber] = useState("");

  // Check-in + KYC state
  const [kycType, setKycType] = useState("Aadhaar Card");
  const [kycNumber, setKycNumber] = useState("");
  const [kycDocUrl, setKycDocUrl] = useState("https://grandpalacehotel.in/kyc/verified-id-scan.pdf");
  const [kycAddress, setKycAddress] = useState("");
  const [kycDeposit, setKycDeposit] = useState("0");

  // Room change & Stay extension & Checkout state
  const [newRoomId, setNewRoomId] = useState("");
  const [roomChangeReason, setRoomChangeReason] = useState("Guest requested room change");
  const [newCheckOutDate, setNewCheckOutDate] = useState("");
  const [extraCharges, setExtraCharges] = useState("0");
  const [extraNote, setExtraNote] = useState("Mini-bar / Room service");

  const loadAll = useCallback(async () => {
    try {
      const [bRes, cRes, rRes] = await Promise.all([
        apiFetch<{ bookings: any[] }>(`/api/admin/bookings?status=${filter}`),
        apiFetch<{ categories: any[] }>("/api/admin/categories"),
        apiFetch<{ rooms: any[] }>("/api/admin/rooms"),
      ]);
      setBookings(bRes.bookings || []);
      setCategories(cRes.categories || []);
      setRooms(rRes.rooms || []);
      if (!wCategoryId && cRes.categories?.length) {
        setWCategoryId(cRes.categories[0].id);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, wCategoryId]);

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 5000);
    return () => clearInterval(t);
  }, [loadAll]);

  const handleConfirm = async (b: any) => {
    try {
      await apiFetch(`/api/admin/bookings/${b.id}/confirm`, { method: "POST" });
      loadAll();
      Alert.alert("Booking Confirmed", `${b.booking_ref} has been confirmed and customer notified.`);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleReject = async (b: any) => {
    try {
      await apiFetch(`/api/admin/bookings/${b.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: "Rejected by hotel front desk" }),
      });
      loadAll();
      Alert.alert("Booking Rejected", `${b.booking_ref} was cancelled.`);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const submitWalkIn = async () => {
    if (!wName.trim() || !wPhone.trim() || !wCategoryId) {
      Alert.alert("Missing Fields", "Enter guest name, phone, and select a room category.");
      return;
    }
    try {
      const created = await apiFetch("/api/admin/bookings/walk-in", {
        method: "POST",
        body: JSON.stringify({
          guest_name: wName.trim(),
          guest_phone: wPhone.trim(),
          guest_email: wEmail.trim(),
          category_id: wCategoryId,
          check_in: wCheckIn,
          check_out: wCheckOut,
          booking_type: wType,
          advance_paid: Number(wAdvancePaid) || 0,
          auto_check_in: wAutoCheckIn,
          id_number: wIdNumber,
        }),
      });
      setWalkInOpen(false);
      setWName("");
      setWPhone("");
      loadAll();
      Alert.alert("Reservation Created", `Ref: ${created.booking_ref} • Room #${created.room_number}`);
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    }
  };

  const submitCheckIn = async () => {
    if (!checkInTarget) return;
    if (!kycNumber.trim()) {
      Alert.alert("KYC Required", "Please enter the guest's Government ID number.");
      return;
    }
    try {
      await apiFetch(`/api/admin/bookings/${checkInTarget.id}/check-in`, {
        method: "POST",
        body: JSON.stringify({
          id_type: kycType,
          id_number: kycNumber.trim(),
          document_url: kycDocUrl.trim(),
          address: kycAddress.trim(),
          deposit_collected: Number(kycDeposit) || 0,
        }),
      });
      setCheckInTarget(null);
      loadAll();
      Alert.alert("Guest Checked In", `Room #${checkInTarget.room_number} is now marked OCCUPIED.`);
    } catch (e: any) {
      Alert.alert("Check-in Failed", e.message);
    }
  };

  const submitRoomChange = async () => {
    if (!roomChangeTarget || !newRoomId) return;
    try {
      const updated = await apiFetch(`/api/admin/bookings/${roomChangeTarget.id}/room-change`, {
        method: "POST",
        body: JSON.stringify({ new_room_id: newRoomId, reason: roomChangeReason }),
      });
      setRoomChangeTarget(null);
      loadAll();
      Alert.alert("Room Changed", `Moved guest to Room #${updated.room_number}.`);
    } catch (e: any) {
      Alert.alert("Room Change Failed", e.message);
    }
  };

  const submitExtendStay = async () => {
    if (!extendTarget || !newCheckOutDate.trim()) return;
    try {
      const updated = await apiFetch(`/api/admin/bookings/${extendTarget.id}/extend-stay`, {
        method: "POST",
        body: JSON.stringify({ new_check_out: newCheckOutDate.trim(), extra_discount: 0 }),
      });
      setExtendTarget(null);
      loadAll();
      Alert.alert(
        "Stay Extended",
        `New check-out: ${updated.check_out} (${updated.pricing.nights} nights, Total ₹${updated.pricing.grand_total})`
      );
    } catch (e: any) {
      Alert.alert("Extension Failed", e.message);
    }
  };

  const submitCheckout = async () => {
    if (!checkoutTarget) return;
    try {
      await apiFetch(`/api/admin/bookings/${checkoutTarget.id}/check-out`, {
        method: "POST",
        body: JSON.stringify({
          collect_balance: true,
          payment_method: "UPI",
          extra_charges: Number(extraCharges) || 0,
          extra_charges_note: extraNote,
        }),
      });
      const rNum = checkoutTarget.room_number;
      setCheckoutTarget(null);
      loadAll();
      Alert.alert(
        "Checkout Complete!",
        `Guest checked out and bill settled. Room #${rNum} is now marked DIRTY for Housekeeping.`
      );
    } catch (e: any) {
      Alert.alert("Checkout Failed", e.message);
    }
  };

  const availableRooms = rooms.filter((r) => r.status === "AVAILABLE");

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.sub}>RESERVATIONS, KYC & FRONT DESK</Text>
          <Text style={styles.title}>Booking Management</Text>
        </View>
        <Pressable style={styles.newBtn} onPress={() => setWalkInOpen(true)}>
          <Ionicons name="add" size={18} color="#090D16" />
          <Text style={styles.newBtnText}>Walk-in / Advance</Text>
        </Pressable>
      </View>

      {/* Filter Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && { color: "#090D16" }]}>{f}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor="#10B981" />}
      >
        {loading ? (
          <ActivityIndicator color="#10B981" size="large" style={{ marginTop: 40 }} />
        ) : (
          bookings.map((b) => (
            <View key={b.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ref}>
                    {b.booking_ref} • {b.booking_source || "CUSTOMER_APP"}
                  </Text>
                  <Text style={styles.guestName}>{b.guest?.name}</Text>
                  <Text style={styles.guestMeta}>
                    {b.guest?.phone} • {b.category_name} (Room #{b.room_number})
                  </Text>
                </View>
                <View style={styles.statusCol}>
                  <Text style={styles.statusTag}>{b.status}</Text>
                  <Text style={styles.payTag}>{b.payment_status}</Text>
                </View>
              </View>

              <View style={styles.stayBar}>
                <Text style={styles.stayText}>
                  Stay: {b.check_in} → {b.check_out} ({b.pricing?.nights}N) • {b.guests} Guests
                </Text>
                <Text style={styles.stayAmount}>
                  Total: ₹{b.pricing?.grand_total?.toLocaleString()} (Due: ₹{(b.balance_due || 0).toLocaleString()})
                </Text>
              </View>

              {b.kyc?.id_number ? (
                <Text style={styles.kycLine}>
                  KYC Verified: {b.kyc.id_type} — {b.kyc.id_number}
                </Text>
              ) : null}

              {/* Action Buttons by Status */}
              <View style={styles.actionsWrap}>
                {b.status === "PENDING" && (
                  <>
                    <Pressable style={styles.btnConfirm} onPress={() => handleConfirm(b)}>
                      <Ionicons name="checkmark-circle" size={15} color="#090D16" />
                      <Text style={styles.btnDarkText}>Confirm Booking</Text>
                    </Pressable>
                    <Pressable style={styles.btnDanger} onPress={() => handleReject(b)}>
                      <Text style={styles.btnDangerText}>Reject</Text>
                    </Pressable>
                  </>
                )}

                {["PENDING", "CONFIRMED"].includes(b.status) && (
                  <Pressable
                    style={styles.btnPrimary}
                    onPress={() => {
                      setCheckInTarget(b);
                      setKycType(b.kyc?.id_type || "Aadhaar Card");
                      setKycNumber(b.kyc?.id_number || "8492-3310-9921");
                      setKycAddress(b.guest?.address || "Jaipur, Rajasthan");
                      setKycDeposit("0");
                    }}
                  >
                    <Ionicons name="id-card" size={15} color="#090D16" />
                    <Text style={styles.btnDarkText}>Check-In + KYC</Text>
                  </Pressable>
                )}

                {["CONFIRMED", "CHECKED_IN"].includes(b.status) && (
                  <>
                    <Pressable
                      style={styles.btnOutline}
                      onPress={() => {
                        setRoomChangeTarget(b);
                        setNewRoomId(availableRooms[0]?.id || "");
                      }}
                    >
                      <Text style={styles.btnOutlineText}>Room Change</Text>
                    </Pressable>
                    <Pressable
                      style={styles.btnOutline}
                      onPress={() => {
                        setExtendTarget(b);
                        setNewCheckOutDate(dayjs(b.check_out).add(1, "day").format("YYYY-MM-DD"));
                      }}
                    >
                      <Text style={styles.btnOutlineText}>Extend Stay</Text>
                    </Pressable>
                  </>
                )}

                {b.status === "CHECKED_IN" && (
                  <Pressable
                    style={styles.btnCheckout}
                    onPress={() => {
                      setCheckoutTarget(b);
                      setExtraCharges("0");
                    }}
                  >
                    <Ionicons name="exit-outline" size={15} color="#090D16" />
                    <Text style={styles.btnDarkText}>Checkout Guest</Text>
                  </Pressable>
                )}

                <Pressable
                  style={styles.btnOutline}
                  onPress={() => Linking.openURL(`${API_URL}/api/bookings/${b.id}/invoice`)}
                >
                  <Text style={styles.btnOutlineText}>GST Invoice</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* 1. Walk-in / Advance Booking Modal */}
      <Modal visible={walkInOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Walk-In / Advance Reservation</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              <View style={styles.row}>
                {(["WALK_IN", "ADVANCE"] as const).map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.modeBtn, wType === t && styles.modeBtnActive]}
                    onPress={() => {
                      setWType(t);
                      setWAutoCheckIn(t === "WALK_IN");
                    }}
                  >
                    <Text style={[styles.modeBtnText, wType === t && { color: "#090D16" }]}>{t}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Guest Full Name</Text>
              <TextInput value={wName} onChangeText={setWName} style={styles.input} placeholder="Rajeshwari Devi" placeholderTextColor="#64748B" />

              <Text style={styles.label}>Guest Phone</Text>
              <TextInput value={wPhone} onChangeText={setWPhone} style={styles.input} placeholder="+91 98765 11223" placeholderTextColor="#64748B" />

              <Text style={styles.label}>Room Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
                {categories.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[styles.catChip, wCategoryId === c.id && styles.catChipActive]}
                    onPress={() => setWCategoryId(c.id)}
                  >
                    <Text style={[styles.catChipText, wCategoryId === c.id && { color: "#090D16" }]}>
                      {c.name} (₹{c.base_price})
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Check-in</Text>
                  <TextInput value={wCheckIn} onChangeText={setWCheckIn} style={styles.input} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Check-out</Text>
                  <TextInput value={wCheckOut} onChangeText={setWCheckOut} style={styles.input} />
                </View>
              </View>

              <Text style={styles.label}>Advance Collected (₹)</Text>
              <TextInput value={wAdvancePaid} onChangeText={setWAdvancePaid} keyboardType="numeric" style={styles.input} />

              <Text style={styles.label}>Gov ID Number (KYC)</Text>
              <TextInput value={wIdNumber} onChangeText={setWIdNumber} style={styles.input} placeholder="Aadhaar / Passport Number" placeholderTextColor="#64748B" />
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelModalBtn} onPress={() => setWalkInOpen(false)}>
                <Text style={styles.cancelModalText}>Close</Text>
              </Pressable>
              <Pressable style={styles.saveModalBtn} onPress={submitWalkIn}>
                <Text style={styles.saveModalText}>Create Booking</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2. Check-in + Guest KYC Modal */}
      <Modal visible={!!checkInTarget} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Guest Check-in & KYC — Room #{checkInTarget?.room_number}
            </Text>
            <Text style={styles.label}>ID Document Type</Text>
            <TextInput value={kycType} onChangeText={setKycType} style={styles.input} />
            <Text style={styles.label}>ID Document Number</Text>
            <TextInput value={kycNumber} onChangeText={setKycNumber} style={styles.input} />
            <Text style={styles.label}>KYC Document Scan / File URL</Text>
            <TextInput value={kycDocUrl} onChangeText={setKycDocUrl} style={styles.input} />
            <Text style={styles.label}>Guest Address</Text>
            <TextInput value={kycAddress} onChangeText={setKycAddress} style={styles.input} />
            <Text style={styles.label}>Collect Payment at Check-in (₹)</Text>
            <TextInput value={kycDeposit} onChangeText={setKycDeposit} keyboardType="numeric" style={styles.input} />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelModalBtn} onPress={() => setCheckInTarget(null)}>
                <Text style={styles.cancelModalText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveModalBtn} onPress={submitCheckIn}>
                <Text style={styles.saveModalText}>Verify KYC & Check-In</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 3. Room Change Modal */}
      <Modal visible={!!roomChangeTarget} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Move Guest from Room #{roomChangeTarget?.room_number}
            </Text>
            <Text style={styles.label}>Select Target Available Room</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
              {availableRooms.map((r) => (
                <Pressable
                  key={r.id}
                  style={[styles.catChip, newRoomId === r.id && styles.catChipActive]}
                  onPress={() => setNewRoomId(r.id)}
                >
                  <Text style={[styles.catChipText, newRoomId === r.id && { color: "#090D16" }]}>
                    #{r.room_number} ({r.category_name})
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>Reason for Room Change</Text>
            <TextInput value={roomChangeReason} onChangeText={setRoomChangeReason} style={styles.input} />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelModalBtn} onPress={() => setRoomChangeTarget(null)}>
                <Text style={styles.cancelModalText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveModalBtn} onPress={submitRoomChange}>
                <Text style={styles.saveModalText}>Confirm Room Move</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 4. Stay Extension Modal */}
      <Modal visible={!!extendTarget} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Extend Stay — {extendTarget?.booking_ref}</Text>
            <Text style={styles.label}>Current Check-out: {extendTarget?.check_out}</Text>
            <Text style={styles.label}>New Check-out Date (YYYY-MM-DD)</Text>
            <TextInput value={newCheckOutDate} onChangeText={setNewCheckOutDate} style={styles.input} />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelModalBtn} onPress={() => setExtendTarget(null)}>
                <Text style={styles.cancelModalText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveModalBtn} onPress={submitExtendStay}>
                <Text style={styles.saveModalText}>Update Stay & Tariff</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 5. Guest Checkout Modal */}
      <Modal visible={!!checkoutTarget} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Guest Checkout — Room #{checkoutTarget?.room_number}
            </Text>
            <Text style={styles.label}>
              Balance Due: ₹{(checkoutTarget?.balance_due || 0).toLocaleString()}
            </Text>
            <Text style={styles.label}>Add Extra Charges (F&B / Mini-bar ₹)</Text>
            <TextInput value={extraCharges} onChangeText={setExtraCharges} keyboardType="numeric" style={styles.input} />
            <Text style={styles.label}>Notes</Text>
            <TextInput value={extraNote} onChangeText={setExtraNote} style={styles.input} />

            <View style={styles.modalActions}>
              <Pressable style={styles.cancelModalBtn} onPress={() => setCheckoutTarget(null)}>
                <Text style={styles.cancelModalText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveModalBtn} onPress={submitCheckout}>
                <Text style={styles.saveModalText}>Settle & Complete Checkout</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090D16" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sub: { color: "#10B981", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  title: { color: "#F8FAFC", fontSize: 22, fontWeight: "800" },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  newBtnText: { color: "#090D16", fontSize: 12, fontWeight: "800" },
  filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 10, maxHeight: 44 },
  filterChip: {
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  filterChipActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  filterText: { color: "#94A3B8", fontSize: 11, fontWeight: "800" },
  scroll: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 12,
    gap: 10,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between" },
  ref: { color: "#10B981", fontSize: 11, fontWeight: "800" },
  guestName: { color: "#F8FAFC", fontSize: 16, fontWeight: "800", marginTop: 2 },
  guestMeta: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  statusCol: { alignItems: "flex-end", gap: 4 },
  statusTag: {
    backgroundColor: "#1F2937",
    color: "#F8FAFC",
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  payTag: { color: "#10B981", fontSize: 11, fontWeight: "800" },
  stayBar: {
    backgroundColor: "#090D16",
    padding: 10,
    borderRadius: 8,
    gap: 3,
  },
  stayText: { color: "#CBD5E1", fontSize: 12 },
  stayAmount: { color: "#F8FAFC", fontSize: 13, fontWeight: "800" },
  kycLine: { color: "#10B981", fontSize: 11, fontWeight: "600" },
  actionsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  btnConfirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#10B981",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#38BDF8",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnCheckout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F59E0B",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnDarkText: { color: "#090D16", fontSize: 12, fontWeight: "800" },
  btnOutline: {
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnOutlineText: { color: "#CBD5E1", fontSize: 12, fontWeight: "700" },
  btnDanger: {
    borderWidth: 1,
    borderColor: "#EF4444",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnDangerText: { color: "#EF4444", fontSize: 12, fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#374151",
    gap: 8,
  },
  modalTitle: { color: "#F8FAFC", fontSize: 17, fontWeight: "800", marginBottom: 6 },
  label: { color: "#CBD5E1", fontSize: 12, fontWeight: "600", marginTop: 4 },
  input: {
    backgroundColor: "#090D16",
    borderWidth: 1,
    borderColor: "#374151",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: "#F8FAFC",
    fontSize: 14,
  },
  row: { flexDirection: "row", gap: 8 },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#374151",
    alignItems: "center",
  },
  modeBtnActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  modeBtnText: { color: "#CBD5E1", fontSize: 12, fontWeight: "800" },
  catChip: {
    backgroundColor: "#090D16",
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginRight: 8,
  },
  catChipActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  catChipText: { color: "#CBD5E1", fontSize: 12, fontWeight: "700" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 12 },
  cancelModalBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  cancelModalText: { color: "#94A3B8", fontWeight: "700" },
  saveModalBtn: {
    backgroundColor: "#10B981",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveModalText: { color: "#090D16", fontWeight: "800" },
});
