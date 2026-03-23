/**
 * explore.tsx — Dynamic version using real DJ data from backend
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, TextInput, Dimensions, StatusBar, FlatList, Animated, BackHandler,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { apiService } from "../../services/api";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = (width - 52) / 2;

// ─── DJ → Equipment mapper ────────────────────────────────────────────────────

interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  price: number;
  image: string;
  rating: number;
  reviews: number;
  available: boolean;
  genres?: string[];
  locationCity?: string;
}

function mapDJToEquipment(dj: any): EquipmentItem {
  const genres = Array.isArray(dj.genres) ? dj.genres : [];
  const primaryGenre = genres[0] || "DJ Service";

  // Map genre to category
  let categoryId = "djs";
  const genreLower = primaryGenre.toLowerCase();
  if (genreLower.includes("bollywood") || genreLower.includes("hindi")) categoryId = "bollywood";
  else if (genreLower.includes("edm") || genreLower.includes("house") || genreLower.includes("techno")) categoryId = "edm";
  else if (genreLower.includes("hip") || genreLower.includes("rap")) categoryId = "hiphop";
  else if (genreLower.includes("lounge") || genreLower.includes("jazz")) categoryId = "lounge";

  const images = Array.isArray(dj.images) && dj.images.length > 0 ? dj.images : [];
  const image = images[0] || "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=400&q=80";

  return {
    id: String(dj.id),
    name: dj.name,
    category: genres.slice(0, 2).join(" / ") || "DJ",
    categoryId,
    price: Math.round(dj.hourlyRate || 0),
    image,
    rating: parseFloat(dj.ratingAverage) || 0,
    reviews: dj.ratingCount || 0,
    available: dj.isAvailable !== false,
    genres,
    locationCity: dj.locationCity || "",
  };
}

const categories = [
  { id: "all",       name: "All",       icon: "grid-outline" },
  { id: "bollywood", name: "Bollywood", icon: "musical-notes-outline" },
  { id: "edm",       name: "EDM",       icon: "radio-outline" },
  { id: "hiphop",    name: "Hip-Hop",   icon: "disc-outline" },
  { id: "lounge",    name: "Lounge",    icon: "wine-outline" },
  { id: "djs",       name: "Others",    icon: "headset-outline" },
];

const sortOptions = [
  { id: "popular",    name: "Most Popular",       icon: "trending-up-outline"  },
  { id: "price-low",  name: "Price: Low to High", icon: "arrow-up-outline"     },
  { id: "price-high", name: "Price: High to Low", icon: "arrow-down-outline"   },
  { id: "rating",     name: "Highest Rated",      icon: "star-outline"         },
];

// ─── Sort Sheet ───────────────────────────────────────────────────────────────

const SHEET_HEIGHT = height * 0.52;

function SortSheet({ visible, selectedSort, onSelect, onClose }: {
  visible: boolean; selectedSort: string; onSelect: (id: string) => void; onClose: () => void;
}) {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const overlayOp = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(overlayOp, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, { toValue: SHEET_HEIGHT, duration: 280, useNativeDriver: true }),
        Animated.timing(overlayOp, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { onClose(); return true; });
    return () => sub.remove();
  }, [visible]);

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[ss.overlay, { opacity: overlayOp }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[ss.sheet, { transform: [{ translateY }] }]}>
        <View style={ss.handleZone}><View style={ss.handle} /></View>
        <Text style={ss.title}>Sort By</Text>
        {sortOptions.map((opt) => {
          const active = selectedSort === opt.id;
          return (
            <TouchableOpacity key={opt.id} style={[ss.row, active && ss.rowActive]} activeOpacity={0.8}
              onPress={() => { onSelect(opt.id); onClose(); }}>
              <View style={[ss.iconBox, active && ss.iconBoxActive]}>
                <Ionicons name={opt.icon as any} size={18} color={active ? "#0cadab" : "#8696a0"} />
              </View>
              <Text style={[ss.rowText, active && ss.rowTextActive]}>{opt.name}</Text>
              {active && <View style={ss.checkCircle}><Ionicons name="checkmark" size={14} color="#fff" /></View>}
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 24 }} />
      </Animated.View>
    </View>
  );
}

const ss = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(16,23,32,0.44)" },
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, height: SHEET_HEIGHT, backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, borderColor: "#eef0f3", overflow: "hidden" },
  handleZone: { paddingTop: 12, paddingBottom: 4, alignItems: "center" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#d1d5db" },
  title: { fontSize: 18, fontWeight: "800", color: "#101720", letterSpacing: -0.3, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 13, gap: 14, borderRadius: 16, marginHorizontal: 12, marginBottom: 4 },
  rowActive: { backgroundColor: "#f4f8ff" },
  iconBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#f4f8ff", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#eef0f3" },
  iconBoxActive: { backgroundColor: "#f0fafa", borderColor: "#d0f0ef" },
  rowText: { flex: 1, fontSize: 15, fontWeight: "600", color: "#101720" },
  rowTextActive: { color: "#0cadab", fontWeight: "700" },
  checkCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#0cadab", justifyContent: "center", alignItems: "center" },
});

// ─── Equipment Card ───────────────────────────────────────────────────────────

function EquipmentCard({ item, onPress }: { item: EquipmentItem; onPress: () => void }) {
  const [liked, setLiked] = useState(false);

  return (
    <TouchableOpacity style={cs.card} activeOpacity={0.92} onPress={onPress}>
      <View style={cs.imgWrapper}>
        <Image source={{ uri: item.image }} style={cs.img} />
        <TouchableOpacity style={cs.heart} activeOpacity={0.85}
          onPress={() => setLiked(l => !l)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={18} color={liked ? "#ef4444" : "#fff"} />
        </TouchableOpacity>
        <View style={[cs.availDot, !item.available && cs.availDotOff]} />
      </View>
      <View style={cs.body}>
        <Text style={cs.cat} numberOfLines={1}>{item.category.toUpperCase()}</Text>
        <Text style={cs.name} numberOfLines={2}>{item.name}</Text>
        {item.locationCity ? <Text style={cs.city} numberOfLines={1}>📍 {item.locationCity}</Text> : null}
        <View style={cs.ratingRow}>
          <Ionicons name="star" size={12} color="#FFC107" />
          <Text style={cs.rating}>{item.rating.toFixed(1)}</Text>
          <Text style={cs.reviews}>({item.reviews})</Text>
        </View>
        <View style={cs.footer}>
          <View>
            <Text style={cs.price}>₹{item.price.toLocaleString()}</Text>
            <Text style={cs.priceUnit}>/hr</Text>
          </View>
          <TouchableOpacity style={[cs.addBtn, !item.available && cs.addBtnOff]} disabled={!item.available} activeOpacity={0.85}>
            <Ionicons name={item.available ? "add" : "close"} size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const cs = StyleSheet.create({
  card: { width: CARD_WIDTH, backgroundColor: "#fff", borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "#eef0f3" },
  imgWrapper: { position: "relative" },
  img: { width: "100%", height: CARD_WIDTH, backgroundColor: "#e5e7eb" },
  heart: { position: "absolute", top: 10, right: 10, width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(16,23,32,0.55)", justifyContent: "center", alignItems: "center" },
  availDot: { position: "absolute", bottom: 10, left: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e", borderWidth: 1.5, borderColor: "#fff" },
  availDotOff: { backgroundColor: "#d1d5db" },
  body: { padding: 11 },
  cat: { fontSize: 9, color: "#8696a0", fontWeight: "700", letterSpacing: 0.6, marginBottom: 3 },
  name: { fontSize: 14, fontWeight: "700", color: "#101720", letterSpacing: -0.2, lineHeight: 19, marginBottom: 2 },
  city: { fontSize: 10, color: "#8696a0", marginBottom: 5 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 10 },
  rating: { fontSize: 12, fontWeight: "700", color: "#101720" },
  reviews: { fontSize: 11, color: "#8696a0" },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  price: { fontSize: 18, fontWeight: "800", color: "#101720", letterSpacing: -0.5 },
  priceUnit: { fontSize: 11, color: "#8696a0", fontWeight: "500" },
  addBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#101720", justifyContent: "center", alignItems: "center" },
  addBtnOff: { backgroundColor: "#e5e7eb" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BrowseScreen() {
  const router = useRouter();
  const [allDJs, setAllDJs] = useState<EquipmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSort, setSelectedSort] = useState("popular");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSort, setShowSort] = useState(false);

  const headerY = useRef(new Animated.Value(-20)).current;
  const headerOp = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(24)).current;
  const contentOp = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerY, { toValue: 0, tension: 80, friction: 12, delay: 0, useNativeDriver: true }),
      Animated.timing(headerOp, { toValue: 1, duration: 280, delay: 0, useNativeDriver: true }),
      Animated.spring(contentY, { toValue: 0, tension: 70, friction: 12, delay: 80, useNativeDriver: true }),
      Animated.timing(contentOp, { toValue: 1, duration: 320, delay: 80, useNativeDriver: true }),
    ]).start();
  }, []);

  const fetchDJs = useCallback(async () => {
    try {
      const res = await apiService.getDJs({ isAvailable: undefined });
      const djList = res.data || res;
      const list = Array.isArray(djList) ? djList : [];
      setAllDJs(list.map(mapDJToEquipment));
    } catch (err) {
      console.error("Failed to fetch DJs:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDJs(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchDJs(); };

  const sortedFiltered = useCallback(() => {
    let list = allDJs.filter((item) => {
      const q = searchQuery.toLowerCase();
      const matchSearch = item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.locationCity || "").toLowerCase().includes(q) ||
        (item.genres || []).some(g => g.toLowerCase().includes(q));
      const matchCat = selectedCategory === "all" || item.categoryId === selectedCategory;
      return matchSearch && matchCat;
    });
    switch (selectedSort) {
      case "price-low":  list = [...list].sort((a, b) => a.price - b.price); break;
      case "price-high": list = [...list].sort((a, b) => b.price - a.price); break;
      case "rating":     list = [...list].sort((a, b) => b.rating - a.rating); break;
      default:           list = [...list].sort((a, b) => b.reviews - a.reviews);
    }
    return list;
  }, [searchQuery, selectedCategory, selectedSort, allDJs]);

  const items = sortedFiltered();
  const activeSortLabel = sortOptions.find((s) => s.id === selectedSort)?.name ?? "Sort";

  const renderCard = useCallback(
    ({ item }: { item: EquipmentItem }) => (
      <EquipmentCard item={item} onPress={() => router.push(`/equipment/${item.id}` as any)} />
    ),
    [router]
  );

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f8ff" />
      <SafeAreaView style={styles.container} edges={["top"]}>
        <LinearGradient colors={["#f4f8ff", "#eef1f9", "#ffffff"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }}>

          {/* Header */}
          <Animated.View style={[styles.header, { opacity: headerOp, transform: [{ translateY: headerY }] }]}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={22} color="#101720" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Browse DJs</Text>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSort(true)} activeOpacity={0.8}>
              <Ionicons name="funnel-outline" size={20} color="#101720" />
            </TouchableOpacity>
          </Animated.View>

          {/* Search */}
          <Animated.View style={[styles.searchRow, { opacity: headerOp, transform: [{ translateY: headerY }] }]}>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={20} color="#8696a0" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search DJs, genres, city..."
                placeholderTextColor="#8696a0"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {!!searchQuery && (
                <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color="#c4c9d0" />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>

          {/* Content */}
          <Animated.View style={[{ flex: 1 }, { opacity: contentOp, transform: [{ translateY: contentY }] }]}>

            {/* Categories */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catScroll} style={styles.catScrollWrap}>
              {categories.map((cat) => {
                const on = selectedCategory === cat.id;
                return (
                  <TouchableOpacity key={cat.id} style={[styles.chip, on && styles.chipOn]}
                    onPress={() => setSelectedCategory(cat.id)} activeOpacity={0.75}>
                    <Ionicons name={cat.icon as any} size={16} color={on ? "#fff" : "#101720"} />
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{cat.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Results row */}
            <View style={styles.resultsRow}>
              <Text style={styles.resultsText}>
                <Text style={styles.resultsCount}>{loading ? "..." : items.length}</Text>
                {" "}{items.length === 1 ? "DJ" : "DJs"} found
              </Text>
              <TouchableOpacity style={styles.sortChip} onPress={() => setShowSort(true)} activeOpacity={0.8}>
                <Ionicons name="swap-vertical-outline" size={14} color="#0cadab" />
                <Text style={styles.sortChipText}>{activeSortLabel}</Text>
              </TouchableOpacity>
            </View>

            {/* Grid */}
            {loading ? (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color="#0cadab" />
                <Text style={{ color: "#8696a0", marginTop: 12, fontSize: 14 }}>Loading DJs...</Text>
              </View>
            ) : (
              <FlatList
                data={items}
                renderItem={renderCard}
                keyExtractor={(item) => item.id}
                numColumns={2}
                contentContainerStyle={styles.grid}
                columnWrapperStyle={styles.gridRow}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0cadab"]} />}
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <View style={styles.emptyIconCircle}>
                      <Ionicons name="search-outline" size={36} color="#0cadab" />
                    </View>
                    <Text style={styles.emptyTitle}>No DJs found</Text>
                    <Text style={styles.emptyMsg}>Try a different search or category</Text>
                    <TouchableOpacity style={styles.emptyReset}
                      onPress={() => { setSearchQuery(""); setSelectedCategory("all"); }}>
                      <Text style={styles.emptyResetText}>Clear filters</Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            )}
          </Animated.View>
        </LinearGradient>
      </SafeAreaView>

      <SortSheet visible={showSort} selectedSort={selectedSort} onSelect={setSelectedSort} onClose={() => setShowSort(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f8ff" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 10, gap: 12 },
  iconBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#eef0f3" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "800", color: "#101720", letterSpacing: -0.4 },
  searchRow: { paddingHorizontal: 20, marginBottom: 14 },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 13, gap: 10, borderWidth: 1, borderColor: "#eef0f3" },
  searchInput: { flex: 1, fontSize: 15, color: "#101720", fontWeight: "400" },
  catScrollWrap: { marginBottom: 14, height: 50 },
  catScroll: { paddingHorizontal: 20, gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, height: 40, borderRadius: 14, backgroundColor: "#fff", gap: 6, borderWidth: 1, borderColor: "#eef0f3" },
  chipOn: { backgroundColor: "#101720", borderColor: "#101720" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#101720" },
  chipTextOn: { color: "#fff" },
  resultsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 12 },
  resultsText: { fontSize: 13, color: "#8696a0", fontWeight: "500" },
  resultsCount: { fontWeight: "800", color: "#101720" },
  sortChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#f0fafa", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#d0f0ef" },
  sortChipText: { fontSize: 12, fontWeight: "700", color: "#0cadab" },
  grid: { paddingHorizontal: 16, paddingBottom: 120 },
  gridRow: { gap: 12, marginBottom: 12 },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 26, backgroundColor: "#f0fafa", borderWidth: 1, borderColor: "#d0f0ef", justifyContent: "center", alignItems: "center", marginBottom: 18 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#101720", marginBottom: 6 },
  emptyMsg: { fontSize: 14, color: "#8696a0", fontWeight: "500", textAlign: "center", marginBottom: 20 },
  emptyReset: { backgroundColor: "#f4f8ff", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "#eef0f3" },
  emptyResetText: { fontSize: 13, fontWeight: "700", color: "#0cadab" },
});