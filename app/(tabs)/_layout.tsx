import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Tab Config ───────────────────────────────────────────────────────────────

const TABS = [
  { name: "index",     label: "Home",      icon: "home",      iconOutline: "home-outline" },
  { name: "earnings",  label: "Earnings",  icon: "cash",      iconOutline: "cash-outline" },
  { name: "bookings",  label: "Bookings",  icon: "calendar",  iconOutline: "calendar-outline" },
  { name: "inventory", label: "Inventory", icon: "grid",      iconOutline: "grid-outline" },
  { name: "profile",   label: "Profile",   icon: "person",    iconOutline: "person-outline" },
];

// Heights / spacing
const BAR_H         = 80;
const BOTTOM_INSET  = Platform.select({ ios: 34, android: 0, default: 0 })!;
const TOTAL_BAR_H   = BAR_H + BOTTOM_INSET;

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
      tension: 120,
      friction: 16,
    }).start();
  }, [isFocused]);

  // Pill background: transparent → #101720
  const pillBg = progress.interpolate({
    inputRange:  [0, 1],
    outputRange: ["rgba(16,23,32,0)", "rgba(16,23,32,1)"],
  });

  // Label expand downward + fade
  const labelMaxH = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });
  const labelOp   = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

  // Scale bounce
  const pillScale = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.94, 1] });

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
          { backgroundColor: pillBg, transform: [{ scale: pillScale }] },
        ]}
      >
        {/* Icon */}
        <Ionicons
          name={(isFocused ? tab.icon : tab.iconOutline) as any}
          size={20}
          color={isFocused ? "#ffffff" : "#8696a0"}
        />

        {/* Expanding label below icon */}
        <Animated.View style={{ maxHeight: labelMaxH, overflow: "hidden" }}>
          <Animated.Text
            style={[styles.tabLabel, { opacity: labelOp }]}
            numberOfLines={1}
          >
            {tab.label}
          </Animated.Text>
        </Animated.View>
      </Animated.View>

      {/* Small dot beneath inactive icon */}
      {!isFocused && <View style={styles.dot} />}
    </Pressable>
  );
}

// ─── Custom Tab Bar ───────────────────────────────────────────────────────────

function CustomTabBar({ state, navigation }: any) {
  return (
    <View style={styles.barContainer}>
      {/* Thin accent line at top */}
      <View style={styles.topLine} />

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

      {/* Bottom safe-area fill — same bg so it blends */}
      <View style={{ height: BOTTOM_INSET, backgroundColor: "#ffffff" }} />
    </View>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
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
  // Sits flush at the very bottom — no floating
  barContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#ffffff",
  },

  // Hairline accent at the top edge of the bar
  topLine: {
    height: 1,
    backgroundColor: "#eef0f3",
  },

  // The actual icon row
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    height: BAR_H,
    paddingHorizontal: 8,
    backgroundColor: "#ffffff",
  },

  // Each tab occupies equal flex share
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: BAR_H,
    // small dot below icon needs relative positioning context
    position: "relative",
  },

  // Content pill — icon on top, label below
  pill: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    minWidth: 56,
  },

  tabLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.2,
    flexShrink: 0,
    marginTop: 3,
  },

  // 4px dot beneath inactive icons (subtle active-elsewhere hint)
  dot: {
    position: "absolute",
    bottom: 8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "transparent", // invisible by default; tint if you want
  },
});