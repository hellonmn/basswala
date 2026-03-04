import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  StatusBar,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";

const { width, height } = Dimensions.get("window");

// ─── Types ────────────────────────────────────────────────────────────────────

type DeliveryMethod = "delivery" | "pickup";
type PaymentMethod  = "upi" | "cod" | "card";

interface BookingState {
  deliveryMethod: DeliveryMethod;
  address: string;
  landmark: string;
  pincode: string;
  name: string;
  phone: string;
  email: string;
  paymentMethod: PaymentMethod;
  upiId: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const equipmentData: any = {
  "1": {
    id: "1", name: "Pioneer DDJ-1000", category: "DJ Controller",
    price: 150, deposit: 500,
    image: "https://www.svsound.com/cdn/shop/files/mobile-system.jpg?v=1738683786&width=2000",
    vendor: "BeatBox Rentals", vendorPhone: "+91 98765 43210",
    pickupAddress: "Shop 7, MI Road, Jaipur",
  },
};

const SAVED_ADDRESSES = [
  { id: "1", label: "Home",   icon: "home-outline",      address: "42, Shyam Nagar, Jaipur, 302019",       pincode: "302019" },
  { id: "2", label: "Work",   icon: "business-outline",  address: "Plot 9, Malviya Nagar, Jaipur, 302017", pincode: "302017" },
  { id: "3", label: "Other",  icon: "location-outline",  address: "15, Vaishali Nagar, Jaipur, 302021",    pincode: "302021" },
];

const UPI_APPS = [
  { id: "gpay",   name: "Google Pay", icon: "logo-google",       color: "#4285F4" },
  { id: "phonepe",name: "PhonePe",    icon: "phone-portrait-outline", color: "#5f259f" },
  { id: "paytm",  name: "Paytm",      icon: "wallet-outline",    color: "#00b9f1" },
  { id: "other",  name: "Other UPI",  icon: "at-outline",        color: "#0cadab" },
];

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <View style={si.row}>
      {Array.from({ length: total }).map((_, i) => {
        const done    = i < step;
        const current = i === step;
        return (
          <React.Fragment key={i}>
            <View style={[si.dot, done && si.dotDone, current && si.dotCurrent]}>
              {done ? (
                <Ionicons name="checkmark" size={12} color="#fff" />
              ) : (
                <Text style={[si.dotText, current && si.dotTextCurrent]}>{i + 1}</Text>
              )}
            </View>
            {i < total - 1 && (
              <View style={[si.line, done && si.lineDone]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const si = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", flex: 1 },
  dot: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#eef0f3", justifyContent: "center", alignItems: "center", borderWidth: 1.5, borderColor: "#d1d5db" },
  dotDone: { backgroundColor: "#0cadab", borderColor: "#0cadab" },
  dotCurrent: { backgroundColor: "#101720", borderColor: "#101720" },
  dotText: { fontSize: 11, fontWeight: "800", color: "#8696a0" },
  dotTextCurrent: { color: "#fff" },
  line: { flex: 1, height: 2, backgroundColor: "#eef0f3", marginHorizontal: 4 },
  lineDone: { backgroundColor: "#0cadab" },
});

// ─── Section Title ────────────────────────────────────────────────────────────

const SectionLabel = ({ icon, title, sub }: { icon: string; title: string; sub?: string }) => (
  <View style={styles.secLabel}>
    <View style={styles.secLabelIcon}>
      <Ionicons name={icon as any} size={18} color="#0cadab" />
    </View>
    <View>
      <Text style={styles.secLabelTitle}>{title}</Text>
      {sub && <Text style={styles.secLabelSub}>{sub}</Text>}
    </View>
  </View>
);

// ─── Input Field ──────────────────────────────────────────────────────────────

const Field = ({
  label, value, onChangeText, placeholder, keyboardType, icon, editable = true,
}: any) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <View style={[styles.fieldBox, !editable && styles.fieldBoxDisabled]}>
      {icon && <Ionicons name={icon} size={17} color="#8696a0" style={{ marginRight: 4 }} />}
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#c4c9d0"
        keyboardType={keyboardType || "default"}
        editable={editable}
      />
    </View>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BookingFlowScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const days    = parseInt((params.days as string) || "1");
  const equip   = equipmentData[(params.id as string)] || equipmentData["1"];
  const total   = equip.price * days;
  const grand   = total + equip.deposit;

  const [step, setStep] = useState(0); // 0=delivery, 1=contact, 2=payment, 3=confirm
  const STEPS = ["Delivery", "Contact", "Payment", "Review"];

  const [booking, setBooking] = useState<BookingState>({
    deliveryMethod: "delivery",
    address: "", landmark: "", pincode: "",
    name: "", phone: "", email: "",
    paymentMethod: "upi", upiId: "",
  });
  const [selectedUpiApp, setSelectedUpiApp] = useState("gpay");
  const [selectedSavedAddr, setSelectedSavedAddr] = useState<string | null>(null);

  // Slide animation between steps
  const slideX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const goTo = (next: number) => {
    Animated.parallel([
      Animated.timing(opacity,  { toValue: 0,   duration: 120, useNativeDriver: true }),
      Animated.timing(slideX,   { toValue: -30, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideX.setValue(30);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(slideX,  { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    });
  };

  const goBack = () => {
    if (step === 0) { router.back(); return; }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0,  duration: 120, useNativeDriver: true }),
      Animated.timing(slideX,  { toValue: 30, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setStep((s) => s - 1);
      slideX.setValue(-30);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(slideX,  { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    });
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { goBack(); return true; });
    return () => sub.remove();
  }, [step]);

  const canNext = () => {
    if (step === 0) return booking.deliveryMethod === "pickup" || booking.address.length > 5;
    if (step === 1) return booking.name.length > 1 && booking.phone.length === 10;
    if (step === 2) return booking.paymentMethod !== "upi" || booking.upiId.length > 4;
    return true;
  };

  const handleNext = () => {
    if (step < 3) { goTo(step + 1); return; }
    // Final confirm
    Alert.alert("🎉 Booking Confirmed!", `Your ${equip.name} has been booked for ${days} day${days > 1 ? "s" : ""}.\n\nOrder ID: #ORD-${Math.floor(Math.random() * 9000 + 1000)}`, [
      { text: "View Bookings", onPress: () => router.replace("/(tabs)/bookings") },
    ]);
  };

  const update = (key: keyof BookingState, val: any) =>
    setBooking((b) => ({ ...b, [key]: val }));

  // ── Step Labels ────────────────────────────────────────────────────────────
  const stepMeta = [
    { title: "Delivery Details",    sub: "How do you want to receive it?"    },
    { title: "Contact Info",        sub: "Who will receive the equipment?"   },
    { title: "Payment Method",      sub: "Choose how you'd like to pay"      },
    { title: "Review & Confirm",    sub: "Double-check before booking"       },
  ];

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f4f8ff" />

      {/* ── Header ── */}
      <SafeAreaView edges={["top"]} style={styles.headerWrap}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={goBack} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#101720" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{stepMeta[step].title}</Text>
            <StepIndicator step={step} total={STEPS.length} />
          </View>

          {/* Step count */}
          <View style={styles.stepCount}>
            <Text style={styles.stepCountText}>{step + 1}/{STEPS.length}</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBg}>
          <Animated.View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
        </View>
      </SafeAreaView>

      {/* ── Order summary pill ── */}
      <View style={styles.summaryPill}>
        <View style={styles.summaryLeft}>
          <Text style={styles.summaryName} numberOfLines={1}>{equip.name}</Text>
          <Text style={styles.summaryMeta}>{days} day{days > 1 ? "s" : ""} · {equip.category}</Text>
        </View>
        <View style={styles.summaryRight}>
          <Text style={styles.summaryTotal}>₹{grand}</Text>
          <Text style={styles.summaryTotalSub}>incl. deposit</Text>
        </View>
      </View>

      {/* ── Step Content ── */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={{ opacity, transform: [{ translateX: slideX }] }}
          keyboardShouldPersistTaps="handled"
        >

          {/* ─────────────────── STEP 0: DELIVERY ─────────────────── */}
          {step === 0 && (
            <View style={styles.stepContainer}>

              {/* Delivery method toggle */}
              <SectionLabel icon="cube-outline" title="Delivery Method" />
              <View style={styles.methodRow}>
                {(["delivery", "pickup"] as DeliveryMethod[]).map((m) => {
                  const on = booking.deliveryMethod === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[styles.methodCard, on && styles.methodCardOn]}
                      onPress={() => update("deliveryMethod", m)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.methodIconBox, on && styles.methodIconBoxOn]}>
                        <Ionicons
                          name={m === "delivery" ? "cube-outline" : "walk-outline"}
                          size={24} color={on ? "#0cadab" : "#8696a0"}
                        />
                      </View>
                      <Text style={[styles.methodTitle, on && styles.methodTitleOn]}>
                        {m === "delivery" ? "Home Delivery" : "Self Pickup"}
                      </Text>
                      <Text style={styles.methodSub}>
                        {m === "delivery" ? "Delivered to your address" : `Pickup from vendor`}
                      </Text>
                      {on && <View style={styles.methodCheck}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Pickup info */}
              {booking.deliveryMethod === "pickup" && (
                <View style={styles.pickupCard}>
                  <Ionicons name="location" size={18} color="#0cadab" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickupTitle}>Pickup Location</Text>
                    <Text style={styles.pickupAddr}>{equip.pickupAddress}</Text>
                    <Text style={styles.pickupHours}>Available 10 AM – 7 PM</Text>
                  </View>
                  <TouchableOpacity style={styles.mapBtn}>
                    <Ionicons name="map-outline" size={16} color="#0cadab" />
                    <Text style={styles.mapBtnText}>Map</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Delivery address */}
              {booking.deliveryMethod === "delivery" && (
                <>
                  <SectionLabel icon="bookmark-outline" title="Saved Addresses" sub="Tap to use" />
                  {SAVED_ADDRESSES.map((addr) => {
                    const on = selectedSavedAddr === addr.id;
                    return (
                      <TouchableOpacity
                        key={addr.id}
                        style={[styles.savedAddrCard, on && styles.savedAddrCardOn]}
                        onPress={() => {
                          setSelectedSavedAddr(addr.id);
                          update("address", addr.address);
                          update("pincode", addr.pincode);
                        }}
                        activeOpacity={0.85}
                      >
                        <View style={[styles.savedAddrIcon, on && styles.savedAddrIconOn]}>
                          <Ionicons name={addr.icon as any} size={18} color={on ? "#0cadab" : "#8696a0"} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.savedAddrLabel, on && styles.savedAddrLabelOn]}>{addr.label}</Text>
                          <Text style={styles.savedAddrText} numberOfLines={1}>{addr.address}</Text>
                        </View>
                        {on && <Ionicons name="checkmark-circle" size={20} color="#0cadab" />}
                      </TouchableOpacity>
                    );
                  })}

                  <SectionLabel icon="location-outline" title="Enter Address" sub="Or type a new address" />
                  <Field label="Full Address *" value={booking.address} onChangeText={(v: string) => { update("address", v); setSelectedSavedAddr(null); }}
                    placeholder="House/Flat no., Street, Area" icon="home-outline" />
                  <View style={styles.fieldRow}>
                    <View style={{ flex: 1 }}>
                      <Field label="Landmark" value={booking.landmark} onChangeText={(v: string) => update("landmark", v)}
                        placeholder="Near..." icon="navigate-outline" />
                    </View>
                    <View style={{ width: 120 }}>
                      <Field label="Pincode *" value={booking.pincode} onChangeText={(v: string) => update("pincode", v)}
                        placeholder="302019" keyboardType="numeric" icon="mail-outline" />
                    </View>
                  </View>

                  {/* Map placeholder */}
                  <TouchableOpacity style={styles.mapPlaceholder} activeOpacity={0.85}>
                    <LinearGradient colors={["#f0fafa", "#e8f8f8"]} style={styles.mapPlaceholderGrad}>
                      <View style={styles.mapPin}>
                        <Ionicons name="location" size={28} color="#0cadab" />
                      </View>
                      <Text style={styles.mapPlaceholderTitle}>Pin your location on map</Text>
                      <Text style={styles.mapPlaceholderSub}>Tap to open map and mark exact delivery point</Text>
                      <View style={styles.mapOpenBtn}>
                        <Ionicons name="map-outline" size={15} color="#fff" />
                        <Text style={styles.mapOpenBtnText}>Open Map</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              {/* Delivery charge notice */}
              <View style={styles.noticeCard}>
                <Ionicons name="information-circle-outline" size={16} color="#0cadab" />
                <Text style={styles.noticeText}>
                  {booking.deliveryMethod === "delivery"
                    ? "Free delivery within 10 km from vendor. Extra charges may apply beyond."
                    : "No delivery charges for self-pickup. Carry a valid ID."}
                </Text>
              </View>
            </View>
          )}

          {/* ─────────────────── STEP 1: CONTACT ─────────────────── */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <SectionLabel icon="person-outline" title="Contact Person" sub="Who will receive the equipment?" />

              <Field label="Full Name *" value={booking.name} onChangeText={(v: string) => update("name", v)}
                placeholder="e.g. Arjun Sharma" icon="person-outline" />
              <Field label="Mobile Number *" value={booking.phone} onChangeText={(v: string) => update("phone", v.replace(/\D/g, "").slice(0, 10))}
                placeholder="10-digit mobile number" keyboardType="phone-pad" icon="call-outline" />
              <Field label="Email (optional)" value={booking.email} onChangeText={(v: string) => update("email", v)}
                placeholder="your@email.com" keyboardType="email-address" icon="mail-outline" />

              <SectionLabel icon="calendar-outline" title="Rental Period" />
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}><Ionicons name="calendar-outline" size={16} color="#0cadab" /></View>
                  <Text style={styles.infoKey}>Duration</Text>
                  <Text style={styles.infoVal}>{days} day{days > 1 ? "s" : ""}</Text>
                </View>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}><Ionicons name="cube-outline" size={16} color="#0cadab" /></View>
                  <Text style={styles.infoKey}>Equipment</Text>
                  <Text style={[styles.infoVal, { flex: 1, textAlign: "right" }]} numberOfLines={1}>{equip.name}</Text>
                </View>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}><Ionicons name="storefront-outline" size={16} color="#0cadab" /></View>
                  <Text style={styles.infoKey}>Vendor</Text>
                  <Text style={styles.infoVal}>{equip.vendor}</Text>
                </View>
              </View>

              <View style={styles.noticeCard}>
                <Ionicons name="lock-closed-outline" size={16} color="#0cadab" />
                <Text style={styles.noticeText}>Your contact info is shared only with the vendor for this booking.</Text>
              </View>
            </View>
          )}

          {/* ─────────────────── STEP 2: PAYMENT ─────────────────── */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <SectionLabel icon="wallet-outline" title="Payment Method" />

              {/* UPI */}
              <TouchableOpacity
                style={[styles.payMethodCard, booking.paymentMethod === "upi" && styles.payMethodCardOn]}
                onPress={() => update("paymentMethod", "upi")} activeOpacity={0.85}
              >
                <View style={[styles.payMethodIcon, { backgroundColor: "#f0f4ff" }]}>
                  <Ionicons name="phone-portrait-outline" size={22} color="#4285F4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payMethodTitle}>UPI Payment</Text>
                  <Text style={styles.payMethodSub}>Google Pay, PhonePe, Paytm & more</Text>
                </View>
                <View style={[styles.payRadio, booking.paymentMethod === "upi" && styles.payRadioOn]}>
                  {booking.paymentMethod === "upi" && <View style={styles.payRadioDot} />}
                </View>
              </TouchableOpacity>

              {booking.paymentMethod === "upi" && (
                <View style={styles.upiExpanded}>
                  {/* UPI app grid */}
                  <View style={styles.upiAppsRow}>
                    {UPI_APPS.map((app) => (
                      <TouchableOpacity
                        key={app.id}
                        style={[styles.upiApp, selectedUpiApp === app.id && styles.upiAppOn]}
                        onPress={() => setSelectedUpiApp(app.id)}
                        activeOpacity={0.85}
                      >
                        <View style={[styles.upiAppIcon, { backgroundColor: app.color + "18" }]}>
                          <Ionicons name={app.icon as any} size={20} color={app.color} />
                        </View>
                        <Text style={styles.upiAppName}>{app.name}</Text>
                        {selectedUpiApp === app.id && (
                          <View style={styles.upiAppCheck}><Ionicons name="checkmark" size={10} color="#fff" /></View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                  {selectedUpiApp === "other" && (
                    <Field label="Enter UPI ID" value={booking.upiId} onChangeText={(v: string) => update("upiId", v)}
                      placeholder="yourname@upi" icon="at-outline" />
                  )}
                  {selectedUpiApp !== "other" && (
                    <View style={styles.upiInfo}>
                      <Ionicons name="information-circle-outline" size={14} color="#0cadab" />
                      <Text style={styles.upiInfoText}>You'll be redirected to complete payment after booking</Text>
                    </View>
                  )}
                </View>
              )}

              {/* Cash on Delivery */}
              <TouchableOpacity
                style={[styles.payMethodCard, booking.paymentMethod === "cod" && styles.payMethodCardOn]}
                onPress={() => update("paymentMethod", "cod")} activeOpacity={0.85}
              >
                <View style={[styles.payMethodIcon, { backgroundColor: "#f0fdf4" }]}>
                  <Ionicons name="cash-outline" size={22} color="#22c55e" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payMethodTitle}>Cash on Delivery</Text>
                  <Text style={styles.payMethodSub}>Pay when you receive the equipment</Text>
                </View>
                <View style={[styles.payRadio, booking.paymentMethod === "cod" && styles.payRadioOn]}>
                  {booking.paymentMethod === "cod" && <View style={styles.payRadioDot} />}
                </View>
              </TouchableOpacity>

              {booking.paymentMethod === "cod" && (
                <View style={styles.codExpanded}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#22c55e" />
                  <Text style={styles.codText}>Keep exact cash ready. ₹{grand} (rental + deposit) to be paid at delivery.</Text>
                </View>
              )}

              {/* Card */}
              <TouchableOpacity
                style={[styles.payMethodCard, booking.paymentMethod === "card" && styles.payMethodCardOn]}
                onPress={() => update("paymentMethod", "card")} activeOpacity={0.85}
              >
                <View style={[styles.payMethodIcon, { backgroundColor: "#fff8f0" }]}>
                  <Ionicons name="card-outline" size={22} color="#f97316" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payMethodTitle}>Debit / Credit Card</Text>
                  <Text style={styles.payMethodSub}>Visa, Mastercard, RuPay accepted</Text>
                </View>
                <View style={[styles.payRadio, booking.paymentMethod === "card" && styles.payRadioOn]}>
                  {booking.paymentMethod === "card" && <View style={styles.payRadioDot} />}
                </View>
              </TouchableOpacity>

              {booking.paymentMethod === "card" && (
                <View style={styles.upiExpanded}>
                  <Field label="Card Number" value="" onChangeText={() => {}} placeholder="•••• •••• •••• ••••" keyboardType="numeric" icon="card-outline" />
                  <View style={styles.fieldRow}>
                    <View style={{ flex: 1 }}>
                      <Field label="Expiry" value="" onChangeText={() => {}} placeholder="MM / YY" keyboardType="numeric" icon="calendar-outline" />
                    </View>
                    <View style={{ width: 110 }}>
                      <Field label="CVV" value="" onChangeText={() => {}} placeholder="•••" keyboardType="numeric" icon="lock-closed-outline" />
                    </View>
                  </View>
                </View>
              )}

              {/* Security note */}
              <View style={styles.noticeCard}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#0cadab" />
                <Text style={styles.noticeText}>All payments are secured with 256-bit encryption. Your payment info is never stored.</Text>
              </View>
            </View>
          )}

          {/* ─────────────────── STEP 3: REVIEW ─────────────────── */}
          {step === 3 && (
            <View style={styles.stepContainer}>

              {/* Booking summary card */}
              <LinearGradient colors={["#101720", "#1e2d3d"]} style={styles.summaryCard}>
                <Text style={styles.summaryCardTitle}>Booking Summary</Text>
                <View style={styles.summaryCardDivider} />

                <View style={styles.summaryCardRow}>
                  <Text style={styles.summaryCardKey}>Equipment</Text>
                  <Text style={styles.summaryCardVal}>{equip.name}</Text>
                </View>
                <View style={styles.summaryCardRow}>
                  <Text style={styles.summaryCardKey}>Duration</Text>
                  <Text style={styles.summaryCardVal}>{days} day{days > 1 ? "s" : ""}</Text>
                </View>
                <View style={styles.summaryCardRow}>
                  <Text style={styles.summaryCardKey}>Rental</Text>
                  <Text style={styles.summaryCardVal}>₹{equip.price} × {days} = ₹{total}</Text>
                </View>
                <View style={styles.summaryCardRow}>
                  <Text style={styles.summaryCardKey}>Deposit</Text>
                  <Text style={styles.summaryCardVal}>₹{equip.deposit}</Text>
                </View>
                <View style={styles.summaryCardDivider} />
                <View style={styles.summaryCardRow}>
                  <Text style={[styles.summaryCardKey, { color: "#fff", fontWeight: "800" }]}>Grand Total</Text>
                  <Text style={[styles.summaryCardVal, { color: "#0cadab", fontSize: 20, fontWeight: "800" }]}>₹{grand}</Text>
                </View>
              </LinearGradient>

              {/* Delivery */}
              <SectionLabel icon="cube-outline" title="Delivery" />
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}><Ionicons name={booking.deliveryMethod === "delivery" ? "cube-outline" : "walk-outline"} size={16} color="#0cadab" /></View>
                  <Text style={styles.infoKey}>Method</Text>
                  <Text style={styles.infoVal}>{booking.deliveryMethod === "delivery" ? "Home Delivery" : "Self Pickup"}</Text>
                </View>
                {booking.deliveryMethod === "delivery" && booking.address ? (
                  <>
                    <View style={styles.infoDivider} />
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconBox}><Ionicons name="location-outline" size={16} color="#0cadab" /></View>
                      <Text style={styles.infoKey}>Address</Text>
                      <Text style={[styles.infoVal, { flex: 1, textAlign: "right" }]} numberOfLines={2}>{booking.address}</Text>
                    </View>
                  </>
                ) : null}
                {booking.deliveryMethod === "pickup" && (
                  <>
                    <View style={styles.infoDivider} />
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconBox}><Ionicons name="location-outline" size={16} color="#0cadab" /></View>
                      <Text style={styles.infoKey}>From</Text>
                      <Text style={[styles.infoVal, { flex: 1, textAlign: "right" }]} numberOfLines={2}>{equip.pickupAddress}</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Contact */}
              <SectionLabel icon="person-outline" title="Contact" />
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}><Ionicons name="person-outline" size={16} color="#0cadab" /></View>
                  <Text style={styles.infoKey}>Name</Text>
                  <Text style={styles.infoVal}>{booking.name || "—"}</Text>
                </View>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}><Ionicons name="call-outline" size={16} color="#0cadab" /></View>
                  <Text style={styles.infoKey}>Phone</Text>
                  <Text style={styles.infoVal}>{booking.phone || "—"}</Text>
                </View>
                {booking.email ? (
                  <>
                    <View style={styles.infoDivider} />
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconBox}><Ionicons name="mail-outline" size={16} color="#0cadab" /></View>
                      <Text style={styles.infoKey}>Email</Text>
                      <Text style={styles.infoVal}>{booking.email}</Text>
                    </View>
                  </>
                ) : null}
              </View>

              {/* Payment */}
              <SectionLabel icon="wallet-outline" title="Payment" />
              <View style={styles.infoCard}>
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}><Ionicons name="card-outline" size={16} color="#0cadab" /></View>
                  <Text style={styles.infoKey}>Method</Text>
                  <Text style={styles.infoVal}>
                    {{ upi: "UPI Payment", cod: "Cash on Delivery", card: "Card" }[booking.paymentMethod]}
                  </Text>
                </View>
                {booking.paymentMethod === "upi" && (
                  <>
                    <View style={styles.infoDivider} />
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconBox}><Ionicons name="phone-portrait-outline" size={16} color="#0cadab" /></View>
                      <Text style={styles.infoKey}>App</Text>
                      <Text style={styles.infoVal}>{UPI_APPS.find(a => a.id === selectedUpiApp)?.name}</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Terms */}
              <View style={styles.termsBlock}>
                <Ionicons name="document-text-outline" size={14} color="#8696a0" />
                <Text style={styles.termsText}>
                  By confirming, you agree to our{" "}
                  <Text style={styles.termsLink}>Rental Terms</Text>
                  {" "}and{" "}
                  <Text style={styles.termsLink}>Cancellation Policy</Text>.
                  Deposit is refundable on safe return.
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: 40 }} />
        </Animated.ScrollView>

        {/* ── Bottom CTA ── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.nextBtn, !canNext() && styles.nextBtnOff]}
            onPress={handleNext}
            disabled={!canNext()}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={canNext() ? ["#101720", "#1e2d3d"] : ["#e5e7eb", "#e5e7eb"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.nextBtnGrad}
            >
              <View>
                <Text style={[styles.nextBtnText, !canNext() && styles.nextBtnTextOff]}>
                  {step === 3 ? "Confirm Booking" : `Continue to ${STEPS[step + 1]}`}
                </Text>
                {step === 3 && (
                  <Text style={styles.nextBtnSub}>₹{grand} · {days} day{days > 1 ? "s" : ""}</Text>
                )}
              </View>
              <View style={[styles.nextArrow, !canNext() && styles.nextArrowOff]}>
                <Ionicons
                  name={step === 3 ? "checkmark" : "arrow-forward"}
                  size={18}
                  color={canNext() ? "#101720" : "#c4c9d0"}
                />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f4f8ff" },

  // Header
  headerWrap: { backgroundColor: "#f4f8ff", borderBottomWidth: 1, borderBottomColor: "#eef0f3" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#eef0f3" },
  headerCenter: { flex: 1, gap: 8 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#101720", letterSpacing: -0.3 },
  stepCount: { backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: "#eef0f3" },
  stepCountText: { fontSize: 12, fontWeight: "700", color: "#8696a0" },

  progressBg: { height: 3, backgroundColor: "#eef0f3", marginHorizontal: 0 },
  progressFill: { height: 3, backgroundColor: "#0cadab", borderRadius: 2 },

  // Order summary pill
  summaryPill: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
    backgroundColor: "#fff", borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: "#eef0f3",
    gap: 12,
  },
  summaryLeft: { flex: 1 },
  summaryName: { fontSize: 14, fontWeight: "700", color: "#101720", marginBottom: 2 },
  summaryMeta: { fontSize: 12, color: "#8696a0", fontWeight: "500" },
  summaryRight: { alignItems: "flex-end" },
  summaryTotal: { fontSize: 18, fontWeight: "800", color: "#101720", letterSpacing: -0.4 },
  summaryTotalSub: { fontSize: 10, color: "#8696a0", fontWeight: "500" },

  // Step container
  scrollContent: { paddingBottom: 16 },
  stepContainer: { paddingHorizontal: 16, paddingTop: 12 },

  // Section label
  secLabel: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12, marginTop: 20 },
  secLabelIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#f0fafa", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#d0f0ef" },
  secLabelTitle: { fontSize: 15, fontWeight: "800", color: "#101720", letterSpacing: -0.3 },
  secLabelSub: { fontSize: 11, color: "#8696a0", fontWeight: "500", marginTop: 1 },

  // Delivery method cards
  methodRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  methodCard: {
    flex: 1, backgroundColor: "#fff", borderRadius: 18, padding: 16,
    alignItems: "center", borderWidth: 1.5, borderColor: "#eef0f3", gap: 6,
    position: "relative",
  },
  methodCardOn: { borderColor: "#0cadab", backgroundColor: "#f0fafa" },
  methodIconBox: { width: 48, height: 48, borderRadius: 16, backgroundColor: "#f4f8ff", justifyContent: "center", alignItems: "center" },
  methodIconBoxOn: { backgroundColor: "#e8fffe" },
  methodTitle: { fontSize: 13, fontWeight: "700", color: "#101720", textAlign: "center" },
  methodTitleOn: { color: "#0cadab" },
  methodSub: { fontSize: 11, color: "#8696a0", fontWeight: "500", textAlign: "center", lineHeight: 15 },
  methodCheck: { position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: 10, backgroundColor: "#0cadab", justifyContent: "center", alignItems: "center" },

  // Pickup card
  pickupCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: "#f0fafa", borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: "#d0f0ef", marginBottom: 8,
  },
  pickupTitle: { fontSize: 13, fontWeight: "700", color: "#101720", marginBottom: 2 },
  pickupAddr: { fontSize: 13, color: "#4b6585", fontWeight: "500" },
  pickupHours: { fontSize: 11, color: "#0cadab", fontWeight: "600", marginTop: 4 },
  mapBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "#d0f0ef" },
  mapBtnText: { fontSize: 12, fontWeight: "700", color: "#0cadab" },

  // Saved address cards
  savedAddrCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 8,
    borderWidth: 1.5, borderColor: "#eef0f3",
  },
  savedAddrCardOn: { borderColor: "#0cadab", backgroundColor: "#f0fafa" },
  savedAddrIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#f4f8ff", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#eef0f3" },
  savedAddrIconOn: { backgroundColor: "#e8fffe", borderColor: "#d0f0ef" },
  savedAddrLabel: { fontSize: 13, fontWeight: "700", color: "#101720", marginBottom: 2 },
  savedAddrLabelOn: { color: "#0cadab" },
  savedAddrText: { fontSize: 12, color: "#8696a0", fontWeight: "500" },

  // Field
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#8696a0", letterSpacing: 0.5, marginBottom: 6 },
  fieldBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: "#eef0f3", gap: 8,
  },
  fieldBoxDisabled: { backgroundColor: "#f9fafb" },
  fieldInput: { flex: 1, fontSize: 14, color: "#101720", fontWeight: "500" },
  fieldRow: { flexDirection: "row", gap: 10 },

  // Map placeholder
  mapPlaceholder: { borderRadius: 18, overflow: "hidden", marginBottom: 8, marginTop: 4 },
  mapPlaceholderGrad: { alignItems: "center", padding: 24, gap: 6 },
  mapPin: { width: 52, height: 52, borderRadius: 18, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", marginBottom: 4, borderWidth: 1, borderColor: "#d0f0ef" },
  mapPlaceholderTitle: { fontSize: 14, fontWeight: "800", color: "#101720" },
  mapPlaceholderSub: { fontSize: 12, color: "#8696a0", fontWeight: "500", textAlign: "center" },
  mapOpenBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#0cadab", paddingHorizontal: 18, paddingVertical: 9, borderRadius: 12, marginTop: 8 },
  mapOpenBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  // Notice
  noticeCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#f0fafa", borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: "#d0f0ef", marginTop: 8,
  },
  noticeText: { flex: 1, fontSize: 12, color: "#4b6585", fontWeight: "500", lineHeight: 18 },

  // Info card (review rows)
  infoCard: { backgroundColor: "#fff", borderRadius: 18, borderWidth: 1, borderColor: "#eef0f3", overflow: "hidden" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13 },
  infoIconBox: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#f0fafa", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#d0f0ef" },
  infoKey: { fontSize: 13, color: "#8696a0", fontWeight: "600", flex: 1 },
  infoVal: { fontSize: 13, fontWeight: "700", color: "#101720" },
  infoDivider: { height: 1, backgroundColor: "#f4f8ff", marginHorizontal: 14 },

  // Payment method cards
  payMethodCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 10,
    borderWidth: 1.5, borderColor: "#eef0f3",
  },
  payMethodCardOn: { borderColor: "#0cadab", backgroundColor: "#f0fafa" },
  payMethodIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center" },
  payMethodTitle: { fontSize: 14, fontWeight: "700", color: "#101720", marginBottom: 2 },
  payMethodSub: { fontSize: 12, color: "#8696a0", fontWeight: "500" },
  payRadio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#d1d5db", justifyContent: "center", alignItems: "center" },
  payRadioOn: { borderColor: "#0cadab" },
  payRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#0cadab" },

  // UPI expanded
  upiExpanded: { backgroundColor: "#f4f8ff", borderRadius: 16, padding: 14, marginBottom: 10, marginTop: -4, borderWidth: 1, borderColor: "#eef0f3" },
  upiAppsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  upiApp: { flex: 1, alignItems: "center", gap: 5, padding: 10, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#eef0f3", position: "relative" },
  upiAppOn: { borderColor: "#0cadab", backgroundColor: "#f0fafa" },
  upiAppIcon: { width: 36, height: 36, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  upiAppName: { fontSize: 9, fontWeight: "700", color: "#8696a0", textAlign: "center" },
  upiAppCheck: { position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: "#0cadab", justifyContent: "center", alignItems: "center" },
  upiInfo: { flexDirection: "row", alignItems: "center", gap: 6 },
  upiInfoText: { fontSize: 11, color: "#8696a0", fontWeight: "500", flex: 1 },

  // COD expanded
  codExpanded: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#f0fdf4", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#bbf7d0", marginBottom: 10, marginTop: -4 },
  codText: { flex: 1, fontSize: 12, color: "#166534", fontWeight: "500", lineHeight: 18 },

  // Review summary card
  summaryCard: { borderRadius: 20, padding: 20, marginBottom: 4 },
  summaryCardTitle: { fontSize: 14, fontWeight: "700", color: "rgba(255,255,255,0.6)", letterSpacing: 0.5, marginBottom: 14 },
  summaryCardDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 10 },
  summaryCardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  summaryCardKey: { fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: "500" },
  summaryCardVal: { fontSize: 13, fontWeight: "700", color: "#fff" },

  // Terms
  termsBlock: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 16 },
  termsText: { flex: 1, fontSize: 11, color: "#8696a0", lineHeight: 17 },
  termsLink: { color: "#0cadab", fontWeight: "600" },

  // Bottom CTA
  bottomBar: { paddingHorizontal: 16, paddingBottom: Platform.OS === "ios" ? 24 : 14, paddingTop: 10, backgroundColor: "#f4f8ff", borderTopWidth: 1, borderTopColor: "#eef0f3" },
  nextBtn: { borderRadius: 18, overflow: "hidden" },
  nextBtnOff: { opacity: 0.6 },
  nextBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16 },
  nextBtnText: { fontSize: 16, fontWeight: "800", color: "#fff", letterSpacing: -0.3 },
  nextBtnTextOff: { color: "#8696a0" },
  nextBtnSub: { fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: "500", marginTop: 1 },
  nextArrow: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
  nextArrowOff: { backgroundColor: "#f4f8ff" },
});