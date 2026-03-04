import LocationBottomSheet from "@/components/LocationBottomSheet";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width * 0.72;

// ─── Mock Data ────────────────────────────────────────────────────────────────

const categories = [
  { id: "1", name: "All",         icon: "grid-outline"        },
  { id: "2", name: "Controllers", icon: "radio-outline"        },
  { id: "3", name: "Speakers",    icon: "volume-high-outline"  },
  { id: "4", name: "Mixers",      icon: "options-outline"      },
  { id: "5", name: "Lights",      icon: "bulb-outline"         },
  { id: "6", name: "Mics",        icon: "mic-outline"          },
];

const featuredEquipment = [
  {
    id: "1",
    name: "Pioneer DDJ-1000",
    category: "DJ Controller",
    price: 150,
    image: "https://www.svsound.com/cdn/shop/files/mobile-system.jpg?v=1738683786&width=2000",
    rating: 4.8,
    reviews: 124,
    available: true,
    tag: "Top Pick",
  },
  {
    id: "2",
    name: "Technics SL-1200",
    category: "Turntable",
    price: 100,
    image: "https://cdn.shopify.com/s/files/1/0921/3560/files/IMG_2056.jpg?197788",
    rating: 4.9,
    reviews: 98,
    available: true,
    tag: "Fan Favourite",
  },
  {
    id: "3",
    name: "JBL EON615",
    category: "Speaker System",
    price: 80,
    image: "https://i.ytimg.com/vi/z8BVzNw0ErE/maxresdefault.jpg",
    rating: 4.7,
    reviews: 156,
    available: false,
    tag: null,
  },
];

const popularEquipment = [
  { id: "4", name: "Allen & Heath Xone:96", category: "Professional Mixer",  price: 120, image: "https://via.placeholder.com/120x120", rating: 4.9 },
  { id: "5", name: "Shure SM58",            category: "Vocal Microphone",    price: 30,  image: "https://via.placeholder.com/120x120", rating: 4.8 },
  { id: "6", name: "Chauvet DJ Intimidator",category: "Moving Head Light",   price: 60,  image: "https://via.placeholder.com/120x120", rating: 4.6 },
  { id: "7", name: "Yamaha HS8",            category: "Studio Monitor",      price: 90,  image: "https://via.placeholder.com/120x120", rating: 4.7 },
];

// Quick stats shown in trust bar
const trustStats = [
  { label: "Items",     value: "500+", icon: "cube-outline"          },
  { label: "Cities",    value: "12",   icon: "location-outline"      },
  { label: "Reviews",   value: "4.9★", icon: "star-outline"          },
  { label: "Bookings",  value: "10K+", icon: "calendar-outline"      },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user } = useAuth();
  const { location } = useLocation();
  const router = useRouter();

  const [selectedCategory, setSelectedCategory] = useState("1");
  const [isLocationSheetVisible, setIsLocationSheetVisible] = useState(false);

  const lottieRef = useRef<LottieView>(null);
  const [shouldPlay, setShouldPlay] = useState(true);

  const searchTranslateY = useRef(new Animated.Value(0)).current;
  const searchScale    = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!shouldPlay) {
      const timer = setTimeout(() => {
        setShouldPlay(true);
        lottieRef.current?.play();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [shouldPlay]);

  const handleSearchPress = () => {
    Animated.parallel([
      Animated.timing(searchTranslateY, { toValue: -200, duration: 400, useNativeDriver: true }),
      Animated.timing(searchScale,      { toValue: 0.95,  duration: 400, useNativeDriver: true }),
      Animated.timing(overlayOpacity,   { toValue: 1,     duration: 300, useNativeDriver: true }),
      Animated.timing(contentOpacity,   { toValue: 0,     duration: 300, useNativeDriver: true }),
    ]).start(() => {
      router.push("/explore");
      setTimeout(() => {
        searchTranslateY.setValue(0);
        searchScale.setValue(1);
        overlayOpacity.setValue(0);
        contentOpacity.setValue(1);
      }, 100);
    });
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f8ff" />
      <SafeAreaView style={styles.container} edges={["top"]}>
        <LinearGradient
          colors={["#f4f8ff", "#eef1f9", "#ffffff"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{ flex: 1 }}
        >
          <Animated.View style={[styles.contentContainer, { opacity: contentOpacity }]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* ── Header ── */}
              <View style={styles.header}>
                <Link href="/(tabs)/index" asChild>
                  <TouchableOpacity style={styles.avatarButton}>
                    <Image
                      source={require("../../assets/images/profile.webp")}
                      style={styles.avatarImage}
                    />
                    {/* Online dot */}
                    <View style={styles.avatarOnlineDot} />
                  </TouchableOpacity>
                </Link>

                <TouchableOpacity
                  style={styles.locationSection}
                  onPress={() => setIsLocationSheetVisible(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.locationLabel}>LOCATION</Text>
                  <View style={styles.locationRow}>
                    <Ionicons name="location" size={15} color="#0cadab" />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {location?.area || location?.city || "Select Location"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#8696a0" />
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.notifButton}>
                  <Ionicons name="notifications-outline" size={22} color="#101720" />
                  <View style={styles.notifBadge} />
                </TouchableOpacity>
              </View>

              {/* ── Greeting ── */}
              <View style={styles.greetingSection}>
                <Text style={styles.greetingText}>
                  Hey {user?.name?.split(" ")[0] || "DJ"} 👋
                </Text>
                <Text style={styles.greetingSubText}>
                  What gear do you need today?
                </Text>
              </View>

              {/* ── Search Bar ── */}
              <Animated.View
                style={[
                  styles.searchSection,
                  { transform: [{ translateY: searchTranslateY }, { scale: searchScale }] },
                ]}
              >
                <TouchableOpacity
                  style={styles.searchContainer}
                  activeOpacity={0.88}
                  onPress={handleSearchPress}
                >
                  <Ionicons name="search-outline" size={20} color="#8696a0" />
                  <Text style={styles.searchPlaceholder}>Search DJ equipment...</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.filterButton}>
                  <Ionicons name="options-outline" size={20} color="#101720" />
                </TouchableOpacity>
              </Animated.View>

              {/* ── Trust / Stats Bar ── */}
              <View style={styles.trustBar}>
                {trustStats.map((stat, i) => (
                  <View key={i} style={styles.trustItem}>
                    <Ionicons name={stat.icon as any} size={16} color="#0cadab" />
                    <Text style={styles.trustValue}>{stat.value}</Text>
                    <Text style={styles.trustLabel}>{stat.label}</Text>
                  </View>
                ))}
              </View>

              {/* ── Banner ── */}
              <View style={styles.bannerSection}>
                <LinearGradient
                  colors={["#cfe8ff", "#c5d9f7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.bannerContainer}
                >
                  <View style={styles.bannerLeft}>
                    <View style={styles.bannerBadge}>
                      <Text style={styles.bannerBadgeText}>LIMITED OFFER</Text>
                    </View>
                    <Text style={styles.bannerText}>40% off on{"\n"}first booking</Text>
                    <TouchableOpacity style={styles.bannerButton}>
                      <Text style={styles.bannerButtonText}>Book Now</Text>
                      <Ionicons name="arrow-forward" size={15} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.bannerRight}>
                    <View style={styles.lottieWrapper}>
                      <LottieView
                        ref={lottieRef}
                        source={require("../../assets/animations/banner.json")}
                        autoPlay
                        loop={false}
                        style={styles.lottieAnimation}
                        onAnimationFinish={() => setShouldPlay(false)}
                      />
                    </View>
                  </View>
                </LinearGradient>
              </View>

              {/* ── Categories ── */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Browse</Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoriesScroll}
                >
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        selectedCategory === cat.id && styles.categoryChipActive,
                      ]}
                      onPress={() => setSelectedCategory(cat.id)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={cat.icon as any}
                        size={18}
                        color={selectedCategory === cat.id ? "#fff" : "#101720"}
                      />
                      <Text
                        style={[
                          styles.categoryText,
                          selectedCategory === cat.id && styles.categoryTextActive,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* ── Featured ── */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Featured</Text>
                  <TouchableOpacity>
                    <Text style={styles.seeAll}>See All</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.featuredScroll}
                  decelerationRate="fast"
                  snapToInterval={CARD_WIDTH + 16}
                >
                  {featuredEquipment.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.featuredCard}
                      activeOpacity={0.93}
                      onPress={() => router.push(`/equipment/${item.id}`)}
                    >
                      {/* Image */}
                      <View style={styles.featuredImageWrapper}>
                        <Image source={{ uri: item.image }} style={styles.featuredImage} />

                        {/* Top row: tag + heart */}
                        <View style={styles.featuredImageOverlay}>
                          {item.tag ? (
                            <View style={styles.tagPill}>
                              <Text style={styles.tagPillText}>{item.tag}</Text>
                            </View>
                          ) : <View />}
                          <TouchableOpacity style={styles.heartButton}>
                            <Ionicons name="heart-outline" size={20} color="#fff" />
                          </TouchableOpacity>
                        </View>

                        {/* Availability chip */}
                        <View style={[styles.availabilityChip, !item.available && styles.availabilityChipUnavailable]}>
                          <View style={[styles.availabilityDot, !item.available && styles.availabilityDotUnavailable]} />
                          <Text style={styles.availabilityText}>
                            {item.available ? "Available" : "Unavailable"}
                          </Text>
                        </View>
                      </View>

                      {/* Info */}
                      <View style={styles.featuredInfo}>
                        <View style={styles.featuredRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.equipmentName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.equipmentCategory}>{item.category}</Text>
                          </View>
                          <View style={styles.priceBlock}>
                            <Text style={styles.priceAmount}>₹{item.price}</Text>
                            <Text style={styles.priceUnit}>/day</Text>
                          </View>
                        </View>

                        <View style={styles.featuredMeta}>
                          <View style={styles.ratingRow}>
                            <Ionicons name="star" size={13} color="#FFC107" />
                            <Text style={styles.ratingText}>{item.rating}</Text>
                            <Text style={styles.reviewsText}>({item.reviews})</Text>
                          </View>
                          <TouchableOpacity
                            style={[styles.bookButton, !item.available && styles.bookButtonDisabled]}
                            disabled={!item.available}
                          >
                            <Text style={styles.bookButtonText}>
                              {item.available ? "Book Now" : "Unavailable"}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* ── How It Works ── */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>How It Works</Text>
                </View>
                <View style={styles.howItWorksRow}>
                  {[
                    { step: "1", icon: "search-outline",     label: "Browse\nGear"      },
                    { step: "2", icon: "calendar-outline",   label: "Pick\nDates"       },
                    { step: "3", icon: "cube-outline",       label: "Get\nDelivered"    },
                    { step: "4", icon: "musical-notes-outline", label: "Drop\nThe Beat" },
                  ].map((s, i) => (
                    <View key={i} style={styles.howStep}>
                      <View style={styles.howIconCircle}>
                        <Ionicons name={s.icon as any} size={20} color="#0cadab" />
                      </View>
                      <Text style={styles.howLabel}>{s.label}</Text>
                      {i < 3 && <View style={styles.howConnector} />}
                    </View>
                  ))}
                </View>
              </View>

              {/* ── Popular Rentals ── */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Popular Rentals</Text>
                    <Text style={styles.sectionSub}>Most booked this week</Text>
                  </View>
                  <TouchableOpacity style={styles.seeAllBtn}>
                    <Text style={styles.seeAll}>See All</Text>
                    <Ionicons name="arrow-forward" size={13} color="#0cadab" />
                  </TouchableOpacity>
                </View>

                {/* Top card — wide hero */}
                <TouchableOpacity
                  style={styles.popularHeroCard}
                  activeOpacity={0.92}
                  onPress={() => router.push(`/equipment/${popularEquipment[0].id}`)}
                >
                  <Image source={{ uri: popularEquipment[0].image }} style={styles.popularHeroImg} />
                  {/* Dark gradient overlay */}
                  <LinearGradient
                    colors={["transparent", "rgba(16,23,32,0.82)"]}
                    style={styles.popularHeroOverlay}
                  />
                  {/* Rank badge */}
                  <View style={styles.popularRankBadge}>
                    <Text style={styles.popularRankText}>#1</Text>
                  </View>
                  {/* Bottom content */}
                  <View style={styles.popularHeroContent}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.popularHeroCat}>{popularEquipment[0].category.toUpperCase()}</Text>
                      <Text style={styles.popularHeroName} numberOfLines={1}>{popularEquipment[0].name}</Text>
                      <View style={styles.popularHeroMeta}>
                        <Ionicons name="star" size={12} color="#FFC107" />
                        <Text style={styles.popularHeroRating}>{popularEquipment[0].rating}</Text>
                        <View style={styles.popularHeroDot} />
                        <Text style={styles.popularHeroPrice}>₹{popularEquipment[0].price}/day</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.popularHeroBookBtn}>
                      <Ionicons name="add" size={20} color="#101720" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>

                {/* Bottom row — 3 smaller cards */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.popularRowScroll}
                >
                  {popularEquipment.slice(1).map((item, idx) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.popularSmallCard}
                      activeOpacity={0.92}
                      onPress={() => router.push(`/equipment/${item.id}`)}
                    >
                      <Image source={{ uri: item.image }} style={styles.popularSmallImg} />
                      <LinearGradient
                        colors={["transparent", "rgba(16,23,32,0.78)"]}
                        style={styles.popularSmallOverlay}
                      />
                      {/* Rank badge */}
                      <View style={[styles.popularRankBadge, styles.popularRankBadgeSmall]}>
                        <Text style={styles.popularRankText}>#{idx + 2}</Text>
                      </View>
                      <View style={styles.popularSmallContent}>
                        <Text style={styles.popularSmallCat} numberOfLines={1}>{item.category.toUpperCase()}</Text>
                        <Text style={styles.popularSmallName} numberOfLines={1}>{item.name}</Text>
                        <View style={styles.popularSmallFooter}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                            <Ionicons name="star" size={10} color="#FFC107" />
                            <Text style={styles.popularSmallRating}>{item.rating}</Text>
                          </View>
                          <Text style={styles.popularSmallPrice}>₹{item.price}/d</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* ── Promo Strip ── */}
              <View style={styles.promoStrip}>
                <LinearGradient
                  colors={["#0cadab", "#0a9998"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.promoGradient}
                >
                  <View>
                    <Text style={styles.promoTitle}>Become a Lister</Text>
                    <Text style={styles.promoSub}>Earn by renting out your equipment</Text>
                  </View>
                  <TouchableOpacity style={styles.promoBtn}>
                    <Text style={styles.promoBtnText}>List Now</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>

              <View style={{ height: 120 }} />
            </ScrollView>
          </Animated.View>

          {/* Transition overlay — soft white, no black */}
          <Animated.View
            style={[styles.transitionOverlay, { opacity: overlayOpacity }]}
            pointerEvents="none"
          />
        </LinearGradient>
      </SafeAreaView>

      <LocationBottomSheet
        isVisible={isLocationSheetVisible}
        onClose={() => setIsLocationSheetVisible(false)}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f8ff" },
  contentContainer: { flex: 1 },
  scrollContent: { paddingBottom: 120 },

  // Transition overlay — soft white instead of dark
  transitionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#f4f8ff",
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  avatarButton: { position: "relative" },
  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#e5e7eb",
  },
  avatarOnlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: "#f4f8ff",
  },
  locationSection: {
    flex: 1,
    alignItems: "center",
  },
  locationLabel: {
    fontSize: 9,
    color: "#8696a0",
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#101720",
    maxWidth: width - 220,
  },
  notifButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  notifBadge: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#0cadab",
    borderWidth: 1.5,
    borderColor: "#fff",
  },

  // ── Greeting ────────────────────────────────────────────────────────────────
  greetingSection: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
  },
  greetingText: {
    fontSize: 26,
    fontWeight: "800",
    color: "#101720",
    letterSpacing: -0.5,
  },
  greetingSubText: {
    fontSize: 14,
    color: "#8696a0",
    fontWeight: "500",
    marginTop: 2,
  },

  // ── Search ──────────────────────────────────────────────────────────────────
  searchSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 10,
    zIndex: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#eef0f3",
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: "#8696a0",
    fontWeight: "400",
  },
  filterButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eef0f3",
  },

  // ── Trust Bar ───────────────────────────────────────────────────────────────
  trustBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#eef0f3",
  },
  trustItem: { alignItems: "center", gap: 3, flex: 1 },
  trustValue: { fontSize: 14, fontWeight: "800", color: "#101720" },
  trustLabel: { fontSize: 10, color: "#8696a0", fontWeight: "600" },

  // ── Banner ──────────────────────────────────────────────────────────────────
  bannerSection: { paddingHorizontal: 20, marginBottom: 28 },
  bannerContainer: {
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    height: 156,
    paddingHorizontal: 22,
    overflow: "hidden",
  },
  bannerLeft: { flex: 1, gap: 10, zIndex: 2 },
  bannerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bannerBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#0cadab",
    letterSpacing: 0.8,
  },
  bannerText: {
    fontSize: 21,
    fontWeight: "800",
    color: "#101720",
    lineHeight: 27,
  },
  bannerButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#101720",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 50,
    gap: 6,
  },
  bannerButtonText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  bannerRight: { flex: 1, alignItems: "flex-end", justifyContent: "center" },
  lottieWrapper: {
    position: "absolute",
    right: -42,
    top: -110,
    width: 190,
    height: 190,
  },
  lottieAnimation: { width: "100%", height: "100%" },

  // ── Section ─────────────────────────────────────────────────────────────────
  section: { marginBottom: 28 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#101720",
    letterSpacing: -0.4,
  },
  seeAll: { fontSize: 14, color: "#0cadab", fontWeight: "600" },

  // ── Categories ──────────────────────────────────────────────────────────────
  categoriesScroll: { paddingHorizontal: 20, gap: 8 },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#fff",
    gap: 6,
    borderWidth: 1,
    borderColor: "#eef0f3",
  },
  categoryChipActive: { backgroundColor: "#101720", borderColor: "#101720" },
  categoryText: { fontSize: 14, color: "#101720", fontWeight: "600" },
  categoryTextActive: { color: "#fff" },

  // ── Featured ────────────────────────────────────────────────────────────────
  featuredScroll: { paddingHorizontal: 20, gap: 16 },
  featuredCard: {
    width: CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#eef0f3",
  },
  featuredImageWrapper: { position: "relative" },
  featuredImage: {
    width: "100%",
    height: 200,
    backgroundColor: "#e5e7eb",
  },
  featuredImageOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tagPill: {
    backgroundColor: "#0cadab",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagPillText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  heartButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  availabilityChip: {
    position: "absolute",
    bottom: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  availabilityChipUnavailable: { backgroundColor: "rgba(240,240,240,0.92)" },
  availabilityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#22c55e",
  },
  availabilityDotUnavailable: { backgroundColor: "#d1d5db" },
  availabilityText: { fontSize: 11, fontWeight: "700", color: "#101720" },

  featuredInfo: { padding: 14 },
  featuredRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  equipmentName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#101720",
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  equipmentCategory: { fontSize: 13, color: "#8696a0", fontWeight: "500" },
  priceBlock: { alignItems: "flex-end" },
  priceAmount: { fontSize: 22, fontWeight: "800", color: "#101720", letterSpacing: -0.5 },
  priceUnit: { fontSize: 11, color: "#8696a0", fontWeight: "500" },

  featuredMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingText: { fontSize: 13, fontWeight: "700", color: "#101720" },
  reviewsText: { fontSize: 12, color: "#8696a0" },

  bookButton: {
    backgroundColor: "#0cadab",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  bookButtonDisabled: { backgroundColor: "#e5e7eb" },
  bookButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // ── How It Works ────────────────────────────────────────────────────────────
  howItWorksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    position: "relative",
    alignItems: "flex-start",
  },
  howStep: { alignItems: "center", flex: 1, position: "relative" },
  howIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#f0fafa",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d0f0ef",
    marginBottom: 8,
  },
  howLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#101720",
    textAlign: "center",
    lineHeight: 15,
  },
  howConnector: {
    position: "absolute",
    top: 24,
    right: -16,
    width: 16,
    height: 1,
    backgroundColor: "#d0f0ef",
  },

  // ── Section sub-header ───────────────────────────────────────────────────────
  sectionSub: { fontSize: 12, color: "#8696a0", fontWeight: "500", marginTop: 2 },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 4 },

  // ── Popular Rentals (redesigned) ─────────────────────────────────────────────

  // Hero wide card (rank #1)
  popularHeroCard: {
    marginHorizontal: 20,
    borderRadius: 22,
    overflow: "hidden",
    height: 200,
    position: "relative",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eef0f3",
  },
  popularHeroImg: { width: "100%", height: "100%", backgroundColor: "#e5e7eb" },
  popularHeroOverlay: { ...StyleSheet.absoluteFillObject },
  popularHeroContent: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 16,
    gap: 12,
  },
  popularHeroCat: {
    fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.65)",
    letterSpacing: 0.9, marginBottom: 4,
  },
  popularHeroName: { fontSize: 18, fontWeight: "800", color: "#fff", letterSpacing: -0.4, marginBottom: 6 },
  popularHeroMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  popularHeroRating: { fontSize: 12, fontWeight: "700", color: "#fff" },
  popularHeroDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.4)" },
  popularHeroPrice: { fontSize: 12, fontWeight: "700", color: "#0cadab" },
  popularHeroBookBtn: {
    width: 40, height: 40, borderRadius: 13,
    backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center",
  },

  // Rank badge (shared by hero + small)
  popularRankBadge: {
    position: "absolute", top: 12, left: 12,
    backgroundColor: "#101720",
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10,
  },
  popularRankBadgeSmall: { top: 10, left: 10, paddingHorizontal: 8, paddingVertical: 3 },
  popularRankText: { fontSize: 11, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },

  // Smaller horizontal-scroll cards
  popularRowScroll: { paddingHorizontal: 20, gap: 10 },
  popularSmallCard: {
    width: 148,
    height: 170,
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
    borderWidth: 1,
    borderColor: "#eef0f3",
  },
  popularSmallImg: { width: "100%", height: "100%", backgroundColor: "#e5e7eb" },
  popularSmallOverlay: { ...StyleSheet.absoluteFillObject },
  popularSmallContent: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    padding: 12,
  },
  popularSmallCat: { fontSize: 8, fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: 0.7, marginBottom: 3 },
  popularSmallName: { fontSize: 13, fontWeight: "800", color: "#fff", letterSpacing: -0.3, marginBottom: 5 },
  popularSmallFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  popularSmallRating: { fontSize: 11, fontWeight: "700", color: "#fff" },
  popularSmallPrice: { fontSize: 11, fontWeight: "700", color: "#0cadab" },

  // ── Promo Strip ─────────────────────────────────────────────────────────────
  promoStrip: { marginHorizontal: 20, borderRadius: 20, overflow: "hidden" },
  promoGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  promoTitle: { fontSize: 17, fontWeight: "800", color: "#fff", marginBottom: 3 },
  promoSub: { fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: "500" },
  promoBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  promoBtnText: { fontSize: 13, fontWeight: "700", color: "#0cadab" },
});