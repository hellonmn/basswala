/**
 * HomeScreen index.tsx — Dynamic version
 * - Featured/Popular DJs loaded from backend
 * - Quick Booking (Book a DJ) uses real DJ list
 * - Active bookings from real API
 */

import LocationBottomSheet from "@/components/LocationBottomSheet";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { emitScroll } from "@/utils/tabBarEmitter";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator, Animated, Dimensions, Easing, Image,
  RefreshControl, ScrollView, StatusBar, StyleSheet, Text,
  TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BookingBottomSheet, { Equipment, RentalReceipt } from "../../components/BookingBottomSheet";
import { apiService } from "../../services/api";
import { useFocusEffect } from "expo-router";

const { width, height } = Dimensions.get("window");
const CARD_WIDTH = width * 0.72;

// ─── DJ mapper ─────────────────────────────────────────────────────────────────

function mapDJToEquipment(dj: any): Equipment & {
  image: string; rating: number; reviews: number;
  available: boolean; tag: string | null;
} {
  const genres = Array.isArray(dj.genres) ? dj.genres : [];
  const images = Array.isArray(dj.images) && dj.images.length > 0 ? dj.images :
    ["https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=400&q=80"];
  const accentColors = ["#FF6B35", "#7C3AED", "#059669", "#DC2626", "#0cadab"];
  const idx = parseInt(String(dj.id)) % accentColors.length;

  return {
    id: String(dj.id),
    name: dj.name,
    category: genres.slice(0, 2).join(" / ") || "DJ Service",
    price: Math.round(dj.hourlyRate || 0),
    deposit: Math.round((dj.hourlyRate || 0) * 2),
    pickupAddress: [dj.locationCity, dj.locationState].filter(Boolean).join(", ") || "Location on request",
    accentColor: accentColors[idx],
    image: images[0],
    rating: parseFloat(dj.ratingAverage) || 0,
    reviews: dj.ratingCount || 0,
    available: dj.isAvailable !== false,
    tag: dj.ratingAverage >= 4.8 ? "Top Pick" : dj.ratingCount > 50 ? "Popular" : null,
  };
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function buildCalendar(y: number, m: number) {
  const first = new Date(y, m, 1).getDay();
  const total = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  return cells;
}
const ds = (y: number, m: number, d: number) => `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
const todayStr = () => { const t = new Date(); return ds(t.getFullYear(), t.getMonth(), t.getDate()); };
const daysBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1;

// ─── Book-a-DJ Tab ─────────────────────────────────────────────────────────────

function BookDJTab({ onBooked }: { onBooked: () => void }) {
  const today = new Date();
  const [step, setStep] = useState<0 | 1 | 2>(0);

  // Step 0 – dates
  const [calY, setCalY] = useState(today.getFullYear());
  const [calM, setCalM] = useState(today.getMonth());
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);

  // Step 1 – DJ
  const [loadingDJs, setLoadingDJs] = useState(false);
  const [djs, setDjs] = useState<any[]>([]);
  const [picked, setPicked] = useState<any | null>(null);
  const [expandedDJ, setExpandedDJ] = useState<string | null>(null);

  // Step 2 – confirm
  const [booking, setBooking] = useState(false);

  const slideX = useRef(new Animated.Value(0)).current;
  const fadeV = useRef(new Animated.Value(1)).current;

  const goTo = (next: 0 | 1 | 2, dir: 1 | -1) => {
    Animated.parallel([
      Animated.timing(slideX, { toValue: -width * dir, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fadeV, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideX.setValue(width * dir);
      fadeV.setValue(0);
      Animated.parallel([
        Animated.timing(slideX, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fadeV, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    });
  };

  const fetchDJs = async () => {
    setLoadingDJs(true);
    try {
      const res = await apiService.getDJs({ isAvailable: true });
      const list = res.data || res;
      setDjs(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error("Failed to fetch DJs:", err);
      setDjs([]);
    } finally {
      setLoadingDJs(false);
    }
  };

  const handleDay = (day: number) => {
    const d = ds(calY, calM, day);
    if (d < todayStr()) return;
    if (!start || (start && end)) { setStart(d); setEnd(null); }
    else if (d < start) { setStart(d); setEnd(null); }
    else { setEnd(d); }
  };

  const inRange = (d: number) => !!start && !!end && ds(calY, calM, d) > start && ds(calY, calM, d) < end;
  const isStart = (d: number) => ds(calY, calM, d) === start;
  const isEnd = (d: number) => ds(calY, calM, d) === end;
  const isPast = (d: number) => ds(calY, calM, d) < todayStr();

  const nights = start && end ? daysBetween(start, end) : 0;
  const total = picked ? Math.round(picked.hourlyRate || 0) * nights * 8 : 0; // 8 hrs/day estimate
  const cells = buildCalendar(calY, calM);
  const stepLabels = ["Select Dates", "Choose DJ", "Confirm"];

  const handleConfirm = async () => {
    if (!picked || !start || !end) return;
    setBooking(true);
    try {
      // Create actual booking
      await apiService.createBooking({
        djId: picked.id,
        eventDetails: {
          eventType: "Private Party",
          eventDate: start,
          startTime: "18:00",
          endTime: "22:00",
          duration: nights,
          basePrice: total,
          totalAmount: total,
        },
        eventLocation: {
          latitude: 26.9124,
          longitude: 75.7873,
          address: { city: "Jaipur", country: "India" },
        },
        pricing: { basePrice: total, totalAmount: total },
      });
      setBooking(false);
      onBooked();
    } catch (err: any) {
      console.error("Booking failed:", err);
      setBooking(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Step pills */}
      <View style={dj.stepRow}>
        {stepLabels.map((label, i) => (
          <React.Fragment key={i}>
            <TouchableOpacity
              style={[dj.stepPill, i === step && dj.stepPillActive, i < step && dj.stepPillDone]}
              onPress={() => i < step && goTo(i as 0 | 1 | 2, -1)}
              activeOpacity={i < step ? 0.75 : 1}
            >
              {i < step ? <Ionicons name="checkmark" size={12} color="#fff" /> :
                <Text style={[dj.stepPillNum, i === step && { color: "#fff" }]}>{i + 1}</Text>}
              <Text style={[dj.stepPillLabel, i === step && { color: "#fff" }, i < step && { color: "#fff" }]}>{label}</Text>
            </TouchableOpacity>
            {i < 2 && <View style={[dj.stepLine, i < step && dj.stepLineDone]} />}
          </React.Fragment>
        ))}
      </View>

      <Animated.ScrollView
        style={[{ transform: [{ translateX: slideX }], opacity: fadeV }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => emitScroll(e.nativeEvent.contentOffset.y)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120, paddingTop: 4 }}
      >
        {/* ════ STEP 0: Calendar ════ */}
        {step === 0 && (
          <>
            <Text style={dj.sectionHead}>When do you need the DJ?</Text>
            <View style={dj.monthRow}>
              <TouchableOpacity style={dj.monthArrow} onPress={() => { if (calM === 0) { setCalM(11); setCalY(y => y-1); } else setCalM(m => m-1); }}>
                <Ionicons name="chevron-back" size={18} color="#101720" />
              </TouchableOpacity>
              <Text style={dj.monthLabel}>{MONTHS[calM]} {calY}</Text>
              <TouchableOpacity style={dj.monthArrow} onPress={() => { if (calM === 11) { setCalM(0); setCalY(y => y+1); } else setCalM(m => m+1); }}>
                <Ionicons name="chevron-forward" size={18} color="#101720" />
              </TouchableOpacity>
            </View>
            <View style={dj.dayNames}>
              {DAYS.map(d => <Text key={d} style={dj.dayName}>{d}</Text>)}
            </View>
            <View style={dj.calGrid}>
              {cells.map((cell, i) => {
                if (!cell) return <View key={i} style={dj.calCell} />;
                const s = isStart(cell), e = isEnd(cell), r = inRange(cell), p = isPast(cell);
                const showStrip = r || (s && !!end) || (e && !!start);
                return (
                  <TouchableOpacity key={i} style={dj.calCell} onPress={() => handleDay(cell)} activeOpacity={p ? 1 : 0.75}>
                    {showStrip && <View style={[dj.calRangeStrip, s && dj.calRangeStripStart, e && dj.calRangeStripEnd]} />}
                    <View style={[dj.calDayCircle, (s || e) && dj.calDayCircleActive]}>
                      <Text style={[dj.calText, p && dj.calTextPast, r && dj.calTextRange, (s || e) && dj.calTextEndpoint]}>{cell}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={dj.rangePill}>
              <View style={dj.rangeSide}><Text style={dj.rangeLabel}>FROM</Text><Text style={dj.rangeVal}>{start ?? "—"}</Text></View>
              <View style={dj.rangeDivider} />
              <View style={dj.rangeSide}><Text style={dj.rangeLabel}>TO</Text><Text style={dj.rangeVal}>{end ?? "—"}</Text></View>
              {nights > 0 && <View style={dj.nightBadge}><Text style={dj.nightBadgeText}>{nights} night{nights !== 1 ? "s" : ""}</Text></View>}
            </View>
            <TouchableOpacity style={[dj.ctaBtn, !end && dj.ctaBtnOff]} disabled={!end}
              onPress={() => { goTo(1, 1); fetchDJs(); }} activeOpacity={0.85}>
              <Text style={dj.ctaBtnText}>Find Available DJs</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          </>
        )}

        {/* ════ STEP 1: DJ list ════ */}
        {step === 1 && (
          <>
            <View style={dj.dateBandRow}>
              <Ionicons name="calendar-outline" size={14} color="#0cadab" />
              <Text style={dj.dateBand}>{start} → {end} · {nights} night{nights !== 1 ? "s" : ""}</Text>
              <TouchableOpacity onPress={() => goTo(0, -1)}>
                <Text style={dj.changeLink}>Change</Text>
              </TouchableOpacity>
            </View>
            <Text style={dj.sectionHead}>Choose your DJ</Text>

            {loadingDJs ? (
              <View style={dj.loadBox}>
                <ActivityIndicator size="large" color="#0cadab" />
                <Text style={dj.loadText}>Checking availability…</Text>
              </View>
            ) : djs.length === 0 ? (
              <View style={dj.loadBox}>
                <Ionicons name="search-outline" size={40} color="#8696a0" />
                <Text style={dj.loadText}>No DJs available. Try different dates.</Text>
              </View>
            ) : (
              djs.map((item) => {
                const isExpanded = expandedDJ === item.id.toString();
                const isSelected = picked?.id === item.id;
                const genres = Array.isArray(item.genres) ? item.genres : [];
                return (
                  <View key={item.id} style={[dj.djCard, isSelected && dj.djCardOn, !item.isAvailable && dj.djCardOff]}>
                    <TouchableOpacity style={dj.djCardRow}
                      onPress={() => item.isAvailable && setExpandedDJ(isExpanded ? null : item.id.toString())}
                      activeOpacity={item.isAvailable ? 0.85 : 1}>
                      <View style={[dj.djAvatar, { justifyContent: "center", alignItems: "center", backgroundColor: "#101720" }]}>
                        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>
                          {item.name?.charAt(0) || "D"}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={dj.djRow}>
                          <Text style={dj.djName}>{item.name}</Text>
                          {!item.isAvailable && <View style={dj.bookedBadge}><Text style={dj.bookedText}>Unavailable</Text></View>}
                          {isSelected && <View style={dj.selectedBadge}><Text style={dj.selectedBadgeText}>Selected</Text></View>}
                        </View>
                        <Text style={dj.djGenre}>{genres.join(", ") || "DJ"}</Text>
                        <View style={dj.djMeta}>
                          <Ionicons name="star" size={11} color="#FFC107" />
                          <Text style={dj.djRating}>{parseFloat(item.ratingAverage || 0).toFixed(1)}</Text>
                          <Text style={dj.djReviews}>({item.ratingCount || 0})</Text>
                          {item.locationCity && <View style={dj.tag}><Text style={dj.tagText}>{item.locationCity}</Text></View>}
                        </View>
                      </View>
                      <View style={dj.priceCol}>
                        <Text style={dj.djPrice}>₹{Math.round(item.hourlyRate || 0).toLocaleString()}</Text>
                        <Text style={dj.djPriceUnit}>/hr</Text>
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#8696a0" style={{ marginTop: 6 }} />
                      </View>
                    </TouchableOpacity>

                    {isExpanded && item.isAvailable && (
                      <View style={dj.djDetail}>
                        <View style={dj.djDetailDivider} />
                        <Text style={dj.djDetailLabel}>Specialties</Text>
                        <View style={dj.djTagRow}>
                          {genres.map((t: string) => <View key={t} style={dj.djDetailTag}><Text style={dj.djDetailTagText}>{t}</Text></View>)}
                        </View>
                        <View style={dj.djStatsRow}>
                          <View style={dj.djStat}><Text style={dj.djStatVal}>{parseFloat(item.ratingAverage || 0).toFixed(1)}</Text><Text style={dj.djStatLbl}>Rating</Text></View>
                          <View style={dj.djStatDivider} />
                          <View style={dj.djStat}><Text style={dj.djStatVal}>{item.ratingCount || 0}</Text><Text style={dj.djStatLbl}>Events</Text></View>
                          <View style={dj.djStatDivider} />
                          <View style={dj.djStat}><Text style={dj.djStatVal}>₹{Math.round(item.hourlyRate || 0).toLocaleString()}</Text><Text style={dj.djStatLbl}>Per Hour</Text></View>
                        </View>
                        {item.description && <Text style={dj.djBio}>{item.description}</Text>}
                        <View style={dj.djActions}>
                          <TouchableOpacity style={dj.djSelectBtn} onPress={() => { setPicked(item); setExpandedDJ(null); }} activeOpacity={0.85}>
                            <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                            <Text style={dj.djSelectBtnText}>{isSelected ? "Selected ✓" : "Select this DJ"}</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}

            {!loadingDJs && (
              <TouchableOpacity style={[dj.ctaBtn, !picked && dj.ctaBtnOff]} disabled={!picked} onPress={() => goTo(2, 1)} activeOpacity={0.85}>
                <Text style={dj.ctaBtnText}>Review Booking</Text>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </TouchableOpacity>
            )}
          </>
        )}

        {/* ════ STEP 2: Confirm ════ */}
        {step === 2 && picked && (
          <>
            <Text style={dj.sectionHead}>Review & Confirm</Text>
            <View style={dj.confirmCard}>
              <View style={[dj.confirmAvatar, { justifyContent: "center", alignItems: "center", backgroundColor: "#101720" }]}>
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 22 }}>{picked.name?.charAt(0) || "D"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={dj.confirmName}>{picked.name}</Text>
                <Text style={dj.confirmGenre}>{Array.isArray(picked.genres) ? picked.genres.join(", ") : "DJ"}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <Ionicons name="star" size={12} color="#FFC107" />
                  <Text style={dj.confirmRating}>{parseFloat(picked.ratingAverage || 0).toFixed(1)} · {picked.ratingCount || 0} reviews</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => goTo(1, -1)} style={dj.changeBtn}>
                <Text style={dj.changeBtnText}>Change</Text>
              </TouchableOpacity>
            </View>

            <View style={dj.breakdown}>
              {[
                { l: "Event from", v: start! },
                { l: "Event to", v: end! },
                { l: "Duration", v: `${nights} night${nights !== 1 ? "s" : ""}` },
                { l: "Rate/hr", v: `₹${Math.round(picked.hourlyRate || 0).toLocaleString()}` },
                { l: "Est. hours", v: `~8 hrs/day` },
              ].map(r => (
                <View key={r.l} style={dj.breakRow}>
                  <Text style={dj.breakL}>{r.l}</Text>
                  <Text style={dj.breakV}>{r.v}</Text>
                </View>
              ))}
              <View style={dj.breakLine} />
              <View style={dj.breakRow}>
                <Text style={[dj.breakL, { fontWeight: "700", color: "#101720" }]}>Estimated Total</Text>
                <Text style={dj.breakTotal}>₹{total.toLocaleString()}</Text>
              </View>
            </View>

            <View style={dj.noteRow}>
              <Ionicons name="information-circle-outline" size={14} color="#8696a0" />
              <Text style={dj.noteText}>Final price confirmed on booking. 20% advance required.</Text>
            </View>

            <TouchableOpacity
              style={[dj.ctaBtn, booking && dj.ctaBtnOff, { backgroundColor: "#0cadab" }]}
              disabled={booking} onPress={handleConfirm} activeOpacity={0.85}>
              {booking ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Text style={dj.ctaBtnText}>Confirm Booking</Text>
                  <Ionicons name="checkmark" size={16} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </Animated.ScrollView>
    </View>
  );
}

// ─── Main Home Screen ─────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user } = useAuth();
  const { location } = useLocation();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"gear" | "dj">("gear");
  const [isLocationSheetVisible, setIsLocationSheetVisible] = useState(false);
  const [bookingEquip, setBookingEquip] = useState<Equipment | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  // Dynamic data
  const [featuredDJs, setFeaturedDJs] = useState<any[]>([]);
  const [popularDJs, setPopularDJs] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loadingDJs, setLoadingDJs] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const tabSlide = useRef(new Animated.Value(0)).current;
  const TAB_W = (width - 40) / 2;

  const lottieRef = useRef<LottieView>(null);
  const [shouldPlay, setShouldPlay] = useState(true);
  const searchY = useRef(new Animated.Value(0)).current;
  const searchScale = useRef(new Animated.Value(1)).current;
  const overlayOpac = useRef(new Animated.Value(0)).current;
  const contentOpac = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!shouldPlay) {
      const t = setTimeout(() => { setShouldPlay(true); lottieRef.current?.play(); }, 5000);
      return () => clearTimeout(t);
    }
  }, [shouldPlay]);

  const loadData = useCallback(async () => {
    try {
      // Load DJs
      const djRes = await apiService.getDJs({ isAvailable: true });
      const djList = Array.isArray(djRes.data || djRes) ? (djRes.data || djRes) : [];
      const mapped = djList.map(mapDJToEquipment);
      setFeaturedDJs(mapped.slice(0, 5));
      setPopularDJs(mapped.slice(0, 6));

      // Load recent bookings
      try {
        const bkRes = await apiService.getMyBookings({ limit: 3 });
        const bkList = Array.isArray(bkRes.data || bkRes) ? (bkRes.data || bkRes) : [];
        setRecentBookings(bkList.filter((b: any) =>
          b.status === "Confirmed" || b.status === "Pending" || b.status === "In Progress"
        ).slice(0, 2));
      } catch (_) { /* Ignore booking errors */ }

    } catch (err) {
      console.error("Failed to load home data:", err);
    } finally {
      setLoadingDJs(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, []);

  useFocusEffect(useCallback(() => {
    // Refresh bookings strip when returning to home
    apiService.getMyBookings({ limit: 3 }).then(res => {
      const list = Array.isArray(res.data || res) ? (res.data || res) : [];
      setRecentBookings(list.filter((b: any) =>
        b.status === "Confirmed" || b.status === "Pending" || b.status === "In Progress"
      ).slice(0, 2));
    }).catch(() => {});
  }, []));

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const switchTab = (tab: "gear" | "dj") => {
    setActiveTab(tab);
    Animated.spring(tabSlide, { toValue: tab === "gear" ? 0 : TAB_W, tension: 60, friction: 12, useNativeDriver: true }).start();
  };

  const openBooking = (equip: Equipment) => {
    setBookingEquip(equip);
    setSheetVisible(true);
  };

  const handleSearchPress = () => {
    Animated.parallel([
      Animated.timing(searchY, { toValue: -200, duration: 400, useNativeDriver: true }),
      Animated.timing(searchScale, { toValue: 0.95, duration: 400, useNativeDriver: true }),
      Animated.timing(overlayOpac, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(contentOpac, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      router.push("/explore");
      setTimeout(() => {
        searchY.setValue(0); searchScale.setValue(1); overlayOpac.setValue(0); contentOpac.setValue(1);
      }, 100);
    });
  };

  // Map recent booking to display
  const mapRecentBooking = (b: any) => ({
    id: b.id,
    name: b.dj?.name || "DJ Booking",
    dates: b.eventDate ? `${new Date(b.eventDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} · ${b.duration || 1} day(s)` : "—",
    amount: b.totalAmount || 0,
    status: b.status === "Confirmed" ? "Active" : b.status || "Pending",
    statusColor: b.status === "Confirmed" ? "#22c55e" : b.status === "Cancelled" ? "#ef4444" : "#f59e0b",
    icon: "musical-notes-outline",
    accentColor: "#0cadab",
  });

  const firstName = user?.firstName || user?.name?.split(" ")[0] || "DJ";

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f8ff" />
      <SafeAreaView style={s.container} edges={["top"]}>
        <LinearGradient colors={["#f4f8ff", "#eef1f9", "#ffffff"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ flex: 1 }}>
          <Animated.View style={[{ flex: 1 }, { opacity: contentOpac }]}>

            {/* Header */}
            <View style={s.header}>
              <TouchableOpacity style={s.avatarBtn}>
                <View style={[s.avatar, { backgroundColor: "#0cadab", justifyContent: "center", alignItems: "center" }]}>
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{firstName.charAt(0)}</Text>
                </View>
                <View style={s.onlineDot} />
              </TouchableOpacity>
              <TouchableOpacity style={s.locationBtn} onPress={() => setIsLocationSheetVisible(true)} activeOpacity={0.7}>
                <Text style={s.locationLabel}>LOCATION</Text>
                <View style={s.locationRow}>
                  <Ionicons name="location" size={15} color="#0cadab" />
                  <Text style={s.locationText} numberOfLines={1}>{location?.area || location?.city || "Select Location"}</Text>
                  <Ionicons name="chevron-down" size={16} color="#8696a0" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={s.notifBtn}>
                <Ionicons name="notifications-outline" size={22} color="#101720" />
                <View style={s.notifDot} />
              </TouchableOpacity>
            </View>

            {/* Greeting */}
            <View style={s.greetingRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.greetingText}>Hey {firstName} 👋</Text>
                <Text style={s.greetingSub}>{activeTab === "gear" ? "Browse & book top DJs" : "Book a DJ for your event"}</Text>
              </View>
            </View>

            {/* Tab bar */}
            <View style={s.tabBarWrap}>
              <View style={s.tabBar}>
                <Animated.View style={[s.tabPillFill, { transform: [{ translateX: tabSlide }] }]} />
                <TouchableOpacity style={s.tabBtn} onPress={() => switchTab("gear")} activeOpacity={0.85}>
                  <Ionicons name="musical-notes-outline" size={16} color={activeTab === "gear" ? "#fff" : "#8696a0"} />
                  <Text style={[s.tabLabel, activeTab === "gear" && s.tabLabelActive]}>Explore DJs</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.tabBtn} onPress={() => switchTab("dj")} activeOpacity={0.85}>
                  <Ionicons name="person-outline" size={16} color={activeTab === "dj" ? "#fff" : "#8696a0"} />
                  <Text style={[s.tabLabel, activeTab === "dj" && s.tabLabelActive]}>Quick Booking</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Tab content */}
            {activeTab === "dj" ? (
              <BookDJTab onBooked={() => { switchTab("gear"); loadData(); }} />
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={(e) => emitScroll(e.nativeEvent.contentOffset.y)}
                contentContainerStyle={s.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#0cadab"]} />}
              >
                {/* Search */}
                <Animated.View style={[s.searchSection, { transform: [{ translateY: searchY }, { scale: searchScale }] }]}>
                  <TouchableOpacity style={s.searchBox} activeOpacity={0.88} onPress={handleSearchPress}>
                    <Ionicons name="search-outline" size={20} color="#8696a0" />
                    <Text style={s.searchPlaceholder}>Search DJs, genres, city...</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.filterBtn}>
                    <Ionicons name="options-outline" size={20} color="#101720" />
                  </TouchableOpacity>
                </Animated.View>

                {/* Banner */}
                <View style={s.bannerSection}>
                  <LinearGradient colors={["#cfe8ff", "#c5d9f7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.bannerCard}>
                    <View style={s.bannerLeft}>
                      <View style={s.bannerBadge}><Text style={s.bannerBadgeText}>LIMITED OFFER</Text></View>
                      <Text style={s.bannerText}>40% off on{"\n"}first booking</Text>
                      <TouchableOpacity style={s.bannerBtn} onPress={() => switchTab("dj")}>
                        <Text style={s.bannerBtnText}>Book Now</Text>
                        <Ionicons name="arrow-forward" size={15} color="#fff" />
                      </TouchableOpacity>
                    </View>
                    <View style={s.bannerRight}>
                      <View style={s.lottieWrap}>
                        <LottieView ref={lottieRef} source={require("../../assets/animations/banner.json")} autoPlay loop={false} style={s.lottie} onAnimationFinish={() => setShouldPlay(false)} />
                      </View>
                    </View>
                  </LinearGradient>
                </View>

                {/* Featured DJs */}
                <View style={s.section}>
                  <View style={s.sectionHeader}>
                    <Text style={s.sectionTitle}>Featured DJs</Text>
                    <TouchableOpacity onPress={() => router.push("/(tabs)/explore" as any)}>
                      <Text style={s.seeAll}>See All</Text>
                    </TouchableOpacity>
                  </View>
                  {loadingDJs ? (
                    <View style={{ height: 260, justifyContent: "center", alignItems: "center" }}>
                      <ActivityIndicator size="large" color="#0cadab" />
                    </View>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.featuredScroll} decelerationRate="fast" snapToInterval={CARD_WIDTH + 16}>
                      {featuredDJs.map((item) => (
                        <TouchableOpacity key={item.id} onPress={() => router.push(`/equipment/${item.id}` as any)} style={s.featuredCard}>
                          <Image source={{ uri: item.image }} style={s.featuredImg} />
                          <LinearGradient colors={["transparent", "rgba(16,23,32,0.85)"]} style={StyleSheet.absoluteFillObject} />
                          <View style={s.featuredTopRow}>
                            {item.tag ? <View style={s.tagPill}><Text style={s.tagPillText}>{item.tag}</Text></View> : <View />}
                            <TouchableOpacity style={s.heartBtn}><Ionicons name="heart-outline" size={16} color="#fff" /></TouchableOpacity>
                          </View>
                          <View style={s.featuredBottom}>
                            <View style={[s.availChip, !item.available && s.availChipOff]}>
                              <View style={[s.availDot, !item.available && s.availDotOff]} />
                              <Text style={s.availText}>{item.available ? "Available" : "Unavailable"}</Text>
                            </View>
                            <Text style={s.featuredCat}>{item.category.toUpperCase()}</Text>
                            <Text style={s.featuredName} numberOfLines={1}>{item.name}</Text>
                            <View style={s.featuredMetaRow}>
                              <View style={s.ratingRow}>
                                <Ionicons name="star" size={11} color="#FFC107" />
                                <Text style={s.ratingOverlay}>{item.rating.toFixed(1)}</Text>
                                <Text style={s.reviewsOverlay}>({item.reviews})</Text>
                              </View>
                              <Text style={[s.priceOverlay, { color: item.accentColor ?? "#0cadab" }]}>
                                ₹{item.price.toLocaleString()}<Text style={s.priceOverlayUnit}>/hr</Text>
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={[s.featuredBookBtn, { backgroundColor: item.available ? (item.accentColor ?? "#0cadab") : "rgba(255,255,255,0.15)" }]}
                              disabled={!item.available}
                              onPress={() => { if (item.available) openBooking(item); }}
                              activeOpacity={0.85}>
                              <Ionicons name="calendar-outline" size={13} color={item.available ? "#fff" : "rgba(255,255,255,0.4)"} />
                              <Text style={[s.featuredBookBtnText, !item.available && { color: "rgba(255,255,255,0.4)" }]}>
                                {item.available ? "Book Now" : "Unavailable"}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>

                {/* Active Bookings */}
                {recentBookings.length > 0 && (
                  <View style={s.section}>
                    <View style={s.sectionHeader}>
                      <View>
                        <Text style={s.sectionTitle}>Active Bookings</Text>
                        <Text style={s.sectionSub}>Currently active events</Text>
                      </View>
                      <TouchableOpacity style={s.seeAllBtn} onPress={() => router.push("/(tabs)/bookings")}>
                        <Text style={s.seeAll}>View All</Text>
                        <Ionicons name="arrow-forward" size={13} color="#0cadab" />
                      </TouchableOpacity>
                    </View>
                    {recentBookings.map(b => {
                      const display = mapRecentBooking(b);
                      return (
                        <TouchableOpacity key={display.id} style={s.bookingCard} activeOpacity={0.88} onPress={() => router.push("/(tabs)/bookings")}>
                          <View style={[s.bookingIconBox, { backgroundColor: display.accentColor + "15", borderColor: display.accentColor + "30" }]}>
                            <Ionicons name={display.icon as any} size={20} color={display.accentColor} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.bookingName} numberOfLines={1}>{display.name}</Text>
                            <Text style={s.bookingMeta}>{display.dates}</Text>
                          </View>
                          <View style={{ alignItems: "flex-end", gap: 4 }}>
                            <View style={[s.bookingStatusPill, { backgroundColor: display.statusColor + "15" }]}>
                              <View style={[s.bookingStatusDot, { backgroundColor: display.statusColor }]} />
                              <Text style={[s.bookingStatusText, { color: display.statusColor }]}>{display.status}</Text>
                            </View>
                            <Text style={s.bookingAmt}>₹{display.amount.toLocaleString()}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* How It Works */}
                <View style={s.section}>
                  <View style={s.sectionHeader}><Text style={s.sectionTitle}>How It Works</Text></View>
                  <View style={s.howRow}>
                    {[
                      { icon: "search-outline", label: "Browse\nDJs" },
                      { icon: "calendar-outline", label: "Pick\nDates" },
                      { icon: "card-outline", label: "Pay\nSecurely" },
                      { icon: "musical-notes-outline", label: "Enjoy\nThe Event" },
                    ].map((step, i) => (
                      <View key={i} style={s.howStep}>
                        <View style={s.howCircle}>
                          <Ionicons name={step.icon as any} size={20} color="#0cadab" />
                        </View>
                        <Text style={s.howLabel}>{step.label}</Text>
                        {i < 3 && <View style={s.howConnector} />}
                      </View>
                    ))}
                  </View>
                </View>

                {/* Popular DJs */}
                {!loadingDJs && popularDJs.length > 0 && (
                  <View style={s.section}>
                    <View style={s.sectionHeader}>
                      <View>
                        <Text style={s.sectionTitle}>Popular DJs</Text>
                        <Text style={s.sectionSub}>Most booked this week</Text>
                      </View>
                      <TouchableOpacity style={s.seeAllBtn} onPress={() => router.push("/(tabs)/explore" as any)}>
                        <Text style={s.seeAll}>See All</Text>
                        <Ionicons name="arrow-forward" size={13} color="#0cadab" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity style={s.heroCard} activeOpacity={0.92} onPress={() => router.push(`/equipment/${popularDJs[0].id}` as any)}>
                      <Image source={{ uri: popularDJs[0].image }} style={s.heroImg} />
                      <LinearGradient colors={["transparent", "rgba(16,23,32,0.82)"]} style={s.heroOverlay} />
                      <View style={s.heroRankBadge}><Text style={s.heroRankText}>#1</Text></View>
                      <View style={s.heroContent}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.heroCat}>{popularDJs[0].category.toUpperCase()}</Text>
                          <Text style={s.heroName} numberOfLines={1}>{popularDJs[0].name}</Text>
                          <View style={s.heroMeta}>
                            <Ionicons name="star" size={12} color="#FFC107" />
                            <Text style={s.heroRating}>{popularDJs[0].rating.toFixed(1)}</Text>
                            <View style={s.heroDot} />
                            <Text style={[s.heroPrice, { color: popularDJs[0].accentColor ?? "#0cadab" }]}>₹{popularDJs[0].price.toLocaleString()}/hr</Text>
                          </View>
                        </View>
                        <TouchableOpacity style={s.heroBookBtn} onPress={() => openBooking(popularDJs[0])}>
                          <Ionicons name="add" size={20} color="#101720" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.smallCardsScroll}>
                      {popularDJs.slice(1, 5).map((item, idx) => (
                        <TouchableOpacity key={item.id} style={s.smallCard} activeOpacity={0.92} onPress={() => router.push(`/equipment/${item.id}` as any)}>
                          <Image source={{ uri: item.image }} style={s.smallImg} />
                          <LinearGradient colors={["transparent", "rgba(16,23,32,0.78)"]} style={s.smallOverlay} />
                          <View style={s.smallRankBadge}><Text style={s.smallRankText}>#{idx + 2}</Text></View>
                          <View style={s.smallContent}>
                            <Text style={s.smallCat} numberOfLines={1}>{item.category.toUpperCase()}</Text>
                            <Text style={s.smallName} numberOfLines={1}>{item.name}</Text>
                            <View style={s.smallFooter}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                                <Ionicons name="star" size={10} color="#FFC107" />
                                <Text style={s.smallRating}>{item.rating.toFixed(1)}</Text>
                              </View>
                              <TouchableOpacity onPress={() => openBooking(item)} style={[s.smallBookBtn, { backgroundColor: item.accentColor ?? "#0cadab" }]}>
                                <Text style={s.smallBookBtnText}>₹{item.price.toLocaleString()}/hr</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Promo */}
                <View style={s.promoWrap}>
                  <LinearGradient colors={["#0cadab", "#0a9998"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.promoGrad}>
                    <View>
                      <Text style={s.promoTitle}>List Your DJ Services</Text>
                      <Text style={s.promoSub}>Earn by performing at events</Text>
                    </View>
                    <TouchableOpacity style={s.promoBtn}>
                      <Text style={s.promoBtnText}>Join Now</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>

                <View style={{ height: 120 }} />
              </ScrollView>
            )}
          </Animated.View>

          <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#f4f8ff", opacity: overlayOpac }]} pointerEvents="none" />
        </LinearGradient>
      </SafeAreaView>

      <LocationBottomSheet isVisible={isLocationSheetVisible} onClose={() => setIsLocationSheetVisible(false)} />

      {(bookingEquip) && (
  <BookingBottomSheet
    visible={sheetVisible}
    equipment={bookingEquip}
    days={1}
    onClose={() => { setSheetVisible(false); setBookingEquip(null); }}
    onBooked={(_: RentalReceipt) => { loadData(); }}
    onViewBookings={() => router.replace("/(tabs)/bookings")}
  />
)}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f8ff" },
  scrollContent: { paddingBottom: 120 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10, gap: 12 },
  avatarBtn: { position: "relative" },
  avatar: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#e5e7eb" },
  onlineDot: { position: "absolute", bottom: 1, right: 1, width: 9, height: 9, borderRadius: 5, backgroundColor: "#22c55e", borderWidth: 2, borderColor: "#f4f8ff" },
  locationBtn: { flex: 1, alignItems: "center" },
  locationLabel: { fontSize: 9, color: "#8696a0", fontWeight: "700", letterSpacing: 1, marginBottom: 2 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 14, fontWeight: "700", color: "#101720", maxWidth: width - 220 },
  notifBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", position: "relative", shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  notifDot: { position: "absolute", top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: "#0cadab", borderWidth: 1.5, borderColor: "#fff" },
  greetingRow: { paddingHorizontal: 20, paddingTop: 2, paddingBottom: 14 },
  greetingText: { fontSize: 24, fontWeight: "800", color: "#101720", letterSpacing: -0.5 },
  greetingSub: { fontSize: 13, color: "#8696a0", fontWeight: "500", marginTop: 2 },
  tabBarWrap: { paddingHorizontal: 20, marginBottom: 14 },
  tabBar: { flexDirection: "row", backgroundColor: "#f0f2f5", borderRadius: 22, padding: 3, position: "relative", overflow: "hidden" },
  tabPillFill: { position: "absolute", top: 3, bottom: 3, left: 3, width: (width - 46) / 2, backgroundColor: "#101720", borderRadius: 19 },
  tabBtn: { flex: 1, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, zIndex: 1 },
  tabLabel: { fontSize: 14, fontWeight: "600", color: "#8696a0" },
  tabLabelActive: { color: "#fff", fontWeight: "700" },
  searchSection: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 16, gap: 10, zIndex: 10 },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, gap: 10, borderWidth: 1, borderColor: "#eef0f3" },
  searchPlaceholder: { flex: 1, fontSize: 15, color: "#8696a0", fontWeight: "400" },
  filterBtn: { width: 50, height: 50, borderRadius: 16, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#eef0f3" },
  bannerSection: { paddingHorizontal: 20, marginBottom: 28 },
  bannerCard: { borderRadius: 22, flexDirection: "row", alignItems: "center", height: 156, paddingHorizontal: 22, overflow: "hidden" },
  bannerLeft: { flex: 1, gap: 10, zIndex: 2 },
  bannerBadge: { alignSelf: "flex-start", backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  bannerBadgeText: { fontSize: 9, fontWeight: "800", color: "#0cadab", letterSpacing: 0.8 },
  bannerText: { fontSize: 21, fontWeight: "800", color: "#101720", lineHeight: 27 },
  bannerBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "#101720", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 50, gap: 6 },
  bannerBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  bannerRight: { flex: 1, alignItems: "flex-end", justifyContent: "center" },
  lottieWrap: { position: "absolute", right: -42, top: -110, width: 190, height: 190 },
  lottie: { width: "100%", height: "100%" },
  section: { marginBottom: 28 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: { fontSize: 20, fontWeight: "800", color: "#101720", letterSpacing: -0.4 },
  sectionSub: { fontSize: 12, color: "#8696a0", fontWeight: "500", marginTop: 2 },
  seeAll: { fontSize: 14, color: "#0cadab", fontWeight: "600" },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  featuredScroll: { paddingHorizontal: 20, gap: 16 },
  featuredCard: { width: CARD_WIDTH, height: 260, borderRadius: 20, overflow: "hidden", position: "relative", borderWidth: 1, borderColor: "#1e2d3d" },
  featuredImg: { width: "100%", height: "100%", backgroundColor: "#1a2535" },
  featuredTopRow: { position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  featuredBottom: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 12, gap: 3 },
  featuredCat: { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.55)", letterSpacing: 0.9 },
  featuredName: { fontSize: 17, fontWeight: "800", color: "#fff", letterSpacing: -0.4, marginBottom: 4 },
  featuredMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingOverlay: { fontSize: 12, fontWeight: "700", color: "#fff" },
  reviewsOverlay: { fontSize: 11, color: "rgba(255,255,255,0.5)" },
  priceOverlay: { fontSize: 15, fontWeight: "800" },
  priceOverlayUnit: { fontSize: 10, fontWeight: "500", color: "rgba(255,255,255,0.55)" },
  featuredBookBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12 },
  featuredBookBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
  tagPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "#101720" },
  tagPillText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  heartBtn: { width: 30, height: 30, borderRadius: 10, backgroundColor: "rgba(16,23,32,0.45)", justifyContent: "center", alignItems: "center" },
  availChip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, gap: 5, marginBottom: 4 },
  availChipOff: { backgroundColor: "rgba(220,220,220,0.85)" },
  availDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  availDotOff: { backgroundColor: "#d1d5db" },
  availText: { fontSize: 10, fontWeight: "700", color: "#101720" },
  bookingCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 16, padding: 14, marginHorizontal: 20, marginBottom: 10, borderWidth: 1, borderColor: "#eef0f3" },
  bookingIconBox: { width: 42, height: 42, borderRadius: 13, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  bookingName: { fontSize: 14, fontWeight: "700", color: "#101720", marginBottom: 3 },
  bookingMeta: { fontSize: 11, color: "#8696a0", fontWeight: "500" },
  bookingStatusPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  bookingStatusDot: { width: 5, height: 5, borderRadius: 3 },
  bookingStatusText: { fontSize: 10, fontWeight: "700" },
  bookingAmt: { fontSize: 13, fontWeight: "800", color: "#101720" },
  howRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, alignItems: "flex-start" },
  howStep: { alignItems: "center", flex: 1, position: "relative" },
  howCircle: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#f0fafa", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#d0f0ef", marginBottom: 8 },
  howLabel: { fontSize: 11, fontWeight: "700", color: "#101720", textAlign: "center", lineHeight: 15 },
  howConnector: { position: "absolute", top: 24, right: -16, width: 16, height: 1, backgroundColor: "#d0f0ef" },
  heroCard: { marginHorizontal: 20, borderRadius: 22, overflow: "hidden", height: 200, position: "relative", marginBottom: 12, borderWidth: 1, borderColor: "#eef0f3" },
  heroImg: { width: "100%", height: "100%", backgroundColor: "#e5e7eb" },
  heroOverlay: { ...StyleSheet.absoluteFillObject },
  heroRankBadge: { position: "absolute", top: 12, left: 12, backgroundColor: "#101720", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  heroRankText: { fontSize: 11, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },
  heroContent: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "flex-end", padding: 16, gap: 12 },
  heroCat: { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.65)", letterSpacing: 0.9, marginBottom: 4 },
  heroName: { fontSize: 18, fontWeight: "800", color: "#fff", letterSpacing: -0.4, marginBottom: 6 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 5 },
  heroRating: { fontSize: 12, fontWeight: "700", color: "#fff" },
  heroDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.4)" },
  heroPrice: { fontSize: 12, fontWeight: "700" },
  heroBookBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  smallCardsScroll: { paddingHorizontal: 20, gap: 10 },
  smallCard: { width: 148, height: 170, borderRadius: 18, overflow: "hidden", position: "relative", borderWidth: 1, borderColor: "#eef0f3" },
  smallImg: { width: "100%", height: "100%", backgroundColor: "#e5e7eb" },
  smallOverlay: { ...StyleSheet.absoluteFillObject },
  smallRankBadge: { position: "absolute", top: 10, left: 10, backgroundColor: "#101720", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9 },
  smallRankText: { fontSize: 11, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },
  smallContent: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 11 },
  smallCat: { fontSize: 8, fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: 0.7, marginBottom: 3 },
  smallName: { fontSize: 13, fontWeight: "800", color: "#fff", letterSpacing: -0.3, marginBottom: 5 },
  smallFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  smallRating: { fontSize: 11, fontWeight: "700", color: "#fff" },
  smallBookBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9 },
  smallBookBtnText: { fontSize: 10, fontWeight: "800", color: "#fff" },
  promoWrap: { marginHorizontal: 20, borderRadius: 20, overflow: "hidden" },
  promoGrad: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 22, paddingVertical: 20 },
  promoTitle: { fontSize: 17, fontWeight: "800", color: "#fff", marginBottom: 3 },
  promoSub: { fontSize: 12, color: "rgba(255,255,255,0.8)", fontWeight: "500" },
  promoBtn: { backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  promoBtnText: { fontSize: 13, fontWeight: "700", color: "#0cadab" },
});

// ─── Book-a-DJ Styles ─────────────────────────────────────────────────────────

const dj = StyleSheet.create({
  stepRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, marginBottom: 20 },
  stepPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#f0f2f5" },
  stepPillActive: { backgroundColor: "#101720" },
  stepPillDone: { backgroundColor: "#22c55e" },
  stepPillNum: { fontSize: 11, fontWeight: "700", color: "#8696a0" },
  stepPillLabel: { fontSize: 12, fontWeight: "600", color: "#8696a0" },
  stepLine: { flex: 1, height: 2, backgroundColor: "#eef0f3", marginHorizontal: 4 },
  stepLineDone: { backgroundColor: "#22c55e" },
  sectionHead: { fontSize: 20, fontWeight: "800", color: "#101720", letterSpacing: -0.4, marginBottom: 18 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  monthArrow: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#f0f2f5", justifyContent: "center", alignItems: "center" },
  monthLabel: { fontSize: 16, fontWeight: "700", color: "#101720" },
  dayNames: { flexDirection: "row", marginBottom: 6 },
  dayName: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: "#8696a0" },
  calGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, justifyContent: "center", alignItems: "center", position: "relative" },
  calRangeStrip: { position: "absolute", left: 0, right: 0, height: 36, top: "50%", marginTop: -18, backgroundColor: "rgba(12,173,171,0.13)" },
  calRangeStripStart: { left: "50%" },
  calRangeStripEnd: { right: "50%" },
  calDayCircle: { width: "72%", aspectRatio: 1, borderRadius: 100, justifyContent: "center", alignItems: "center", zIndex: 1 },
  calDayCircleActive: { backgroundColor: "#0cadab" },
  calText: { fontSize: 13, fontWeight: "600", color: "#101720", textAlign: "center" },
  calTextPast: { color: "#d1d5db" },
  calTextRange: { color: "#0cadab", fontWeight: "700" },
  calTextEndpoint: { color: "#fff", fontWeight: "800" },
  rangePill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: "#f4f8ff", borderRadius: 18, paddingVertical: 16, paddingHorizontal: 20, marginBottom: 20 },
  rangeSide: { alignItems: "center" },
  rangeLabel: { fontSize: 9, fontWeight: "700", color: "#8696a0", letterSpacing: 1, marginBottom: 3 },
  rangeVal: { fontSize: 14, fontWeight: "700", color: "#101720" },
  rangeDivider: { width: 1, height: 32, backgroundColor: "#e5e7eb" },
  nightBadge: { backgroundColor: "#101720", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  nightBadgeText: { fontSize: 12, fontWeight: "800", color: "#fff" },
  ctaBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#101720", borderRadius: 18, paddingVertical: 17, marginTop: 4 },
  ctaBtnOff: { opacity: 0.35 },
  ctaBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  dateBandRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16, backgroundColor: "#f0fafa", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  dateBand: { flex: 1, fontSize: 13, fontWeight: "600", color: "#101720" },
  changeLink: { fontSize: 13, fontWeight: "600", color: "#0cadab" },
  loadBox: { alignItems: "center", paddingVertical: 48, gap: 12 },
  loadText: { fontSize: 14, color: "#8696a0", textAlign: "center" },
  djCard: { backgroundColor: "#f9fafb", borderRadius: 18, marginBottom: 10, borderWidth: 1.5, borderColor: "transparent", overflow: "hidden" },
  djCardOn: { borderColor: "#0cadab", backgroundColor: "#f0fafa" },
  djCardOff: { opacity: 0.45 },
  djCardRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  djAvatar: { width: 56, height: 56, borderRadius: 16, backgroundColor: "#e5e7eb" },
  djRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" },
  djName: { fontSize: 15, fontWeight: "700", color: "#101720", letterSpacing: -0.3 },
  djGenre: { fontSize: 12, color: "#8696a0", marginBottom: 5 },
  djMeta: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  djRating: { fontSize: 11, fontWeight: "700", color: "#101720" },
  djReviews: { fontSize: 11, color: "#8696a0" },
  tag: { backgroundColor: "#eef0f3", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: "600", color: "#8696a0" },
  priceCol: { alignItems: "flex-end" },
  djPrice: { fontSize: 16, fontWeight: "800", color: "#101720", letterSpacing: -0.4 },
  djPriceUnit: { fontSize: 10, color: "#8696a0" },
  bookedBadge: { backgroundColor: "#fef2f2", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  bookedText: { fontSize: 10, fontWeight: "600", color: "#dc2626" },
  selectedBadge: { backgroundColor: "#f0fefa", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  selectedBadgeText: { fontSize: 10, fontWeight: "700", color: "#0cadab" },
  djDetail: { paddingHorizontal: 14, paddingBottom: 14 },
  djDetailDivider: { height: 1, backgroundColor: "#eef0f3", marginBottom: 14 },
  djDetailLabel: { fontSize: 11, fontWeight: "700", color: "#8696a0", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8 },
  djTagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  djDetailTag: { backgroundColor: "#101720", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  djDetailTagText: { fontSize: 11, fontWeight: "600", color: "#fff" },
  djStatsRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#f4f8ff", borderRadius: 14, paddingVertical: 12, marginBottom: 14 },
  djStat: { flex: 1, alignItems: "center" },
  djStatVal: { fontSize: 15, fontWeight: "800", color: "#101720", letterSpacing: -0.3 },
  djStatLbl: { fontSize: 10, color: "#8696a0", fontWeight: "600", marginTop: 2 },
  djStatDivider: { width: 1, height: 28, backgroundColor: "#e5e7eb" },
  djBio: { fontSize: 13, color: "#6b7280", lineHeight: 19, marginBottom: 14 },
  djActions: { flexDirection: "row" },
  djSelectBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, backgroundColor: "#101720", borderRadius: 14, paddingVertical: 13 },
  djSelectBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  confirmCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#f9fafb", borderRadius: 18, padding: 16, marginBottom: 20 },
  confirmAvatar: { width: 64, height: 64, borderRadius: 18, backgroundColor: "#e5e7eb" },
  confirmName: { fontSize: 17, fontWeight: "700", color: "#101720", letterSpacing: -0.3, marginBottom: 2 },
  confirmGenre: { fontSize: 13, color: "#8696a0", marginBottom: 2 },
  confirmRating: { fontSize: 12, fontWeight: "600", color: "#101720" },
  changeBtn: { backgroundColor: "#f0f2f5", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  changeBtnText: { fontSize: 12, fontWeight: "700", color: "#0cadab" },
  breakdown: { backgroundColor: "#f4f8ff", borderRadius: 18, padding: 18, marginBottom: 14 },
  breakRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  breakL: { fontSize: 13, color: "#8696a0", fontWeight: "500" },
  breakV: { fontSize: 13, fontWeight: "600", color: "#101720" },
  breakLine: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 8 },
  breakTotal: { fontSize: 22, fontWeight: "800", color: "#0cadab", letterSpacing: -0.5 },
  noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 7, marginBottom: 20 },
  noteText: { flex: 1, fontSize: 12, color: "#8696a0", lineHeight: 17 },
});