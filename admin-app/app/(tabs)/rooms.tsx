import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

import { apiFetch } from "@/src/api/client";

export default function AdminRoomsPricingCalendarScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"rooms" | "pricing" | "calendar">("rooms");
  const [rooms, setRooms] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [calendar, setCalendar] = useState<{ dates: string[]; calendar: any[] }>({ dates: [], calendar: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Room Modal
  const [addOpen, setAddOpen] = useState(false);
  const [rNumber, setRNumber] = useState("");
  const [rFloor, setRFloor] = useState("1");
  const [rCategoryId, setRCategoryId] = useState("");
  const [rNotes, setRNotes] = useState("Ready for guest arrival");

  // Edit Price Modal
  const [priceTarget, setPriceTarget] = useState<any>(null);
  const [newBasePrice, setNewBasePrice] = useState("");
  const [newWeekendPrice, setNewWeekendPrice] = useState("");

  const load = useCallback(async () => {
    try {
      const [rRes, cRes, calRes] = await Promise.all([
        apiFetch<{ rooms: any[] }>("/api/admin/rooms"),
        apiFetch<{ categories: any[] }>("/api/admin/categories"),
        apiFetch<{ dates: string[]; calendar: any[] }>("/api/admin/calendar?days=7"),
      ]);
      setRooms(rRes.rooms || []);
      setCategories(cRes.categories || []);
      setCalendar(calRes);
      if (!rCategoryId && cRes.categories?.length) {
        setRCategoryId(cRes.categories[0].id);
      }
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rCategoryId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRoomStatus = async (room: any, status: string) => {
    try {
      await apiFetch(`/api/admin/rooms/${room.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleRemoveRoom = (room: any) => {
    Alert.alert("Remove Room", `Delete Room #${room.room_number} permanently?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/api/admin/rooms/${room.id}`, { method: "DELETE" });
            load();
          } catch (e: any) {
            Alert.alert("Cannot Remove", e.message);
          }
        },
      },
    ]);
  };

  const submitAddRoom = async () => {
    if (!rNumber.trim() || !rCategoryId) {
      Alert.alert("Missing Fields", "Enter room number and choose category.");
      return;
    }
    try {
      await apiFetch("/api/admin/rooms", {
        method: "POST",
        body: JSON.stringify({
          room_number: rNumber.trim(),
          floor: Number(rFloor) || 1,
          category_id: rCategoryId,
          status: "AVAILABLE",
          notes: rNotes,
        }),
      });
      setAddOpen(false);
      setRNumber("");
      load();
      Alert.alert("Room Added", `Room #${rNumber.trim()} added to inventory.`);
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    }
  };

  const submitCategoryPrice = async () => {
    if (!priceTarget || !newBasePrice) return;
    try {
      await apiFetch(`/api/admin/categories/${priceTarget.id}/pricing`, {
        method: "PATCH",
        body: JSON.stringify({
          base_price: Number(newBasePrice),
          weekend_price: Number(newWeekendPrice) || Math.round(Number(newBasePrice) * 1.15),
        }),
      });
      setPriceTarget(null);
      load();
      Alert.alert("Tariff Updated", `${priceTarget.name} base price updated to ₹${newBasePrice}/night.`);
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.sub}>INVENTORY, TARIFFS & CALENDAR</Text>
          <Text style={styles.title}>Rooms & Pricing</Text>
        </View>
        <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
          <Ionicons name="add" size={18} color="#090D16" />
          <Text style={styles.addBtnText}>Add Room</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(["rooms", "pricing", "calendar"] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && { color: "#090D16" }]}>
              {t === "rooms" ? "Room Inventory" : t === "pricing" ? "Categories & Pricing" : "7-Day Calendar"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#10B981" />}
      >
        {loading ? (
          <ActivityIndicator color="#10B981" size="large" style={{ marginTop: 40 }} />
        ) : tab === "rooms" ? (
          rooms.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.roomTitle}>
                    Room #{r.room_number} • Floor {r.floor}
                  </Text>
                  <Text style={styles.roomSub}>
                    {r.category_name} • ₹{(r.effective_price || 4500).toLocaleString()}/night
                  </Text>
                </View>
                <Text style={styles.statusBadge}>{r.status}</Text>
              </View>

              <View style={styles.actionsRow}>
                <Pressable
                  style={[styles.chipBtn, r.status === "AVAILABLE" && styles.chipActive]}
                  onPress={() => handleRoomStatus(r, "AVAILABLE")}
                >
                  <Text style={[styles.chipText, r.status === "AVAILABLE" && { color: "#090D16" }]}>
                    Available
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.chipBtn, r.status === "BLOCKED" && styles.chipBlocked]}
                  onPress={() => handleRoomStatus(r, r.status === "BLOCKED" ? "AVAILABLE" : "BLOCKED")}
                >
                  <Text style={styles.chipText}>
                    {r.status === "BLOCKED" ? "Unblock Room" : "Block Room"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.chipBtn}
                  onPress={() => handleRoomStatus(r, "DIRTY")}
                >
                  <Text style={styles.chipText}>Mark Dirty</Text>
                </Pressable>
                <Pressable style={styles.delBtn} onPress={() => handleRemoveRoom(r)}>
                  <Ionicons name="trash-outline" size={15} color="#EF4444" />
                </Pressable>
              </View>
            </View>
          ))
        ) : tab === "pricing" ? (
          categories.map((c) => (
            <View key={c.id} style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.roomTitle}>{c.name}</Text>
                  <Text style={styles.roomSub}>
                    {c.available_rooms}/{c.total_rooms} Available • Max {c.max_guests} Guests • {c.size_sqft} sq.ft
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.priceVal}>₹{c.base_price.toLocaleString()}</Text>
                  <Text style={styles.roomSub}>Weekend: ₹{(c.weekend_price || c.base_price).toLocaleString()}</Text>
                </View>
              </View>
              <Pressable
                style={styles.editPriceBtn}
                onPress={() => {
                  setPriceTarget(c);
                  setNewBasePrice(String(c.base_price));
                  setNewWeekendPrice(String(c.weekend_price || c.base_price));
                }}
              >
                <Ionicons name="pricetag-outline" size={15} color="#10B981" />
                <Text style={styles.editPriceText}>Change Room Category Price</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <View style={styles.card}>
            <Text style={styles.roomTitle}>7-Day Room Availability Matrix</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.calHeaderRow}>
                  <Text style={[styles.calCell, { width: 80, fontWeight: "800" }]}>Room</Text>
                  {calendar.dates.map((d) => (
                    <Text key={d} style={styles.calHeaderCell}>
                      {d.slice(5)}
                    </Text>
                  ))}
                </View>
                {calendar.calendar.map((row) => (
                  <View key={row.room_id} style={styles.calRow}>
                    <Text style={[styles.calCell, { width: 80, fontWeight: "800" }]}>#{row.room_number}</Text>
                    {row.days.map((cell: any) => (
                      <View
                        key={cell.date}
                        style={[
                          styles.calStateBox,
                          cell.state === "AVAILABLE"
                            ? { backgroundColor: "rgba(16,185,129,0.18)" }
                            : cell.state === "BLOCKED"
                              ? { backgroundColor: "rgba(100,116,139,0.3)" }
                              : { backgroundColor: "rgba(245,158,11,0.28)" },
                        ]}
                      >
                        <Text style={styles.calStateText}>{cell.state.slice(0, 4)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Add Room Modal */}
      <Modal visible={addOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add New Hotel Room</Text>
            <Text style={styles.label}>Room Number</Text>
            <TextInput value={rNumber} onChangeText={setRNumber} style={styles.input} placeholder="106" placeholderTextColor="#64748B" />
            <Text style={styles.label}>Floor</Text>
            <TextInput value={rFloor} onChangeText={setRFloor} keyboardType="numeric" style={styles.input} />
            <Text style={styles.label}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
              {categories.map((c) => (
                <Pressable
                  key={c.id}
                  style={[styles.chipBtn, rCategoryId === c.id && styles.chipActive, { marginRight: 8 }]}
                  onPress={() => setRCategoryId(c.id)}
                >
                  <Text style={[styles.chipText, rCategoryId === c.id && { color: "#090D16" }]}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.label}>Notes</Text>
            <TextInput value={rNotes} onChangeText={setRNotes} style={styles.input} />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setAddOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={submitAddRoom}>
                <Text style={styles.saveText}>Add Room</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Category Price Modal */}
      <Modal visible={!!priceTarget} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update Price — {priceTarget?.name}</Text>
            <Text style={styles.label}>Standard Nightly Tariff (₹)</Text>
            <TextInput value={newBasePrice} onChangeText={setNewBasePrice} keyboardType="numeric" style={styles.input} />
            <Text style={styles.label}>Weekend Nightly Tariff (₹)</Text>
            <TextInput value={newWeekendPrice} onChangeText={setNewWeekendPrice} keyboardType="numeric" style={styles.input} />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setPriceTarget(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={submitCategoryPrice}>
                <Text style={styles.saveText}>Save Pricing</Text>
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
    paddingBottom: 10,
  },
  sub: { color: "#10B981", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  title: { color: "#F8FAFC", fontSize: 22, fontWeight: "800" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  addBtnText: { color: "#090D16", fontSize: 12, fontWeight: "800" },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#111827",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tab: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 9 },
  tabActive: { backgroundColor: "#10B981" },
  tabText: { color: "#94A3B8", fontSize: 12, fontWeight: "800" },
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
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  roomTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "800" },
  roomSub: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  statusBadge: {
    backgroundColor: "#1F2937",
    color: "#10B981",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priceVal: { color: "#10B981", fontSize: 18, fontWeight: "800" },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chipBtn: {
    backgroundColor: "#090D16",
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },
  chipActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  chipBlocked: { borderColor: "#F59E0B" },
  chipText: { color: "#CBD5E1", fontSize: 12, fontWeight: "700" },
  delBtn: {
    marginLeft: "auto",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#EF4444",
  },
  editPriceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#090D16",
    borderWidth: 1,
    borderColor: "#10B981",
    paddingVertical: 10,
    borderRadius: 10,
  },
  editPriceText: { color: "#10B981", fontSize: 13, fontWeight: "800" },
  calHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#374151", paddingBottom: 6 },
  calHeaderCell: { width: 58, color: "#94A3B8", fontSize: 11, fontWeight: "700", textAlign: "center" },
  calRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#1F2937" },
  calCell: { color: "#F8FAFC", fontSize: 12 },
  calStateBox: { width: 54, marginHorizontal: 2, paddingVertical: 6, borderRadius: 6, alignItems: "center" },
  calStateText: { color: "#F8FAFC", fontSize: 10, fontWeight: "800" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", padding: 18 },
  modalCard: { backgroundColor: "#111827", borderRadius: 16, padding: 18, borderWidth: 1, borderColor: "#374151", gap: 8 },
  modalTitle: { color: "#F8FAFC", fontSize: 17, fontWeight: "800", marginBottom: 4 },
  label: { color: "#CBD5E1", fontSize: 12, fontWeight: "600" },
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
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 12 },
  cancelBtn: { paddingHorizontal: 14, paddingVertical: 10 },
  cancelText: { color: "#94A3B8", fontWeight: "700" },
  saveBtn: { backgroundColor: "#10B981", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  saveText: { color: "#090D16", fontWeight: "800" },
});
