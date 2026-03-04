import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";

const { width } = Dimensions.get("window");

// ─── Logout Modal ──────────────────────────────────────────────────────────────

const LogoutModal = ({ visible, onClose, onConfirm, isGuest }) => {
  const scaleValue = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    } else {
      scaleValue.setValue(0);
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <Animated.View style={[modalStyles.modal, { transform: [{ scale: scaleValue }] }]}>
          <View style={modalStyles.iconCircle}>
            <Ionicons name="log-out-outline" size={30} color="#ef4444" />
          </View>

          <Text style={modalStyles.title}>
            {isGuest ? "End Guest Session?" : "Sign Out?"}
          </Text>
          <Text style={modalStyles.message}>
            {isGuest
              ? "Your current session will be ended and you'll return to the welcome screen."
              : "You'll need to sign in again to access your account and saved preferences."}
          </Text>

          <View style={modalStyles.buttonRow}>
            <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={modalStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modalStyles.confirmBtn} onPress={onConfirm} activeOpacity={0.8}>
              <Text style={modalStyles.confirmBtnText}>
                {isGuest ? "End Session" : "Sign Out"}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatDate = (dateString) => {
  if (!dateString) return "Not available";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return "Invalid date";
  }
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const StatCard = ({ icon, value, label }) => (
  <View style={styles.statCard}>
    <Ionicons name={icon} size={18} color="#0cadab" />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const MenuRow = ({ icon, label, sublabel = null, onPress, danger = false, rightEl = null }) => (
  <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.75}>
    <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
      <Ionicons name={icon} size={20} color={danger ? "#ef4444" : "#101720"} />
    </View>
    <View style={styles.menuTextBlock}>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      {sublabel ? <Text style={styles.menuSublabel}>{sublabel}</Text> : null}
    </View>
    {rightEl || (
      <Ionicons name="chevron-forward" size={18} color={danger ? "#ef4444" : "#c4c9d0"} />
    )}
  </TouchableOpacity>
);

const SectionCard = ({ title, children }) => (
  <View style={styles.sectionCard}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, logout, isGuest } = useAuth();
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "DJ";

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
          {/* ── Top Bar ── */}
          <View style={styles.topBar}>
            <Text style={styles.topBarTitle}>Profile</Text>
            <TouchableOpacity style={styles.settingsBtn}>
              <Ionicons name="settings-outline" size={22} color="#101720" />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Avatar Hero ── */}
            <View style={styles.avatarSection}>
              {isGuest ? (
                <View style={[styles.avatarCircle, styles.avatarCircleGuest]}>
                  <Ionicons name="person-outline" size={44} color="#8696a0" />
                </View>
              ) : (
                <LinearGradient
                  colors={["#0cadab", "#0a9998"]}
                  style={styles.avatarCircle}
                >
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </LinearGradient>
              )}

              {/* Online dot */}
              {!isGuest && <View style={styles.onlineDot} />}

              <Text style={styles.userName}>{isGuest ? "Guest User" : user?.name || "DJ User"}</Text>
              <Text style={styles.userEmail}>{isGuest ? "Not signed in" : user?.email || ""}</Text>

              {/* Verification badge */}
              {!isGuest && user?.isEmailVerified !== undefined && (
                <View style={[
                  styles.verifiedBadge,
                  !user.isEmailVerified && styles.unverifiedBadge
                ]}>
                  <Ionicons
                    name={user.isEmailVerified ? "checkmark-circle" : "alert-circle-outline"}
                    size={14}
                    color={user.isEmailVerified ? "#0cadab" : "#f59e0b"}
                  />
                  <Text style={[
                    styles.verifiedText,
                    !user.isEmailVerified && styles.unverifiedText
                  ]}>
                    {user.isEmailVerified ? "Verified Account" : "Unverified"}
                  </Text>
                </View>
              )}

              {/* Edit profile button */}
              {!isGuest && (
                <TouchableOpacity style={styles.editProfileBtn} activeOpacity={0.8}>
                  <Ionicons name="pencil-outline" size={15} color="#101720" />
                  <Text style={styles.editProfileText}>Edit Profile</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Guest CTA ── */}
            {isGuest && (
              <View style={styles.guestCTA}>
                <LinearGradient
                  colors={["#cfe8ff", "#c5d9f7"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.guestCard}
                >
                  <Text style={styles.guestCardTitle}>Unlock Full Access</Text>
                  <Text style={styles.guestCardSub}>
                    Sign up to book gear, track orders, and save your favourites.
                  </Text>
                  <View style={styles.guestFeatures}>
                    {[
                      { icon: "heart-outline",     text: "Save favourite gear" },
                      { icon: "cube-outline",       text: "Track your bookings"  },
                      { icon: "star-outline",       text: "Earn loyalty rewards" },
                      { icon: "musical-notes-outline", text: "Get DJ-curated picks" },
                    ].map((f, i) => (
                      <View key={i} style={styles.guestFeatureRow}>
                        <View style={styles.guestFeatureIcon}>
                          <Ionicons name={f.icon as any} size={16} color="#0cadab" />
                        </View>
                        <Text style={styles.guestFeatureText}>{f.text}</Text>
                      </View>
                    ))}
                  </View>
                </LinearGradient>

                <TouchableOpacity
                  style={styles.signupBtn}
                  onPress={() => router.push("/signup")}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={["#101720", "#1e2d3d"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.signupBtnGrad}
                  >
                    <Text style={styles.signupBtnText}>Create Account</Text>
                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.loginBtn}
                  onPress={() => router.push("/login")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.loginBtnText}>Already have an account? Sign In</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── Registered User ── */}
            {!isGuest && (
              <>
                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <StatCard icon="cube-outline"      value="12"   label="Bookings" />
                  <View style={styles.statDivider} />
                  <StatCard icon="heart-outline"     value="5"    label="Saved"    />
                  <View style={styles.statDivider} />
                  <StatCard icon="star-outline"      value="4.9"  label="Rating"   />
                  <View style={styles.statDivider} />
                  <StatCard icon="wallet-outline"    value="₹240" label="Saved"    />
                </View>

                {/* Account Info */}
                <SectionCard title="Account">
                  <MenuRow
                    icon="person-outline"
                    label="Full Name"
                    sublabel={user?.name || "Not provided"}
                    onPress={() => {}}
                  />
                  <MenuRow
                    icon="mail-outline"
                    label="Email"
                    sublabel={user?.email || "Not provided"}
                    onPress={() => {}}
                  />
                  <MenuRow
                    icon="call-outline"
                    label="Phone Number"
                    sublabel="Add phone number"
                    onPress={() => {}}
                  />
                  {user?.id && (
                    <MenuRow
                      icon="finger-print-outline"
                      label="User ID"
                      sublabel={user.id}
                      onPress={() => {}}
                    />
                  )}
                </SectionCard>

                {/* Bookings */}
                <SectionCard title="Bookings">
                  <MenuRow
                    icon="time-outline"
                    label="Active Rentals"
                    onPress={() => router.push("/bookings/active")}
                    rightEl={
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>2</Text>
                      </View>
                    }
                  />
                  <MenuRow
                    icon="checkmark-circle-outline"
                    label="Past Bookings"
                    onPress={() => router.push("/bookings/history")}
                  />
                  <MenuRow
                    icon="heart-outline"
                    label="Saved Equipment"
                    onPress={() => router.push("/saved")}
                  />
                </SectionCard>

                {/* Preferences */}
                <SectionCard title="Preferences">
                  <MenuRow
                    icon="location-outline"
                    label="Delivery Address"
                    sublabel="Add your default address"
                    onPress={() => {}}
                  />
                  <MenuRow
                    icon="notifications-outline"
                    label="Notifications"
                    onPress={() => {}}
                  />
                  <MenuRow
                    icon="moon-outline"
                    label="Dark Mode"
                    onPress={() => {}}
                    rightEl={
                      <View style={styles.toggleOff}>
                        <View style={styles.toggleThumb} />
                      </View>
                    }
                  />
                </SectionCard>

                {/* List Your Gear promo */}
                <TouchableOpacity style={styles.listerBanner} activeOpacity={0.88}>
                  <LinearGradient
                    colors={["#0cadab", "#0a9998"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.listerBannerGrad}
                  >
                    <View>
                      <Text style={styles.listerBannerTitle}>List Your Gear 🎛️</Text>
                      <Text style={styles.listerBannerSub}>
                        Earn money when you're not using your equipment
                      </Text>
                    </View>
                    <View style={styles.listerArrow}>
                      <Ionicons name="arrow-forward" size={18} color="#0cadab" />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Support & Legal */}
                <SectionCard title="Support">
                  <MenuRow icon="help-circle-outline" label="Help Centre"   onPress={() => {}} />
                  <MenuRow icon="chatbubble-outline"  label="Contact Us"    onPress={() => {}} />
                  <MenuRow icon="document-text-outline" label="Terms of Service" onPress={() => {}} />
                  <MenuRow icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => {}} />
                </SectionCard>

                {/* Joined date */}
                {user?.createdAt && (
                  <Text style={styles.joinedText}>
                    Member since {formatDate(user.createdAt)}
                  </Text>
                )}

                {/* Logout */}
                <TouchableOpacity
                  style={styles.logoutBtn}
                  onPress={() => setShowLogoutModal(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="log-out-outline" size={18} color="#ef4444" />
                  <Text style={styles.logoutBtnText}>Sign Out</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={{ height: 80 }} />
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>

      <LogoutModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => { setShowLogoutModal(false); logout(); }}
        isGuest={isGuest}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f8ff" },
  scrollContent: { paddingBottom: 16 },

  // ── Top Bar ─────────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  topBarTitle: { fontSize: 22, fontWeight: "800", color: "#101720", letterSpacing: -0.4 },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eef0f3",
  },

  // ── Avatar Hero ─────────────────────────────────────────────────────────────
  avatarSection: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 24,
    position: "relative",
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  avatarCircleGuest: { backgroundColor: "#e5e7eb" },
  avatarInitials: { fontSize: 36, fontWeight: "800", color: "#fff", letterSpacing: -1 },
  onlineDot: {
    position: "absolute",
    top: 74,
    right: width / 2 - 52,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22c55e",
    borderWidth: 2.5,
    borderColor: "#f4f8ff",
  },
  userName: { fontSize: 22, fontWeight: "800", color: "#101720", letterSpacing: -0.4 },
  userEmail: { fontSize: 14, color: "#8696a0", fontWeight: "500", marginTop: 3, marginBottom: 10 },

  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fafa",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 5,
    borderWidth: 1,
    borderColor: "#d0f0ef",
    marginBottom: 14,
  },
  unverifiedBadge: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  verifiedText: { fontSize: 12, fontWeight: "700", color: "#0cadab" },
  unverifiedText: { color: "#f59e0b" },

  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#eef0f3",
  },
  editProfileText: { fontSize: 13, fontWeight: "700", color: "#101720" },

  // ── Stats Row ────────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#eef0f3",
    alignItems: "center",
  },
  statCard: { flex: 1, alignItems: "center", gap: 3 },
  statDivider: { width: 1, height: 36, backgroundColor: "#eef0f3" },
  statValue: { fontSize: 16, fontWeight: "800", color: "#101720" },
  statLabel: { fontSize: 10, color: "#8696a0", fontWeight: "600" },

  // ── Section Card ─────────────────────────────────────────────────────────────
  sectionCard: {
    marginHorizontal: 20,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eef0f3",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8696a0",
    letterSpacing: 0.8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
    textTransform: "uppercase",
  },

  // ── Menu Row ─────────────────────────────────────────────────────────────────
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
    borderRadius: 14,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#f4f8ff",
    justifyContent: "center",
    alignItems: "center",
  },
  menuIconDanger: { backgroundColor: "#fef2f2" },
  menuTextBlock: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: "600", color: "#101720" },
  menuLabelDanger: { color: "#ef4444" },
  menuSublabel: { fontSize: 12, color: "#8696a0", fontWeight: "500", marginTop: 1 },

  activeBadge: {
    backgroundColor: "#0cadab",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: "center",
  },
  activeBadgeText: { fontSize: 11, fontWeight: "800", color: "#fff" },

  toggleOff: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
  },

  // ── Lister Banner ────────────────────────────────────────────────────────────
  listerBanner: { marginHorizontal: 20, marginBottom: 16, borderRadius: 18, overflow: "hidden" },
  listerBannerGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  listerBannerTitle: { fontSize: 15, fontWeight: "800", color: "#fff", marginBottom: 3 },
  listerBannerSub: { fontSize: 12, color: "rgba(255,255,255,0.82)", fontWeight: "500" },
  listerArrow: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Joined / Logout ──────────────────────────────────────────────────────────
  joinedText: {
    textAlign: "center",
    fontSize: 12,
    color: "#c4c9d0",
    fontWeight: "500",
    marginBottom: 14,
    marginTop: 4,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#fecaca",
    backgroundColor: "#fff5f5",
  },
  logoutBtnText: { fontSize: 15, fontWeight: "700", color: "#ef4444" },

  // ── Guest CTA ────────────────────────────────────────────────────────────────
  guestCTA: { paddingHorizontal: 20, gap: 14 },
  guestCard: { borderRadius: 22, padding: 24 },
  guestCardTitle: { fontSize: 20, fontWeight: "800", color: "#101720", marginBottom: 6 },
  guestCardSub: { fontSize: 13, color: "#4b6585", fontWeight: "500", marginBottom: 20, lineHeight: 19 },
  guestFeatures: { gap: 12 },
  guestFeatureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  guestFeatureIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  guestFeatureText: { fontSize: 14, fontWeight: "600", color: "#101720" },

  signupBtn: { borderRadius: 18, overflow: "hidden" },
  signupBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  signupBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  loginBtn: { alignItems: "center", paddingVertical: 6 },
  loginBtnText: { fontSize: 14, color: "#0cadab", fontWeight: "600" },
});

// ─── Modal Styles ─────────────────────────────────────────────────────────────

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(16, 23, 32, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 26,
    padding: 28,
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eef0f3",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#101720",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: "#8696a0",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 28,
    paddingHorizontal: 8,
    fontWeight: "500",
  },
  buttonRow: { flexDirection: "row", gap: 12, width: "100%" },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#f4f8ff",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eef0f3",
  },
  cancelBtnText: { color: "#8696a0", fontSize: 14, fontWeight: "700" },
  confirmBtn: {
    flex: 1,
    backgroundColor: "#ef4444",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});