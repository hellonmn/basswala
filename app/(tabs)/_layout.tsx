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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Tab Config ───────────────────────────────────────────────────────────────

const TABS = [
  { name: "index",    label: "Home",     icon: "home",     iconOutline: "home-outline"     },
  { name: "explore",  label: "Browse",   icon: "grid",     iconOutline: "grid-outline"     },
  { name: "bookings", label: "Bookings", icon: "calendar", iconOutline: "calendar-outline" },
  { name: "profile",  label: "Profile",  icon: "person",   iconOutline: "person-outline"   },
];

const BAR_H         = 64;
const BAR_SIDE_PAD  = 16; // margin from screen edges
const BAR_WIDTH     = SCREEN_WIDTH - BAR_SIDE_PAD * 2;

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
  // 0 = inactive, 1 = active
  const progress = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: isFocused ? 1 : 0,
      useNativeDriver: false, // needed for backgroundColor
      tension: 100,
      friction: 14,
    }).start();
  }, [isFocused]);

  // Pill background color: transparent → #101720
  const pillBg = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(16,23,32,0)", "rgba(16,23,32,1)"],
  });

  // Label width: 0 → auto (we use maxWidth trick)
  const labelMaxW = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 80],
  });

  // Label opacity
  const labelOp = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  // Icon color: #8696a0 → #ffffff
  const iconColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ["#8696a0", "#ffffff"],
  });

  // Subtle scale on the whole pill
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
      {/* The pill hugs the content — no absolute positioning */}
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: pillBg,
            transform: [{ scale: pillScale }],
          },
        ]}
      >
        {/* Icon */}
        <Animated.Text style={{ color: iconColor }}>
          {/* We use a wrapper since AnimatedIonicons isn't straightforward */}
          <Ionicons
            name={(isFocused ? tab.icon : tab.iconOutline) as any}
            size={21}
            color={isFocused ? "#fff" : "#8696a0"}
          />
        </Animated.Text>

        {/* Label — collapses to 0 width when inactive */}
        <Animated.View
          style={{
            maxWidth: labelMaxW,
            overflow: "hidden",
          }}
        >
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
  return (
    <View style={styles.barWrapper} pointerEvents="box-none">
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
    </View>
  );
}

// ─── Layout with Auth Check ───────────────────────────────────────────────────

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading while checking auth status
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0cadab" />
      </View>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Show tabs if authenticated
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
  // Loading container
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
    // Enough bottom padding for home indicator (iOS) or nav bar (Android)
    paddingBottom: Platform.select({ ios: 28, android: 14, default: 14 }),
    paddingHorizontal: BAR_SIDE_PAD,
    pointerEvents: "box-none",
  },

  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",  // even spacing regardless of pill width
    backgroundColor: "#ffffff",
    borderRadius: 28,
    height: BAR_H,
    width: BAR_WIDTH,
    paddingHorizontal: 10,
    // Soft shadow
    shadowColor: "#101720",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.09,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#eef0f3",
  },

  // Each tab fills its flex share, centers content
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: BAR_H,
  },

  // The pill wraps its own content — grows/shrinks naturally with label
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    // No fixed width — let content drive it
  },

  tabLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: -0.2,
    // Prevent text wrapping during animation
    flexShrink: 0,
  },
});