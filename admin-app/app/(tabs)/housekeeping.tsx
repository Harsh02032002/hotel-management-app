import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { apiFetch } from "@/src/api/client";

export default function AdminHousekeepingScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/housekeeping");
      setData(res);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const updateRoomHousekeeping = async (room: any, status: "DIRTY" | "CLEANING" | "AVAILABLE") => {
    try {
      await apiFetch(`/api/admin/housekeeping/${room.id}/status`, {
        method: "POST",
        body: JSON.stringify({
          status,
          assigned_to: "Rameshwar Meena",
          notes:
            status === "AVAILABLE"
              ? "Cleaned, sanitized & inspected — Ready for booking"
              : `Marked ${status} by Housekeeping`,
        }),
      });
      load();
      if (status === "AVAILABLE") {
        Alert.alert(
          "Room Clean & Available!",
          `Room #${room.room_number} is now CLEAN & AVAILABLE for customer bookings.`
        );
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const s = data?.summary || {};
  const rooms = data?.rooms || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.sub}>ROOM TURNOVER & SANITIZATION</Text>
        <Text style={styles.title}>Housekeeping Desk</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#10B981" />}
      >
        {/* Summary Bar */}
        <View style={styles.summaryRow}>
          <View style={[styles.sumCard, { borderColor: "#EF4444" }]}>
            <Text style={[styles.sumVal, { color: "#EF4444" }]}>{s.dirty ?? 0}</Text>
            <Text style={styles.sumLabel}>Dirty Rooms</Text>
          </View>
          <View style={[styles.sumCard, { borderColor: "#F59E0B" }]}>
            <Text style={[styles.sumVal, { color: "#F59E0B" }]}>{s.cleaning ?? 0}</Text>
            <Text style={styles.sumLabel}>Cleaning</Text>
          </View>
          <View style={[styles.sumCard, { borderColor: "#10B981" }]}>
            <Text style={[styles.sumVal, { color: "#10B981" }]}>{s.clean_available ?? 0}</Text>
            <Text style={styles.sumLabel}>Clean & Ready</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color="#10B981" size="large" style={{ marginTop: 40 }} />
        ) : (
          rooms.map((r: any) => (
            <View
              key={r.id}
              style={[
                styles.card,
                r.status === "DIRTY" && { borderColor: "#EF4444" },
                r.status === "CLEANING" && { borderColor: "#F59E0B" },
              ]}
            >
              <View style={styles.topRow}>
                <View>
                  <Text style={styles.roomTitle}>
                    Room #{r.room_number} • {r.category_name}
                  </Text>
                  <Text style={styles.meta}>
                    Staff: {r.assigned_housekeeper || "Rameshwar Meena"} • {r.notes || "Standard turnover"}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.badge,
                    r.status === "AVAILABLE"
                      ? { color: "#10B981" }
                      : r.status === "DIRTY"
                        ? { color: "#EF4444" }
                        : { color: "#F59E0B" },
                  ]}
                >
                  {r.status}
                </Text>
              </View>

              {r.status !== "OCCUPIED" && (
                <View style={styles.actionsRow}>
                  {r.status === "DIRTY" && (
                    <Pressable
                      style={styles.cleanProgressBtn}
                      onPress={() => updateRoomHousekeeping(r, "CLEANING")}
                    >
                      <Ionicons name="water-outline" size={15} color="#090D16" />
                      <Text style={styles.btnDarkText}>Start Cleaning</Text>
                    </Pressable>
                  )}

                  {(r.status === "DIRTY" || r.status === "CLEANING") && (
                    <Pressable
                      style={styles.readyBtn}
                      onPress={() => updateRoomHousekeeping(r, "AVAILABLE")}
                    >
                      <Ionicons name="checkmark-done-circle" size={16} color="#090D16" />
                      <Text style={styles.btnDarkText}>Mark Clean & Available</Text>
                    </Pressable>
                  )}

                  {r.status === "AVAILABLE" && (
                    <Pressable
                      style={styles.dirtyBtn}
                      onPress={() => updateRoomHousekeeping(r, "DIRTY")}
                    >
                      <Text style={styles.dirtyBtnText}>Flag Needs Cleaning (Dirty)</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090D16" },
  header: { paddingHorizontal: 16, paddingBottom: 10 },
  sub: { color: "#10B981", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  title: { color: "#F8FAFC", fontSize: 22, fontWeight: "800" },
  scroll: { padding: 16, paddingBottom: 40 },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  sumCard: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
    alignItems: "center",
  },
  sumVal: { fontSize: 22, fontWeight: "800" },
  sumLabel: { color: "#94A3B8", fontSize: 11, fontWeight: "700", marginTop: 2 },
  card: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 10,
    gap: 10,
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  roomTitle: { color: "#F8FAFC", fontSize: 15, fontWeight: "800" },
  meta: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  badge: { fontSize: 12, fontWeight: "800" },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cleanProgressBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F59E0B",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  readyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnDarkText: { color: "#090D16", fontSize: 12, fontWeight: "800" },
  dirtyBtn: {
    borderWidth: 1,
    borderColor: "#374151",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 8,
  },
  dirtyBtnText: { color: "#94A3B8", fontSize: 11, fontWeight: "700" },
});
