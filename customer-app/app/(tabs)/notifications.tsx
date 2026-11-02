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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";

import { apiFetch } from "@/src/api/client";

export default function CustomerNotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{ notifications: any[] }>("/api/notifications");
      setItems(res.notifications || []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  const markAllRead = async () => {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      load();
    } catch {}
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.sub}>REAL-TIME HOTEL UPDATES</Text>
          <Text style={styles.title}>Notifications</Text>
        </View>
        <Pressable style={styles.markBtn} onPress={markAllRead}>
          <Text style={styles.markText}>Mark all read</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#D4AF37" />}
      >
        {loading ? (
          <ActivityIndicator color="#D4AF37" size="large" style={{ marginTop: 40 }} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={44} color="#475569" />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        ) : (
          items.map((n) => (
            <View key={n.id} style={[styles.card, !n.read && styles.cardUnread]}>
              <View style={styles.iconBox}>
                <Ionicons name="notifications" size={18} color="#D4AF37" />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.cardTitle}>{n.title}</Text>
                <Text style={styles.cardMsg}>{n.message}</Text>
                <Text style={styles.cardTime}>{n.created_at?.slice(0, 16).replace("T", " ")}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  sub: { color: "#D4AF37", fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  title: { color: "#F8FAFC", fontSize: 24, fontWeight: "800" },
  markBtn: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  markText: { color: "#D4AF37", fontSize: 12, fontWeight: "700" },
  scroll: { padding: 16, paddingBottom: 40 },
  empty: { alignItems: "center", marginTop: 64, gap: 8 },
  emptyText: { color: "#94A3B8", fontSize: 14 },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#1E293B",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 10,
  },
  cardUnread: { borderColor: "#D4AF37" },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: "#F8FAFC", fontSize: 15, fontWeight: "800" },
  cardMsg: { color: "#CBD5E1", fontSize: 13, lineHeight: 18 },
  cardTime: { color: "#64748B", fontSize: 11, marginTop: 2 },
});
