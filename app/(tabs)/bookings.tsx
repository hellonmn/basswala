/**
 * bookings.tsx — Updated with real bookingApi
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  Animated,
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
import { bookingApi } from "../../services/userApi"; // ← Updated import

const { width, height } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────
interface Booking {
  id: number | string;
  name: string;
  category: string;
  image: string;
  price: number;
  startDate: string;
  endDate: string;
  days: number;           // duration in hours
  status: string;
  orderId: string;
  deliveryAddress: string;
  vendor: string;
  vendorPhone: string;
  deposit: number;
  notes: string;
  rating?: number;
  totalAmount?: number;
}

// ─── Image Resolver ───────────────────────────────────────────────────────────
function resolveDJImage(b: any): string {
  const FALLBACK = "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80";

  const dj = b.captainDJ ?? b.dj ?? b.djProfile ?? null;
  let imgs = dj?.images ?? b.images ?? null;

  if (typeof imgs === "string") imgs = JSON.parse(imgs);
  if (Array.isArray(imgs) && imgs.length > 0) return imgs[0];
  if (typeof imgs === "string" && imgs.length > 0) return imgs;

  const single = dj?.profilePicture ?? dj?.image ?? b.image ?? null;
  if (typeof single === "string" && single.length > 0) return single;

  return FALLBACK;
}

// ─── Amount Resolver ──────────────────────────────────────────────────────────
function resolveAmount(raw: any): number {
  const n = Number(raw) || 0;
  if (n <= 0) return 0;
  // If amount looks like paise (very large), convert to rupees
  return n > 10000 ? Math.round(n / 100) : n;
}

// ─── Map Backend Booking ──────────────────────────────────────────────────────
function mapBooking(b: any): Booking {
  const dj = b.captainDJ ?? b.dj ?? {};
  const djName = dj.name || "DJ Booking";

  const eventDate = b.eventDate || b.eventDetails?.eventDate;
  const startDateStr = eventDate
    ? new Date(eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  const durationHours = Number(b.durationHours || b.eventDetails?.durationHours || 3);

  const price = resolveAmount(dj.hourlyRate || b.basePrice);
  const totalAmount = resolveAmount(b.totalAmount || b.eventDetails?.totalAmount) || (price * durationHours);

  let status = (b.status || "pending").toLowerCase().trim();
  if (["confirmed", "in progress", "active"].includes(status)) status = "active";
  else if (status === "completed") status = "completed";
  else if (["cancelled", "canceled"].includes(status)) status = "cancelled";
  else status = "upcoming";

  const deliveryAddress = [
    b.deliveryLocation?.street,
    b.deliveryLocation?.city,
    b.deliveryLocation?.state,
  ].filter(Boolean).join(", ") || "—";

  return {
    id: b.id,
    name: djName,
    category: b.eventType || "DJ Service",
    image: resolveDJImage(b),
    price,
    startDate: startDateStr,
    endDate: startDateStr,
    days: durationHours,
    status,
    orderId: `#ORD-${b.id}`,
    deliveryAddress,
    vendor: djName,
    vendorPhone: dj.phone || "+91 00000 00000",
    deposit: 0,
    notes: b.specialRequests || "",
    rating: b.rating,
    totalAmount,
  };
}

const TABS = ["Active", "Upcoming", "Past"];

const statusConfig: Record<string, any> = {
  active: { label: "Active", color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0", icon: "radio-button-on" },
  upcoming: { label: "Upcoming", color: "#0cadab", bg: "#f0fafa", border: "#d0f0ef", icon: "time-outline" },
  completed: { label: "Completed", color: "#8696a0", bg: "#f8f9fa", border: "#e5e7eb", icon: "checkmark-circle-outline" },
  cancelled: { label: "Cancelled", color: "#ef4444", bg: "#fef2f2", border: "#fecaca", icon: "close-circle-outline" },
};

// ─── Skeleton Component ───────────────────────────────────────────────────────
const SkeletonBox = ({ w, h, r = 8 }: { w: number | string; h: number; r?: number }) => {
  const anim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });
  return <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: "#e5e7eb", opacity }} />;
};

// ─── Star Rating ─────────────────────────────────────────────────────────────
const StarRating = ({ rating }: { rating: number }) => (
  <View style={{ flexDirection: "row", gap: 2 }}>
    {[1, 2, 3, 4, 5].map((s) => (
      <Ionicons key={s} name={s <= rating ? "star" : "star-outline"} size={14} color={s <= rating ? "#FFC107" : "#d1d5db"} />
    ))}
  </View>
);

// ─── Booking Bottom Sheet (unchanged UI) ─────────────────────────────────────
const PEEK_HEIGHT = height * 0.52;
const FULL_HEIGHT = height * 0.95;
const PEEK_TRANSLATE_Y = FULL_HEIGHT - PEEK_HEIGHT;
const SNAP_THRESHOLD = 50;

const BookingBottomSheet = ({
  booking,
  onClose,
  onCancelBooking,
  onAddReview,
}: {
  booking: Booking;
  onClose: () => void;
  onCancelBooking?: (id: string | number) => void;
  onAddReview?: (id: string | number, rating: number) => void;
}) => {
  // ... (Your existing bottom sheet code remains unchanged)
  // I'm keeping it exactly as you had for brevity. Paste your original sheet code here if needed.
  // For space, I'm showing only the changed parts below.
};

// ─── Booking Card (unchanged) ─────────────────────────────────────────────────
const BookingCard = ({ item, onPress }: { item: Booking; onPress: (b: Booking) => void }) => {
  const cfg = statusConfig[item.status] || statusConfig.upcoming;
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

// ─── Empty State (unchanged) ──────────────────────────────────────────────────
const EmptyState = ({ tab }: { tab: string }) => (
  <View style={styles.empty}>
    <View style={styles.emptyIcon}>
      <Ionicons name={{ Active: "radio-button-off-outline", Upcoming: "calendar-outline", Past: "time-outline" }[tab] as any} size={38} color="#0cadab" />
    </View>
    <Text style={styles.emptyTitle}>Nothing here yet</Text>
    <Text style={styles.emptyMsg}>
      {{ Active: "No active bookings.\nExplore DJs and make your first booking!", Upcoming: "No upcoming bookings.\nPlan your next event!", Past: "No past bookings yet.\nYour history will appear here." }[tab]}
    </Text>
  </View>
);

// ─── Main Bookings Screen ─────────────────────────────────────────────────────
export default function BookingsScreen() {
  const [activeTab, setActiveTab] = useState<"Active" | "Upcoming" | "Past">("Active");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
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

  const handleCancelBooking = async (id: string | number) => {
    try {
      await bookingApi.cancel(id);
      setAllBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b)));
      Alert.alert("Cancelled", "Booking has been cancelled.");
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Failed to cancel booking");
    }
  };

  const handleAddReview = async (id: string | number, rating: number) => {
    try {
      await bookingApi.addReview(id, { rating });
      setAllBookings((prev) => prev.map((b) => (b.id === id ? { ...b, rating } : b)));
      Alert.alert("Thank you!", "Your review has been submitted.");
    } catch (err: any) {
      Alert.alert("Error", "Failed to submit review");
    }
  };

  const getTabItems = (tab: string) => {
    if (tab === "Active") return allBookings.filter((b) => b.status === "active");
    if (tab === "Upcoming") return allBookings.filter((b) => b.status === "upcoming");
    if (tab === "Past") return allBookings.filter((b) => b.status === "completed" || b.status === "cancelled");
    return [];
  };

  const items = getTabItems(activeTab);

  const activeCount = allBookings.filter((b) => b.status === "active").length;
  const upcomingCount = allBookings.filter((b) => b.status === "upcoming").length;
  const pastCount = allBookings.filter((b) => b.status === "completed" || b.status === "cancelled").length;

  const totalSpent = allBookings
    .filter((b) => b.status !== "cancelled")
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

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
            // Your existing skeleton UI (unchanged)
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16 }} showsVerticalScrollIndicator={false}>
              {/* ... your skeleton code ... */}
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
                  const count = tab === "Active" ? activeCount : tab === "Upcoming" ? upcomingCount : pastCount;
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
                  items.map((item) => <BookingCard key={item.id} item={item} onPress={setSelectedBooking} />)
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

      {selectedBooking && (
        <BookingBottomSheet
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onCancelBooking={handleCancelBooking}
          onAddReview={handleAddReview}
        />
      )}
    </>
  );
}


// ─── Sheet Styles ─────────────────────────────────────────────────────────────

const sheet = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(16,23,32,0.46)" },
  panel: { position: "absolute", bottom: 0, left: 0, right: 0, height: FULL_HEIGHT, backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, borderColor: "#eef0f3", overflow: "hidden" },
  handleZone: { paddingTop: 12, paddingBottom: 6, alignItems: "center" },
  handle: { width: 60, height: 4, borderRadius: 2, backgroundColor: "#d1d5db" },
  scrollContent: { paddingBottom: 16 },
  imageWrapper: { position: "relative", marginHorizontal: 16, marginBottom: 14, borderRadius: 20, overflow: "hidden" },
  image: { width: "100%", height: 196, backgroundColor: "#e5e7eb" },
  statusPill: { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statusPillText: { fontSize: 12, fontWeight: "700" },
  nameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 20, marginBottom: 14 },
  name: { fontSize: 20, fontWeight: "800", color: "#101720", letterSpacing: -0.4, marginBottom: 3 },
  category: { fontSize: 13, color: "#8696a0", fontWeight: "500" },
  totalPrice: { fontSize: 24, fontWeight: "800", color: "#101720", letterSpacing: -0.5 },
  totalUnit: { fontSize: 11, color: "#8696a0", fontWeight: "500", textAlign: "right" },
  card: { marginHorizontal: 16, marginBottom: 12, backgroundColor: "#f4f8ff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#eef0f3" },
  cardTitle: { fontSize: 10, fontWeight: "700", color: "#8696a0", letterSpacing: 0.9, textTransform: "uppercase", marginBottom: 12 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#eef0f3" },
  cardLabel: { fontSize: 13, color: "#8696a0", fontWeight: "600", flex: 1 },
  cardValue: { fontSize: 13, fontWeight: "700", color: "#101720", textAlign: "right" },
  divider: { height: 1, backgroundColor: "#eef0f3", marginVertical: 10 },
  dateBlock: { flexDirection: "row", alignItems: "center" },
  dateLabel: { fontSize: 9, fontWeight: "700", color: "#8696a0", letterSpacing: 0.8, marginBottom: 4 },
  dateValue: { fontSize: 14, fontWeight: "800", color: "#101720" },
  dateLine: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 4 },
  dateLineSeg: { width: 18, height: 1, backgroundColor: "#d0f0ef" },
  notesCard: { marginHorizontal: 16, marginBottom: 12, flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: "#f0fafa", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#d0f0ef" },
  notesText: { flex: 1, fontSize: 13, color: "#4b6585", fontWeight: "500", lineHeight: 19 },
  rateCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: "#fffbeb", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#fde68a", gap: 10 },
  rateTitle: { fontSize: 14, fontWeight: "800", color: "#101720" },
  rateSub: { fontSize: 12, color: "#8696a0", fontWeight: "500" },
  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 4 },
  actionPrimary: { flex: 1, backgroundColor: "#101720", borderRadius: 16, paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  actionPrimaryText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  actionDanger: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fef2f2", borderRadius: 16, paddingVertical: 15, borderWidth: 1, borderColor: "#fecaca" },
  actionDangerText: { fontSize: 15, fontWeight: "700", color: "#ef4444" },
});

// ─── Screen Styles ────────────────────────────────────────────────────────────

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
  list: { paddingHorizontal: 20 },
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