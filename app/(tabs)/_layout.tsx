import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useRef, useEffect } from "react";
import {
  Animated,
  Pressable,
  ActivityIndicator,
  View,
  StyleSheet,
  Platform,
  Dimensions,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { Redirect } from "expo-router";
import { addScrollListener, addSheetListener } from "@/utils/tabBarEmitter";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Tab Config ───────────────────────────────────────────────────────────────

const TABS = [
  { name: "index",    label: "Home",     icon: "home",     iconOutline: "home-outline"     },
  { name: "explore",  label: "Browse",   icon: "grid",     iconOutline: "grid-outline"     },
  { name: "bookings", label: "Bookings", icon: "calendar", iconOutline: "calendar-outline" },
  { name: "profile",  label: "Profile",  icon: "person",   iconOutline: "person-outline"   },
];

const BAR_H        = 64;
const BAR_SIDE_PAD = 16;
const BAR_WIDTH    = SCREEN_WIDTH - BAR_SIDE_PAD * 2;
const HIDE_OFFSET  = BAR_H + (Platform.OS === "ios" ? 40 : 28);

// ─── Animated Tab Button ──────────────────────────────────────────────────────

function TabButton({
  tab,
  isFocused,
  onPress,
  onLongPress,
}: {
  tab: (typeof TABS)[number];
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const progress = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: isFocused ? 1 : 0,
      useNativeDriver: false,
      tension: 100,
      friction: 14,
    }).start();
  }, [isFocused]);

  const pillBg = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(16,23,32,0)", "rgba(16,23,32,1)"],
  });

  const labelMaxW = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 80],
  });

  const labelOp = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  const pillScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1],
  });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabBtn}
      android_ripple={null}
    >
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: pillBg,
            transform: [{ scale: pillScale }],
          },
        ]}
      >
        <Animated.Text>
          <Ionicons
            name={(isFocused ? tab.icon : tab.iconOutline) as any}
            size={21}
            color={isFocused ? "#fff" : "#8696a0"}
          />
        </Animated.Text>

        <Animated.View style={{ maxWidth: labelMaxW, overflow: "hidden" }}>
          <Animated.Text
            style={[styles.tabLabel, { opacity: labelOp }]}
            numberOfLines={1}
          >
            {" "}{tab.label}
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

// ─── Custom Tab Bar ───────────────────────────────────────────────────────────

function CustomTabBar({ state, navigation }: any) {
  const translateY   = useRef(new Animated.Value(0)).current;
  const lastY        = useRef(0);
  const isHidden     = useRef(false);
  // Separate flag so sheet-hide overrides scroll-hide and vice versa
  const sheetOpen    = useRef(false);

  const animateTo = (toValue: number) => {
    Animated.spring(translateY, {
      toValue,
      useNativeDriver: true,
      tension: 80,
      friction: 14,
    }).start();
  };

  // ── Sheet listener — hides bar while any booking sheet / modal is open ──
  useEffect(() => {
    const unsub = addSheetListener((visible: boolean) => {
      sheetOpen.current = visible;
      if (visible) {
        // Sheet opened → immediately slide bar off screen
        isHidden.current = true;
        animateTo(HIDE_OFFSET);
      } else {
        // Sheet closed → slide bar back
        isHidden.current = false;
        animateTo(0);
      }
    });
    return unsub;
  }, [translateY]);

  // ── Scroll listener — auto-hide while scrolling down ──
  useEffect(() => {
    const unsub = addScrollListener((currentY: number) => {
      // Don't let scroll fight the sheet
      if (sheetOpen.current) return;

      const delta = currentY - lastY.current;
      lastY.current = currentY;

      if (currentY <= 10) {
        if (isHidden.current) {
          isHidden.current = false;
          animateTo(0);
        }
        return;
      }

      if (delta > 6 && !isHidden.current) {
        isHidden.current = true;
        animateTo(HIDE_OFFSET);
      } else if (delta < -6 && isHidden.current) {
        isHidden.current = false;
        animateTo(0);
      }
    });
    return unsub;
  }, [translateY]);

  // ── Reset bar on tab change (only if sheet is not open) ──
  useEffect(() => {
    if (sheetOpen.current) return;
    isHidden.current = false;
    lastY.current    = 0;
    animateTo(0);
  }, [state.index, translateY]);

  return (
    <Animated.View
      style={[styles.barWrapper, { transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const tab = TABS.find((t) => t.name === route.name) ?? TABS[0];

          return (
            <TabButton
              key={route.key}
              tab={tab}
              isFocused={isFocused}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              onLongPress={() =>
                navigation.emit({ type: "tabLongPress", target: route.key })
              }
            />
          );
        })}
      </View>
    </Animated.View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0cadab" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f4f8ff",
  },
  barWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingBottom: Platform.select({ ios: 28, android: 14, default: 14 }),
    paddingHorizontal: BAR_SIDE_PAD,
    pointerEvents: "box-none",
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    backgroundColor: "#ffffff",
    borderRadius: 28,
    height: BAR_H,
    width: BAR_WIDTH,
    paddingHorizontal: 10,
    shadowColor: "#101720",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#eef0f3",
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: BAR_H,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.2,
    flexShrink: 0,
  },
});