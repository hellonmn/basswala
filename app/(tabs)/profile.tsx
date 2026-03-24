import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const { width } = Dimensions.get("window");

// ─── Mock Data ────────────────────────────────────────────────────────────────

const captainProfile = {
  name: "Rahul Sharma",
  role: "DJ & Sound Captain",
  id: "CPT-4892",
  email: "rahul.sharma@djgear.in",
  phone: "+91 98765 43210",
  location: "Jaipur, Rajasthan",
  memberSince: "March 2022",
  isVerified: true,
  rating: 4.9,
  totalRatings: 342,
  completionRate: 97,
};

const statsRow = [
  { label: "Bookings", value: "156", icon: "musical-notes-outline" },
  { label: "Equipment", value: "24", icon: "hardware-chip-outline" },
  { label: "Rating", value: "4.9", icon: "star-outline" },
  { label: "Reviews", value: "342", icon: "chatbubble-outline" },
];

const badges = [
  { label: "Top Earner", icon: "trophy-outline", color: "#f59e0b", bg: "#fffbeb" },
  { label: "5★ Captain", icon: "star-outline", color: "#6366f1", bg: "#eef2ff" },
  { label: "Pro Verified", icon: "shield-checkmark-outline", color: "#0cadab", bg: "#f0fffe" },
  { label: "100+ Bookings", icon: "checkmark-done-outline", color: "#22c55e", bg: "#f0fdf4" },
];

// ─── Logout Modal ─────────────────────────────────────────────────────────────

const LogoutModal = ({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) => {
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
          <Text style={modalStyles.title}>Sign Out?</Text>
          <Text style={modalStyles.message}>
            You'll need to sign in again to access your captain dashboard and bookings.
          </Text>
          <View style={modalStyles.buttonRow}>
            <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={modalStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={modalStyles.confirmBtn} onPress={onConfirm} activeOpacity={0.8}>
              <Text style={modalStyles.confirmBtnText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const MenuRow = ({
  icon,
  label,
  sublabel = null,
  onPress,
  danger = false,
  rightEl = null,
  accentColor = null,
}: {
  icon: string;
  label: string;
  sublabel?: string | null;
  onPress: () => void;
  danger?: boolean;
  rightEl?: React.ReactNode;
  accentColor?: string | null;
}) => (
  <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.75}>
    <View style={[styles.menuIcon, danger && styles.menuIconDanger, accentColor ? { backgroundColor: "#f0fffe" } : null]}>
      <Ionicons name={icon as any} size={20} color={danger ? "#ef4444" : accentColor ?? "#101720"} />
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

const SectionCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.sectionCard}>
    <Text style={styles.sectionLabel}>{title}</Text>
    {children}
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CaptainProfileScreen() {
  const [showLogout, setShowLogout] = useState(false);

  const initials = captainProfile.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

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
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={20} color="#101720" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>Profile</Text>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="settings-outline" size={20} color="#101720" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* ── Avatar Hero ── */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarOuter}>
                <LinearGradient colors={["#0cadab", "#0a9998"]} style={styles.avatarCircle}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </LinearGradient>
                <View style={styles.onlineDot} />
              </View>

              <Text style={styles.captainName}>{captainProfile.name}</Text>
              <Text style={styles.captainRole}>{captainProfile.role}</Text>

              <View style={styles.metaRow}>
                <View style={styles.metaChip}>
                  <Ionicons name="location-outline" size={13} color="#8696a0" />
                  <Text style={styles.metaChipText}>{captainProfile.location}</Text>
                </View>
                <View style={styles.metaChip}>
                  <Ionicons name="calendar-outline" size={13} color="#8696a0" />
                  <Text style={styles.metaChipText}>Since {captainProfile.memberSince}</Text>
                </View>
              </View>

              {/* Verified + Rating row */}
              <View style={styles.badgeRow}>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={13} color="#0cadab" />
                  <Text style={styles.verifiedText}>Verified Captain</Text>
                </View>
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={13} color="#f59e0b" />
                  <Text style={styles.ratingText}>{captainProfile.rating}</Text>
                  <Text style={styles.ratingCount}>({captainProfile.totalRatings})</Text>
                </View>
              </View>

              {/* Edit Profile Button */}
              <TouchableOpacity style={styles.editBtn} activeOpacity={0.8}>
                <Ionicons name="pencil-outline" size={15} color="#101720" />
                <Text style={styles.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>

            {/* ── Stats Row ── */}
            <View style={styles.statsContainer}>
              {statsRow.map((s, i) => (
                <React.Fragment key={i}>
                  <View style={styles.statItem}>
                    <Ionicons name={s.icon as any} size={16} color="#0cadab" />
                    <Text style={styles.statValue}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                  {i < statsRow.length - 1 && <View style={styles.statDivider} />}
                </React.Fragment>
              ))}
            </View>

            {/* ── Completion Rate ── */}
            <View style={styles.completionSection}>
              <View style={styles.completionCard}>
                <View style={styles.completionHeader}>
                  <Text style={styles.completionTitle}>Completion Rate</Text>
                  <Text style={styles.completionValue}>{captainProfile.completionRate}%</Text>
                </View>
                <View style={styles.completionBar}>
                  <LinearGradient
                    colors={["#0cadab", "#0a9998"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.completionFill, { width: `${captainProfile.completionRate}%` as any }]}
                  />
                </View>
                <Text style={styles.completionSub}>
                  You're in the top 5% of captains in Jaipur 🎉
                </Text>
              </View>
            </View>

            {/* ── Achievement Badges ── */}
            <View style={styles.badgesSection}>
              <Text style={styles.sectionTitleLg}>Achievements</Text>
              <View style={styles.badgesGrid}>
                {badges.map((b, i) => (
                  <View key={i} style={styles.achievementBadge}>
                    <View style={[styles.achievementIcon, { backgroundColor: b.bg }]}>
                      <Ionicons name={b.icon as any} size={20} color={b.color} />
                    </View>
                    <Text style={styles.achievementLabel}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ── Account Info ── */}
            <SectionCard title="Account">
              <MenuRow
                icon="person-outline"
                label="Full Name"
                sublabel={captainProfile.name}
                onPress={() => {}}
              />
              <MenuRow
                icon="mail-outline"
                label="Email"
                sublabel={captainProfile.email}
                onPress={() => {}}
              />
              <MenuRow
                icon="call-outline"
                label="Phone"
                sublabel={captainProfile.phone}
                onPress={() => {}}
              />
              <MenuRow
                icon="finger-print-outline"
                label="Captain ID"
                sublabel={captainProfile.id}
                onPress={() => {}}
              />
            </SectionCard>

            {/* ── Business ── */}
            <SectionCard title="Business">
              <MenuRow
                icon="wallet-outline"
                label="Earnings & Payouts"
                onPress={() => {}}
                accentColor="#0cadab"
              />
              <MenuRow
                icon="hardware-chip-outline"
                label="My Inventory"
                onPress={() => {}}
                accentColor="#0cadab"
              />
              <MenuRow
                icon="document-text-outline"
                label="Booking History"
                onPress={() => {}}
                accentColor="#0cadab"
              />
              <MenuRow
                icon="star-outline"
                label="Reviews & Ratings"
                onPress={() => {}}
                accentColor="#0cadab"
                rightEl={
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>342</Text>
                  </View>
                }
              />
            </SectionCard>

            {/* ── Preferences ── */}
            <SectionCard title="Preferences">
              <MenuRow
                icon="notifications-outline"
                label="Notifications"
                onPress={() => {}}
              />
              <MenuRow
                icon="location-outline"
                label="Service Area"
                sublabel="Jaipur, Rajasthan"
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
              <MenuRow
                icon="language-outline"
                label="Language"
                sublabel="English"
                onPress={() => {}}
              />
            </SectionCard>

            {/* ── Support ── */}
            <SectionCard title="Support">
              <MenuRow icon="help-circle-outline" label="Help Centre" onPress={() => {}} />
              <MenuRow icon="chatbubble-outline" label="Contact Support" onPress={() => {}} />
              <MenuRow icon="document-text-outline" label="Terms of Service" onPress={() => {}} />
              <MenuRow icon="shield-checkmark-outline" label="Privacy Policy" onPress={() => {}} />
            </SectionCard>

            {/* ── Joined info ── */}
            <Text style={styles.joinedText}>
              Captain since {captainProfile.memberSince} · ID {captainProfile.id}
            </Text>

            {/* ── Logout ── */}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => setShowLogout(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="log-out-outline" size={18} color="#ef4444" />
              <Text style={styles.logoutBtnText}>Sign Out</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>

      <LogoutModal
        visible={showLogout}
        onClose={() => setShowLogout(false)}
        onConfirm={() => setShowLogout(false)}
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
    borderBottomWidth: 1,
    borderBottomColor: "#eef0f3",
  },
  topBarTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#101720",
    letterSpacing: -0.4,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eef0f3",
  },

  // ── Avatar Hero ──────────────────────────────────────────────────────────────
  avatarSection: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  avatarOuter: {
    position: "relative",
    marginBottom: 16,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -1,
  },
  onlineDot: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#22c55e",
    borderWidth: 3,
    borderColor: "#f4f8ff",
  },
  captainName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#101720",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  captainRole: {
    fontSize: 14,
    color: "#8696a0",
    fontWeight: "600",
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#eef0f3",
  },
  metaChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5a6169",
  },
  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#f0fafa",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#d0f0ef",
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0cadab",
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fffbeb",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#101720",
  },
  ratingCount: {
    fontSize: 11,
    fontWeight: "500",
    color: "#8696a0",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#eef0f3",
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#101720",
  },

  // ── Stats Row ────────────────────────────────────────────────────────────────
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#eef0f3",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#eef0f3",
  },
  statValue: {
    fontSize: 17,
    fontWeight: "800",
    color: "#101720",
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 10,
    color: "#8696a0",
    fontWeight: "600",
  },

  // ── Completion Rate ───────────────────────────────────────────────────────────
  completionSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  completionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#eef0f3",
    gap: 10,
  },
  completionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  completionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#101720",
  },
  completionValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0cadab",
    letterSpacing: -0.5,
  },
  completionBar: {
    height: 8,
    backgroundColor: "#eef0f3",
    borderRadius: 4,
    overflow: "hidden",
  },
  completionFill: {
    height: "100%",
    borderRadius: 4,
  },
  completionSub: {
    fontSize: 12,
    color: "#8696a0",
    fontWeight: "500",
  },

  // ── Badges ───────────────────────────────────────────────────────────────────
  badgesSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitleLg: {
    fontSize: 20,
    fontWeight: "800",
    color: "#101720",
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  badgesGrid: {
    flexDirection: "row",
    gap: 10,
  },
  achievementBadge: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#eef0f3",
  },
  achievementIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  achievementLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#101720",
    textAlign: "center",
    letterSpacing: 0.1,
  },

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
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#8696a0",
    letterSpacing: 0.8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
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
    minWidth: 28,
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

  // ── Bottom ───────────────────────────────────────────────────────────────────
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
  logoutBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ef4444",
  },
});

// ─── Modal Styles ─────────────────────────────────────────────────────────────

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(16,23,32,0.45)",
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