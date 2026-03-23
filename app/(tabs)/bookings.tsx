/**
 * bookings.tsx — Dynamic version using real API data
 * Replaces all mockBookings with live data from /bookings/my-bookings
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Dimensions,
  Image,
  PanResponder,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiService } from "../../services/api";

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
  days: number;
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

// ─── Image resolver — handles all common backend shapes ──────────────────────
function resolveDJImage(b: any): string {
  const FALLBACK = "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80";
  // Try all common nesting patterns the backend may use
  const dj = b.dj ?? b.djProfile ?? b.djDetails ?? b.DJ ?? null;
  const imgs = dj?.images ?? dj?.profileImages ?? b.images ?? null;
  if (Array.isArray(imgs) && imgs.length > 0) return imgs[0];
  if (typeof imgs === "string" && imgs.length > 0) return imgs;
  const single = dj?.image ?? dj?.profilePicture ?? dj?.avatar ?? b.djImage ?? null;
  if (typeof single === "string" && single.length > 0) return single;
  return FALLBACK;
}

// ─── Amount resolver — auto-detects paise vs rupees ─────────────────────────
//  Razorpay amounts are in paise (e.g. 49900 = ₹499).
//  If amount > 1000 and seems unreasonably large for a booking fee, convert.
function resolveAmount(raw: any): number {
  const n = Number(raw) || 0;
  if (n <= 0) return 0;
  // Heuristic: if the value is > 10000 it's likely in paise — divide by 100
  // A realistic max DJ hourly fee in rupees is ₹10,000; anything above that is paise
  return n > 10000 ? Math.round(n / 100) : n;
}

// Map backend booking to display format
function mapBooking(b: any): Booking {
  // DJ name — try all common shapes
  const dj = b.dj ?? b.djProfile ?? b.djDetails ?? b.DJ ?? null;
  const djName = dj?.name ?? b.djName ?? "DJ";

  const category = b.eventType ?? b.eventDetails?.eventType ?? "DJ Service";

  // Date handling
  const eventDate = b.eventDate ?? b.eventDetails?.eventDate ?? null;
  const startDate = eventDate
    ? new Date(eventDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  // duration is in hours (from our booking flow), not days
  // Show the same date for start/end since it's an hourly event
  const durationHours = Number(b.duration ?? b.eventDetails?.duration ?? 1);

  const price = resolveAmount(b.basePrice ?? b.eventDetails?.basePrice ?? 0);

  // totalAmount — prefer backend value, fall back to price (in rupees)
  const totalAmount = resolveAmount(b.totalAmount ?? b.eventDetails?.totalAmount ?? 0) || price;

  // Map backend status to display status
  let status = (b.status || "pending").toLowerCase().trim();
  if (status === "confirmed" || status === "in progress" || status === "active") status = "active";
  else if (status === "completed") status = "completed";
  else if (status === "cancelled" || status === "canceled") status = "cancelled";
  else status = "upcoming"; // pending → upcoming

  const deliveryAddress = [
    b.eventStreet ?? b.eventLocation?.street ?? "",
    b.eventCity   ?? b.eventLocation?.city   ?? "",
    b.eventState  ?? b.eventLocation?.state  ?? "",
  ].filter(Boolean).join(", ") || "—";

  return {
    id: b.id,
    name: djName,
    category,
    image: resolveDJImage(b),
    price,
    startDate,
    endDate: startDate, // same-day event (hourly booking)
    days: durationHours,
    status,
    orderId: `#ORD-${b.id}`,
    deliveryAddress,
    vendor: djName,
    vendorPhone: dj?.owner?.phone ?? dj?.phone ?? "+91 00000 00000",
    deposit: 0,
    notes: b.specialRequests ?? b.eventDetails?.specialRequests ?? "",
    rating: b.rating ?? null,
    totalAmount,
  };
}

const TABS = ["Active", "Upcoming", "Past"];

const statusConfig: Record<string, any> = {
  active:    { label: "Active",    color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0", icon: "radio-button-on"          },
  upcoming:  { label: "Upcoming",  color: "#0cadab", bg: "#f0fafa", border: "#d0f0ef", icon: "time-outline"             },
  completed: { label: "Completed", color: "#8696a0", bg: "#f8f9fa", border: "#e5e7eb", icon: "checkmark-circle-outline" },
  cancelled: { label: "Cancelled", color: "#ef4444", bg: "#fef2f2", border: "#fecaca", icon: "close-circle-outline"     },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  return (
    <Animated.View style={{ width: w as any, height: h, borderRadius: r, backgroundColor: "#e5e7eb", opacity }} />
  );
};

const StarRating = ({ rating }: { rating: number }) => (
  <View style={{ flexDirection: "row", gap: 2 }}>
    {[1, 2, 3, 4, 5].map((s) => (
      <Ionicons key={s} name={s <= rating ? "star" : "star-outline"} size={14}
        color={s <= rating ? "#FFC107" : "#d1d5db"} />
    ))}
  </View>
);

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────

const PEEK_HEIGHT = height * 0.52;
const FULL_HEIGHT = height * 0.95;
const PEEK_TRANSLATE_Y = FULL_HEIGHT - PEEK_HEIGHT;
const SNAP_THRESHOLD = 50;

const BookingBottomSheet = ({ booking, onClose, onCancelBooking, onAddReview }: {
  booking: Booking;
  onClose: () => void;
  onCancelBooking?: (id: string | number) => void;
  onAddReview?: (id: string | number, rating: number) => void;
}) => {
  const translateY = useRef(new Animated.Value(FULL_HEIGHT)).current;
  const overlayOp = useRef(new Animated.Value(0)).current;
  const isExpanded = useRef(false);
  const isAtTop = useRef(true);
  const [expanded, setExpanded] = useState(false);

  const springTo = useCallback((toValue: number, cb?: () => void) => {
    Animated.spring(translateY, { toValue, useNativeDriver: true, tension: 68, friction: 13 }).start(cb);
  }, [translateY]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: PEEK_TRANSLATE_Y, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.timing(overlayOp, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { dismiss(); return true; });
    return () => sub.remove();
  }, []);

  const expandFull = useCallback(() => { isExpanded.current = true; setExpanded(true); springTo(0); }, [springTo]);
  const collapsePeek = useCallback(() => { isExpanded.current = false; setExpanded(false); springTo(PEEK_TRANSLATE_Y); }, [springTo]);
  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: FULL_HEIGHT, duration: 300, useNativeDriver: true }),
      Animated.timing(overlayOp, { toValue: 0, duration: 240, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [translateY, overlayOp, onClose]);

  const handlePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
    onPanResponderRelease: (_, g) => {
      if (g.dy < -SNAP_THRESHOLD && !isExpanded.current) expandFull();
      else if (g.dy > SNAP_THRESHOLD && isExpanded.current) collapsePeek();
      else if (g.dy > SNAP_THRESHOLD && !isExpanded.current) dismiss();
    },
  })).current;

  const bodyPan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => {
      if (!isExpanded.current && g.dy < -SNAP_THRESHOLD / 2) return true;
      if (isExpanded.current && isAtTop.current && g.dy > SNAP_THRESHOLD / 2) return true;
      return false;
    },
    onPanResponderRelease: (_, g) => {
      if (!isExpanded.current && g.dy < -SNAP_THRESHOLD) expandFull();
      else if (isExpanded.current && isAtTop.current && g.dy > SNAP_THRESHOLD) collapsePeek();
    },
  })).current;

  const cfg = statusConfig[booking.status] || statusConfig.upcoming;
  const total = booking.totalAmount || booking.price * booking.days;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[sheet.overlay, { opacity: overlayOp }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={dismiss} />
      </Animated.View>
      <Animated.View style={[sheet.panel, { transform: [{ translateY }] }]} {...bodyPan.panHandlers}>
        <View {...handlePan.panHandlers} style={sheet.handleZone}>
          <View style={sheet.handle} />
        </View>
        <ScrollView
          scrollEnabled={expanded} showsVerticalScrollIndicator={false} bounces={false}
          scrollEventThrottle={8}
          onScroll={(e) => { isAtTop.current = e.nativeEvent.contentOffset.y <= 2; }}
          contentContainerStyle={sheet.scrollContent}
        >
          {/* Image */}
          <View style={sheet.imageWrapper}>
            <Image source={{ uri: booking.image }} style={sheet.image} />
            <View style={[sheet.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
              <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
              <Text style={[sheet.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          {/* Name + Price */}
          <View style={sheet.nameRow}>
            <View style={{ flex: 1 }}>
              <Text style={sheet.name}>{booking.name}</Text>
              <Text style={sheet.category}>{booking.category}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={sheet.totalPrice}>₹{total.toLocaleString()}</Text>
              <Text style={sheet.totalUnit}>{booking.days}hr{booking.days !== 1 ? "s" : ""}</Text>
            </View>
          </View>

          {/* Order + Dates */}
          <View style={sheet.card}>
            <View style={sheet.cardRow}>
              <View style={sheet.cardIconBox}><Ionicons name="receipt-outline" size={16} color="#0cadab" /></View>
              <Text style={sheet.cardLabel}>Order ID</Text>
              <Text style={sheet.cardValue}>{booking.orderId}</Text>
            </View>
            <View style={sheet.divider} />
            <View style={sheet.dateBlock}>
              <View style={{ flex: 1 }}>
                <Text style={sheet.dateLabel}>FROM</Text>
                <Text style={sheet.dateValue}>{booking.startDate}</Text>
              </View>
              <View style={sheet.dateLine}>
                <View style={sheet.dateLineSeg} />
                <Ionicons name="airplane-outline" size={14} color="#0cadab" />
                <View style={sheet.dateLineSeg} />
              </View>
              <View style={{ flex: 1, alignItems: "flex-end" }}>
                <Text style={sheet.dateLabel}>TO</Text>
                <Text style={sheet.dateValue}>{booking.endDate}</Text>
              </View>
            </View>
          </View>

          {/* Vendor & Delivery */}
          {(booking.vendor || booking.deliveryAddress) && (
            <View style={sheet.card}>
              <Text style={sheet.cardTitle}>Vendor & Delivery</Text>
              <View style={sheet.cardRow}>
                <View style={sheet.cardIconBox}><Ionicons name="storefront-outline" size={16} color="#8696a0" /></View>
                <Text style={sheet.cardLabel}>Vendor</Text>
                <Text style={sheet.cardValue}>{booking.vendor}</Text>
              </View>
              {booking.deliveryAddress && booking.deliveryAddress !== "—" && (
                <>
                  <View style={sheet.divider} />
                  <View style={sheet.cardRow}>
                    <View style={sheet.cardIconBox}><Ionicons name="location-outline" size={16} color="#8696a0" /></View>
                    <Text style={sheet.cardLabel}>Location</Text>
                    <Text style={[sheet.cardValue, { flex: 1, textAlign: "right" }]} numberOfLines={2}>
                      {booking.deliveryAddress}
                    </Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* Notes */}
          {!!booking.notes && (
            <View style={sheet.notesCard}>
              <Ionicons name="information-circle-outline" size={16} color="#0cadab" />
              <Text style={sheet.notesText}>{booking.notes}</Text>
            </View>
          )}

          {/* Rating */}
          {booking.status === "completed" && booking.rating && (
            <View style={sheet.card}>
              <Text style={sheet.cardTitle}>Your Rating</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 4 }}>
                <StarRating rating={booking.rating} />
                <Text style={{ fontSize: 13, color: "#8696a0", fontWeight: "600" }}>
                  {booking.rating === 5 ? "Excellent!" : booking.rating >= 4 ? "Great" : "Good"}
                </Text>
              </View>
            </View>
          )}

          {/* Rate prompt */}
          {booking.status === "completed" && !booking.rating && (
            <TouchableOpacity style={sheet.rateCard} onPress={() => onAddReview?.(booking.id, 5)}>
              <View>
                <Text style={sheet.rateTitle}>How was your experience?</Text>
                <Text style={sheet.rateSub}>Tap a star to leave a review</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity key={s} onPress={() => onAddReview?.(booking.id, s)}>
                    <Ionicons name="star-outline" size={24} color="#FFC107" />
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          )}

          {/* Actions */}
          <View style={sheet.actions}>
            {booking.status === "active" && (
              <TouchableOpacity style={sheet.actionPrimary}>
                <Text style={sheet.actionPrimaryText}>Contact DJ</Text>
              </TouchableOpacity>
            )}
            {booking.status === "upcoming" && (
              <>
                <TouchableOpacity
                  style={sheet.actionDanger}
                  onPress={() => { onCancelBooking?.(booking.id); dismiss(); }}
                >
                  <Text style={sheet.actionDangerText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={sheet.actionPrimary}>
                  <Text style={sheet.actionPrimaryText}>Modify</Text>
                </TouchableOpacity>
              </>
            )}
            {booking.status === "completed" && (
              <TouchableOpacity style={sheet.actionPrimary}>
                <Text style={sheet.actionPrimaryText}>Book Again</Text>
              </TouchableOpacity>
            )}
            {booking.status === "cancelled" && (
              <TouchableOpacity style={[sheet.actionPrimary, { flex: 1 }]}>
                <Text style={sheet.actionPrimaryText}>Book Again</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
};

// ─── Booking Card ─────────────────────────────────────────────────────────────

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
        {item.status === "completed" && item.rating && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <StarRating rating={item.rating} />
            <Text style={{ fontSize: 12, color: "#8696a0", fontWeight: "500" }}>Your rating</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────

const EmptyState = ({ tab }: { tab: string }) => (
  <View style={styles.empty}>
    <View style={styles.emptyIcon}>
      <Ionicons
        name={{ Active: "radio-button-off-outline", Upcoming: "calendar-outline", Past: "time-outline" }[tab] as any}
        size={38} color="#0cadab"
      />
    </View>
    <Text style={styles.emptyTitle}>Nothing here yet</Text>
    <Text style={styles.emptyMsg}>
      {{ Active: "No active bookings.\nExplore DJs and make your first booking!", Upcoming: "No upcoming bookings.\nPlan your next event!", Past: "No past bookings yet.\nYour history will appear here." }[tab]}
    </Text>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BookingsScreen() {
  const [activeTab, setActiveTab] = useState("Active");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await apiService.getMyBookings();
      const raw = res.data || res;
      const list = Array.isArray(raw) ? raw : [];
      setAllBookings(list.map(mapBooking));
    } catch (err) {
      console.error("Failed to fetch bookings:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refresh when screen comes into focus
  useFocusEffect(useCallback(() => { fetchBookings(); }, [fetchBookings]));

  const onRefresh = () => { setRefreshing(true); fetchBookings(); };

  const handleCancelBooking = async (id: string | number) => {
    try {
      await apiService.cancelBooking(id);
      setAllBookings(prev => prev.map(b => b.id === id ? { ...b, status: "cancelled" } : b));
    } catch (err) {
      console.error("Cancel failed:", err);
    }
  };

  const handleAddReview = async (id: string | number, rating: number) => {
    try {
      await apiService.addBookingReview(id, { rating });
      setAllBookings(prev => prev.map(b => b.id === id ? { ...b, rating } : b));
    } catch (err) {
      console.error("Review failed:", err);
    }
  };

  // Filter by tab
  const getTabItems = (tab: string) => {
    if (tab === "Active") return allBookings.filter(b => b.status === "active");
    if (tab === "Upcoming") return allBookings.filter(b => b.status === "upcoming");
    if (tab === "Past") return allBookings.filter(b => b.status === "completed" || b.status === "cancelled");
    return [];
  };

  const items = getTabItems(activeTab);
  const activeCount = allBookings.filter(b => b.status === "active").length;
  const upcomingCount = allBookings.filter(b => b.status === "upcoming").length;

  const tabCounts: Record<string, number> = {
    Active: activeCount,
    Upcoming: upcomingCount,
    Past: allBookings.filter(b => b.status === "completed" || b.status === "cancelled").length,
  };

  const totalSpent = allBookings
    .filter(b => b.status !== "cancelled")
    .reduce((a, b) => a + (b.totalAmount || b.price * b.days), 0);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f8ff" />
      <SafeAreaView style={styles.container} edges={["top"]}>
        <LinearGradient colors={["#f4f8ff", "#eef1f9", "#ffffff"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }}>

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
              {/* Summary strip skeleton */}
              <View style={{ flexDirection: "row", backgroundColor: "#fff", borderRadius: 18, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#eef0f3", gap: 8 }}>
                {[1,2,3,4].map((_, i, arr) => (
                  <React.Fragment key={i}>
                    <View style={{ flex: 1, alignItems: "center", gap: 6 }}>
                      <SkeletonBox w={20} h={14} r={4} />
                      <SkeletonBox w={32} h={16} r={5} />
                      <SkeletonBox w={40} h={11} r={4} />
                    </View>
                    {i < arr.length - 1 && <View style={{ width: 1, height: 30, backgroundColor: "#eef0f3" }} />}
                  </React.Fragment>
                ))}
              </View>
              {/* Tab row skeleton */}
              <View style={{ flexDirection: "row", backgroundColor: "#fff", borderRadius: 16, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: "#eef0f3", gap: 4 }}>
                {[1,2,3].map(i => <SkeletonBox key={i} w={(width - 64) / 3} h={40} r={13} />)}
              </View>
              {/* Booking card skeletons */}
              {[1,2,3].map(i => (
                <View key={i} style={{ backgroundColor: "#fff", borderRadius: 22, overflow: "hidden", marginBottom: 14, borderWidth: 1, borderColor: "#eef0f3" }}>
                  <SkeletonBox w="100%" h={176} r={0} />
                  <View style={{ padding: 14, gap: 10 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <View style={{ gap: 6 }}>
                        <SkeletonBox w={140} h={18} r={6} />
                        <SkeletonBox w={90} h={13} r={5} />
                      </View>
                      <View style={{ alignItems: "flex-end", gap: 6 }}>
                        <SkeletonBox w={70} h={20} r={6} />
                        <SkeletonBox w={45} h={12} r={4} />
                      </View>
                    </View>
                    <SkeletonBox w="100%" h={52} r={14} />
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <>
              {/* Summary Strip */}
              <View style={styles.strip}>
                {[
                  { icon: "radio-button-on",         color: "#22c55e", value: activeCount,   label: "Active"   },
                  { icon: "time-outline",             color: "#0cadab", value: upcomingCount, label: "Upcoming" },
                  { icon: "checkmark-circle-outline", color: "#8696a0",
                    value: allBookings.filter(b => b.status === "completed").length, label: "Done" },
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
                  const count = tabCounts[tab];
                  const on = activeTab === tab;
                  return (
                    <TouchableOpacity key={tab} style={[styles.tab, on && styles.tabOn]} onPress={() => setActiveTab(tab)} activeOpacity={0.8}>
                      <Text style={[styles.tabText, on && styles.tabTextOn]}>{tab}</Text>
                      {count > 0 && (
                        <View style={[styles.tabBadge, on && styles.tabBadgeOn]}>
                          <Text style={[styles.tabBadgeText, on && styles.tabBadgeTextOn]}>{count}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* List */}
              <ScrollView
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0cadab"]} />}
              >
                {items.length === 0 ? (
                  <EmptyState tab={activeTab} />
                ) : (
                  items.map((item) => (
                    <BookingCard key={item.id} item={item} onPress={setSelectedBooking} />
                  ))
                )}

                {activeTab === "Past" && items.length > 0 && (
                  <TouchableOpacity style={styles.promoStrip} activeOpacity={0.88}>
                    <LinearGradient colors={["#0cadab", "#0a9998"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.promoGrad}>
                      <View>
                        <Text style={styles.promoTitle}>Planning another event? 🎶</Text>
                        <Text style={styles.promoSub}>Browse top DJs available in your city</Text>
                      </View>
                      <View style={styles.promoArrow}>
                        <Ionicons name="arrow-forward" size={18} color="#0cadab" />
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