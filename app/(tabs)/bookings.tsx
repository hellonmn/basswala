/**
 * bookings.tsx — User Side Bookings Screen (Original UI + Real Statuses)
 * Click opens full detail screen instead of bottom sheet
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { bookingApi } from "../../services/userApi";

const { width } = Dimensions.get("window");

interface Booking {
  id: number;
  name: string;
  category: string;
  image: string;
  price: number;
  startDate: string;
  endDate: string;
  days: number;
  status: string;                    // Real status from captain
  orderId: string;
  deliveryAddress: string;
  vendor: string;
  vendorPhone: string;
  totalAmount: number;
  eventType?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  specialRequests?: string;
  rating?: number;
  captainNotes?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function resolveDJImage(b: any): string {
  const FALLBACK = "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80";
  const dj = b.captainDJ ?? b.dj ?? {};
  let imgs = dj.images ?? b.images;

  if (typeof imgs === "string") {
    try { imgs = JSON.parse(imgs); } catch { imgs = []; }
  }
  if (Array.isArray(imgs) && imgs.length > 0) return imgs[0];
  if (typeof imgs === "string" && imgs.length > 0) return imgs;

  return dj.profilePicture || b.image || FALLBACK;
}

function resolveAmount(raw: any): number {
  const n = Number(raw) || 0;
  return n > 10000 ? Math.round(n / 100) : n;
}

function mapBooking(b: any): Booking {
  const dj = b.captainDJ ?? b.dj ?? {};
  const eventDate = b.eventDate || b.eventDetails?.eventDate;

  return {
    id: b.id,
    name: dj.name || "DJ Booking",
    category: b.eventType || "DJ Service",
    image: resolveDJImage(b),
    price: resolveAmount(dj.hourlyRate),
    startDate: eventDate ? new Date(eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—",
    endDate: eventDate ? new Date(eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—",
    days: Number(b.durationHours || 3),
    status: b.status || "Pending",
    orderId: `#${b.id}`,
    deliveryAddress: [b.deliveryStreet, b.deliveryCity, b.deliveryState].filter(Boolean).join(", ") || "—",
    vendor: dj.name || "Captain DJ",
    vendorPhone: dj.phone || "—",
    totalAmount: resolveAmount(b.totalAmount),
    eventType: b.eventType,
    eventDate: b.eventDate,
    startTime: b.startTime,
    endTime: b.endTime,
    specialRequests: b.specialRequests,
    rating: b.rating,
    captainNotes: b.captainNotes,
  };
}

const TABS = ["All", "Active", "Upcoming", "Past"] as const;

const statusConfig: Record<string, any> = {
  Pending:              { label: "Pending",              color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", icon: "time-outline" },
  Confirmed:            { label: "Confirmed",            color: "#0cadab", bg: "#f0fffe", border: "#a5f3fc", icon: "checkmark-circle-outline" },
  "Equipment Dispatched": { label: "Dispatched",         color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", icon: "car-outline" },
  "In Progress":        { label: "In Progress",          color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0", icon: "play-circle-outline" },
  Completed:            { label: "Completed",            color: "#8696a0", bg: "#f8fafc", border: "#e2e8f0", icon: "checkmark-done-outline" },
  Cancelled:            { label: "Cancelled",            color: "#ef4444", bg: "#fef2f2", border: "#fecaca", icon: "close-circle-outline" },
};

// ─── Booking Card (Your Original Beautiful Design) ───────────────────────────
const BookingCard = ({ item, onPress }: { item: Booking; onPress: (b: Booking) => void }) => {
  const cfg = statusConfig[item.status] || statusConfig.Pending;
  const total = item.totalAmount || item.price * item.days;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.91} onPress={() => onPress(item)}>
      <View style={styles.cardImageWrapper}>
        <Image source={{ uri: item.image }} style={styles.cardImage} />
        <View style={[styles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
          <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.cardCategory}>{item.category}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.cardTotal}>₹{total.toLocaleString()}</Text>
            <Text style={styles.cardTotalUnit}>{item.days}hr{item.days !== 1 ? "s" : ""}</Text>
          </View>
        </View>
        <View style={styles.datePill}>
          <View style={{ flex: 1 }}>
            <Text style={styles.datePillLabel}>FROM</Text>
            <Text style={styles.datePillValue}>{item.startDate}</Text>
          </View>
          <Ionicons name="arrow-forward" size={14} color="#c4c9d0" style={{ paddingHorizontal: 8 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.datePillLabel}>TO</Text>
            <Text style={styles.datePillValue}>{item.endDate}</Text>
          </View>
          <Text style={styles.orderIdText}>{item.orderId}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Main Screen (Your Original UI Kept) ─────────────────────────────────────
export default function BookingsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"All" | "Active" | "Upcoming" | "Past">("All");
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await bookingApi.getMyBookings({ limit: 50 });
      const rawList = res.success && Array.isArray(res.data) ? res.data : [];
      const mapped = rawList.map(mapBooking);
      setAllBookings(mapped);
    } catch (err: any) {
      console.error("Failed to fetch bookings:", err);
      Alert.alert("Error", "Could not load your bookings. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [fetchBookings])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const getFilteredBookings = () => {
    if (activeTab === "All") return allBookings;
    if (activeTab === "Active") return allBookings.filter(b => ["Confirmed", "Equipment Dispatched", "In Progress"].includes(b.status));
    if (activeTab === "Upcoming") return allBookings.filter(b => b.status === "Pending");
    return allBookings.filter(b => ["Completed", "Cancelled"].includes(b.status));
  };

  const items = getFilteredBookings();

  const activeCount = allBookings.filter(b => ["Confirmed", "Equipment Dispatched", "In Progress"].includes(b.status)).length;
  const upcomingCount = allBookings.filter(b => b.status === "Pending").length;
  const pastCount = allBookings.filter(b => ["Completed", "Cancelled"].includes(b.status)).length;
  const totalSpent = allBookings.filter(b => b.status !== "Cancelled").reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f8ff" />
      <SafeAreaView style={styles.container} edges={["top"]}>
        <LinearGradient colors={["#f4f8ff", "#eef1f9", "#ffffff"]} style={{ flex: 1 }}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <View>
              <Text style={styles.topBarTitle}>My Bookings</Text>
              <Text style={styles.topBarSub}>
                {activeCount} active · {upcomingCount} upcoming
              </Text>
            </View>
          </View>

          {loading ? (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
              {/* Your skeleton can go here if you want to keep it */}
              <ActivityIndicator size="large" color="#0cadab" style={{ marginTop: 100 }} />
            </ScrollView>
          ) : (
            <>
              {/* Summary Strip */}
              <View style={styles.strip}>
                {[
                  { icon: "radio-button-on", color: "#22c55e", value: activeCount, label: "Active" },
                  { icon: "time-outline", color: "#0cadab", value: upcomingCount, label: "Upcoming" },
                  { icon: "checkmark-circle-outline", color: "#8696a0", value: pastCount, label: "Done" },
                  { icon: "wallet-outline", color: "#101720", value: `₹${totalSpent.toLocaleString()}`, label: "Spent" },
                ].map((s, i, arr) => (
                  <React.Fragment key={i}>
                    <View style={styles.stripItem}>
                      <Ionicons name={s.icon as any} size={14} color={s.color} />
                      <Text style={styles.stripValue}>{s.value}</Text>
                      <Text style={styles.stripLabel}>{s.label}</Text>
                    </View>
                    {i < arr.length - 1 && <View style={styles.stripDivider} />}
                  </React.Fragment>
                ))}
              </View>

              {/* Tabs */}
              <View style={styles.tabRow}>
                {TABS.map((tab) => {
                  const count = tab === "All" ? allBookings.length : tab === "Active" ? activeCount : tab === "Upcoming" ? upcomingCount : pastCount;
                  const isActive = activeTab === tab;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.tab, isActive && styles.tabOn]}
                      onPress={() => setActiveTab(tab as any)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.tabText, isActive && styles.tabTextOn]}>{tab}</Text>
                      {count > 0 && (
                        <View style={[styles.tabBadge, isActive && styles.tabBadgeOn]}>
                          <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextOn]}>{count}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Booking List */}
              <ScrollView
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0cadab"]} />}
              >
                {items.length === 0 ? (
                  <EmptyState tab={activeTab} />
                ) : (
                  items.map((item) => <BookingCard key={item.id} item={item} onPress={(b) => router.push(`/bookings/${b.id}`)} />)
                )}

                {activeTab === "Past" && items.length > 0 && (
                  <TouchableOpacity style={styles.promoStrip} activeOpacity={0.88}>
                    <LinearGradient colors={["#0cadab", "#0a9998"]} style={styles.promoGrad}>
                      <View>
                        <Text style={styles.promoTitle}>Planning another event? 🎶</Text>
                        <Text style={styles.promoSub}>Browse top DJs available in your city</Text>
                      </View>
                      <View style={styles.promoArrow}>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            </>
          )}
        </LinearGradient>
      </SafeAreaView>
    </>
  );
};

// ─── Empty State ─────────────────────────────────────────────────────────────
const EmptyState = ({ tab }: { tab: string }) => (
  <View style={styles.empty}>
    <View style={styles.emptyIcon}>
      <Ionicons name={{ All: "calendar-outline", Active: "radio-button-off-outline", Upcoming: "calendar-outline", Past: "time-outline" }[tab] as any} size={38} color="#0cadab" />
    </View>
    <Text style={styles.emptyTitle}>Nothing here yet</Text>
    <Text style={styles.emptyMsg}>
      {tab === "Active" ? "No active bookings.\nExplore DJs and make your first booking!" :
       tab === "Upcoming" ? "No upcoming bookings.\nPlan your next event!" : 
       "No past bookings yet.\nYour history will appear here."}
    </Text>
  </View>
);

// ─── Screen Styles (Your Original Beautiful Styles) ──────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f8ff" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  topBarTitle: { fontSize: 22, fontWeight: "800", color: "#101720", letterSpacing: -0.4 },
  topBarSub: { fontSize: 12, color: "#8696a0", fontWeight: "500", marginTop: 2 },

  strip: { flexDirection: "row", marginHorizontal: 20, marginBottom: 14, backgroundColor: "#fff", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#eef0f3", alignItems: "center" },
  stripItem: { flex: 1, alignItems: "center", gap: 3 },
  stripDivider: { width: 1, height: 30, backgroundColor: "#eef0f3" },
  stripValue: { fontSize: 15, fontWeight: "800", color: "#101720" },
  stripLabel: { fontSize: 10, color: "#8696a0", fontWeight: "600" },

  tabRow: { flexDirection: "row", marginHorizontal: 20, marginBottom: 14, backgroundColor: "#fff", borderRadius: 16, padding: 4, borderWidth: 1, borderColor: "#eef0f3", gap: 4 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 13, gap: 6 },
  tabOn: { backgroundColor: "#101720" },
  tabText: { fontSize: 14, fontWeight: "700", color: "#8696a0" },
  tabTextOn: { color: "#fff" },
  tabBadge: { backgroundColor: "#eef0f3", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeOn: { backgroundColor: "rgba(255,255,255,0.18)" },
  tabBadgeText: { fontSize: 11, fontWeight: "800", color: "#8696a0" },
  tabBadgeTextOn: { color: "#fff" },

  list: { paddingHorizontal: 20, paddingBottom: 100 },
  card: { backgroundColor: "#fff", borderRadius: 22, overflow: "hidden", marginBottom: 14, borderWidth: 1, borderColor: "#eef0f3" },
  cardImageWrapper: { position: "relative" },
  cardImage: { width: "100%", height: 176, backgroundColor: "#e5e7eb" },
  statusPill: { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statusPillText: { fontSize: 12, fontWeight: "700" },
  cardBody: { padding: 14 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  cardName: { fontSize: 17, fontWeight: "800", color: "#101720", letterSpacing: -0.3, marginBottom: 2 },
  cardCategory: { fontSize: 13, color: "#8696a0", fontWeight: "500" },
  cardTotal: { fontSize: 21, fontWeight: "800", color: "#101720", letterSpacing: -0.5 },
  cardTotalUnit: { fontSize: 11, color: "#8696a0", fontWeight: "500", textAlign: "right" },
  datePill: { flexDirection: "row", alignItems: "center", backgroundColor: "#f4f8ff", borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#eef0f3" },
  datePillLabel: { fontSize: 9, fontWeight: "700", color: "#8696a0", letterSpacing: 0.8, marginBottom: 3 },
  datePillValue: { fontSize: 12, fontWeight: "700", color: "#101720" },
  orderIdText: { fontSize: 11, fontWeight: "700", color: "#0cadab", marginLeft: "auto" },

  empty: { alignItems: "center", paddingTop: 56, paddingHorizontal: 32 },
  emptyIcon: { width: 86, height: 86, borderRadius: 28, backgroundColor: "#f0fafa", justifyContent: "center", alignItems: "center", marginBottom: 18, borderWidth: 1, borderColor: "#d0f0ef" },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: "#101720", marginBottom: 8 },
  emptyMsg: { fontSize: 14, color: "#8696a0", textAlign: "center", lineHeight: 21, fontWeight: "500" },

  promoStrip: { borderRadius: 18, overflow: "hidden", marginTop: 4 },
  promoGrad: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 18 },
  promoTitle: { fontSize: 15, fontWeight: "800", color: "#fff", marginBottom: 3 },
  promoSub: { fontSize: 12, color: "rgba(255,255,255,0.82)", fontWeight: "500" },
  promoArrow: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
});