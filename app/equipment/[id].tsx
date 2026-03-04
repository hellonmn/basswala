import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
  Share,
  Alert,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";

const { width } = Dimensions.get("window");
const IMG_HEIGHT = width * 0.88;

// ─── Mock Data ────────────────────────────────────────────────────────────────

const equipmentData: any = {
  "1": {
    id: "1",
    name: "Pioneer DDJ-1000",
    category: "DJ Controller",
    price: 150,
    deposit: 500,
    image: "https://www.svsound.com/cdn/shop/files/mobile-system.jpg?v=1738683786&width=2000",
    rating: 4.8,
    reviews: 124,
    available: true,
    vendor: "BeatBox Rentals",
    vendorRating: 4.9,
    deliveryTime: "Same day delivery",
    description:
      "Professional 4-channel DJ controller with premium build quality. Perfect for club performances and professional events. Features full-size jog wheels, dedicated beat FX controls, and seamless integration with major DJ software.",
    features: [
      "4-channel professional mixer",
      "High-resolution jog wheels",
      "Built-in sound card",
      "16 RGB performance pads",
      "Beat FX and Sound Color FX",
      "Compatible with Rekordbox DJ",
    ],
    specifications: {
      Channels: "4",
      Weight: "5.6 kg",
      Dimensions: "72.0 × 43.4 × 6.0 cm",
      Connectivity: "USB",
      Software: "Rekordbox DJ",
    },
    images: [
      "https://www.svsound.com/cdn/shop/files/mobile-system.jpg?v=1738683786&width=2000",
      "https://cdn.shopify.com/s/files/1/0921/3560/files/IMG_2056.jpg?197788",
      "https://i.ytimg.com/vi/z8BVzNw0ErE/maxresdefault.jpg",
    ],
    rentalTerms: [
      "Minimum rental period: 1 day",
      "Security deposit required",
      "Free delivery within 10 km",
      "Setup assistance available",
      "24/7 technical support",
    ],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const StarRating = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <View style={{ flexDirection: "row", gap: 2 }}>
    {[1, 2, 3, 4, 5].map((s) => (
      <Ionicons
        key={s}
        name={s <= Math.round(rating) ? "star" : "star-outline"}
        size={size}
        color={s <= Math.round(rating) ? "#FFC107" : "#d1d5db"}
      />
    ))}
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EquipmentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const equipment = equipmentData[params.id as string] || equipmentData["1"];

  const [imgIndex,    setImgIndex]    = useState(0);
  const [days,        setDays]        = useState(1);
  const [isFavorite,  setIsFavorite]  = useState(false);

  // Scroll-driven header opacity
  const scrollY     = useRef(new Animated.Value(0)).current;
  const headerBg    = scrollY.interpolate({ inputRange: [IMG_HEIGHT - 90, IMG_HEIGHT - 40], outputRange: [0, 1], extrapolate: "clamp" });
  const headerBgClr = headerBg.interpolate({ inputRange: [0, 1], outputRange: ["rgba(255,255,255,0)", "rgba(255,255,255,1)"] });
  const headerTitle = scrollY.interpolate({ inputRange: [IMG_HEIGHT - 80, IMG_HEIGHT - 20], outputRange: [0, 1], extrapolate: "clamp" });

  const total = equipment.price * days;

  const handleShare = async () => {
    try {
      await Share.share({ message: `Check out ${equipment.name} – ₹${equipment.price}/day on Basswala!` });
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const handleBook = () => {
    router.push({ pathname: "/booking-flow", params: { id: equipment.id, days: String(days) } });
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* ── Scrollable Body ── */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        {/* ── Hero Image Carousel ── */}
        <View style={styles.hero}>
          <ScrollView
            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
            onScroll={(e) => setImgIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
            scrollEventThrottle={16}
          >
            {equipment.images.map((uri: string, i: number) => (
              <Image key={i} source={{ uri }} style={styles.heroImg} resizeMode="cover" />
            ))}
          </ScrollView>

          {/* Gradient fade at bottom of image */}
          <LinearGradient
            colors={["transparent", "rgba(244,248,255,0.7)", "#f4f8ff"]}
            style={styles.heroFade}
            pointerEvents="none"
          />

          {/* Dot indicators */}
          <View style={styles.dots}>
            {equipment.images.map((_: any, i: number) => (
              <View key={i} style={[styles.dot, i === imgIndex && styles.dotActive]} />
            ))}
          </View>

          {/* Availability pill */}
          <View style={[styles.availPill, !equipment.available && styles.availPillOff]}>
            <View style={[styles.availDot, !equipment.available && styles.availDotOff]} />
            <Text style={styles.availText}>{equipment.available ? "Available Now" : "Unavailable"}</Text>
          </View>

          {/* Thumbnail row */}
          <View style={styles.thumbRow}>
            {equipment.images.map((uri: string, i: number) => (
              <TouchableOpacity
                key={i}
                style={[styles.thumb, i === imgIndex && styles.thumbActive]}
                activeOpacity={0.85}
              >
                <Image source={{ uri }} style={styles.thumbImg} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Content ── */}
        <View style={styles.content}>

          {/* Category + Title + Rating */}
          <View style={styles.titleBlock}>
            <View style={styles.catPill}>
              <Text style={styles.catPillText}>{equipment.category.toUpperCase()}</Text>
            </View>
            <Text style={styles.title}>{equipment.name}</Text>
            <View style={styles.ratingRow}>
              <StarRating rating={equipment.rating} size={15} />
              <Text style={styles.ratingNum}>{equipment.rating}</Text>
              <Text style={styles.ratingReviews}>· {equipment.reviews} reviews</Text>
            </View>
          </View>

          {/* Vendor row */}
          <View style={styles.vendorCard}>
            <View style={styles.vendorIconBox}>
              <Ionicons name="storefront-outline" size={20} color="#0cadab" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vendorName}>{equipment.vendor}</Text>
              <View style={styles.vendorMeta}>
                <Ionicons name="star" size={12} color="#FFC107" />
                <Text style={styles.vendorRating}>{equipment.vendorRating}</Text>
                <Text style={styles.vendorDot}>·</Text>
                <Text style={styles.vendorDelivery}>{equipment.deliveryTime}</Text>
              </View>
            </View>
            <View style={styles.vendorCallBtn}>
              <Ionicons name="call-outline" size={18} color="#0cadab" />
            </View>
          </View>

          {/* ── Pricing + Day Selector ── */}
          <View style={styles.pricingCard}>
            {/* Left: price */}
            <View style={{ flex: 1 }}>
              <Text style={styles.pricingLabel}>RENTAL PRICE</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                <Text style={styles.priceBig}>₹{equipment.price}</Text>
                <Text style={styles.priceUnit}>/day</Text>
              </View>
              <Text style={styles.depositHint}>+ ₹{equipment.deposit} deposit</Text>
            </View>

            {/* Right: day selector */}
            <View style={styles.daySel}>
              <Text style={styles.daySelLabel}>DAYS</Text>
              <View style={styles.daySelControls}>
                <TouchableOpacity
                  style={[styles.dayBtn, days <= 1 && styles.dayBtnOff]}
                  onPress={() => setDays((d) => Math.max(1, d - 1))}
                  activeOpacity={0.8}
                >
                  <Ionicons name="remove" size={18} color={days <= 1 ? "#c4c9d0" : "#fff"} />
                </TouchableOpacity>
                <Text style={styles.dayNum}>{days}</Text>
                <TouchableOpacity style={styles.dayBtn} onPress={() => setDays((d) => d + 1)} activeOpacity={0.8}>
                  <Ionicons name="add" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Total banner */}
          <LinearGradient colors={["#0cadab", "#0a9998"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.totalBanner}>
            <View>
              <Text style={styles.totalLabel}>TOTAL FOR {days} DAY{days > 1 ? "S" : ""}</Text>
              <Text style={styles.totalAmount}>₹{total}</Text>
            </View>
            <View style={styles.totalRight}>
              <Text style={styles.totalDeposit}>Deposit</Text>
              <Text style={styles.totalDepositAmt}>₹{equipment.deposit}</Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalRight}>
              <Text style={styles.totalDeposit}>Grand Total</Text>
              <Text style={[styles.totalDepositAmt, { fontSize: 18, fontWeight: "800" }]}>₹{total + equipment.deposit}</Text>
            </View>
          </LinearGradient>

          {/* ── Description ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.descCard}>
              <Text style={styles.descText}>{equipment.description}</Text>
            </View>
          </View>

          {/* ── Features ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Features</Text>
            <View style={styles.infoCard}>
              {equipment.features.map((f: string, i: number) => (
                <View key={i}>
                  <View style={styles.featureRow}>
                    <View style={styles.featureIconBox}>
                      <Ionicons name="checkmark" size={14} color="#0cadab" />
                    </View>
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                  {i < equipment.features.length - 1 && <View style={styles.rowDivider} />}
                </View>
              ))}
            </View>
          </View>

          {/* ── Specifications ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Specifications</Text>
            <View style={styles.infoCard}>
              {Object.entries(equipment.specifications).map(([k, v]: any, i, arr) => (
                <View key={k}>
                  <View style={styles.specRow}>
                    <Text style={styles.specKey}>{k}</Text>
                    <Text style={styles.specVal}>{v}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={styles.rowDivider} />}
                </View>
              ))}
            </View>
          </View>

          {/* ── Rental Terms ── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rental Terms</Text>
            <View style={styles.infoCard}>
              {equipment.rentalTerms.map((t: string, i: number) => (
                <View key={i}>
                  <View style={styles.termRow}>
                    <View style={styles.termIconBox}>
                      <Ionicons name="information-circle-outline" size={16} color="#0cadab" />
                    </View>
                    <Text style={styles.termText}>{t}</Text>
                  </View>
                  {i < equipment.rentalTerms.length - 1 && <View style={styles.rowDivider} />}
                </View>
              ))}
            </View>
          </View>

          <View style={{ height: 120 }} />
        </View>
      </Animated.ScrollView>

      {/* ── Floating Header (scroll-aware) ── */}
      <SafeAreaView edges={["top"]} style={styles.headerWrap} pointerEvents="box-none">
        <Animated.View style={[styles.headerInner, { backgroundColor: headerBgClr }]}>
          {/* Back */}
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color="#101720" />
          </TouchableOpacity>

          {/* Title fades in after hero scrolls off */}
          <Animated.Text style={[styles.headerTitleText, { opacity: headerTitle }]} numberOfLines={1}>
            {equipment.name}
          </Animated.Text>

          {/* Actions */}
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn} onPress={handleShare} activeOpacity={0.8}>
              <Ionicons name="share-social-outline" size={22} color="#101720" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setIsFavorite((f) => !f)} activeOpacity={0.8}>
              <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={22} color={isFavorite ? "#ef4444" : "#101720"} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>

      {/* ── Bottom Action Bar ── */}
      <SafeAreaView edges={["bottom"]} style={styles.bottomWrap}>
        <View style={styles.bottomBar}>
          {/* Cart button */}
          <TouchableOpacity style={styles.cartBtn} activeOpacity={0.8} disabled={!equipment.available}>
            <Ionicons name="cart-outline" size={22} color={equipment.available ? "#101720" : "#c4c9d0"} />
          </TouchableOpacity>

          {/* Book Now */}
          <TouchableOpacity
            style={[styles.bookBtn, !equipment.available && styles.bookBtnOff]}
            onPress={handleBook}
            disabled={!equipment.available}
            activeOpacity={0.88}
          >
            <View>
              <Text style={styles.bookBtnLabel}>
                {equipment.available ? "Book Now" : "Unavailable"}
              </Text>
              {equipment.available && (
                <Text style={styles.bookBtnSub}>₹{total} · {days} day{days > 1 ? "s" : ""}</Text>
              )}
            </View>
            {equipment.available && (
              <View style={styles.bookArrow}>
                <Ionicons name="arrow-forward" size={18} color="#101720" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f4f8ff" },

  // Hero
  hero: { position: "relative" },
  heroImg: { width, height: IMG_HEIGHT, backgroundColor: "#e5e7eb" },
  heroFade: { position: "absolute", bottom: 0, left: 0, right: 0, height: 120 },

  dots: { position: "absolute", bottom: 80, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(16,23,32,0.22)" },
  dotActive: { width: 24, backgroundColor: "#101720" },

  availPill: {
    position: "absolute", top: 56, left: 20,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: "#d0f0ef",
  },
  availPillOff: { borderColor: "#e5e7eb" },
  availDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
  availDotOff: { backgroundColor: "#d1d5db" },
  availText: { fontSize: 12, fontWeight: "700", color: "#101720" },

  thumbRow: {
    position: "absolute", bottom: 16, left: 0, right: 0,
    flexDirection: "row", justifyContent: "center", gap: 8,
  },
  thumb: { width: 48, height: 48, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: "rgba(255,255,255,0.5)" },
  thumbActive: { borderColor: "#0cadab", borderWidth: 2.5 },
  thumbImg: { width: "100%", height: "100%" },

  // Content
  content: { backgroundColor: "#f4f8ff", paddingTop: 4 },

  // Title block
  titleBlock: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  catPill: {
    alignSelf: "flex-start",
    backgroundColor: "#f0fafa", borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: "#d0f0ef", marginBottom: 10,
  },
  catPillText: { fontSize: 9, fontWeight: "800", color: "#0cadab", letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: "800", color: "#101720", letterSpacing: -0.6, lineHeight: 32, marginBottom: 10 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingNum: { fontSize: 15, fontWeight: "700", color: "#101720" },
  ratingReviews: { fontSize: 13, color: "#8696a0", fontWeight: "500" },

  // Vendor
  vendorCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: 20, marginBottom: 16,
    backgroundColor: "#fff", borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: "#eef0f3",
  },
  vendorIconBox: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#f0fafa", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#d0f0ef" },
  vendorName: { fontSize: 14, fontWeight: "700", color: "#101720", marginBottom: 3 },
  vendorMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  vendorRating: { fontSize: 12, fontWeight: "700", color: "#101720" },
  vendorDot: { color: "#c4c9d0", fontSize: 12 },
  vendorDelivery: { fontSize: 12, color: "#8696a0", fontWeight: "500" },
  vendorCallBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#f0fafa", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#d0f0ef" },

  // Pricing card
  pricingCard: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 20, marginBottom: 12,
    backgroundColor: "#fff", borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: "#eef0f3",
  },
  pricingLabel: { fontSize: 9, fontWeight: "700", color: "#8696a0", letterSpacing: 0.8, marginBottom: 4 },
  priceBig: { fontSize: 34, fontWeight: "800", color: "#101720", letterSpacing: -1 },
  priceUnit: { fontSize: 15, color: "#8696a0", fontWeight: "600" },
  depositHint: { fontSize: 11, color: "#8696a0", fontWeight: "500", marginTop: 3 },

  daySel: { alignItems: "center", gap: 6 },
  daySelLabel: { fontSize: 9, fontWeight: "700", color: "#8696a0", letterSpacing: 0.8 },
  daySelControls: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#f4f8ff", borderRadius: 16, padding: 5 },
  dayBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#101720", justifyContent: "center", alignItems: "center" },
  dayBtnOff: { backgroundColor: "#eef0f3" },
  dayNum: { fontSize: 20, fontWeight: "800", color: "#101720", minWidth: 28, textAlign: "center" },

  // Total banner
  totalBanner: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 20, marginBottom: 24,
    borderRadius: 18, paddingHorizontal: 18, paddingVertical: 16,
    gap: 0,
  },
  totalLabel: { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.75)", letterSpacing: 0.8, marginBottom: 3 },
  totalAmount: { fontSize: 26, fontWeight: "800", color: "#fff", letterSpacing: -0.8, flex: 1 },
  totalRight: { alignItems: "flex-end" },
  totalDeposit: { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.75)", letterSpacing: 0.6, marginBottom: 2 },
  totalDepositAmt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  totalDivider: { width: 1, height: 36, backgroundColor: "rgba(255,255,255,0.25)", marginHorizontal: 14 },

  // Sections
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: "#101720", letterSpacing: -0.4, marginBottom: 12 },

  descCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#eef0f3" },
  descText: { fontSize: 14, lineHeight: 23, color: "#4b6585", fontWeight: "500" },

  infoCard: { backgroundColor: "#fff", borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: "#eef0f3" },
  rowDivider: { height: 1, backgroundColor: "#f4f8ff", marginHorizontal: 16 },

  // Feature rows
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  featureIconBox: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#f0fafa", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#d0f0ef" },
  featureText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#101720" },

  // Spec rows
  specRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  specKey: { fontSize: 14, color: "#8696a0", fontWeight: "600" },
  specVal: { fontSize: 14, fontWeight: "700", color: "#101720" },

  // Term rows
  termRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  termIconBox: { width: 28, height: 28, borderRadius: 9, backgroundColor: "#f0fafa", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#d0f0ef", marginTop: 1 },
  termText: { flex: 1, fontSize: 14, color: "#4b6585", fontWeight: "500", lineHeight: 21 },

  // Floating header
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 },
  headerInner: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  headerBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.88)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(238,240,243,0.7)",
  },
  headerTitleText: { flex: 1, fontSize: 16, fontWeight: "800", color: "#101720", letterSpacing: -0.3 },
  headerActions: { flexDirection: "row", gap: 8 },

  // Bottom bar
  bottomWrap: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#eef0f3" },
  bottomBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, gap: 12,
  },
  cartBtn: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: "#f4f8ff",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "#eef0f3",
  },
  bookBtn: {
    flex: 1, height: 52, borderRadius: 16,
    backgroundColor: "#101720",
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18,
  },
  bookBtnOff: { backgroundColor: "#e5e7eb" },
  bookBtnLabel: { fontSize: 16, fontWeight: "800", color: "#fff" },
  bookBtnSub: { fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: "500", marginTop: 1 },
  bookArrow: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.12)", justifyContent: "center", alignItems: "center" },
});