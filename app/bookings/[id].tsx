/**
 * app/bookings/[id].tsx
 * User Booking Detail - Reliable Polling + OTP Visibility + Success Animation
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import { bookingApi } from "../../services/userApi";

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: string; label: string }> = {
  Pending:              { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", icon: "time-outline", label: "Pending" },
  Confirmed:            { color: "#0cadab", bg: "#f0fffe", border: "#a5f3fc", icon: "checkmark-circle-outline", label: "Confirmed" },
  "Equipment Dispatched": { color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe", icon: "car-outline", label: "Dispatched" },
  "In Progress":        { color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0", icon: "play-circle-outline", label: "In Progress" },
  Completed:            { color: "#22c55e", bg: "#f0fdf4", border: "#bbf7d0", icon: "checkmark-done-outline", label: "Completed" },
  Cancelled:            { color: "#ef4444", bg: "#fef2f2", border: "#fecaca", icon: "close-circle-outline", label: "Cancelled" },
};

export default function UserBookingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const bookingId = parseInt(id as string);

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);

  const scrollY = useRef(new Animated.Value(0)).current;
  const lottieRef = useRef<LottieView>(null);

  // Floating Header Animation
  const headerBg = scrollY.interpolate({
    inputRange: [180, 240],
    outputRange: ["rgba(244,248,255,0)", "rgba(244,248,255,1)"],
    extrapolate: "clamp",
  });

  const headerTitleOpacity = scrollY.interpolate({
    inputRange: [180, 240],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // Fetch booking data
  const fetchBooking = async () => {
    try {
      setLoading(true);
      const res = await bookingApi.getById(bookingId);
      
      if (res.success && res.data) {
        const newBooking = res.data;
        setBooking(newBooking);

        // Auto success when completed
        if (newBooking.status === "Completed") {
          setShowSuccess(true);
          setTimeout(() => lottieRef.current?.play(), 400);
        }
      } else {
        Alert.alert("Not Found", "This booking does not exist.");
        router.back();
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to load booking");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  // Polling every 3 seconds
  useEffect(() => {
    if (!bookingId) return;

    fetchBooking();

    const interval = setInterval(() => {
      fetchBooking();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [bookingId]);

  // Format Date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const openGoogleMaps = () => {
    if (!booking?.deliveryLatitude || !booking?.deliveryLongitude) {
      Alert.alert("No Location", "Delivery location is not available.");
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${booking.deliveryLatitude},${booking.deliveryLongitude}&travelmode=driving`;
    Linking.openURL(url);
  };

  const callDJ = () => {
    const phone = booking?.dj?.phone || booking?.captainDJ?.phone;
    if (!phone) return Alert.alert("No Contact", "DJ phone number is not available.");
    Linking.openURL(`tel:${phone}`);
  };

  const showOtp = () => {
    if (!booking?.otp) {
      Alert.alert("No OTP Yet", "Captain has not generated OTP for this booking yet.");
      return;
    }
    setShowOtpModal(true);
  };

  const submitReview = async () => {
    if (reviewRating === 0) return Alert.alert("Error", "Please select a rating");
    try {
      await bookingApi.addReview(bookingId, { rating: reviewRating });
      Alert.alert("Thank You!", "Review submitted successfully.");
      fetchBooking();
    } catch (err) {
      Alert.alert("Error", "Failed to submit review");
    }
  };

  if (loading && !booking) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#0cadab" />
        <Text style={styles.loadingText}>Loading booking details...</Text>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ fontSize: 18, color: "#ef4444" }}>Booking not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ color: "#0cadab", marginTop: 12 }}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const cfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.Pending;
  const djName = booking.dj?.name || booking.captainDJ?.name || "DJ Booking";
  const hourlyRate = booking.dj?.hourlyRate || booking.captainDJ?.hourlyRate || 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      >
        <View style={styles.statusBarSpacer} />

        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <Image
            source={{ 
              uri: booking.dj?.profilePicture || 
                   booking.captainDJ?.profilePicture || 
                   "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad" 
            }}
            style={styles.heroImg}
            resizeMode="cover"
          />
        </View>

        <View style={styles.content}>
          {/* Status */}
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
              <Ionicons name={cfg.icon} size={18} color={cfg.color} />
              <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          {/* Title */}
          <View style={styles.titleBlock}>
            <Text style={styles.title}>
              {djName} • ₹{hourlyRate}/hr
            </Text>
            <Text style={styles.category}>{booking.eventType}</Text>
          </View>

          {/* OTP Button - Shows when OTP exists */}
          {booking.otp && booking.status !== "Completed" && (
            <View style={styles.otpSection}>
              <TouchableOpacity style={styles.otpButton} onPress={showOtp}>
                <Ionicons name="key-outline" size={20} color="#fff" />
                <Text style={styles.otpButtonText}>Show Delivery OTP</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Event Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>EVENT DETAILS</Text>
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={20} color="#0cadab" />
              <Text style={styles.infoLabel}>Date</Text>
              <Text style={styles.infoValue}>{formatDate(booking.eventDate)}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={20} color="#0cadab" />
              <Text style={styles.infoLabel}>Time</Text>
              <Text style={styles.infoValue}>
                {booking.startTime} – {booking.endTime}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="hourglass-outline" size={20} color="#0cadab" />
              <Text style={styles.infoLabel}>Duration</Text>
              <Text style={styles.infoValue}>{booking.durationHours} hours</Text>
            </View>
          </View>

          {/* Delivery Address */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DELIVERY ADDRESS</Text>
            <View style={styles.addressCard}>
              <Ionicons name="location-outline" size={22} color="#0cadab" />
              <Text style={styles.addressText}>
                {booking.deliveryStreet ? booking.deliveryStreet + ", " : ""}
                {booking.deliveryCity}, {booking.deliveryState}
              </Text>
            </View>
          </View>

          {/* DJ Info */}
          {(booking.dj || booking.captainDJ) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>DJ / VENDOR</Text>
              <View style={styles.vendorCard}>
                <Text style={styles.vendorName}>
                  {booking.dj?.name || booking.captainDJ?.name}
                </Text>
                <TouchableOpacity style={styles.callButton} onPress={callDJ}>
                  <Ionicons name="call" size={18} color="#fff" />
                  <Text style={styles.callButtonText}>Call DJ</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Timeline */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BOOKING HISTORY</Text>
            <View style={styles.timeline}>
              <View style={styles.timelineLine} />
              <View style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineDate}>Booking Created</Text>
                  <Text style={styles.timelineDesc}>Request was submitted</Text>
                </View>
              </View>

              <View style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: "#0cadab" }]} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineDate}>Status Updated</Text>
                  <Text style={styles.timelineDesc}>Captain marked as {booking.status}</Text>
                </View>
              </View>

              {booking.status === "Completed" && (
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { backgroundColor: "#22c55e" }]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineDate}>Delivery Completed</Text>
                    <Text style={styles.timelineDesc}>Booking successfully completed</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          <View style={{ height: 140 }} />
        </View>
      </Animated.ScrollView>

      {/* Floating Header */}
      <SafeAreaView edges={["top"]} style={styles.headerWrap}>
        <Animated.View style={[styles.headerInner, { backgroundColor: headerBg }]}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#101720" />
          </TouchableOpacity>
          <Animated.Text style={[styles.headerTitleText, { opacity: headerTitleOpacity }]} numberOfLines={1}>
            {djName}
          </Animated.Text>
        </Animated.View>
      </SafeAreaView>

      {/* OTP Modal */}
      <Modal visible={showOtpModal} transparent animationType="fade">
        <View style={styles.otpModalOverlay}>
          <View style={styles.otpModal}>
            <Text style={styles.otpModalTitle}>Delivery OTP</Text>
            <Text style={styles.otpModalSubtitle}>Share this with the captain</Text>
            <Text style={styles.otpDisplay}>{booking?.otp || "—— ——"}</Text>

            <TouchableOpacity style={styles.closeOtpBtn} onPress={() => setShowOtpModal(false)}>
              <Text style={styles.closeOtpText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Animation Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successContent}>
            <LottieView
              ref={lottieRef}
              source={require("../../assets/animations/success.json")}
              autoPlay
              loop={false}
              style={styles.successLottie}
            />
            <Text style={styles.successTitle}>Booking Completed!</Text>
            <Text style={styles.successSubtitle}>Thank you for choosing Basswala</Text>

            <TouchableOpacity 
              style={styles.viewBookingsBtn}
              onPress={() => {
                setShowSuccess(false);
                router.push("/(tabs)/bookings");
              }}
            >
              <Text style={styles.viewBookingsText}>View My Bookings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom Bar */}
      <SafeAreaView edges={["bottom"]} style={styles.bottomWrap}>
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.bookBtn} onPress={openGoogleMaps}>
            <Ionicons name="map" size={20} color="#fff" />
            <Text style={styles.bookBtnLabel}>Navigate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bookBtn} onPress={callDJ}>
            <Ionicons name="call" size={20} color="#fff" />
            <Text style={styles.bookBtnLabel}>Call DJ</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f4f8ff" },
  statusBarSpacer: { height: 30 },

  heroContainer: {
    margin: 2,
    height: 260,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
  },
  heroImg: { width: "100%", height: "100%" },

  statusRow: { flexDirection: "row", justifyContent: "center", marginTop: 20, marginBottom: 12 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 30, borderWidth: 1 },
  statusText: { fontSize: 15, fontWeight: "700" },

  titleBlock: { paddingHorizontal: 20, paddingTop: 20 },
  title: { fontSize: 26, fontWeight: "800", color: "#101720", letterSpacing: -0.6 },
  category: { fontSize: 15, color: "#8696a0", marginTop: 4 },

  section: { marginTop: 12, backgroundColor: "#fff", padding: 20, borderRadius: 18, marginHorizontal: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#8696a0", letterSpacing: 0.8, marginBottom: 12 },

  infoRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f4f8ff" },
  infoLabel: { flex: 1, fontSize: 15, color: "#5a6169" },
  infoValue: { fontSize: 15, fontWeight: "600", color: "#101720" },

  addressCard: { flexDirection: "row", gap: 12, backgroundColor: "#f8fafc", padding: 16, borderRadius: 16 },
  addressText: { flex: 1, fontSize: 15, lineHeight: 22, color: "#374151" },

  vendorCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", padding: 16, borderRadius: 16 },
  vendorName: { fontSize: 17, fontWeight: "700", color: "#101720" },
  callButton: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#0cadab", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
  callButtonText: { color: "#fff", fontWeight: "700" },

  otpSection: { marginHorizontal: 16, marginTop: 12 },
  otpButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    gap: 10, 
    backgroundColor: "#0cadab", 
    paddingVertical: 16, 
    borderRadius: 16 
  },
  otpButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  starsContainer: { flexDirection: "row", justifyContent: "center", gap: 12, marginBottom: 16 },
  submitReviewBtn: { backgroundColor: "#0cadab", paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  submitReviewBtnDisabled: { backgroundColor: "#e5e7eb" },
  submitReviewText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  timeline: { marginTop: 8, position: "relative", paddingLeft: 20 },
  timelineLine: { position: "absolute", left: 11, top: 12, bottom: 12, width: 2, backgroundColor: "#e5e7eb" },
  timelineItem: { flexDirection: "row", marginBottom: 20 },
  timelineDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#0cadab", borderWidth: 3, borderColor: "#fff", zIndex: 1 },
  timelineContent: { flex: 1, marginLeft: 16, paddingTop: 2 },
  timelineDate: { fontSize: 13, fontWeight: "700", color: "#8696a0" },
  timelineDesc: { fontSize: 14, color: "#101720", marginTop: 2 },

  headerWrap: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 100 },
  headerInner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  headerBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.88)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(238,240,243,0.7)" },
  headerTitleText: { flex: 1, fontSize: 16, fontWeight: "800", color: "#101720", letterSpacing: -0.3 },

  bottomWrap: { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#eef0f3" },
  bottomBar: { flexDirection: "row", padding: 16, gap: 12 },
  bookBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: "#101720", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  bookBtnLabel: { fontSize: 16, fontWeight: "800", color: "#fff" },

  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#8696a0" },

  // OTP Modal
  otpModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", alignItems: "center" },
  otpModal: { backgroundColor: "#fff", borderRadius: 24, padding: 30, width: "85%", alignItems: "center" },
  otpModalTitle: { fontSize: 20, fontWeight: "800", color: "#101720", marginBottom: 8 },
  otpModalSubtitle: { fontSize: 14, color: "#8696a0", marginBottom: 24 },
  otpDisplay: { fontSize: 42, fontWeight: "800", letterSpacing: 12, color: "#0cadab", marginBottom: 30 },
  closeOtpBtn: { backgroundColor: "#f4f8ff", paddingVertical: 14, paddingHorizontal: 40, borderRadius: 16 },
  closeOtpText: { color: "#0cadab", fontWeight: "700" },

  // Success Modal
  successOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" },
  successContent: { backgroundColor: "#fff", borderRadius: 28, padding: 40, alignItems: "center", width: "88%" },
  successLottie: { width: 180, height: 180 },
  successTitle: { fontSize: 24, fontWeight: "800", color: "#101720", marginTop: 20 },
  successSubtitle: { fontSize: 15, color: "#8696a0", marginTop: 8, marginBottom: 40 },
  viewBookingsBtn: { backgroundColor: "#0cadab", paddingVertical: 16, paddingHorizontal: 50, borderRadius: 18 },
  viewBookingsText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});