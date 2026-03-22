/**
 * BookingBottomSheet.tsx
 *
 * FLOW (fixed):
 *   1. User taps "Continue to Payment"
 *   2. Plane animation starts immediately (overlay inside sheet)
 *   3. createPaymentOrder() runs — plane keeps playing
 *   4. Razorpay / PaymentScreen opens AS A MODAL on top of the plane overlay
 *   5. User pays — Razorpay closes
 *   6. Plane overlay is STILL showing (never hidden between steps)
 *   7. Plane text updates to "Confirming booking…"
 *   8. createRental() runs — plane keeps playing
 *   9. Receipt step appears, plane hides
 *
 * PaymentScreen is now rendered inside the existing plane overlay Modal
 * so there is zero flash of the booking sheet between payment return
 * and rental creation.
 *
 * BOTTOM NAV:
 *   emitSheet(true)  on open  → CustomTabBar slides away
 *   emitSheet(false) on close → CustomTabBar slides back
 *   Import path: @/utils/tabBarEmitter
 *
 * ANIMATION PATH: assets/animations/ (not assets/animation/)
 *
 * AUTO-NAVIGATE FIX:
 *   onBooked()      → fires silently when rental is created (no navigation side-effect)
 *   onViewBookings() → fires ONLY when user taps "View My Bookings" CTA on receipt
 *   onClose()       → just dismisses the sheet, never navigates
 *
 *   In your parent screen:
 *     onBooked={r => { /* store receipt locally if needed *\/ }}
 *     onViewBookings={() => router.push("/(tabs)/bookings")}
 */

import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiService } from "../services/api";
import { emitSheet } from "@/utils/tabBarEmitter";
import PaymentScreen from "./PaymentScreen";

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Equipment {
  id: string;
  name: string;
  category: string;
  price: number;
  deposit: number;
  pickupAddress: string;
  accentColor?: string;
}

export interface RentalReceipt {
  rentalId: string;
  equipmentName: string;
  days: number;
  totalAmount: number;
  paymentMethod: string;
  paymentId?: string;
  deliveryMethod: string;
  address: string;
  contactName: string;
  contactPhone: string;
  createdAt: string;
}

export interface PaymentResult {
  success: boolean;
  method: "upi_app" | "upi_id" | "card" | "cod";
  paymentId?: string;
  orderId?: string;
  signature?: string;
  dismissed?: boolean;
  error?: string;
}

type DeliveryMethod = "delivery" | "pickup";
type SheetStep      = "delivery" | "success" | "receipt";

// What the plane overlay is currently doing
type PlanePhase =
  | "idle"          // not visible
  | "preparing"     // createPaymentOrder in flight
  | "paying"        // Razorpay/PaymentScreen open — plane still shows behind it
  | "confirming";   // createRental in flight

interface Props {
  visible: boolean;
  equipment: Equipment;
  days?: number;
  onClose: () => void;
  /** Fires silently when rental record is created — do NOT navigate here */
  onBooked?: (receipt: RentalReceipt) => void;
  /** Fires ONLY when user explicitly taps "View My Bookings" — navigate here */
  onViewBookings?: (receipt: RentalReceipt) => void;
  bottomNavHeight?: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const CURRENT_USER = {
  name: "Arjun Sharma",
  phone: "9876543210",
  email: "arjun@example.com",
};

const SAVED_ADDRESSES = [
  { id: "1", label: "Home",  icon: "home-outline"     as const, address: "42, Shyam Nagar, Jaipur, 302019",      pincode: "302019" },
  { id: "2", label: "Work",  icon: "business-outline" as const, address: "Plot 9, Malviya Nagar, Jaipur, 302017", pincode: "302017" },
  { id: "3", label: "Other", icon: "location-outline" as const, address: "15, Vaishali Nagar, Jaipur, 302021",    pincode: "302021" },
];

const PAY_LABEL: Record<string, string> = {
  upi_app: "UPI App", upi_id: "UPI ID", card: "Card", cod: "Cash on Delivery",
};

const PLANE_TEXT: Record<PlanePhase, { title: string; sub: string }> = {
  idle:       { title: "",                      sub: ""                                  },
  preparing:  { title: "Setting up payment…",   sub: "Hang tight, almost ready"          },
  paying:     { title: "Processing payment…",   sub: "Do not close or go back"           },
  confirming: { title: "Confirming booking…",   sub: "Recording your rental details"     },
};

const CTA_BAR_HEIGHT = 88;

// ═══════════════════════════════════════════════════════════════════════════════

export default function BookingBottomSheet({
  visible,
  equipment: eq,
  days = 1,
  onClose,
  onBooked,
  onViewBookings,
  bottomNavHeight = 50,
}: Props) {
  const insets = useSafeAreaInsets();
  const accent = eq.accentColor ?? "#0cadab";
  const total  = eq.price * days;
  const grand  = total + eq.deposit;

  const successLottieRef = useRef<LottieView>(null);
  const planeLottieRef   = useRef<LottieView>(null);
  const headerFade       = useRef(new Animated.Value(0)).current;
  const pillSlide        = useRef(new Animated.Value(30)).current;

  const snapPoints = useMemo(() => {
    const topPct = Math.round(((SCREEN_H - bottomNavHeight - 16) / SCREEN_H) * 100);
    return ["62%", `${topPct}%`];
  }, [bottomNavHeight]);

  // ── State ───────────────────────────────────────────────────────────────────
  const [step,           setStep]           = useState<SheetStep>("delivery");
  const [planePhase,     setPlanePhase]     = useState<PlanePhase>("idle");
  const [showPayment,    setShowPayment]    = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("delivery");
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>("1");
  const [address,        setAddress]        = useState(SAVED_ADDRESSES[0].address);
  const [landmark,       setLandmark]       = useState("");
  const [pincode,        setPincode]        = useState(SAVED_ADDRESSES[0].pincode);
  const [altContact,     setAltContact]     = useState({ enabled: false, name: "", phone: "", email: "" });
  const [orderId,        setOrderId]        = useState("");
  const [payResult,      setPayResult]      = useState<PaymentResult | null>(null);
  const [receipt,        setReceipt]        = useState<RentalReceipt | null>(null);
  const [countdown,      setCountdown]      = useState(5);
  const successProg = useRef(new Animated.Value(0)).current;

  // Keep payResult in a ref so createRental can read the latest value
  // without needing to be in its dependency array
  const payResultRef = useRef<PaymentResult | null>(null);
  useEffect(() => { payResultRef.current = payResult; }, [payResult]);

  // ── Declarative sheet index ─────────────────────────────────────────────────
  const sheetIndex = useMemo(() => {
    if (!visible) return -1;
    if (step === "success" || step === "receipt") return 1;
    return 0;
  }, [visible, step]);

  // ── Notify tab bar ──────────────────────────────────────────────────────────
  useEffect(() => {
    emitSheet(visible);   // true  = sheet open  → tab bar hides
                           // false = sheet closed → tab bar shows
  }, [visible]);

  // ── Reset + entrance animation on open ─────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setStep("delivery");
      setPlanePhase("idle");
      setShowPayment(false);
      setPayResult(null);
      setReceipt(null);
      headerFade.setValue(0);
      pillSlide.setValue(30);
      Animated.parallel([
        Animated.timing(headerFade, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.spring(pillSlide,  { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // ── Success step ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== "success") return;
    successProg.setValue(0);
    setCountdown(5);
    setTimeout(() => successLottieRef.current?.play(), 80);
    Animated.timing(successProg, {
      toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: false,
    }).start();
    const iv = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { clearInterval(iv); return 0; } return c - 1; });
    }, 1000);
    const t = setTimeout(createRental, 5000);
    return () => { clearInterval(iv); clearTimeout(t); };
  }, [step]);

  // ── createRental — called from success step OR "Go now" button ──────────────
  const confirmingRef = useRef(false);
  const createRental = useCallback(async () => {
    if (confirmingRef.current) return;
    confirmingRef.current = true;

    // Switch plane text to "Confirming booking…" and keep animation running
    setPlanePhase("confirming");
    setTimeout(() => planeLottieRef.current?.play(), 80);

    const pr      = payResultRef.current;
    const contact = altContact.enabled && altContact.name ? altContact : CURRENT_USER;

    try {
      const res = await apiService.createRental({
        equipmentId:     eq.id,
        startDate:       new Date().toISOString(),
        endDate:         new Date(Date.now() + days * 86_400_000).toISOString(),
        deliveryAddress: deliveryMethod === "delivery" ? address : eq.pickupAddress,
        paymentId:       pr?.paymentId,
        paymentMethod:   pr?.method,
        razorpayOrderId: orderId,
      });

      // Brief moment so animation always feels meaningful
      await new Promise((r) => setTimeout(r, 900));

      const r: RentalReceipt = {
        rentalId:      res?.rental?.id ?? `RNT-${Date.now()}`,
        equipmentName: eq.name,
        days,
        totalAmount:   grand,
        paymentMethod: pr?.method ?? "cod",
        paymentId:     pr?.paymentId,
        deliveryMethod,
        address:       deliveryMethod === "delivery" ? address : eq.pickupAddress,
        contactName:   contact.name,
        contactPhone:  contact.phone,
        createdAt:     new Date().toISOString(),
      };

      setPlanePhase("idle");   // hide plane
      setReceipt(r);
      setStep("receipt");
      onBooked?.(r); // silent — store receipt only; do NOT navigate in this callback
    } catch (e: any) {
      setPlanePhase("idle");
      Alert.alert("Booking Failed", e.message ?? "Could not create booking.");
    } finally {
      confirmingRef.current = false;
    }
  }, [altContact, deliveryMethod, address, eq, days, grand, orderId]);

  // ── goToPayment ─────────────────────────────────────────────────────────────
  const goToPayment = useCallback(async () => {
    if (deliveryMethod === "delivery" && address.trim().length < 6) {
      return Alert.alert("Missing Address", "Please enter or select a delivery address.");
    }

    // 1. Show plane immediately
    setPlanePhase("preparing");
    setTimeout(() => planeLottieRef.current?.play(), 80);

    try {
      // 2. Create order (plane plays during this)
      const res = await apiService.createPaymentOrder(grand);
      if (!res?.orderId) throw new Error("No order ID returned");
      setOrderId(res.orderId);

      // 3. Switch text and open payment screen ON TOP of the plane overlay
      setPlanePhase("paying");
      setShowPayment(true);

    } catch (e: any) {
      setPlanePhase("idle");
      Alert.alert("Setup Failed", e.message ?? "Could not create payment order.");
    }
  }, [deliveryMethod, address, grand]);

  // ── Payment result callback ─────────────────────────────────────────────────
  const onPaymentResult = useCallback((result: PaymentResult) => {
    // Close payment screen — plane overlay stays visible (phase = "paying")
    setShowPayment(false);

    if (result.success) {
      setPayResult(result);
      // Immediately start rental creation — plane continues with "confirming" text
      payResultRef.current = result;
      createRental();
    } else if (result.dismissed) {
      // User backed out — hide plane, let them retry
      setPlanePhase("idle");
    } else {
      setPlanePhase("idle");
      Alert.alert("Payment Failed", result.error ?? "Please try again.");
    }
  }, [createRental]);

  const contactPerson   = altContact.enabled && altContact.name ? altContact : CURRENT_USER;
  const progressWidth   = successProg.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const scrollPadBottom = CTA_BAR_HEIGHT + bottomNavHeight + insets.bottom + 16;
  const ctaBottom       = bottomNavHeight + insets.bottom;
  const planeVisible    = planePhase !== "idle";

  const renderBackdrop = useCallback(
    (p: any) => (
      <BottomSheetBackdrop
        {...p}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <>
      {/*
        PaymentScreen opens INSIDE this modal so it sits on top of the plane overlay.
        We do NOT hide the plane when payment opens — it continues playing behind
        PaymentScreen and is immediately visible again when PaymentScreen closes.
      */}
      {showPayment && (
        <Modal visible transparent animationType="slide" statusBarTranslucent>
          <PaymentScreen
            orderId={orderId}
            amount={grand}
            contact={contactPerson.phone}
            email={contactPerson.email ?? "guest@basswala.in"}
            accentColor={accent}
            onBack={() => {
              setShowPayment(false);
              setPlanePhase("idle");
            }}
            onResult={onPaymentResult}
          />
        </Modal>
      )}

      <BottomSheet
        index={sheetIndex}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onClose}
        backdropComponent={renderBackdrop}
        backgroundStyle={s.sheetBg}
        handleIndicatorStyle={[s.handle, { backgroundColor: accent + "70" }]}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
      >

        {/* ══════ DELIVERY STEP ══════ */}
        {step === "delivery" && (
          <>
            <Animated.View style={[s.header, { opacity: headerFade }]}>
              <View style={s.headerLeft}>
                <View style={[s.headerDot, { backgroundColor: accent }]} />
                <View>
                  <Text style={s.headerTitle}>Book Equipment</Text>
                  <Text style={s.headerSub}>{eq.name}</Text>
                </View>
              </View>
              <TouchableOpacity style={s.closeBtn} onPress={onClose}>
                <Ionicons name="close" size={17} color="#64748b" />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={{ transform: [{ translateY: pillSlide }], opacity: headerFade }}>
              <LinearGradient
                colors={[accent + "18", accent + "08"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[s.pill, { borderColor: accent + "40" }]}
              >
                <View style={[s.pillIconWrap, { backgroundColor: accent + "25" }]}>
                  <Ionicons name="musical-notes-outline" size={20} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.pillName} numberOfLines={1}>{eq.name}</Text>
                  <Text style={s.pillMeta}>{days} day{days > 1 ? "s" : ""} · {eq.category}</Text>
                </View>
                <View style={s.pillAmtCol}>
                  <Text style={[s.pillAmt, { color: accent }]}>₹{grand}</Text>
                  <View style={[s.pillDepositTag, { backgroundColor: accent + "18" }]}>
                    <Text style={[s.pillDepositText, { color: accent }]}>incl. deposit</Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>

            <BottomSheetScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: scrollPadBottom }}
            >
              {/* ── Delivery method ── */}
              <SectionLabel icon="swap-horizontal-outline" title="Delivery Method" accent={accent} />
              <View style={s.methodRow}>
                {(["delivery", "pickup"] as DeliveryMethod[]).map((m) => {
                  const active = deliveryMethod === m;
                  return (
                    <TouchableOpacity
                      key={m} activeOpacity={0.85}
                      style={[s.methodCard, active && { borderColor: accent, backgroundColor: accent + "0d" }]}
                      onPress={() => setDeliveryMethod(m)}
                    >
                      {active && (
                        <LinearGradient colors={[accent + "18", accent + "05"]} style={StyleSheet.absoluteFillObject} />
                      )}
                      <View style={[s.methodIconBox, active && { backgroundColor: accent + "28" }]}>
                        <Ionicons
                          name={m === "delivery" ? "bicycle-outline" : "storefront-outline"}
                          size={24} color={active ? accent : "#94a3b8"}
                        />
                      </View>
                      <Text style={[s.methodTitle, active && { color: accent }]}>
                        {m === "delivery" ? "Home Delivery" : "Self Pickup"}
                      </Text>
                      <Text style={s.methodSub}>
                        {m === "delivery" ? "Door-step delivery" : "Pickup from store"}
                      </Text>
                      {active && (
                        <View style={[s.methodCheck, { backgroundColor: accent }]}>
                          <Ionicons name="checkmark" size={10} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {deliveryMethod === "pickup" && (
                <View style={[s.infoCard, { borderColor: accent + "35", backgroundColor: accent + "08" }]}>
                  <View style={[s.infoIcon, { backgroundColor: accent + "22" }]}>
                    <Ionicons name="location" size={17} color={accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.infoTitle}>Pickup Location</Text>
                    <Text style={s.infoBody}>{eq.pickupAddress}</Text>
                    <Text style={[s.infoHint, { color: accent }]}>Open 10 AM – 7 PM · Mon–Sat</Text>
                  </View>
                </View>
              )}

              {deliveryMethod === "delivery" && (
                <>
                  <SectionLabel icon="bookmark-outline" title="Saved Addresses" sub="Tap to select" accent={accent} />
                  {SAVED_ADDRESSES.map((addr) => {
                    const active = selectedAddrId === addr.id;
                    return (
                      <TouchableOpacity
                        key={addr.id} activeOpacity={0.85}
                        style={[s.addrCard, active && { borderColor: accent, backgroundColor: accent + "0a" }]}
                        onPress={() => { setSelectedAddrId(addr.id); setAddress(addr.address); setPincode(addr.pincode); }}
                      >
                        <View style={[s.addrIcon, active && { backgroundColor: accent + "22", borderColor: accent + "40" }]}>
                          <Ionicons name={addr.icon} size={16} color={active ? accent : "#94a3b8"} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.addrLabel, active && { color: accent }]}>{addr.label}</Text>
                          <Text style={s.addrText} numberOfLines={1}>{addr.address}</Text>
                        </View>
                        {active && <Ionicons name="checkmark-circle" size={22} color={accent} />}
                      </TouchableOpacity>
                    );
                  })}

                  <SectionLabel icon="create-outline" title="Or Enter Manually" accent={accent} />
                  <Field
                    label="Full Address" value={address}
                    onChange={(v: string) => { setAddress(v); setSelectedAddrId(null); }}
                    placeholder="House/Flat, Street, Area" icon="home-outline" accent={accent}
                  />
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Field label="Landmark" value={landmark} onChange={setLandmark} placeholder="Near..." icon="navigate-outline" accent={accent} />
                    </View>
                    <View style={{ width: 118 }}>
                      <Field label="Pincode" value={pincode} onChange={setPincode} placeholder="302019" icon="mail-outline" accent={accent} keyboardType="numeric" />
                    </View>
                  </View>
                </>
              )}

              {/* ── Contact ── */}
              <SectionLabel icon="person-circle-outline" title="Contact Person" sub="Who receives the gear?" accent={accent} />
              <LinearGradient colors={[accent + "12", accent + "06"]} style={[s.userCard, { borderColor: accent + "35" }]}>
                <View style={[s.avatar, { backgroundColor: accent }]}>
                  <Text style={s.avatarText}>{CURRENT_USER.name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.userName}>{CURRENT_USER.name}</Text>
                  <Text style={s.userPhone}>{CURRENT_USER.phone}</Text>
                </View>
                <View style={[s.youBadge, { borderColor: accent + "50", backgroundColor: accent + "15" }]}>
                  <Ionicons name="checkmark-circle" size={12} color={accent} />
                  <Text style={[s.youBadgeText, { color: accent }]}>You</Text>
                </View>
              </LinearGradient>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[s.altContactRow, altContact.enabled && s.altContactRowActive]}
                onPress={() => setAltContact((c) => ({ ...c, enabled: !c.enabled }))}
              >
                <Ionicons name={altContact.enabled ? "person-remove-outline" : "person-add-outline"} size={17} color={altContact.enabled ? "#f87171" : accent} />
                <Text style={[s.altContactText, { color: altContact.enabled ? "#f87171" : accent }]}>
                  {altContact.enabled ? "Remove alternate contact" : "Add different contact"}
                </Text>
                <Ionicons name={altContact.enabled ? "chevron-up" : "chevron-down"} size={15} color="#94a3b8" />
              </TouchableOpacity>

              {altContact.enabled && (
                <View style={s.altContactCard}>
                  <Text style={s.altContactHint}>This person will receive and sign for the equipment</Text>
                  <Field label="Full Name *"      value={altContact.name}  onChange={(v: string) => setAltContact((c) => ({ ...c, name: v }))}                                  placeholder="Their name"      icon="person-outline"  accent={accent} />
                  <Field label="Mobile *"         value={altContact.phone} onChange={(v: string) => setAltContact((c) => ({ ...c, phone: v.replace(/\D/g, "").slice(0, 10) }))} placeholder="10-digit mobile" icon="call-outline"    accent={accent} keyboardType="phone-pad" />
                  <Field label="Email (optional)" value={altContact.email} onChange={(v: string) => setAltContact((c) => ({ ...c, email: v }))}                                  placeholder="their@email.com" icon="mail-outline"    accent={accent} keyboardType="email-address" />
                </View>
              )}

              {/* ── Price summary ── */}
              <LinearGradient colors={["#0f172a", "#1e293b", "#0f172a"]} style={s.priceCard}>
                <View style={s.priceCardHeader}>
                  <Ionicons name="receipt-outline" size={14} color="rgba(255,255,255,0.4)" />
                  <Text style={s.priceLabel}>ORDER SUMMARY</Text>
                </View>
                <View style={s.priceDivider} />
                {[
                  { k: "Rental",           note: `₹${eq.price} × ${days}d`, v: `₹${total}` },
                  { k: "Security Deposit", note: "Refundable",               v: `₹${eq.deposit}` },
                ].map((row, i) => (
                  <View key={i} style={s.priceRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={s.priceKey}>{row.k}</Text>
                      <View style={s.priceNoteTag}><Text style={s.priceNote}>{row.note}</Text></View>
                    </View>
                    <Text style={s.priceVal}>{row.v}</Text>
                  </View>
                ))}
                <View style={s.priceDivider} />
                <View style={s.priceRow}>
                  <Text style={[s.priceKey, { color: "#fff", fontWeight: "800", fontSize: 15 }]}>Grand Total</Text>
                  <Text style={[s.priceVal, { color: accent, fontSize: 24, fontWeight: "900" }]}>₹{grand}</Text>
                </View>
              </LinearGradient>

              <View style={s.notice}>
                <View style={[s.noticeIcon, { backgroundColor: accent + "18" }]}>
                  <Ionicons name="information-circle" size={15} color={accent} />
                </View>
                <Text style={s.noticeText}>
                  {deliveryMethod === "delivery"
                    ? "Free delivery within 10 km. Extra charges may apply beyond."
                    : "No delivery charges for self-pickup. Carry a valid ID."}
                </Text>
              </View>
            </BottomSheetScrollView>

            {/* ── CTA ── */}
            <View style={[s.ctaBar, { bottom: ctaBottom }]}>
              <TouchableOpacity
                style={[s.ctaBtn, planePhase === "preparing" && { opacity: 0.6 }]}
                onPress={goToPayment}
                disabled={planePhase !== "idle"}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={[accent, accent + "CC"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={s.ctaInner}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={s.ctaText}>Continue to Payment</Text>
                    <Text style={s.ctaSubText}>Secured by Razorpay</Text>
                  </View>
                  <View style={s.ctaArrow}>
                    <Ionicons name="arrow-forward" size={18} color={accent} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
              <View style={s.rzpRow}>
                <Ionicons name="lock-closed" size={11} color="#94a3b8" />
                <Text style={s.rzpNote}>256-bit SSL encryption</Text>
              </View>
            </View>
          </>
        )}

        {/* ══════ SUCCESS STEP ══════ */}
        {step === "success" && (
          <View style={s.successOuter}>
            <View style={s.lottieWrap}>
              <LottieView
                ref={successLottieRef}
                source={require("../assets/animations/success.json")}
                style={s.lottie}
                autoPlay={false}
                loop={false}
              />
            </View>
            <Animated.View
              style={[
                s.successContent,
                {
                  opacity: successProg.interpolate({ inputRange: [0, 0.1], outputRange: [0, 1], extrapolate: "clamp" }),
                  transform: [{ translateY: successProg.interpolate({ inputRange: [0, 0.1], outputRange: [20, 0], extrapolate: "clamp" }) }],
                },
              ]}
            >
              <Text style={s.successTitle}>Payment Successful!</Text>
              <View style={s.successAmtRow}>
                <Text style={s.successCurrency}>₹</Text>
                <Text style={s.successAmt}>{grand.toLocaleString("en-IN")}</Text>
              </View>
              <View style={s.successBadge}>
                <Ionicons name="shield-checkmark" size={13} color="#16a34a" />
                <Text style={s.successBadgeText}>Paid via {PAY_LABEL[payResult?.method ?? "cod"]}</Text>
              </View>
              <Text style={s.successSub}>Confirming your booking…</Text>
              <View style={s.progressTrack}>
                <Animated.View style={[s.progressFill, { width: progressWidth }]} />
              </View>
              <View style={s.successFooterRow}>
                <Text style={s.countdown}>Auto-continuing in {countdown}s</Text>
                <TouchableOpacity
                  style={[s.skipBtn, { backgroundColor: accent }]}
                  onPress={() => { successProg.stopAnimation(); createRental(); }}
                  activeOpacity={0.85}
                >
                  <Text style={s.skipText}>Go now</Text>
                  <Ionicons name="arrow-forward" size={13} color="#fff" />
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        )}

        {/* ══════ RECEIPT STEP ══════ */}
        {step === "receipt" && receipt && (
          <>
            <LinearGradient colors={["#ffffff", "#ffffff"]} style={s.receiptHeader}>
              <View style={[s.receiptHeaderIcon, { backgroundColor: accent + "30" }]}>
                <Ionicons name="checkmark-done-outline" size={22} color={accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.receiptTitle}>Booking Confirmed 🎉</Text>
                <Text style={s.receiptOrderId}>{receipt.rentalId}</Text>
              </View>
              <TouchableOpacity style={s.receiptClose} onPress={onClose}>
                <Ionicons name="close" size={17} color="rgba(255,255,255,0.55)" />
              </TouchableOpacity>
            </LinearGradient>

            <BottomSheetScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: scrollPadBottom }}
            >
              <View style={s.amtBlock}>
                <Text style={s.amtLabel}>TOTAL PAID</Text>
                <Text style={s.amtVal}>₹{receipt.totalAmount.toLocaleString("en-IN")}</Text>
                <View style={s.paidBadge}>
                  <Ionicons name="checkmark-circle" size={13} color="#16a34a" />
                  <Text style={s.paidBadgeText}>{receipt.paymentMethod === "cod" ? "Pay on Delivery" : "Payment Confirmed"}</Text>
                </View>
              </View>

              <ReceiptSection title="Equipment">
                <ReceiptRow icon="musical-notes-outline" label="Item"     value={receipt.equipmentName}                                        accent={accent} />
                <ReceiptDivider />
                <ReceiptRow icon="calendar-outline"      label="Duration" value={`${receipt.days} day${receipt.days > 1 ? "s" : ""}`}         accent={accent} />
              </ReceiptSection>
              <ReceiptSection title="Payment">
                <ReceiptRow icon="card-outline" label="Method" value={PAY_LABEL[receipt.paymentMethod] ?? receipt.paymentMethod} accent={accent} />
                {receipt.paymentId && (
                  <><ReceiptDivider />
                  <ReceiptRow icon="receipt-outline" label="Payment ID" value={receipt.paymentId} accent={accent} small /></>
                )}
                <ReceiptDivider />
                <ReceiptRow icon="time-outline" label="Date" accent={accent}
                  value={new Date(receipt.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                />
              </ReceiptSection>
              <ReceiptSection title="Delivery">
                <ReceiptRow icon={receipt.deliveryMethod === "delivery" ? "bicycle-outline" : "storefront-outline"} label="Type" value={receipt.deliveryMethod === "delivery" ? "Home Delivery" : "Self Pickup"} accent={accent} />
                <ReceiptDivider />
                <ReceiptRow icon="location-outline" label="Address" value={receipt.address} accent={accent} />
              </ReceiptSection>
              <ReceiptSection title="Contact">
                <ReceiptRow icon="person-outline" label="Name"  value={receipt.contactName}  accent={accent} />
                <ReceiptDivider />
                <ReceiptRow icon="call-outline"   label="Phone" value={receipt.contactPhone} accent={accent} />
              </ReceiptSection>

              <View style={[s.rzpCard, { borderColor: accent + "30" }]}>
                <Ionicons name="shield-checkmark" size={14} color={accent} />
                <Text style={[s.rzpCardText, { color: accent }]}>Secured by Razorpay · 256-bit SSL</Text>
              </View>
            </BottomSheetScrollView>

            <View style={[s.ctaBar, { bottom: ctaBottom }]}>
              {/* "View My Bookings" — navigates via onViewBookings; parent decides where to go */}
              <TouchableOpacity
                style={s.ctaBtn}
                onPress={() => { onViewBookings?.(receipt!); onClose(); }}
                activeOpacity={0.88}
              >
                <LinearGradient colors={["#0f172a", "#1e293b"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ctaInner}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.ctaText}>View My Bookings</Text>
                    <Text style={s.ctaSubText}>Track your rental</Text>
                  </View>
                  <View style={[s.ctaArrow, { backgroundColor: accent }]}>
                    <Ionicons name="arrow-forward" size={18} color="#101720" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
              {/* "Done" — just closes the sheet, stays on current screen */}
              <TouchableOpacity style={s.doneBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={s.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ══════ PLANE ANIMATION OVERLAY ══════
            Lives INSIDE the BottomSheet so it covers just the sheet content.
            z-index 50 ensures it floats above every step.
            PaymentScreen Modal renders on top of this (Modal is portal-based).
        */}
        {planeVisible && (
          <View style={s.planeOverlay}>
            <LottieView
              ref={planeLottieRef}
              source={require("../assets/animations/planeAnimation.json")}
              style={s.planeLottie}
              autoPlay
              loop
            />
            <Text style={s.planeTitle}>{PLANE_TEXT[planePhase].title}</Text>
            <Text style={s.planeSub}>{PLANE_TEXT[planePhase].sub}</Text>
            <View style={[s.planeAmtPill, { borderColor: accent + "50", backgroundColor: accent + "10" }]}>
              <Ionicons name="lock-closed" size={12} color={accent} />
              <Text style={[s.planeAmt, { color: accent }]}>₹{grand.toLocaleString("en-IN")} · Secured</Text>
            </View>
          </View>
        )}

      </BottomSheet>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ icon, title, sub, accent }: { icon: string; title: string; sub?: string; accent: string }) {
  return (
    <View style={s.sLabel}>
      <View style={[s.sLabelIcon, { backgroundColor: accent + "1a", borderColor: accent + "30" }]}>
        <Ionicons name={icon as any} size={15} color={accent} />
      </View>
      <View>
        <Text style={s.sLabelTitle}>{title}</Text>
        {sub && <Text style={s.sLabelSub}>{sub}</Text>}
      </View>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, icon, accent }: any) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={[s.fieldBox, focused && { borderColor: accent, borderWidth: 1.5 }]}>
        {icon && <Ionicons name={icon} size={15} color={focused ? accent : "#94a3b8"} />}
        <TextInput
          style={s.fieldInput} value={value} onChangeText={onChange}
          placeholder={placeholder} placeholderTextColor="#c4c9d0"
          keyboardType={keyboardType ?? "default"}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        />
      </View>
    </View>
  );
}

function ReceiptSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.rSection}>
      <Text style={s.rSectionTitle}>{title.toUpperCase()}</Text>
      <View style={s.rCard}>{children}</View>
    </View>
  );
}

function ReceiptRow({ icon, label, value, accent, small }: { icon: string; label: string; value: string; accent: string; small?: boolean }) {
  return (
    <View style={s.rRow}>
      <View style={[s.rRowIcon, { backgroundColor: accent + "14", borderColor: accent + "28" }]}>
        <Ionicons name={icon as any} size={14} color={accent} />
      </View>
      <Text style={s.rRowLabel}>{label}</Text>
      <Text style={[s.rRowVal, small && { fontSize: 11 }]} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function ReceiptDivider() { return <View style={s.rDivider} />; }

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  sheetBg: {
    backgroundColor: "#f8fafc", borderTopLeftRadius: 28, borderTopRightRadius: 28,
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 16 } }),
  },
  handle: { width: 38, height: 4, borderRadius: 2 },

  header:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#e8edf2" },
  headerLeft:  { flexDirection: "row", alignItems: "center", gap: 10 },
  headerDot:   { width: 8, height: 8, borderRadius: 4 },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a", letterSpacing: -0.5 },
  headerSub:   { fontSize: 12, color: "#94a3b8", fontWeight: "500", marginTop: 1 },
  closeBtn:    { width: 34, height: 34, borderRadius: 10, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },

  pill:            { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginVertical: 10, borderRadius: 18, padding: 14, borderWidth: 1.5 },
  pillIconWrap:    { width: 42, height: 42, borderRadius: 13, justifyContent: "center", alignItems: "center" },
  pillName:        { fontSize: 14, fontWeight: "800", color: "#0f172a", letterSpacing: -0.3 },
  pillMeta:        { fontSize: 11, color: "#94a3b8", fontWeight: "500", marginTop: 2 },
  pillAmtCol:      { alignItems: "flex-end", gap: 4 },
  pillAmt:         { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  pillDepositTag:  { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  pillDepositText: { fontSize: 9, fontWeight: "700", letterSpacing: 0.2 },

  sLabel:      { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 22, marginBottom: 12 },
  sLabelIcon:  { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  sLabelTitle: { fontSize: 13, fontWeight: "800", color: "#0f172a", letterSpacing: -0.2 },
  sLabelSub:   { fontSize: 11, color: "#94a3b8", fontWeight: "500", marginTop: 1 },

  methodRow:    { flexDirection: "row", gap: 10, marginBottom: 8 },
  methodCard:   { flex: 1, alignItems: "center", backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: "#e8edf2", gap: 6, position: "relative", overflow: "hidden" },
  methodIconBox:{ width: 48, height: 48, borderRadius: 15, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  methodTitle:  { fontSize: 13, fontWeight: "800", color: "#0f172a", textAlign: "center" },
  methodSub:    { fontSize: 11, color: "#94a3b8", fontWeight: "500", textAlign: "center", lineHeight: 15 },
  methodCheck:  { position: "absolute", top: 10, right: 10, width: 18, height: 18, borderRadius: 9, justifyContent: "center", alignItems: "center" },

  infoCard:  { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 16, padding: 14, borderWidth: 1.5, marginBottom: 4 },
  infoIcon:  { width: 36, height: 36, borderRadius: 11, justifyContent: "center", alignItems: "center" },
  infoTitle: { fontSize: 13, fontWeight: "800", color: "#0f172a", marginBottom: 3 },
  infoBody:  { fontSize: 12, color: "#475569", fontWeight: "500" },
  infoHint:  { fontSize: 11, fontWeight: "700", marginTop: 4 },

  addrCard:  { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 13, marginBottom: 8, borderWidth: 1.5, borderColor: "#e8edf2" },
  addrIcon:  { width: 36, height: 36, borderRadius: 11, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#e8edf2" },
  addrLabel: { fontSize: 13, fontWeight: "800", color: "#0f172a", marginBottom: 2 },
  addrText:  { fontSize: 11, color: "#94a3b8", fontWeight: "500" },

  field:      { marginBottom: 10 },
  fieldLabel: { fontSize: 10, fontWeight: "700", color: "#94a3b8", letterSpacing: 0.5, marginBottom: 6, textTransform: "uppercase" },
  fieldBox:   { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 13, paddingHorizontal: 13, paddingVertical: 12, borderWidth: 1, borderColor: "#e8edf2" },
  fieldInput: { flex: 1, fontSize: 14, color: "#0f172a", fontWeight: "500" },

  userCard:     { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 14, borderWidth: 1.5, marginBottom: 10 },
  avatar:       { width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  avatarText:   { fontSize: 16, fontWeight: "900", color: "#fff" },
  userName:     { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  userPhone:    { fontSize: 12, color: "#64748b", fontWeight: "500", marginTop: 2 },
  youBadge:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9, borderWidth: 1 },
  youBadgeText: { fontSize: 11, fontWeight: "800" },

  altContactRow:       { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 13, padding: 13, borderWidth: 1.5, borderColor: "#e8edf2", marginBottom: 10 },
  altContactRowActive: { borderColor: "#fca5a5", backgroundColor: "#fff5f5" },
  altContactText:      { flex: 1, fontSize: 13, fontWeight: "700" },
  altContactCard:      { backgroundColor: "#fff", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#e8edf2", marginBottom: 10 },
  altContactHint:      { fontSize: 12, color: "#94a3b8", fontWeight: "500", marginBottom: 12 },

  priceCard:       { borderRadius: 22, padding: 20, marginTop: 10, marginBottom: 6 },
  priceCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14 },
  priceLabel:      { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.35)", letterSpacing: 1 },
  priceDivider:    { height: 1, backgroundColor: "rgba(255,255,255,0.07)", marginVertical: 10 },
  priceRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  priceKey:        { fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: "600" },
  priceNoteTag:    { backgroundColor: "rgba(255,255,255,0.07)", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  priceNote:       { fontSize: 9, color: "rgba(255,255,255,0.28)", fontWeight: "600", letterSpacing: 0.2 },
  priceVal:        { fontSize: 13, fontWeight: "700", color: "#fff" },

  notice:     { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#f0f9ff", borderRadius: 13, padding: 12, borderWidth: 1, borderColor: "#bae6fd", marginTop: 10 },
  noticeIcon: { width: 26, height: 26, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  noticeText: { flex: 1, fontSize: 12, color: "#0369a1", fontWeight: "500", lineHeight: 17 },

  ctaBar:     { position: "absolute", left: 0, right: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 80, borderTopWidth: 1, borderTopColor: "#e8edf2", backgroundColor: "#f8fafc" },
  ctaBtn:     { borderRadius: 18, overflow: "hidden" },
  ctaInner:   { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  ctaText:    { fontSize: 15, fontWeight: "900", color: "#fff", letterSpacing: -0.3 },
  ctaSubText: { fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: "500", marginTop: 1 },
  ctaArrow:   { width: 38, height: 38, borderRadius: 12, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  rzpRow:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 8 },
  rzpNote:    { fontSize: 11, color: "#94a3b8", fontWeight: "600" },

  // Success step
  successOuter:     { flex: 1, backgroundColor: "#f0fdf4", alignItems: "center" },
  lottieWrap:       { width: SCREEN_W * 0.65, height: SCREEN_W * 0.65, marginTop: 8 },
  lottie:           { width: "100%", height: "100%" },
  successContent:   { alignItems: "center", paddingHorizontal: 32, gap: 10, flex: 1 },
  successTitle:     { fontSize: 24, fontWeight: "900", color: "#0f172a", letterSpacing: -0.5 },
  successAmtRow:    { flexDirection: "row", alignItems: "flex-start", gap: 2 },
  successCurrency:  { fontSize: 22, fontWeight: "700", color: "#16a34a", marginTop: 6 },
  successAmt:       { fontSize: 44, fontWeight: "900", color: "#16a34a", letterSpacing: -1 },
  successBadge:     { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#bbf7d0" },
  successBadgeText: { fontSize: 13, fontWeight: "700", color: "#16a34a" },
  successSub:       { fontSize: 13, color: "#64748b", fontWeight: "500" },
  progressTrack:    { width: "80%", height: 5, backgroundColor: "#bbf7d0", borderRadius: 3, overflow: "hidden", marginTop: 4 },
  progressFill:     { height: 5, backgroundColor: "#16a34a", borderRadius: 3 },
  successFooterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "80%", marginTop: 4 },
  countdown:        { fontSize: 12, color: "#94a3b8", fontWeight: "500" },
  skipBtn:          { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  skipText:         { fontSize: 13, fontWeight: "800", color: "#fff" },

  // Receipt
  receiptHeader:     { flexDirection: "row", alignItems: "center", gap: 12, padding: 20, paddingTop: 22, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  receiptHeaderIcon: { width: 46, height: 46, borderRadius: 15, justifyContent: "center", alignItems: "center" },
  receiptTitle:      { fontSize: 17, fontWeight: "900", color: "#000000", letterSpacing: -0.3 },
  receiptOrderId:    { fontSize: 11, color: "rgba(44, 43, 43, 0.38)", fontWeight: "600", marginTop: 2 },
  receiptClose:      { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },

  amtBlock:      { alignItems: "center", paddingVertical: 24, gap: 8 },
  amtLabel:      { fontSize: 10, color: "#94a3b8", fontWeight: "700", letterSpacing: 0.8 },
  amtVal:        { fontSize: 42, fontWeight: "900", color: "#0f172a", letterSpacing: -1 },
  paidBadge:     { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#f0fdf4", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: "#bbf7d0" },
  paidBadgeText: { fontSize: 12, fontWeight: "700", color: "#16a34a" },

  rSection:      { marginBottom: 14 },
  rSectionTitle: { fontSize: 10, fontWeight: "800", color: "#94a3b8", letterSpacing: 1, marginBottom: 8, paddingLeft: 2 },
  rCard:         { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#e8edf2", overflow: "hidden" },
  rRow:          { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  rRowIcon:      { width: 30, height: 30, borderRadius: 9, justifyContent: "center", alignItems: "center", borderWidth: 1 },
  rRowLabel:     { fontSize: 12, color: "#94a3b8", fontWeight: "600", flex: 1 },
  rRowVal:       { fontSize: 13, fontWeight: "700", color: "#0f172a", flex: 2, textAlign: "right" },
  rDivider:      { height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 14 },

  rzpCard:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8, marginBottom: 4, backgroundColor: "#f0fafa", borderRadius: 12, paddingVertical: 10, borderWidth: 1 },
  rzpCardText: { fontSize: 12, fontWeight: "700" },

  doneBtn:     { alignItems: "center", paddingVertical: 12, marginTop: 2 },
  doneBtnText: { fontSize: 14, fontWeight: "600", color: "#64748b" },

  // Plane overlay — covers the entire sheet content area
  planeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(248,250,252,0.97)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    gap: 8,
  },
  planeLottie:  { width: SCREEN_W * 0.62, height: SCREEN_W * 0.62 },
  planeTitle:   { fontSize: 20, fontWeight: "900", color: "#0f172a", letterSpacing: -0.4, textAlign: "center" },
  planeSub:     { fontSize: 13, color: "#64748b", fontWeight: "500", textAlign: "center" },
  planeAmtPill: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, marginTop: 6 },
  planeAmt:     { fontSize: 13, fontWeight: "700" },
});