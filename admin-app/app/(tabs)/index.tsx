import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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

import { apiFetch } from "@/src/api/client";
import { useAuth } from "@/src/context/auth";

const ROOM_COLOR: Record<string, string> = {
  AVAILABLE: "#10B981",
  OCCUPIED: "#3B82F6",
  DIRTY: "#EF4444",
  CLEANING: "#F59E0B",
  BLOCKED: "#64748B",
};

export default function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { admin, signOut } = useAuth();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/admin/dashboard");
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

  const k = data?.kpis || {};
  const rooms = data?.rooms_overview || [];
  const recentBookings = data?.recent_bookings || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#10B981" />}
      >
        <View style={styles.topRow}>
          <View>
            <Text style={styles.roleTag}>{(admin?.role || "ADMIN").toUpperCase()} • LIVE PMS</Text>
            <Text style={styles.title}>{admin?.name || "Hotel Administrator"}</Text>
          </View>
          <Pressable style={styles.logoutBtn} onPress={signOut}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          </Pressable>
        </View>

        {loading && !data ? (
          <ActivityIndicator color="#10B981" size="large" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* KPI Grid */}
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Occupancy</Text>
                <Text style={styles.kpiVal}>{k.occupancy_rate ?? 0}%</Text>
                <Text style={styles.kpiSub}>
                  {k.occupied_rooms ?? 0}/{k.total_rooms ?? 0} Occupied
                </Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Available</Text>
                <Text style={[styles.kpiVal, { color: "#10B981" }]}>{k.available_rooms ?? 0}</Text>
                <Text style={styles.kpiSub}>{k.dirty_rooms ?? 0} Dirty / Cleaning</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Pending Approval</Text>
                <Text style={[styles.kpiVal, { color: "#F59E0B" }]}>{k.pending_bookings ?? 0}</Text>
                <Text style={styles.kpiSub}>{k.in_house_guests ?? 0} In-House Guests</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiLabel}>Total Revenue</Text>
                <Text style={[styles.kpiVal, { color: "#10B981" }]}>
                  ₹{((k.total_revenue || 0) / 1000).toFixed(1)}k
                </Text>
                <Text style={styles.kpiSub}>Net ₹{(k.net_profit || 0).toLocaleString()}</Text>
              </View>
            </View>

            {/* Quick Room Status Matrix */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Live Room Status Rack</Text>
              <Pressable onPress={() => router.push("/(tabs)/rooms")}>
                <Text style={styles.link}>Manage Rooms →</Text>
              </Pressable>
            </View>

            <View style={styles.roomRack}>
              {rooms.map((r: any) => (
                <Pressable
                  key={r.id}
                  style={[styles.roomTile, { borderColor: ROOM_COLOR[r.status] || "#374151" }]}
                  onPress={() => router.push("/(tabs)/housekeeping")}
                >
                  <Text style={styles.roomNum}>#{r.room_number}</Text>
                  <View style={[styles.roomDot, { backgroundColor: ROOM_COLOR[r.status] || "#64748B" }]} />
                  <Text style={[styles.roomState, { color: ROOM_COLOR[r.status] || "#94A3B8" }]}>{r.status}</Text>
                </Pressable>
              ))}
            </View>

            {/* Recent Incoming Bookings */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Latest Reservations</Text>
              <Pressable onPress={() => router.push("/(tabs)/bookings")}>
                <Text style={styles.link}>All Bookings →</Text>
              </Pressable>
            </View>

            {recentBookings.slice(0, 6).map((b: any) => (
              <Pressable
                key={b.id}
                style={styles.bookingRow}
                onPress={() => router.push("/(tabs)/bookings")}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.bRef}>
                    {b.booking_ref} • Room #{b.room_number}
                  </Text>
                  <Text style={styles.bGuest}>
                    {b.guest?.name} ({b.check_in} → {b.check_out})
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.bTotal}>₹{b.pricing?.grand_total?.toLocaleString()}</Text>
                  <Text style={[styles.bStatus, { color: b.status === "PENDING" ? "#F59E0B" : "#10B981" }]}>
                    {b.status} • {b.payment_status}
                  </Text>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090D16" },
  scroll: { padding: 16, paddingBottom: 40 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  roleTag: { color: "#10B981", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  title: { color: "#F8FAFC", fontSize: 22, fontWeight: "800" },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1F2937",
    alignItems: "center",
    justifyContent: "center",
  },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  kpiCard: {
    width: "48%",
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  kpiLabel: { color: "#94A3B8", fontSize: 12, fontWeight: "600" },
  kpiVal: { color: "#F8FAFC", fontSize: 24, fontWeight: "800", marginVertical: 4 },
  kpiSub: { color: "#64748B", fontSize: 11, fontWeight: "600" },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 6,
  },
  sectionTitle: { color: "#F8FAFC", fontSize: 16, fontWeight: "800" },
  link: { color: "#10B981", fontSize: 12, fontWeight: "700" },
  roomRack: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  roomTile: {
    width: "23%",
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 4,
  },
  roomNum: { color: "#F8FAFC", fontSize: 13, fontWeight: "800" },
  roomDot: { width: 8, height: 8, borderRadius: 4 },
  roomState: { fontSize: 9, fontWeight: "800" },
  bookingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 8,
  },
  bRef: { color: "#10B981", fontSize: 12, fontWeight: "800" },
  bGuest: { color: "#F8FAFC", fontSize: 14, fontWeight: "700", marginTop: 2 },
  bTotal: { color: "#F8FAFC", fontSize: 15, fontWeight: "800" },
  bStatus: { fontSize: 11, fontWeight: "700", marginTop: 2 },
});
