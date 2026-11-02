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

import { API_URL, apiFetch } from "@/src/api/client";

const SUB_TABS = ["FINANCE", "INVOICES", "STAFF", "REPORTS", "AUDIT_LOGS"] as const;

export default function AdminOperationsAndFinanceScreen() {
  const insets = useSafeAreaInsets();
  const [subTab, setSubTab] = useState<(typeof SUB_TABS)[number]>("FINANCE");
  const [finance, setFinance] = useState<any>(null);
  const [payments, setPayments] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [reports, setReports] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Ledger Entry Modal (Income / Expense / Petty Cash / Vendor Payment)
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [lType, setLType] = useState<"INCOME" | "EXPENSE" | "PETTY_CASH" | "VENDOR_PAYMENT">("EXPENSE");
  const [lCategory, setLCategory] = useState("Operations & Supplies");
  const [lTitle, setLTitle] = useState("");
  const [lAmount, setLAmount] = useState("");
  const [lVendor, setLVendor] = useState("");

  // Add Staff Modal
  const [staffOpen, setStaffOpen] = useState(false);
  const [sName, setSName] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sPhone, setSPhone] = useState("");
  const [sRole, setSRole] = useState("frontdesk");
  const [sDept, setSDept] = useState("Front Office");
  const [sSalary, setSSalary] = useState("30000");

  const loadAll = useCallback(async () => {
    try {
      const [fRes, pRes, sRes, rRes, aRes, nRes] = await Promise.all([
        apiFetch("/api/admin/finance"),
        apiFetch("/api/admin/payments"),
        apiFetch<{ staff: any[] }>("/api/admin/staff"),
        apiFetch("/api/admin/reports"),
        apiFetch<{ audit_logs: any[] }>("/api/admin/audit-logs"),
        apiFetch<{ notifications: any[] }>("/api/admin/notifications"),
      ]);
      setFinance(fRes);
      setPayments(pRes);
      setStaffList(sRes.staff || []);
      setReports(rRes);
      setAuditLogs(aRes.audit_logs || []);
      setAlerts(nRes.notifications || []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const submitLedgerEntry = async () => {
    if (!lTitle.trim() || !lAmount) {
      Alert.alert("Missing Fields", "Enter title and amount.");
      return;
    }
    try {
      await apiFetch("/api/admin/finance/ledger", {
        method: "POST",
        body: JSON.stringify({
          entry_type: lType,
          category: lCategory,
          title: lTitle.trim(),
          amount: Number(lAmount),
          payment_mode: "UPI",
          vendor_name: lVendor.trim(),
        }),
      });
      setLedgerOpen(false);
      setLTitle("");
      setLAmount("");
      loadAll();
      Alert.alert("Entry Recorded", `${lType} entry added to hotel finance ledger.`);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const submitAddStaff = async () => {
    if (!sName.trim() || !sEmail.trim() || !sPhone.trim()) {
      Alert.alert("Missing Details", "Fill staff name, email, and phone.");
      return;
    }
    try {
      await apiFetch("/api/admin/staff", {
        method: "POST",
        body: JSON.stringify({
          name: sName.trim(),
          email: sEmail.trim(),
          phone: sPhone.trim(),
          role: sRole,
          department: sDept,
          salary: Number(sSalary) || 30000,
        }),
      });
      setStaffOpen(false);
      setSName("");
      setSEmail("");
      setSPhone("");
      loadAll();
      Alert.alert("Staff Added", `${sName} added to hotel staff roster.`);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const fs = finance?.summary || {};

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Text style={styles.sub}>FINANCE, GST, STAFF & AUDIT</Text>
        <Text style={styles.title}>Hotel Operations</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {SUB_TABS.map((t) => (
          <Pressable
            key={t}
            style={[styles.tabChip, subTab === t && styles.tabChipActive]}
            onPress={() => setSubTab(t)}
          >
            <Text style={[styles.tabText, subTab === t && { color: "#090D16" }]}>{t.replace("_", " ")}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor="#10B981" />}
      >
        {loading ? (
          <ActivityIndicator color="#10B981" size="large" style={{ marginTop: 40 }} />
        ) : subTab === "FINANCE" ? (
          <>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Income Ledger</Text>
                <Text style={[styles.kpiVal, { color: "#10B981" }]}>
                  ₹{(fs.total_income || 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Expense Register</Text>
                <Text style={[styles.kpiVal, { color: "#EF4444" }]}>
                  ₹{(fs.total_expenses || 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Petty Cash</Text>
                <Text style={[styles.kpiVal, { color: "#F59E0B" }]}>
                  ₹{(fs.total_petty_cash || 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>Vendor Payments</Text>
                <Text style={[styles.kpiVal, { color: "#38BDF8" }]}>
                  ₹{(fs.total_vendor_payments || 0).toLocaleString()}
                </Text>
              </View>
            </View>

            <Pressable style={styles.actionBtn} onPress={() => setLedgerOpen(true)}>
              <Ionicons name="add-circle" size={18} color="#090D16" />
              <Text style={styles.actionBtnText}>Record Income / Expense / Petty Cash / Vendor Payment</Text>
            </Pressable>

            {(finance?.all_entries || []).map((e: any) => (
              <View key={e.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tag}>{e.entry_type} • {e.category}</Text>
                    <Text style={styles.cardTitle}>{e.title}</Text>
                    <Text style={styles.cardMeta}>
                      {e.vendor_name ? `${e.vendor_name} • ` : ""}{e.payment_mode} • By {e.recorded_by}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.amount,
                      { color: e.entry_type === "INCOME" ? "#10B981" : "#F59E0B" },
                    ]}
                  >
                    {e.entry_type === "INCOME" ? "+" : "-"}₹{e.amount?.toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </>
        ) : subTab === "INVOICES" ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                Total Collected: ₹{(payments?.total_collected || 0).toLocaleString()} • Pending Dues: ₹
                {(payments?.pending_dues || 0).toLocaleString()}
              </Text>
            </View>
            {(payments?.invoices || []).map((inv: any) => (
              <View key={inv.booking_id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.tag}>{inv.invoice_number} • {inv.booking_ref}</Text>
                    <Text style={styles.cardTitle}>{inv.guest_name} (Room #{inv.room_number})</Text>
                    <Text style={styles.cardMeta}>
                      Taxable: ₹{inv.subtotal} • CGST: ₹{inv.cgst} • SGST: ₹{inv.sgst}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.amount}>₹{inv.grand_total?.toLocaleString()}</Text>
                    <Text style={styles.cardMeta}>{inv.payment_status}</Text>
                  </View>
                </View>
                <Pressable
                  style={styles.outlineBtn}
                  onPress={() => Linking.openURL(`${API_URL}/api/bookings/${inv.booking_id}/invoice`)}
                >
                  <Ionicons name="document-text-outline" size={14} color="#10B981" />
                  <Text style={styles.outlineBtnText}>Open Printable GST Tax Invoice</Text>
                </Pressable>
              </View>
            ))}
          </>
        ) : subTab === "STAFF" ? (
          <>
            <Pressable style={styles.actionBtn} onPress={() => setStaffOpen(true)}>
              <Ionicons name="person-add" size={16} color="#090D16" />
              <Text style={styles.actionBtnText}>Add Hotel Staff Member</Text>
            </Pressable>
            {staffList.map((s) => (
              <View key={s.id} style={styles.card}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.tag}>{s.role.toUpperCase()} • {s.department}</Text>
                    <Text style={styles.cardTitle}>{s.name}</Text>
                    <Text style={styles.cardMeta}>{s.email} • {s.phone} • {s.shift}</Text>
                  </View>
                  <Text style={styles.amount}>₹{(s.salary || 0).toLocaleString()}/mo</Text>
                </View>
              </View>
            ))}
          </>
        ) : subTab === "REPORTS" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Hotel Analytics & GST Report</Text>
            <Text style={styles.cardMeta}>Total Bookings: {reports?.total_bookings ?? 0}</Text>
            <Text style={styles.cardMeta}>Active Stays: {reports?.active_bookings ?? 0}</Text>
            <Text style={styles.cardMeta}>Completed Checkouts: {reports?.completed_checkouts ?? 0}</Text>
            <Text style={styles.cardMeta}>Total GST Billed: ₹{(reports?.total_gst_billed || 0).toLocaleString()}</Text>
            <Text style={[styles.cardTitle, { marginTop: 12 }]}>Revenue by Room Category</Text>
            {(reports?.revenue_by_category || []).map((rc: any) => (
              <View key={rc.category} style={styles.rowBetween}>
                <Text style={styles.cardMeta}>
                  {rc.category} ({rc.bookings} bookings, {rc.nights} nights)
                </Text>
                <Text style={styles.amount}>₹{rc.revenue?.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        ) : (
          <>
            <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Recent Admin Notifications</Text>
            {alerts.slice(0, 6).map((n) => (
              <View key={n.id} style={styles.card}>
                <Text style={styles.tag}>{n.title}</Text>
                <Text style={styles.cardMeta}>{n.message}</Text>
              </View>
            ))}
            <Text style={[styles.cardTitle, { marginVertical: 8 }]}>System Audit Trail</Text>
            {auditLogs.map((log) => (
              <View key={log.id} style={styles.card}>
                <Text style={styles.tag}>
                  {log.action} • {log.actor_name} ({log.actor_role})
                </Text>
                <Text style={styles.cardMeta}>
                  {log.details} • {log.created_at?.slice(0, 16).replace("T", " ")}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Add Finance Ledger Entry Modal */}
      <Modal visible={ledgerOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Finance Entry</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {(["INCOME", "EXPENSE", "PETTY_CASH", "VENDOR_PAYMENT"] as const).map((t) => (
                <Pressable
                  key={t}
                  style={[styles.tabChip, lType === t && styles.tabChipActive]}
                  onPress={() => setLType(t)}
                >
                  <Text style={[styles.tabText, lType === t && { color: "#090D16" }]}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>Category</Text>
            <TextInput value={lCategory} onChangeText={setLCategory} style={styles.input} />
            <Text style={styles.label}>Description / Title</Text>
            <TextInput value={lTitle} onChangeText={setLTitle} style={styles.input} placeholder="Vendor invoice / Expense description" placeholderTextColor="#64748B" />
            <Text style={styles.label}>Amount (₹)</Text>
            <TextInput value={lAmount} onChangeText={setLAmount} keyboardType="numeric" style={styles.input} />
            <Text style={styles.label}>Vendor / Party Name</Text>
            <TextInput value={lVendor} onChangeText={setLVendor} style={styles.input} />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setLedgerOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={submitLedgerEntry}>
                <Text style={styles.saveText}>Save Entry</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Staff Modal */}
      <Modal visible={staffOpen} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Staff Member</Text>
            <Text style={styles.label}>Full Name</Text>
            <TextInput value={sName} onChangeText={setSName} style={styles.input} />
            <Text style={styles.label}>Email</Text>
            <TextInput value={sEmail} onChangeText={setSEmail} autoCapitalize="none" style={styles.input} />
            <Text style={styles.label}>Phone</Text>
            <TextInput value={sPhone} onChangeText={setSPhone} style={styles.input} />
            <Text style={styles.label}>Role (admin / frontdesk / housekeeping / finance)</Text>
            <TextInput value={sRole} onChangeText={setSRole} autoCapitalize="none" style={styles.input} />
            <Text style={styles.label}>Monthly Salary (₹)</Text>
            <TextInput value={sSalary} onChangeText={setSSalary} keyboardType="numeric" style={styles.input} />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setStaffOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={submitAddStaff}>
                <Text style={styles.saveText}>Add Staff</Text>
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
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  sub: { color: "#10B981", fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  title: { color: "#F8FAFC", fontSize: 22, fontWeight: "800" },
  tabRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 10, maxHeight: 44 },
  tabChip: {
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  tabChipActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  tabText: { color: "#94A3B8", fontSize: 11, fontWeight: "800" },
  scroll: { padding: 16, paddingBottom: 40 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  kpiBox: {
    width: "48%",
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1F2937",
  },
  kpiLabel: { color: "#94A3B8", fontSize: 11, fontWeight: "700" },
  kpiVal: { fontSize: 18, fontWeight: "800", marginTop: 4 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#10B981",
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  actionBtnText: { color: "#090D16", fontSize: 13, fontWeight: "800" },
  card: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1F2937",
    marginBottom: 10,
    gap: 6,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tag: { color: "#10B981", fontSize: 11, fontWeight: "800" },
  cardTitle: { color: "#F8FAFC", fontSize: 15, fontWeight: "800" },
  cardMeta: { color: "#94A3B8", fontSize: 12 },
  amount: { color: "#F8FAFC", fontSize: 15, fontWeight: "800" },
  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#10B981",
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 6,
  },
  outlineBtnText: { color: "#10B981", fontSize: 12, fontWeight: "700" },
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
