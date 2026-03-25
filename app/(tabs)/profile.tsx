/**
 * profile.tsx — Fully functional profile screen
 *
 * Features:
 *  - Real booking stats fetched + counted from API
 *  - Skeleton loader while stats load
 *  - Navigation to Edit Profile, Change Password, Saved DJs, Bookings
 *  - Linking for Help, Contact, Terms, Privacy
 *  - Logout confirmation modal with spring animation
 *  - Success toast shown after returning from Edit Profile
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  Animated,
  Dimensions,
  Easing,
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
import { useAuth } from "../../context/AuthContext";
import { apiService } from "../../services/api";

const { width } = Dimensions.get("window");

// ─── Success Toast ────────────────────────────────────────────────────────────

function SuccessToast({ visible }: { visible: boolean }) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 120,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -80,
          duration: 280,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      style={[ts.toast, { transform: [{ translateY }], opacity }]}
      pointerEvents="none"
    >
      <View style={ts.iconCircle}>
        <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
      </View>
      <Text style={ts.toastText}>Profile saved successfully!</Text>
    </Animated.View>
  );
}

// ─── Skeleton pulse ───────────────────────────────────────────────────────────

function Skel({ w, h, r = 8 }: { w: number | string; h: number; r?: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{
      width: w as any, height: h, borderRadius: r, backgroundColor: "#e5e7eb",
      opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] }),
    }} />
  );
}

// ─── Logout Modal ─────────────────────────────────────────────────────────────

function LogoutModal({ visible, onClose, onConfirm }: {
  visible: boolean; onClose: () => void; onConfirm: () => void;
}) {
  const scale = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.spring(scale, { toValue: visible ? 1 : 0, useNativeDriver: true, tension: 100, friction: 8 }).start();
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <Animated.View style={[ms.modal, { transform: [{ scale }] }]}>
          <View style={ms.iconCircle}>
            <Ionicons name="log-out-outline" size={30} color="#ef4444" />
          </View>
          <Text style={ms.title}>Sign Out?</Text>
          <Text style={ms.message}>You'll need to sign in again to access your account.</Text>
          <View style={ms.btnRow}>
            <TouchableOpacity style={ms.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={ms.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={ms.confirmBtn} onPress={onConfirm} activeOpacity={0.8}>
              <Text style={ms.confirmText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ icon, value, label, color = "#0cadab" }: {
  icon: string; value: string | number; label: string; color?: string;
}) {
  return (
    <View style={s.statCard}>
      <Ionicons name={icon as any} size={18} color={color} />
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Menu row ─────────────────────────────────────────────────────────────────

function MenuRow({ icon, label, sublabel, onPress, danger = false, badge, toggle }: {
  icon: string; label: string; sublabel?: string; onPress: () => void;
  danger?: boolean; badge?: number; toggle?: boolean;
}) {
  return (
    <TouchableOpacity style={s.menuRow} onPress={onPress} activeOpacity={0.72}>
      <View style={[s.menuIcon, danger && s.menuIconDanger]}>
        <Ionicons name={icon as any} size={20} color={danger ? "#ef4444" : "#101720"} />
      </View>
      <View style={s.menuText}>
        <Text style={[s.menuLabel, danger && { color: "#ef4444" }]}>{label}</Text>
        {sublabel ? <Text style={s.menuSub}>{sublabel}</Text> : null}
      </View>
      {badge !== undefined && badge > 0
        ? <View style={s.badge}><Text style={s.badgeText}>{badge}</Text></View>
        : toggle
          ? <View style={s.toggleTrack}><View style={s.toggleThumb} /></View>
          : <Ionicons name="chevron-forward" size={18} color={danger ? "#fca5a5" : "#c4c9d0"} />
      }
    </TouchableOpacity>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionCard}>{children}</View>
    </View>
  );
}

const Divider = () => <View style={s.rowDivider} />;

// ─── Main screen ──────────────────────────────────────────────────────────────

interface Stats { total: number; active: number; completed: number; cancelled: number; }

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ saved?: string }>();

  const [showLogout, setShowLogout] = useState(false);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, completed: 0, cancelled: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [showToast, setShowToast] = useState(false);

  // Show toast when returning from edit with ?saved=1
  useEffect(() => {
    if (params.saved === "1") {
      setShowToast(true);
      const t = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(t);
    }
  }, [params.saved]);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const profileRes = await apiService.getProfile().catch(() => null);
      const pd = profileRes?.data ?? profileRes;
      if (pd?.bookingStats) {
        const b = pd.bookingStats;
        setStats({
          total:     b.totalBookings     ?? b.total     ?? 0,
          active:    b.pendingBookings   ?? b.active    ?? b.confirmed ?? 0,
          completed: b.completedBookings ?? b.completed ?? 0,
          cancelled: b.cancelledBookings ?? b.cancelled ?? 0,
        });
      } else {
        const bkRes = await apiService.getMyBookings();
        const list: any[] = Array.isArray(bkRes?.data ?? bkRes) ? (bkRes?.data ?? bkRes) : [];
        const norm = (s: string) => (s ?? "").toLowerCase().trim();
        setStats({
          total:     list.length,
          active:    list.filter(b => ["pending","confirmed","in progress","active"].includes(norm(b.status))).length,
          completed: list.filter(b => norm(b.status) === "completed").length,
          cancelled: list.filter(b => ["cancelled","canceled"].includes(norm(b.status))).length,
        });
      }
    } catch { /* silently fail */ }
    finally { setLoadingStats(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadStats(); }, [loadStats]));

  const displayName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.name ?? "User";

  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : null;

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f8ff" />
      <SafeAreaView style={s.root} edges={["top"]}>
        <LinearGradient colors={["#f4f8ff","#eef1f9","#ffffff"]} style={{ flex: 1 }}>

          {/* Success Toast — absolutely positioned above everything */}
          <SuccessToast visible={showToast} />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>Profile</Text>
            <TouchableOpacity style={s.settingsBtn}
              onPress={() => router.push("/profile/edit" as any)}>
              <Ionicons name="settings-outline" size={22} color="#101720" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

            {/* Avatar hero */}
            <View style={s.hero}>
              <LinearGradient colors={["#0cadab","#0a9998"]} style={s.avatarCircle}>
                <Text style={s.avatarText}>{initials}</Text>
              </LinearGradient>
              <View style={s.onlineDot} />
              <Text style={s.heroName}>{displayName}</Text>
              <Text style={s.heroEmail}>{user?.email ?? ""}</Text>

              <View style={s.badgesRow}>
                {user?.isEmailVerified && (
                  <View style={s.verifiedBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#0cadab" />
                    <Text style={s.verifiedText}>Verified</Text>
                  </View>
                )}
                {user?.locationCity && (
                  <View style={s.locationBadge}>
                    <Ionicons name="location-outline" size={13} color="#8696a0" />
                    <Text style={s.locationBadgeText}>
                      {[user.locationCity, user.locationState].filter(Boolean).join(", ")}
                    </Text>
                  </View>
                )}
              </View>

              <TouchableOpacity style={s.editBtn} activeOpacity={0.8}
                onPress={() => router.push("/profile/edit" as any)}>
                <Ionicons name="pencil-outline" size={15} color="#101720" />
                <Text style={s.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            </View>

            {/* Stats */}
            {loadingStats ? (
              <View style={s.statsRow}>
                {[1,2,3,4].map((_, i, arr) => (
                  <React.Fragment key={i}>
                    <View style={s.statCard}>
                      <Skel w={22} h={22} r={6} />
                      <Skel w={30} h={18} r={5} />
                      <Skel w={46} h={11} r={4} />
                    </View>
                    {i < arr.length - 1 && <View style={s.statDivider} />}
                  </React.Fragment>
                ))}
              </View>
            ) : (
              <View style={s.statsRow}>
                <StatCard icon="calendar-outline"         value={stats.total}     label="Bookings" />
                <View style={s.statDivider} />
                <StatCard icon="time-outline"             value={stats.active}    label="Active"    color="#f59e0b" />
                <View style={s.statDivider} />
                <StatCard icon="checkmark-circle-outline" value={stats.completed} label="Done"      color="#22c55e" />
                <View style={s.statDivider} />
                <StatCard icon="close-circle-outline"     value={stats.cancelled} label="Cancelled" color="#ef4444" />
              </View>
            )}

            {/* Account — Account Type removed */}
            <Section title="Account">
              <MenuRow icon="person-outline" label="Full Name" sublabel={displayName}
                onPress={() => router.push("/profile/edit" as any)} />
              <Divider />
              <MenuRow icon="mail-outline" label="Email" sublabel={user?.email ?? "—"}
                onPress={() => router.push("/profile/edit" as any)} />
              <Divider />
              <MenuRow icon="call-outline" label="Phone"
                sublabel={user?.phone ?? "Add phone number"}
                onPress={() => router.push("/profile/edit" as any)} />
              <Divider />
              <MenuRow icon="lock-closed-outline" label="Change Password"
                onPress={() => router.push("/profile/change-password" as any)} />
            </Section>

            {/* Bookings — Booking History removed */}
            <Section title="Bookings">
              <MenuRow icon="calendar-outline" label="My Bookings"
                badge={stats.active}
                onPress={() => router.push("/(tabs)/bookings" as any)} />
              <Divider />
              <MenuRow icon="heart-outline" label="Saved DJs"
                onPress={() => router.push("/profile/saved-djs" as any)} />
            </Section>

            {/* Payments */}
            <Section title="Payments">
              <MenuRow icon="wallet-outline" label="Basswala Wallet"
                sublabel="Balance · Transactions · Top-up"
                onPress={() => router.push("/wallet" as any)} />
              <Divider />
              <MenuRow icon="refresh-circle-outline" label="Refunds"
                sublabel="Request or track a refund"
                onPress={() => router.push("/wallet/refund" as any)} />
            </Section>

            {/* Preferences */}
            <Section title="Preferences">
              <MenuRow icon="location-outline" label="Location"
                sublabel={user?.locationCity
                  ? [user.locationCity, user.locationState].filter(Boolean).join(", ")
                  : "Set your location"}
                onPress={() => router.push("/profile/edit" as any)} />
              <Divider />
              <MenuRow icon="notifications-outline" label="Notifications" onPress={() => {}} />
              <Divider />
              <MenuRow icon="moon-outline" label="Dark Mode" toggle onPress={() => {}} />
            </Section>

            {/* DJ banner */}
            <TouchableOpacity style={s.djBanner} activeOpacity={0.88}>
              <LinearGradient colors={["#0cadab","#0a9998"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.djBannerInner}>
                <View style={{ flex: 1 }}>
                  <Text style={s.djBannerTitle}>List Your DJ Services 🎛️</Text>
                  <Text style={s.djBannerSub}>Earn money by performing at events</Text>
                </View>
                <View style={s.djBannerArrow}>
                  <Ionicons name="arrow-forward" size={18} color="#0cadab" />
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Support */}
            <Section title="Support">
              <MenuRow icon="help-circle-outline"       label="Help Centre"
                onPress={() => router.push("/profile/help-center" as any)} />
              <Divider />
              <MenuRow icon="chatbubble-outline"        label="Contact Us"
                onPress={() => router.push("/profile/contact-us" as any)} />
              <Divider />
              <MenuRow icon="document-text-outline"    label="Terms of Service"
                onPress={() => Linking.openURL("https://basswala.in/terms").catch(() => {})} />
              <Divider />
              <MenuRow icon="shield-checkmark-outline" label="Privacy Policy"
                onPress={() => router.push("/profile/privacy-policy" as any)} />
            </Section>

            {memberSince && (
              <Text style={s.memberSince}>Member since {memberSince}</Text>
            )}

            <TouchableOpacity style={s.logoutBtn} onPress={() => setShowLogout(true)} activeOpacity={0.85}>
              <Ionicons name="log-out-outline" size={18} color="#ef4444" />
              <Text style={s.logoutText}>Sign Out</Text>
            </TouchableOpacity>

            <Text style={s.version}>Basswala v1.0.0</Text>
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>

      <LogoutModal
        visible={showLogout}
        onClose={() => setShowLogout(false)}
        onConfirm={async () => { setShowLogout(false); await logout(); }}
      />
    </>
  );
}

const s = StyleSheet.create({
  root:             { flex: 1, backgroundColor: "#f4f8ff" },
  header:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle:      { fontSize: 22, fontWeight: "800", color: "#101720", letterSpacing: -0.4 },
  settingsBtn:      { width: 42, height: 42, borderRadius: 14, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#eef0f3" },

  hero:             { alignItems: "center", paddingTop: 8, paddingBottom: 24, position: "relative" },
  avatarCircle:     { width: 96, height: 96, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: 14 },
  avatarText:       { fontSize: 36, fontWeight: "800", color: "#fff", letterSpacing: -1 },
  onlineDot:        { position: "absolute", top: 74, right: width / 2 - 52, width: 14, height: 14, borderRadius: 7, backgroundColor: "#22c55e", borderWidth: 2.5, borderColor: "#f4f8ff" },
  heroName:         { fontSize: 22, fontWeight: "800", color: "#101720", letterSpacing: -0.4, marginBottom: 4 },
  heroEmail:        { fontSize: 14, color: "#8696a0", fontWeight: "500", marginBottom: 12 },
  badgesRow:        { flexDirection: "row", gap: 8, marginBottom: 16 },
  verifiedBadge:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f0fafa", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#d0f0ef" },
  verifiedText:     { fontSize: 11, fontWeight: "700", color: "#0cadab" },
  locationBadge:    { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#f4f8ff", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#eef0f3" },
  locationBadgeText:{ fontSize: 11, fontWeight: "600", color: "#8696a0" },
  editBtn:          { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", borderRadius: 14, paddingHorizontal: 20, paddingVertical: 11, borderWidth: 1, borderColor: "#eef0f3" },
  editBtnText:      { fontSize: 13, fontWeight: "700", color: "#101720" },

  statsRow:         { flexDirection: "row", marginHorizontal: 20, backgroundColor: "#fff", borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#eef0f3", alignItems: "center" },
  statCard:         { flex: 1, alignItems: "center", gap: 4 },
  statDivider:      { width: 1, height: 36, backgroundColor: "#eef0f3" },
  statValue:        { fontSize: 17, fontWeight: "800", color: "#101720" },
  statLabel:        { fontSize: 10, color: "#8696a0", fontWeight: "600" },

  section:          { marginHorizontal: 20, marginBottom: 16 },
  sectionTitle:     { fontSize: 11, fontWeight: "700", color: "#8696a0", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 },
  sectionCard:      { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#eef0f3", overflow: "hidden" },
  menuRow:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  menuIcon:         { width: 40, height: 40, borderRadius: 13, backgroundColor: "#f4f8ff", justifyContent: "center", alignItems: "center" },
  menuIconDanger:   { backgroundColor: "#fef2f2" },
  menuText:         { flex: 1 },
  menuLabel:        { fontSize: 15, fontWeight: "600", color: "#101720" },
  menuSub:          { fontSize: 12, color: "#8696a0", fontWeight: "500", marginTop: 1 },
  badge:            { backgroundColor: "#0cadab", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, minWidth: 22, alignItems: "center" },
  badgeText:        { fontSize: 11, fontWeight: "800", color: "#fff" },
  toggleTrack:      { width: 44, height: 26, borderRadius: 13, backgroundColor: "#e5e7eb", justifyContent: "center", paddingHorizontal: 3 },
  toggleThumb:      { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  rowDivider:       { height: 1, backgroundColor: "#f3f4f6", marginHorizontal: 16 },

  djBanner:         { marginHorizontal: 20, marginBottom: 16, borderRadius: 18, overflow: "hidden" },
  djBannerInner:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 18, gap: 16 },
  djBannerTitle:    { fontSize: 15, fontWeight: "800", color: "#fff", marginBottom: 3 },
  djBannerSub:      { fontSize: 12, color: "rgba(255,255,255,0.82)", fontWeight: "500" },
  djBannerArrow:    { width: 40, height: 40, borderRadius: 13, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },

  memberSince:      { textAlign: "center", fontSize: 12, color: "#c4c9d0", fontWeight: "500", marginBottom: 14, marginTop: 4 },
  logoutBtn:        { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 20, paddingVertical: 16, borderRadius: 18, borderWidth: 1.5, borderColor: "#fecaca", backgroundColor: "#fff5f5", marginBottom: 10 },
  logoutText:       { fontSize: 15, fontWeight: "700", color: "#ef4444" },
  version:          { textAlign: "center", fontSize: 11, color: "#d1d5db", marginBottom: 8 },
});

const ms = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(16,23,32,0.45)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  modal:      { backgroundColor: "#fff", borderRadius: 26, padding: 28, width: "100%", maxWidth: 380, alignItems: "center", borderWidth: 1, borderColor: "#eef0f3" },
  iconCircle: { width: 72, height: 72, borderRadius: 24, backgroundColor: "#fef2f2", alignItems: "center", justifyContent: "center", marginBottom: 20, borderWidth: 1, borderColor: "#fecaca" },
  title:      { fontSize: 20, fontWeight: "800", color: "#101720", textAlign: "center", marginBottom: 10, letterSpacing: -0.3 },
  message:    { fontSize: 14, color: "#8696a0", textAlign: "center", lineHeight: 21, marginBottom: 28, paddingHorizontal: 8, fontWeight: "500" },
  btnRow:     { flexDirection: "row", gap: 12, width: "100%" },
  cancelBtn:  { flex: 1, backgroundColor: "#f4f8ff", borderRadius: 16, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: "#eef0f3" },
  cancelText: { color: "#8696a0", fontSize: 14, fontWeight: "700" },
  confirmBtn: { flex: 1, backgroundColor: "#ef4444", borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  confirmText:{ color: "#fff", fontSize: 14, fontWeight: "700" },
});

const ts = StyleSheet.create({
  toast:      { position: "absolute", top: 12, left: 20, right: 20, zIndex: 999, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1, borderColor: "#bbf7d0", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 8 },
  iconCircle: { width: 36, height: 36, borderRadius: 11, backgroundColor: "#f0fdf4", justifyContent: "center", alignItems: "center" },
  toastText:  { fontSize: 14, fontWeight: "700", color: "#15803d" },
});