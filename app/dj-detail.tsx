import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { servicesApi, bookingApi } from "../services/userApi";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "../context/LocationContext";

const { width } = Dimensions.get("window");

interface CaptainDJ {
  id: number;
  name: string;
  bio?: string;
  genres: string[];
  experienceYears: number;
  hourlyRate: number;
  minimumHours: number;
  currency: string;
  isAvailable: boolean;
  specializations: string[];
  ratingAverage: number;
  ratingCount: number;
  images: string[];
  captain?: {
    id: number;
    businessName?: string;
    locationCity?: string;
    locationState?: string;
    latitude?: number;
    longitude?: number;
  };
}

// ─── Booking Modal ─────────────────────────────────────────────────────────────
const BookingModal = ({
  visible,
  dj,
  captainId,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  dj: CaptainDJ | null;
  captainId: number;
  onClose: () => void;
  onSuccess: (bookingId: number) => void;
}) => {
  const { location } = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    eventType: "Wedding",
    eventDate: "",
    startTime: "18:00",
    endTime: "23:00",
    durationHours: "5",
    guestCount: "",
    specialRequests: "",
    deliveryCity: location?.city || "",
    deliveryStreet: "",
  });

  if (!dj) return null;

  const hourlyRate = Number(dj.hourlyRate);
  const duration = parseInt(form.durationHours) || dj.minimumHours;
  const totalFee = hourlyRate * duration;

  const handleSubmit = async () => {
    if (!form.eventDate) return Alert.alert("Required", "Please enter the event date (YYYY-MM-DD)");
    if (!form.deliveryCity) return Alert.alert("Required", "Please enter delivery city");
    if (duration < dj.minimumHours) {
      return Alert.alert("Minimum hours", `This DJ requires a minimum of ${dj.minimumHours} hours`);
    }

    setSubmitting(true);
    try {
      const res = await bookingApi.create({
        captainId,
        captainDJId: dj.id,
        eventType: form.eventType,
        eventDate: form.eventDate,
        startTime: form.startTime,
        endTime: form.endTime,
        durationHours: duration,
        guestCount: form.guestCount ? parseInt(form.guestCount) : undefined,
        specialRequests: form.specialRequests || undefined,
        deliveryLocation: {
          latitude: location?.latitude || 26.9124,
          longitude: location?.longitude || 75.7873,
          street: form.deliveryStreet || undefined,
          city: form.deliveryCity,
        },
      });

      if (res.success) {
        onSuccess(res.data?.id);
      } else {
        Alert.alert("Error", res.message || "Failed to create booking");
      }
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || err.message || "Failed to create booking");
    } finally {
      setSubmitting(false);
    }
  };

  const Field = ({ label, value, onChangeText, placeholder, keyboardType = "default" }: any) => (
    <View style={bS.field}>
      <Text style={bS.label}>{label}</Text>
      <TextInput
        style={bS.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8696a0"
        keyboardType={keyboardType}
      />
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={bS.overlay}>
        <View style={bS.sheet}>
          <View style={bS.topRow}>
            <View>
              <Text style={bS.title}>Book {dj.name}</Text>
              <Text style={bS.sub}>₹{hourlyRate.toLocaleString()}/hr · Min {dj.minimumHours}h</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={bS.closeBtn}>
              <Ionicons name="close" size={20} color="#101720" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Event Type */}
            <View style={bS.field}>
              <Text style={bS.label}>Event Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {bookingApi.EVENT_TYPES.map(t => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setForm(p => ({ ...p, eventType: t }))}
                      style={[bS.typeChip, form.eventType === t && bS.typeChipActive]}
                      activeOpacity={0.8}
                    >
                      <Text style={[bS.typeChipText, form.eventType === t && bS.typeChipTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            <Field label="Event Date (YYYY-MM-DD) *" value={form.eventDate}
              onChangeText={(v: string) => setForm(p => ({ ...p, eventDate: v }))}
              placeholder="e.g. 2026-05-15" />

            <View style={bS.rowFields}>
              <View style={{ flex: 1 }}>
                <Field label="Start Time" value={form.startTime}
                  onChangeText={(v: string) => setForm(p => ({ ...p, startTime: v }))}
                  placeholder="18:00" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="End Time" value={form.endTime}
                  onChangeText={(v: string) => setForm(p => ({ ...p, endTime: v }))}
                  placeholder="23:00" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Duration (hrs)" value={form.durationHours}
                  onChangeText={(v: string) => setForm(p => ({ ...p, durationHours: v }))}
                  placeholder={String(dj.minimumHours)} keyboardType="numeric" />
              </View>
            </View>

            <View style={bS.rowFields}>
              <View style={{ flex: 1 }}>
                <Field label="Guest Count" value={form.guestCount}
                  onChangeText={(v: string) => setForm(p => ({ ...p, guestCount: v }))}
                  placeholder="100" keyboardType="numeric" />
              </View>
              <View style={{ flex: 2 }}>
                <Field label="Event City *" value={form.deliveryCity}
                  onChangeText={(v: string) => setForm(p => ({ ...p, deliveryCity: v }))}
                  placeholder="Jaipur" />
              </View>
            </View>

            <Field label="Venue Address" value={form.deliveryStreet}
              onChangeText={(v: string) => setForm(p => ({ ...p, deliveryStreet: v }))}
              placeholder="Street, area, landmark..." />

            <Field label="Special Requests" value={form.specialRequests}
              onChangeText={(v: string) => setForm(p => ({ ...p, specialRequests: v }))}
              placeholder="Song preferences, dress code..." />

            {/* Pricing summary */}
            <View style={bS.priceSummary}>
              <View style={bS.priceRow}>
                <Text style={bS.priceKey}>DJ Fee ({duration}h × ₹{hourlyRate.toLocaleString()})</Text>
                <Text style={bS.priceVal}>₹{totalFee.toLocaleString()}</Text>
              </View>
              <View style={[bS.priceRow, bS.totalRow]}>
                <Text style={bS.totalKey}>Estimated Total</Text>
                <Text style={bS.totalVal}>₹{totalFee.toLocaleString()}</Text>
              </View>
            </View>

            <TouchableOpacity style={bS.submitBtn} onPress={handleSubmit} disabled={submitting} activeOpacity={0.8}>
              <LinearGradient colors={["#0cadab", "#0a9998"]} style={bS.submitBtnGrad}>
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={bS.submitBtnText}>Confirm Booking</Text>
                  </>
                }
              </LinearGradient>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function DJDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { isAuthenticated } = useAuth();
  const djId = parseInt(params.djId as string);
  const captainId = parseInt(params.captainId as string);

  const [dj, setDj] = useState<CaptainDJ | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);

  useEffect(() => {
    const fetchDJ = async () => {
      try {
        // Get all DJs and find the one we want
        const res = await servicesApi.getAllDJs();
        if (res.success) {
          const found = (res.data || []).find((d: CaptainDJ) => d.id === djId);
          if (found) setDj(found);
        }
      } catch (err) {
        console.error("fetchDJ error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDJ();
  }, [djId]);

  const handleBookPress = () => {
    if (!isAuthenticated) {
      Alert.alert("Login Required", "Please log in to book a DJ.", [
        { text: "Cancel", style: "cancel" },
        { text: "Login", onPress: () => router.push("/(auth)/login" as any) },
      ]);
      return;
    }
    setShowBooking(true);
  };

  const handleBookingSuccess = (bookingId: number) => {
    setShowBooking(false);
    Alert.alert(
      "🎉 Booking Confirmed!",
      `Your booking #${bookingId} has been created. The captain will confirm soon.`,
      [
        { text: "View My Bookings", onPress: () => router.push("/my-bookings" as any) },
        { text: "Done", style: "cancel" },
      ]
    );
  };

  if (loading) return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f4f8ff" }}>
      <ActivityIndicator size="large" color="#0cadab" />
    </View>
  );

  if (!dj) return (
    <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f4f8ff" }}>
      <Ionicons name="musical-notes-outline" size={48} color="#c4c9d0" />
      <Text style={{ fontSize: 18, fontWeight: "700", color: "#101720", marginTop: 12 }}>DJ not found</Text>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
        <Text style={{ color: "#0cadab", fontWeight: "600" }}>Go Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );

  const totalMin = Number(dj.hourlyRate) * dj.minimumHours;

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f8ff" />
      <SafeAreaView style={styles.container} edges={["top"]}>
        <LinearGradient colors={["#f4f8ff", "#eef1f9", "#ffffff"]} style={{ flex: 1 }}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#101720" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle} numberOfLines={1}>{dj.name}</Text>
            <View style={{ width: 42 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Hero Avatar */}
            <View style={styles.heroSection}>
              <LinearGradient
                colors={dj.isAvailable ? ["#0cadab", "#0a9998"] : ["#8696a0", "#5a6169"]}
                style={styles.heroAvatar}
              >
                <Text style={styles.heroAvatarText}>{dj.name[0]?.toUpperCase()}</Text>
              </LinearGradient>
              <Text style={styles.heroName}>{dj.name}</Text>
              {dj.captain?.businessName ? (
                <View style={styles.heroMeta}>
                  <Ionicons name="storefront-outline" size={14} color="#8696a0" />
                  <Text style={styles.heroMetaText}>{dj.captain.businessName}</Text>
                  {dj.captain.locationCity ? <>
                    <Text style={styles.dot}>·</Text>
                    <Ionicons name="location-outline" size={14} color="#8696a0" />
                    <Text style={styles.heroMetaText}>{dj.captain.locationCity}</Text>
                  </> : null}
                </View>
              ) : null}

              {/* Rating + avail */}
              <View style={styles.badgeRow}>
                {dj.ratingCount > 0 ? (
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={13} color="#f59e0b" />
                    <Text style={styles.ratingBadgeText}>{Number(dj.ratingAverage).toFixed(1)} ({dj.ratingCount})</Text>
                  </View>
                ) : null}
                <View style={[styles.availBadge, { backgroundColor: dj.isAvailable ? "#f0fdf4" : "#fef2f2" }]}>
                  <View style={[styles.availDot, { backgroundColor: dj.isAvailable ? "#22c55e" : "#ef4444" }]} />
                  <Text style={[styles.availBadgeText, { color: dj.isAvailable ? "#22c55e" : "#ef4444" }]}>
                    {dj.isAvailable ? "Available" : "Currently Busy"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statVal}>₹{Number(dj.hourlyRate).toLocaleString()}</Text>
                <Text style={styles.statLbl}>Per Hour</Text>
              </View>
              <View style={styles.statDiv} />
              <View style={styles.stat}>
                <Text style={styles.statVal}>{dj.minimumHours}h</Text>
                <Text style={styles.statLbl}>Min Hours</Text>
              </View>
              <View style={styles.statDiv} />
              <View style={styles.stat}>
                <Text style={styles.statVal}>{dj.experienceYears}yr</Text>
                <Text style={styles.statLbl}>Experience</Text>
              </View>
            </View>

            {/* Bio */}
            {dj.bio ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>About</Text>
                <View style={styles.bioCard}>
                  <Text style={styles.bioText}>{dj.bio}</Text>
                </View>
              </View>
            ) : null}

            {/* Genres */}
            {dj.genres && dj.genres.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Music Genres</Text>
                <View style={styles.tagWrap}>
                  {dj.genres.map(g => (
                    <View key={g} style={styles.tag}>
                      <Ionicons name="musical-note-outline" size={12} color="#0cadab" />
                      <Text style={styles.tagText}>{g}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Specializations */}
            {dj.specializations && dj.specializations.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Specializes In</Text>
                <View style={styles.tagWrap}>
                  {dj.specializations.map(s => (
                    <View key={s} style={[styles.tag, styles.tagSpec]}>
                      <Ionicons name="star-outline" size={12} color="#6366f1" />
                      <Text style={[styles.tagText, { color: "#6366f1" }]}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Pricing summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pricing</Text>
              <LinearGradient colors={["#101720", "#1e2d3d"]} style={styles.priceCard}>
                <View style={styles.priceCardRow}>
                  <Text style={styles.priceCardKey}>Hourly Rate</Text>
                  <Text style={styles.priceCardVal}>₹{Number(dj.hourlyRate).toLocaleString()}/hr</Text>
                </View>
                <View style={styles.priceCardDivider} />
                <View style={styles.priceCardRow}>
                  <Text style={styles.priceCardKey}>Minimum Booking</Text>
                  <Text style={styles.priceCardVal}>{dj.minimumHours} hours</Text>
                </View>
                <View style={styles.priceCardDivider} />
                <View style={styles.priceCardRow}>
                  <Text style={[styles.priceCardKey, { color: "#fff", fontWeight: "700" }]}>Starting From</Text>
                  <Text style={[styles.priceCardVal, { color: "#0cadab", fontSize: 22, fontWeight: "800" }]}>
                    ₹{totalMin.toLocaleString()}
                  </Text>
                </View>
              </LinearGradient>
            </View>

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Bottom CTA */}
          <View style={styles.bottomBar}>
            <View style={styles.bottomBarLeft}>
              <Text style={styles.bottomBarLabel}>Starting from</Text>
              <Text style={styles.bottomBarPrice}>₹{totalMin.toLocaleString()}</Text>
            </View>
            <TouchableOpacity
              style={[styles.bookBtn, !dj.isAvailable && styles.bookBtnOff]}
              onPress={handleBookPress}
              disabled={!dj.isAvailable}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={dj.isAvailable ? ["#0cadab", "#0a9998"] : ["#e5e7eb", "#e5e7eb"]}
                style={styles.bookBtnGrad}
              >
                <Text style={[styles.bookBtnText, !dj.isAvailable && styles.bookBtnTextOff]}>
                  {dj.isAvailable ? "Book Now" : "Currently Unavailable"}
                </Text>
                {dj.isAvailable ? <Ionicons name="arrow-forward" size={16} color="#fff" /> : null}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>

      <BookingModal
        visible={showBooking}
        dj={dj}
        captainId={captainId}
        onClose={() => setShowBooking(false)}
        onSuccess={handleBookingSuccess}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f8ff" },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#eef0f3",
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 14, backgroundColor: "#fff",
    justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#eef0f3",
  },
  topBarTitle: { fontSize: 18, fontWeight: "800", color: "#101720", flex: 1, textAlign: "center", marginHorizontal: 8 },
  scrollContent: { paddingBottom: 24 },

  heroSection: { alignItems: "center", paddingVertical: 28 },
  heroAvatar: { width: 100, height: 100, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 14 },
  heroAvatarText: { fontSize: 40, fontWeight: "800", color: "#fff" },
  heroName: { fontSize: 26, fontWeight: "800", color: "#101720", letterSpacing: -0.5, marginBottom: 6 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 12 },
  heroMetaText: { fontSize: 13, color: "#8696a0", fontWeight: "500" },
  dot: { color: "#c4c9d0" },
  badgeRow: { flexDirection: "row", gap: 8 },
  ratingBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#fffbeb", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "#fde68a",
  },
  ratingBadgeText: { fontSize: 12, fontWeight: "700", color: "#101720" },
  availBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  availDot: { width: 7, height: 7, borderRadius: 4 },
  availBadgeText: { fontSize: 12, fontWeight: "700" },

  statsRow: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 20, backgroundColor: "#fff", borderRadius: 20,
    padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#eef0f3",
  },
  stat: { flex: 1, alignItems: "center" },
  statDiv: { width: 1, height: 32, backgroundColor: "#eef0f3" },
  statVal: { fontSize: 20, fontWeight: "800", color: "#101720", letterSpacing: -0.4 },
  statLbl: { fontSize: 11, color: "#8696a0", fontWeight: "600", marginTop: 3 },

  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: "#101720", letterSpacing: -0.3, marginBottom: 12 },
  bioCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#eef0f3" },
  bioText: { fontSize: 14, lineHeight: 22, color: "#4b6585", fontWeight: "500" },
  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#f0fffe", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: "#a5f3fc",
  },
  tagSpec: { backgroundColor: "#eef2ff", borderColor: "#c7d2fe" },
  tagText: { fontSize: 13, fontWeight: "700", color: "#0cadab" },

  priceCard: { borderRadius: 20, padding: 18 },
  priceCardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  priceCardKey: { fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: "500" },
  priceCardVal: { fontSize: 15, fontWeight: "700", color: "#fff" },
  priceCardDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 10 },

  bottomBar: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 28 : 14,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#eef0f3", gap: 12,
  },
  bottomBarLeft: { flex: 1 },
  bottomBarLabel: { fontSize: 10, color: "#8696a0", fontWeight: "700", letterSpacing: 0.5 },
  bottomBarPrice: { fontSize: 22, fontWeight: "800", color: "#0cadab", letterSpacing: -0.5 },
  bookBtn: { flex: 2, borderRadius: 16, overflow: "hidden" },
  bookBtnOff: { opacity: 0.6 },
  bookBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, gap: 8 },
  bookBtnText: { fontSize: 16, fontWeight: "800", color: "#fff" },
  bookBtnTextOff: { color: "#8696a0" },
});

// ─── Booking Modal Styles ──────────────────────────────────────────────────────
const bS = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(16,23,32,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingTop: 16, maxHeight: "92%",
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title: { fontSize: 22, fontWeight: "800", color: "#101720", letterSpacing: -0.4 },
  sub: { fontSize: 13, color: "#8696a0", fontWeight: "500", marginTop: 3 },
  closeBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#f4f8ff", justifyContent: "center", alignItems: "center",
  },
  field: { marginBottom: 14 },
  label: { fontSize: 11, fontWeight: "700", color: "#5a6169", marginBottom: 7, letterSpacing: 0.3 },
  input: {
    borderWidth: 1, borderColor: "#eef0f3", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: "#101720",
  },
  rowFields: { flexDirection: "row", gap: 10 },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#f4f8ff", borderWidth: 1, borderColor: "#eef0f3",
  },
  typeChipActive: { backgroundColor: "#0cadab", borderColor: "#0cadab" },
  typeChipText: { fontSize: 12, fontWeight: "700", color: "#8696a0" },
  typeChipTextActive: { color: "#fff" },
  priceSummary: {
    backgroundColor: "#f8fafc", borderRadius: 16, padding: 14,
    marginTop: 8, marginBottom: 16, borderWidth: 1, borderColor: "#eef0f3",
  },
  priceRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  priceKey: { fontSize: 13, color: "#8696a0", fontWeight: "500" },
  priceVal: { fontSize: 13, fontWeight: "700", color: "#101720" },
  totalRow: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#eef0f3" },
  totalKey: { fontSize: 15, fontWeight: "700", color: "#101720" },
  totalVal: { fontSize: 18, fontWeight: "800", color: "#0cadab", letterSpacing: -0.4 },
  submitBtn: { borderRadius: 16, overflow: "hidden" },
  submitBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, gap: 8 },
  submitBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});