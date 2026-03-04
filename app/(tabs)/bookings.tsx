import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Dimensions,
  Image,
  PanResponder,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

// ─── Mock Data ────────────────────────────────────────────────────────────────

const TABS = ["Active", "Upcoming", "Past"];

const mockBookings: Record<string, any[]> = {
  Active: [
    {
      id: "b1", name: "Pioneer DDJ-1000", category: "DJ Controller",
      image: "https://www.svsound.com/cdn/shop/files/mobile-system.jpg?v=1738683786&width=2000",
      price: 150, startDate: "Feb 20, 2026", endDate: "Feb 23, 2026", days: 3,
      status: "active", orderId: "#ORD-4821", deliveryType: "Delivered",
      deliveryAddress: "42, Shyam Nagar, Jaipur, 302019",
      vendor: "BeatBox Rentals", vendorPhone: "+91 98765 43210",
      deposit: 500, notes: "Handle with care. Comes with carry case.",
    },
    {
      id: "b2", name: "JBL EON615", category: "Speaker System",
      image: "https://i.ytimg.com/vi/z8BVzNw0ErE/maxresdefault.jpg",
      price: 80, startDate: "Feb 21, 2026", endDate: "Feb 22, 2026", days: 1,
      status: "active", orderId: "#ORD-4835", deliveryType: "Pickup",
      deliveryAddress: "Shop 7, MI Road, Jaipur",
      vendor: "SoundWave Pro", vendorPhone: "+91 99887 76655",
      deposit: 300, notes: "Pickup available 10am–7pm.",
    },
  ],
  Upcoming: [
    {
      id: "b3", name: "Technics SL-1200", category: "Turntable",
      image: "https://cdn.shopify.com/s/files/1/0921/3560/files/IMG_2056.jpg?197788",
      price: 100, startDate: "Mar 1, 2026", endDate: "Mar 3, 2026", days: 2,
      status: "upcoming", orderId: "#ORD-4902", deliveryType: "Delivered",
      deliveryAddress: "15, Vaishali Nagar, Jaipur, 302021",
      vendor: "Vinyl Vault", vendorPhone: "+91 90000 11223",
      deposit: 400, notes: "Requires level surface for setup.",
    },
    {
      id: "b4", name: "Allen & Heath Xone:96", category: "Professional Mixer",
      image: "https://via.placeholder.com/400x240/e5e7eb/8696a0?text=Mixer",
      price: 120, startDate: "Mar 5, 2026", endDate: "Mar 6, 2026", days: 1,
      status: "upcoming", orderId: "#ORD-4918", deliveryType: "Pickup",
      deliveryAddress: "Plot 9, Malviya Nagar, Jaipur",
      vendor: "BeatBox Rentals", vendorPhone: "+91 98765 43210",
      deposit: 600, notes: "Includes power cables and user manual.",
    },
  ],
  Past: [
    {
      id: "b5", name: "Shure SM58", category: "Vocal Microphone",
      image: "https://via.placeholder.com/400x240/e5e7eb/8696a0?text=Mic",
      price: 30, startDate: "Jan 10, 2026", endDate: "Jan 11, 2026", days: 1,
      status: "completed", orderId: "#ORD-4210", deliveryType: "Pickup",
      deliveryAddress: "Shop 7, MI Road, Jaipur",
      vendor: "SoundWave Pro", vendorPhone: "+91 99887 76655",
      deposit: 150, notes: "XLR cable included.", rating: 5,
    },
    {
      id: "b6", name: "Chauvet DJ Intimidator", category: "Moving Head Light",
      image: "https://via.placeholder.com/400x240/e5e7eb/8696a0?text=Light",
      price: 60, startDate: "Dec 28, 2025", endDate: "Dec 30, 2025", days: 2,
      status: "completed", orderId: "#ORD-3987", deliveryType: "Delivered",
      deliveryAddress: "42, Shyam Nagar, Jaipur, 302019",
      vendor: "LightIt Up Co.", vendorPhone: "+91 97654 32109",
      deposit: 250, notes: "DMX controller not included.", rating: 4,
    },
    {
      id: "b7", name: "Yamaha HS8", category: "Studio Monitor",
      image: "https://via.placeholder.com/400x240/e5e7eb/8696a0?text=Monitor",
      price: 90, startDate: "Dec 14, 2025", endDate: "Dec 15, 2025", days: 1,
      status: "cancelled", orderId: "#ORD-3844", deliveryType: "Delivered",
      deliveryAddress: "15, Vaishali Nagar, Jaipur, 302021",
      vendor: "Vinyl Vault", vendorPhone: "+91 90000 11223",
      deposit: 0, notes: "Booking cancelled before confirmation.",
    },
  ],
};

// ─── Config ───────────────────────────────────────────────────────────────────

const statusConfig: Record<string, any> = {
  active:    { label: "Active",    color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0", icon: "radio-button-on"          },
  upcoming:  { label: "Upcoming",  color: "#0cadab", bg: "#f0fafa", border: "#d0f0ef", icon: "time-outline"             },
  completed: { label: "Completed", color: "#8696a0", bg: "#f8f9fa", border: "#e5e7eb", icon: "checkmark-circle-outline" },
  cancelled: { label: "Cancelled", color: "#ef4444", bg: "#fef2f2", border: "#fecaca", icon: "close-circle-outline"     },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const StarRating = ({ rating }: { rating: number }) => (
  <View style={{ flexDirection: "row", gap: 2 }}>
    {[1, 2, 3, 4, 5].map((s) => (
      <Ionicons key={s} name={s <= rating ? "star" : "star-outline"} size={14}
        color={s <= rating ? "#FFC107" : "#d1d5db"} />
    ))}
  </View>
);

// ─── Bottom Sheet ─────────────────────────────────────────────────────────────
//
// Layout trick (same as HomeScreen LocationBottomSheet pattern):
//   • Sheet has fixed height = FULL_HEIGHT, anchored at bottom: 0
//   • PEEK  → translateY = FULL_HEIGHT - PEEK_HEIGHT   (only top portion visible)
//   • FULL  → translateY = 0                           (fills screen)
//   • GONE  → translateY = FULL_HEIGHT                 (off-screen)
//
// Gesture strategy:
//   • Handle zone: always intercepts drag → expand / collapse / dismiss
//   • ScrollView: only scrollable when EXPANDED
//     - When at scroll top AND user drags DOWN → collapse / dismiss (via onScroll + panResponder)
//     - When in PEEK mode → the whole sheet area intercepts upward drag → expand
//
// All animations use useNativeDriver: true (translateY only). ✅

const PEEK_HEIGHT      = height * 0.52;
const FULL_HEIGHT      = height * 0.95;
const PEEK_TRANSLATE_Y = FULL_HEIGHT - PEEK_HEIGHT;
const SNAP_THRESHOLD   = 50;

const BookingBottomSheet = ({ booking, onClose }: { booking: any; onClose: () => void }) => {
  const translateY   = useRef(new Animated.Value(FULL_HEIGHT)).current;
  const overlayOp    = useRef(new Animated.Value(0)).current;
  const isExpanded   = useRef(false);
  const scrollY      = useRef(0);           // track scroll position inside sheet
  const isAtTop      = useRef(true);        // true when scrolled to top
  const [expanded, setExpanded] = useState(false);

  // ── Spring helpers ──────────────────────────────────────────────────────────

  const springTo = useCallback((toValue: number, cb?: () => void) => {
    Animated.spring(translateY, {
      toValue,
      useNativeDriver: true,
      tension: 68,
      friction: 13,
    }).start(cb);
  }, [translateY]);

  const fadeTo = useCallback((toValue: number, duration = 260) => {
    Animated.timing(overlayOp, { toValue, duration, useNativeDriver: true }).start();
  }, [overlayOp]);

  // ── Mount: slide to peek ────────────────────────────────────────────────────

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: PEEK_TRANSLATE_Y,
        useNativeDriver: true,
        tension: 80,
        friction: 12,
      }),
      Animated.timing(overlayOp, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Back handler ────────────────────────────────────────────────────────────

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      dismiss();
      return true;
    });
    return () => sub.remove();
  }, []);

  // ── State changers ──────────────────────────────────────────────────────────

  const expandFull = useCallback(() => {
    isExpanded.current = true;
    setExpanded(true);
    springTo(0);
  }, [springTo]);

  const collapsePeek = useCallback(() => {
    isExpanded.current = false;
    setExpanded(false);
    springTo(PEEK_TRANSLATE_Y);
  }, [springTo]);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY,  { toValue: FULL_HEIGHT, duration: 300, useNativeDriver: true }),
      Animated.timing(overlayOp,   { toValue: 0,           duration: 240, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [translateY, overlayOp, onClose]);

  // ── Handle zone pan responder (always active) ────────────────────────────────

  const handlePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dy) > 4,
      onPanResponderRelease: (_, g) => {
        if      (g.dy < -SNAP_THRESHOLD && !isExpanded.current) expandFull();
        else if (g.dy >  SNAP_THRESHOLD &&  isExpanded.current) collapsePeek();
        else if (g.dy >  SNAP_THRESHOLD && !isExpanded.current) dismiss();
      },
    })
  ).current;

  // ── Sheet body pan responder (for peek mode — whole sheet draggable) ─────────
  // Only claims the gesture when NOT expanded, allowing ScrollView to own it when expanded.

  const bodyPan = useRef(
    PanResponder.create({
      // Only intercept when in peek mode OR when expanded+at-top+dragging down
      onMoveShouldSetPanResponder: (_, g) => {
        if (!isExpanded.current && g.dy < -SNAP_THRESHOLD / 2) return true; // peek → drag up
        if (isExpanded.current && isAtTop.current && g.dy > SNAP_THRESHOLD / 2) return true; // expanded+top → drag down
        return false;
      },
      onPanResponderRelease: (_, g) => {
        if (!isExpanded.current && g.dy < -SNAP_THRESHOLD) expandFull();
        else if (isExpanded.current && isAtTop.current && g.dy > SNAP_THRESHOLD) collapsePeek();
      },
    })
  ).current;

  // ── Render ──────────────────────────────────────────────────────────────────

  const cfg   = statusConfig[booking.status];
  const total = booking.price * booking.days;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dim overlay */}
      <Animated.View style={[sheet.overlay, { opacity: overlayOp }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={dismiss} />
      </Animated.View>

      {/* Sheet panel — fixed height, only translateY moves */}
      <Animated.View
        style={[sheet.panel, { transform: [{ translateY }] }]}
        {...bodyPan.panHandlers}
      >
        {/* ── Drag handle ── */}
        <View {...handlePan.panHandlers} style={sheet.handleZone}>
          <View style={sheet.handle} />
        </View>

        {/* ── Scrollable content ── */}
        <ScrollView
          scrollEnabled={expanded}
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEventThrottle={8}
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
            isAtTop.current = scrollY.current <= 2;
          }}
          contentContainerStyle={sheet.scrollContent}
        >
          {/* Gear Image */}
          <View style={sheet.imageWrapper}>
            <Image source={{ uri: booking.image }} style={sheet.image} />
            <View style={[sheet.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
              <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
              <Text style={[sheet.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <View style={sheet.deliveryChip}>
              <Ionicons
                name={booking.deliveryType === "Delivered" ? "cube-outline" : "walk-outline"}
                size={12} color="#fff"
              />
              <Text style={sheet.deliveryChipText}>{booking.deliveryType}</Text>
            </View>
          </View>

          {/* Name + Price */}
          <View style={sheet.nameRow}>
            <View style={{ flex: 1 }}>
              <Text style={sheet.name}>{booking.name}</Text>
              <Text style={sheet.category}>{booking.category}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={sheet.totalPrice}>₹{total}</Text>
              <Text style={sheet.totalUnit}>{booking.days}d total</Text>
            </View>
          </View>

          {/* Order + Dates */}
          <View style={sheet.card}>
            <View style={sheet.cardRow}>
              <View style={sheet.cardIconBox}>
                <Ionicons name="receipt-outline" size={16} color="#0cadab" />
              </View>
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

          {/* Pricing */}
          <View style={sheet.card}>
            <Text style={sheet.cardTitle}>Pricing</Text>
            <View style={sheet.priceRow}>
              <Text style={sheet.priceLabel}>₹{booking.price}/day × {booking.days} day{booking.days > 1 ? "s" : ""}</Text>
              <Text style={sheet.priceVal}>₹{total}</Text>
            </View>
            <View style={sheet.priceRow}>
              <Text style={sheet.priceLabel}>Security deposit</Text>
              <Text style={sheet.priceVal}>₹{booking.deposit}</Text>
            </View>
            <View style={sheet.divider} />
            <View style={sheet.priceRow}>
              <Text style={[sheet.priceLabel, { fontWeight: "800", color: "#101720" }]}>Total Paid</Text>
              <Text style={[sheet.priceVal, { color: "#0cadab", fontSize: 17 }]}>
                ₹{total + booking.deposit}
              </Text>
            </View>
          </View>

          {/* Vendor & Delivery */}
          <View style={sheet.card}>
            <Text style={sheet.cardTitle}>Vendor & Delivery</Text>
            <View style={sheet.cardRow}>
              <View style={sheet.cardIconBox}><Ionicons name="storefront-outline" size={16} color="#8696a0" /></View>
              <Text style={sheet.cardLabel}>Vendor</Text>
              <Text style={sheet.cardValue}>{booking.vendor}</Text>
            </View>
            <View style={sheet.divider} />
            <View style={sheet.cardRow}>
              <View style={sheet.cardIconBox}><Ionicons name="call-outline" size={16} color="#8696a0" /></View>
              <Text style={sheet.cardLabel}>Phone</Text>
              <Text style={[sheet.cardValue, { color: "#0cadab" }]}>{booking.vendorPhone}</Text>
            </View>
            <View style={sheet.divider} />
            <View style={sheet.cardRow}>
              <View style={sheet.cardIconBox}><Ionicons name="location-outline" size={16} color="#8696a0" /></View>
              <Text style={sheet.cardLabel}>
                {booking.deliveryType === "Delivered" ? "Address" : "Pickup"}
              </Text>
              <Text style={[sheet.cardValue, { flex: 1, textAlign: "right" }]} numberOfLines={2}>
                {booking.deliveryAddress}
              </Text>
            </View>
          </View>

          {/* Notes */}
          {!!booking.notes && (
            <View style={sheet.notesCard}>
              <Ionicons name="information-circle-outline" size={16} color="#0cadab" />
              <Text style={sheet.notesText}>{booking.notes}</Text>
            </View>
          )}

          {/* Rating display */}
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
            <TouchableOpacity style={sheet.rateCard}>
              <View>
                <Text style={sheet.rateTitle}>How was your rental?</Text>
                <Text style={sheet.rateSub}>Tap a star to leave a review</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons key={s} name="star-outline" size={24} color="#FFC107" />
                ))}
              </View>
            </TouchableOpacity>
          )}

          {/* Actions */}
          <View style={sheet.actions}>
            {booking.status === "active" && (
              <>
                <TouchableOpacity style={sheet.actionSecondary}>
                  <Ionicons name="call-outline" size={17} color="#101720" />
                  <Text style={sheet.actionSecondaryText}>Contact</Text>
                </TouchableOpacity>
                <TouchableOpacity style={sheet.actionPrimary}>
                  <Text style={sheet.actionPrimaryText}>Extend Rental</Text>
                </TouchableOpacity>
              </>
            )}
            {booking.status === "upcoming" && (
              <>
                <TouchableOpacity style={sheet.actionDanger}>
                  <Text style={sheet.actionDangerText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={sheet.actionPrimary}>
                  <Text style={sheet.actionPrimaryText}>Modify Dates</Text>
                </TouchableOpacity>
              </>
            )}
            {booking.status === "completed" && (
              <>
                <TouchableOpacity style={sheet.actionSecondary}>
                  <Ionicons name="refresh-outline" size={17} color="#101720" />
                  <Text style={sheet.actionSecondaryText}>Rebook</Text>
                </TouchableOpacity>
                <TouchableOpacity style={sheet.actionPrimary}>
                  <Text style={sheet.actionPrimaryText}>View Receipt</Text>
                </TouchableOpacity>
              </>
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

const BookingCard = ({ item, onPress }: { item: any; onPress: (b: any) => void }) => {
  const cfg   = statusConfig[item.status];
  const total = item.price * item.days;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.91} onPress={() => onPress(item)}>
      <View style={styles.cardImageWrapper}>
        <Image source={{ uri: item.image }} style={styles.cardImage} />
        <View style={[styles.statusPill, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
          <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <View style={styles.deliveryChip}>
          <Ionicons name={item.deliveryType === "Delivered" ? "cube-outline" : "walk-outline"} size={12} color="#fff" />
          <Text style={styles.deliveryChipText}>{item.deliveryType}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.cardCategory}>{item.category}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.cardTotal}>₹{total}</Text>
            <Text style={styles.cardTotalUnit}>{item.days}d total</Text>
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
      {{ Active: "No active rentals.\nExplore gear and make your first booking!", Upcoming: "No upcoming bookings.\nPlan your next gig and reserve equipment.", Past: "No past bookings yet.\nYour rental history will appear here." }[tab]}
    </Text>
    {tab !== "Past" && (
      <TouchableOpacity style={styles.exploreBtn}>
        <LinearGradient colors={["#101720", "#1e2d3d"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.exploreBtnGrad}>
          <Text style={styles.exploreBtnText}>Browse Equipment</Text>
          <Ionicons name="arrow-forward" size={16} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    )}
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BookingsScreen() {
  const [activeTab,       setActiveTab]       = useState("Active");
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const items = mockBookings[activeTab] || [];

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f8ff" />
      <SafeAreaView style={styles.container} edges={["top"]}>
        <LinearGradient
          colors={["#f4f8ff", "#eef1f9", "#ffffff"]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={{ flex: 1 }}
        >
          {/* Top Bar */}
          <View style={styles.topBar}>
            <View>
              <Text style={styles.topBarTitle}>My Bookings</Text>
              <Text style={styles.topBarSub}>
                {mockBookings.Active.length} active · {mockBookings.Upcoming.length} upcoming
              </Text>
            </View>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="options-outline" size={20} color="#101720" />
            </TouchableOpacity>
          </View>

          {/* Summary Strip */}
          <View style={styles.strip}>
            {[
              { icon: "radio-button-on",         color: "#22c55e", value: mockBookings.Active.length,   label: "Active"   },
              { icon: "time-outline",             color: "#0cadab", value: mockBookings.Upcoming.length, label: "Upcoming" },
              { icon: "checkmark-circle-outline", color: "#8696a0",
                value: mockBookings.Past.filter((b) => b.status === "completed").length, label: "Done" },
              { icon: "wallet-outline", color: "#101720",
                value: "₹" + Object.values(mockBookings).flat()
                  .filter((b) => b.status !== "cancelled")
                  .reduce((a, b) => a + b.price * b.days, 0),
                label: "Spent" },
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
              const count = mockBookings[tab].length;
              const on    = activeTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, on && styles.tabOn]}
                  onPress={() => setActiveTab(tab)}
                  activeOpacity={0.8}
                >
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
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {items.length === 0 ? (
              <EmptyState tab={activeTab} />
            ) : (
              items.map((item) => (
                <BookingCard key={item.id} item={item} onPress={setSelectedBooking} />
              ))
            )}

            {activeTab === "Past" && items.length > 0 && (
              <TouchableOpacity style={styles.promoStrip} activeOpacity={0.88}>
                <LinearGradient
                  colors={["#0cadab", "#0a9998"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.promoGrad}
                >
                  <View>
                    <Text style={styles.promoTitle}>Planning another gig? 🎶</Text>
                    <Text style={styles.promoSub}>Browse 500+ pieces of gear available near you</Text>
                  </View>
                  <View style={styles.promoArrow}>
                    <Ionicons name="arrow-forward" size={18} color="#0cadab" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>

      {selectedBooking && (
        <BookingBottomSheet
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </>
  );
}

// ─── Sheet Styles ─────────────────────────────────────────────────────────────

const sheet = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(16,23,32,0.46)" },
  panel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    height: FULL_HEIGHT,          // fixed — never animated
    backgroundColor: "#fff",
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 1, borderBottomWidth: 0, borderColor: "#eef0f3",
    overflow: "hidden",
  },

  handleZone: { paddingTop: 12, paddingBottom: 6, alignItems: "center", gap: 5 },
  handle: { width: 60, height: 4, borderRadius: 2, backgroundColor: "#d1d5db" },
  expandHint: { flexDirection: "row", alignItems: "center", gap: 5 },
  expandHintText: { fontSize: 11, color: "#0cadab", fontWeight: "600" },

  scrollContent: { paddingBottom: 16 },

  imageWrapper: { position: "relative", marginHorizontal: 16, marginBottom: 14, borderRadius: 20, overflow: "hidden" },
  image: { width: "100%", height: 196, backgroundColor: "#e5e7eb" },
  statusPill: { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statusPillText: { fontSize: 12, fontWeight: "700" },
  deliveryChip: { position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: "rgba(16,23,32,0.72)" },
  deliveryChipText: { fontSize: 11, fontWeight: "700", color: "#fff" },

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

  priceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  priceLabel: { fontSize: 13, color: "#8696a0", fontWeight: "600" },
  priceVal: { fontSize: 14, fontWeight: "700", color: "#101720" },

  notesCard: { marginHorizontal: 16, marginBottom: 12, flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: "#f0fafa", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#d0f0ef" },
  notesText: { flex: 1, fontSize: 13, color: "#4b6585", fontWeight: "500", lineHeight: 19 },

  rateCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: "#fffbeb", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#fde68a", gap: 10 },
  rateTitle: { fontSize: 14, fontWeight: "800", color: "#101720" },
  rateSub: { fontSize: 12, color: "#8696a0", fontWeight: "500" },

  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 4 },
  actionPrimary: { flex: 1, backgroundColor: "#101720", borderRadius: 16, paddingVertical: 15, alignItems: "center", justifyContent: "center" },
  actionPrimaryText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  actionSecondary: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#f4f8ff", borderRadius: 16, paddingVertical: 15, borderWidth: 1, borderColor: "#eef0f3" },
  actionSecondaryText: { fontSize: 15, fontWeight: "700", color: "#101720" },
  actionDanger: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fef2f2", borderRadius: 16, paddingVertical: 15, borderWidth: 1, borderColor: "#fecaca" },
  actionDangerText: { fontSize: 15, fontWeight: "700", color: "#ef4444" },
});

// ─── Screen Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f8ff" },

  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  topBarTitle: { fontSize: 22, fontWeight: "800", color: "#101720", letterSpacing: -0.4 },
  topBarSub: { fontSize: 12, color: "#8696a0", fontWeight: "500", marginTop: 2 },
  iconBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#eef0f3" },

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
  tabBadge: { backgroundColor: "#eef0f3", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: "center" },
  tabBadgeOn: { backgroundColor: "rgba(255,255,255,0.18)" },
  tabBadgeText: { fontSize: 11, fontWeight: "800", color: "#8696a0" },
  tabBadgeTextOn: { color: "#fff" },

  list: { paddingHorizontal: 20 },

  card: { backgroundColor: "#fff", borderRadius: 22, overflow: "hidden", marginBottom: 14, borderWidth: 1, borderColor: "#eef0f3" },
  cardImageWrapper: { position: "relative" },
  cardImage: { width: "100%", height: 176, backgroundColor: "#e5e7eb" },
  statusPill: { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statusPillText: { fontSize: 12, fontWeight: "700" },
  deliveryChip: { position: "absolute", top: 12, right: 12, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: "rgba(16,23,32,0.72)" },
  deliveryChipText: { fontSize: 11, fontWeight: "700", color: "#fff" },

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

  tapHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 2 },
  tapHintText: { fontSize: 12, color: "#0cadab", fontWeight: "600" },

  empty: { alignItems: "center", paddingTop: 56, paddingHorizontal: 32 },
  emptyIcon: { width: 86, height: 86, borderRadius: 28, backgroundColor: "#f0fafa", justifyContent: "center", alignItems: "center", marginBottom: 18, borderWidth: 1, borderColor: "#d0f0ef" },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: "#101720", marginBottom: 8 },
  emptyMsg: { fontSize: 14, color: "#8696a0", textAlign: "center", lineHeight: 21, fontWeight: "500", marginBottom: 26 },
  exploreBtn: { borderRadius: 16, overflow: "hidden", width: "100%" },
  exploreBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 15, gap: 8 },
  exploreBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  promoStrip: { borderRadius: 18, overflow: "hidden", marginTop: 4 },
  promoGrad: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 18 },
  promoTitle: { fontSize: 15, fontWeight: "800", color: "#fff", marginBottom: 3 },
  promoSub: { fontSize: 12, color: "rgba(255,255,255,0.82)", fontWeight: "500" },
  promoArrow: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
});