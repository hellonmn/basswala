/**
 * LoginScreen.tsx — Basswala
 * - Ambient glow beneath each card (coloured blurred shadow matching image)
 * - Center card (id 3) = square logo card with brand gradient + "B" initial
 */

import { useAuth } from "@/context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  PanResponder,
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

const { width: SCREEN_W } = Dimensions.get("window");

const CW = 96;
const CH = 124;
const CW_LOGO = 104;
const CH_LOGO = 104;

// Ambient glow — dominant colour hand-sampled from each actual image.
// Opacity is kept very low (0.18–0.22) so it reads as natural light bleed,
// not a coloured shadow. Change these if you swap the image URLs.
const GLOW = [
  "#c97c3a",  // card 1 — warm amber  (DJ controller, brown/gold tones)
  "#4a9e8f",  // card 2 — muted teal  (mixer, green-grey tones)
  "#0cadab",  // card 3 — brand teal  (logo card)
  "#2a4a7f",  // card 4 — deep blue   (CDJ, dark indigo tones)
  "#b85c20",  // card 5 — burnt orange (speaker, copper tones)
];

// ─── Card data ───────────────────────────────────────────────────────────────
const CARD_DATA = [
  { id: "1", uri: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80", isLogo: false },
  { id: "2", uri: "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=400&q=80", isLogo: false },
  { id: "3", uri: "",                                                                          isLogo: true  },
  { id: "4", uri: "https://images.unsplash.com/photo-1516924962500-2b4b3b99ea02?w=400&q=80", isLogo: false },
  { id: "5", uri: "https://images.unsplash.com/photo-1547394765-185e1e68f34e?w=400&q=80",    isLogo: false },
];

const N         = CARD_DATA.length;          // 5
const COPIES    = 100;                       // large even number of copies → effectively infinite
const REPS      = [...Array(COPIES)].flatMap(() => CARD_DATA); // 500 items
const LOGO_IDX  = 2;                         // index of logo in CARD_DATA
const MID_START = Math.floor(COPIES / 2) * N;// index where the "middle" copy starts
const CENTER_I  = MID_START + LOGO_IDX;      // index of logo in middle copy

const STEP      = 88;   // px between card centres
const ARC_RISE  = 32;
const MAX_ROT   = 13;

// scrollX = 0 → card[CENTER_I] is at screen centre
// card[i] resting left = SCREEN_W/2 - cw/2 + (i - CENTER_I)*STEP

// ─── Carousel ─────────────────────────────────────────────────────────────────
function InfiniteCarousel() {
  // scrollX: offset in pixels. 0 = logo centred.
  const scrollX  = useRef(new Animated.Value(0)).current;
  const dragBase = useRef(0); // value of scrollX when finger went down

  // Keep scrollX from drifting too far from 0 by silently re-centring
  // when the user is NOT touching (no visible jump because it's modulo N*STEP).
  useEffect(() => {
    const wrap = N * STEP;
    const id = scrollX.addListener(({ value }) => {
      // If we've drifted more than half the full repeat range, silently jump
      const limit = (COPIES / 4) * N * STEP;
      if (Math.abs(value) > limit) {
        // Wrap by exact N*STEP so card positions don't move
        const adj = Math.round(value / wrap) * wrap;
        scrollX.setValue(value - adj);
        dragBase.current -= adj;
      }
    });
    return () => scrollX.removeListener(id);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),

      onPanResponderGrant: () => {
        // Stop any running animation and record the current value synchronously
        // We use __getValue() to avoid the async stopAnimation callback — this
        // eliminates the "stuck" delay on grab.
        scrollX.stopAnimation();
        dragBase.current = (scrollX as any).__getValue();
        scrollX.setValue(dragBase.current);
      },

      onPanResponderMove: (_, g) => {
        scrollX.setValue(dragBase.current + g.dx);
      },

      onPanResponderRelease: (_, g) => {
        const released = dragBase.current + g.dx;
        dragBase.current = released;

        const wrap    = N * STEP;
        const nearest = Math.round(released / wrap) * wrap;
        dragBase.current = nearest;

        // Phase 1 — short decay to carry the flick naturally
        Animated.decay(scrollX, {
          velocity:        g.vx,
          deceleration:    0.930, // fast stop so spring feels responsive
          useNativeDriver: true,
        }).start(() => {
          // Phase 2 — springy bounce back to logo centre
          const cur     = (scrollX as any).__getValue();
          const nearest2 = Math.round(cur / wrap) * wrap;
          dragBase.current = nearest2;

          Animated.spring(scrollX, {
            toValue:   nearest2,
            velocity:  0,
            tension:   40,   // low tension = slow windup, satisfying spring
            friction:  6,    // low friction = pronounced bounce/overshoot
            useNativeDriver: true,
          }).start();
        });
      },
    })
  ).current;

  // Visible window: only render cards that could possibly be on screen
  // to keep the list lean. Show CENTER_I ± 10 cards.
  const WINDOW = 10;
  const visible = REPS.slice(
    Math.max(0, CENTER_I - WINDOW),
    CENTER_I + WINDOW + 1
  );
  const visibleOffset = Math.max(0, CENTER_I - WINDOW); // index of visible[0] in REPS

  return (
    <View style={s.cardsWrap} {...panResponder.panHandlers}>
      {visible.map((card, vi) => {
        const i         = vi + visibleOffset; // absolute index in REPS
        const cw        = card.isLogo ? CW_LOGO : CW;
        const ch        = card.isLogo ? CH_LOGO : CH;
        const radius    = card.isLogo ? 24 : 18;

        // Static resting position when scrollX = 0
        const restX        = SCREEN_W / 2 - cw / 2 + (i - CENTER_I) * STEP;
        const distFromCentre = restX - (SCREEN_W / 2 - cw / 2); // = (i-CENTER_I)*STEP

        // inputRange: enough steps that the card is always inside the range
        const R   = WINDOW + 2;
        const inp = Array.from({ length: R * 2 + 1 }, (_, k) => (k - R) * STEP);

        const txOut    = inp.map(v => restX + v);
        const rotOut   = inp.map(v => {
          const d = Math.max(-STEP * 2, Math.min(STEP * 2, distFromCentre + v));
          return `${((d / (STEP * 2)) * MAX_ROT).toFixed(1)}deg`;
        });
        const arcOut   = inp.map(v => {
          const d = Math.abs(distFromCentre + v);
          return -(Math.min(d, STEP * 2) / (STEP * 2)) * ARC_RISE;
        });
        const scaleOut = inp.map(v => {
          const d = Math.abs(distFromCentre + v);
          return 1 - Math.min(d / (STEP * 1.5), 1) * 0.13;
        });
        const opacOut  = inp.map(v => {
          const d = Math.abs(distFromCentre + v);
          return 1 - Math.min(d / (STEP * 2.5), 1) * 0.55;
        });

        const translateX = scrollX.interpolate({ inputRange: inp, outputRange: txOut,    extrapolate: "extend" });
        const rotate     = scrollX.interpolate({ inputRange: inp, outputRange: rotOut,   extrapolate: "clamp" });
        const translateY = scrollX.interpolate({ inputRange: inp, outputRange: arcOut,   extrapolate: "clamp" });
        const scale      = scrollX.interpolate({ inputRange: inp, outputRange: scaleOut, extrapolate: "clamp" });
        const opacity    = scrollX.interpolate({ inputRange: inp, outputRange: opacOut,  extrapolate: "clamp" });

        return (
          <Animated.View
            key={`${i}`}
            style={{
              position: "absolute", left: 0, bottom: 0,
              zIndex:   card.isLogo ? 10 : 3,
              opacity,
              transform: [{ translateX }, { translateY }, { rotate }, { scale }],
            }}
          >
            {/* Shadow wrapper — no overflow:hidden so shadow renders on iOS */}
            <View style={{ width:cw, height:ch, borderRadius:radius, backgroundColor:"#fff", shadowColor:"#000", shadowOpacity:0.14, shadowRadius:18, shadowOffset:{width:0,height:5}, elevation:6 }}>
              {/* Inner clip — clips image/gradient to borderRadius */}
              <View style={{ width:cw, height:ch, borderRadius:radius, overflow:"hidden" }}>
                {card.isLogo ? (
                  <LinearGradient
                    colors={["#0ee7e5","#0cadab","#057e7d"]}
                    start={{ x:0, y:0 }} end={{ x:1, y:1 }}
                    style={{ flex:1, justifyContent:"center", alignItems:"center", gap:5 }}
                  >
                    <View style={{ width:52, height:52, borderRadius:26, borderWidth:2, borderColor:"rgba(255,255,255,0.45)", backgroundColor:"rgba(255,255,255,0.18)", justifyContent:"center", alignItems:"center" }}>
                      <Text style={{ fontSize:28, fontWeight:"800", color:"#fff" }}>B</Text>
                    </View>
                    <Text style={{ fontSize:8, fontWeight:"800", color:"rgba(255,255,255,0.8)", letterSpacing:2.8 }}>BASSWALA</Text>
                  </LinearGradient>
                ) : (
                  <Image source={{ uri:card.uri }} style={{ width:"100%", height:"100%" }} resizeMode="cover" />
                )}
              </View>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}


export default function LoginScreen() {
  const [email, setEmail]                 = useState("");
  const [password, setPassword]           = useState("");
  const [showPassword, setShowPassword]   = useState(false);
  const [loading, setLoading]             = useState(false);
  const [emailError, setEmailError]       = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError]   = useState("");
  const { login } = useAuth();

  const clearErrors = () => { setEmailError(""); setPasswordError(""); setGeneralError(""); };

  const handleLogin = async () => {
    clearErrors();
    let err = false;
    if (!email) { setEmailError("Email is required"); err = true; }
    else if (!/\S+@\S+\.\S+/.test(email)) { setEmailError("Enter a valid email"); err = true; }
    if (!password) { setPasswordError("Password is required"); err = true; }
    else if (password.length < 6) { setPasswordError("Min 6 characters"); err = true; }
    if (err) return;

    try {
      setLoading(true);
      await login(email.trim().toLowerCase(), password);
    } catch (e: any) {
      const msg = e.message || "An error occurred";
      if (msg.toLowerCase().includes("network")) setGeneralError("Network error. Check your connection.");
      else if (msg.toLowerCase().includes("invalid")) setPasswordError("Invalid email or password");
      else setGeneralError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <SafeAreaView style={s.safe}>
        <LinearGradient
          colors={["#f0fafa", "#f7f4ff", "#fff8f2", "#ffffff"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

            {/* ── Infinite carousel ── */}
            <InfiniteCarousel />

            {/* ── Heading ── */}
            <View style={s.headingWrap}>
              <Text style={s.heading}>Welcome Back{"\n"}to Basswala</Text>
            </View>

            {/* ── General error ── */}
            {generalError ? (
              <View style={s.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                <Text style={s.errorBannerText}>{generalError}</Text>
              </View>
            ) : null}

            {/* ── Form ── */}
            <View style={s.form}>

              {/* Email */}
              <View style={s.fieldGroup}>
                <Text style={s.label}>E-mail</Text>
                <View style={[s.pill, emailError ? s.pillErr : null]}>
                  <Ionicons name="mail-outline" size={18} color="#C0C0C0" style={s.fieldIcon} />
                  <TextInput
                    style={s.pillInput}
                    value={email}
                    onChangeText={(t) => { setEmail(t); if (emailError) setEmailError(""); }}
                    placeholder="hello@basswala.in"
                    placeholderTextColor="#C8C8C8"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    editable={!loading}
                  />
                </View>
                {emailError ? <Text style={s.fieldErr}>{emailError}</Text> : null}
              </View>

              {/* Password */}
              <View style={s.fieldGroup}>
                <Text style={s.label}>Password</Text>
                <View style={[s.pill, passwordError ? s.pillErr : null]}>
                  <Ionicons name="lock-closed-outline" size={18} color="#C0C0C0" style={s.fieldIcon} />
                  <TextInput
                    style={[s.pillInput, { flex: 1 }]}
                    value={password}
                    onChangeText={(t) => { setPassword(t); if (passwordError) setPasswordError(""); }}
                    placeholder="············"
                    placeholderTextColor="#C8C8C8"
                    secureTextEntry={!showPassword}
                    editable={!loading}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={s.eyeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={18} color="#C0C0C0" />
                  </TouchableOpacity>
                </View>
                {passwordError ? <Text style={s.fieldErr}>{passwordError}</Text> : null}
                <TouchableOpacity style={s.forgotWrap}>
                  <Text style={s.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              {/* Login button */}
              <TouchableOpacity style={[s.loginBtn, loading && { opacity: 0.65 }]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.loginBtnText}>Log in</Text>}
              </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }} />
          </ScrollView>

          {/* Footer */}
          <View style={s.footer}>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={s.signupText}>New to Basswala?{"  "}<Text style={s.signupLink}>Sign up</Text></Text>
              </TouchableOpacity>
            </Link>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f0fafa" },
  scroll: { flexGrow: 1, paddingBottom: 16 },

  // Cards
  cardsWrap: {
    width: SCREEN_W,
    height: CH_LOGO + 60,   // logo card is taller so needs extra space
    marginBottom: 28,
    overflow: "visible",
  },

  // Heading
  headingWrap: { paddingHorizontal: 28, marginBottom: 36 },
  heading: { fontSize: 40, fontWeight: "400", color: "#111111", letterSpacing: -0.8, lineHeight: 46, textAlign: "center" },

  // Error
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 12, padding: 12, marginHorizontal: 28, marginBottom: 16 },
  errorBannerText: { flex: 1, color: "#dc2626", fontSize: 13 },

  // Form
  form: { paddingHorizontal: 28 },
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "500", color: "#AAAAAA", marginBottom: 8, marginLeft: 2 },
  pill: { flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: "#EBEBEB", borderRadius: 18, paddingHorizontal: 20, paddingVertical: 15, backgroundColor: "#ffffff" },
  pillErr: { borderColor: "#ef4444" },
  pillInput: { fontSize: 16, color: "#111111", fontWeight: "400", padding: 0, margin: 0, flex: 1 },
  fieldIcon: { marginRight: 10 },
  eyeBtn: { paddingLeft: 8 },
  forgotWrap: { alignItems: "flex-end", marginTop: 10, marginRight: 2 },
  forgotText: { fontSize: 13, color: "#888888", fontWeight: "500" },
  fieldErr: { fontSize: 12, color: "#ef4444", marginTop: 6, marginLeft: 4 },

  // Button
  loginBtn: { backgroundColor: "#111111", borderRadius: 20, paddingVertical: 18, alignItems: "center", justifyContent: "center", marginTop: 4, shadowColor: "#000", shadowOpacity: 0.10, shadowRadius: 28, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  loginBtnText: { color: "#ffffff", fontSize: 17, fontWeight: "700", letterSpacing: 0.1 },

  // Footer
  footer: { backgroundColor: "#ffffff", alignItems: "center", paddingBottom: Platform.OS === "ios" ? 32 : 20, paddingTop: 14 },
  signupText: { fontSize: 14, color: "#AAAAAA" },
  signupLink: { color: "#111111", fontWeight: "700", textDecorationLine: "underline" },
});