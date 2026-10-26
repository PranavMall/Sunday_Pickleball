// The one shared destination bar (wooden style): Home · Career · Team · Locker · Training.
// Sits on the existing Stack: switching destinations REPLACES the screen, so
// only one destination (and one background) is mounted at a time.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { BackHandler, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/src/ui/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { UI, type IoniconName } from "./kit";

export type Destination = "home" | "career" | "team" | "locker" | "training";

const ITEMS: { key: Destination; label: string; icon: IoniconName; path?: "/" | "/career" | "/team" | "/training" }[] = [
  { key: "home", label: "Home", icon: "home", path: "/" },
  { key: "career", label: "Career", icon: "trophy", path: "/career" },
  { key: "team", label: "Team", icon: "people", path: "/team" },
  { key: "locker", label: "Locker", icon: "lock-closed" },
  { key: "training", label: "Training", icon: "tennisball", path: "/training" }, // icon drawn by PickleballIcon
];

export const BAR_HEIGHT = 74;

export function DestinationBar({ active }: { active: Destination }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  // Android back from Career/Team/Training returns Home (Home exits as usual).
  useFocusEffect(
    useCallback(() => {
      if (active === "home") return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        router.replace("/");
        return true;
      });
      return () => sub.remove();
    }, [active, router]),
  );

  return (
    <View style={styles.wrap} testID="destination-bar">
      {toast ? (
        <View style={styles.toast} pointerEvents="none" testID="locker-coming-soon">
          <Text style={styles.toastText}>Locker — coming soon</Text>
        </View>
      ) : null}
      <LinearGradient colors={["#6E4729", UI.wood, UI.woodDark]} style={[styles.bar, { paddingBottom: insets.bottom + 6 }]}>
        {ITEMS.map((it) => {
          const sel = it.key === active;
          const locked = it.key === "locker";
          const color = locked ? "rgba(251,244,226,0.42)" : sel ? UI.gold : "#FBF4E2";
          return (
            <Pressable
              key={it.key}
              testID={`nav-${it.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: sel, disabled: locked }}
              accessibilityLabel={locked ? "Locker, coming soon" : it.label}
              style={({ pressed }) => [styles.item, sel && styles.itemSel, pressed && !sel && { opacity: 0.75 }]}
              onPress={() => {
                if (locked) return setToast(true);
                if (!sel && it.path) router.replace(it.path);
              }}
            >
              {it.key === "training" ? <PickleballIcon size={22} color={color} /> : <Ionicons name={it.icon} size={22} color={color} />}
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {it.label}
              </Text>
              {sel ? <View style={styles.underline} /> : null}
            </Pressable>
          );
        })}
      </LinearGradient>
    </View>
  );
}

// Code-drawn pickleball icon: a small paddle plus a ball with 3 holes (Views only).
function PickleballIcon({ size, color }: { size: number; color: string }) {
  const u = size / 26;
  const hole = { position: "absolute" as const, width: 2.4 * u, height: 2.4 * u, borderRadius: 1.2 * u, backgroundColor: UI.woodDark };
  return (
    <View style={{ width: size, height: size }} testID="icon-pickleball">
      {/* paddle: rounded face + handle, tilted */}
      <View style={{ position: "absolute", left: 1 * u, top: 0, width: 14 * u, height: 22 * u, alignItems: "center", transform: [{ rotate: "-30deg" }] }}>
        <View style={{ width: 13 * u, height: 14 * u, borderRadius: 6.5 * u, backgroundColor: color }} />
        <View style={{ width: 4 * u, height: 8 * u, borderRadius: 1.5 * u, backgroundColor: color, marginTop: -0.5 * u }} />
      </View>
      {/* ball with 3 holes, clear of the paddle */}
      <View style={{ position: "absolute", right: 0, bottom: 0, width: 11 * u, height: 11 * u, borderRadius: 5.5 * u, backgroundColor: color, borderWidth: 1.5 * u, borderColor: UI.woodDark }}>
        <View style={[hole, { left: 1.4 * u, top: 1.6 * u }]} />
        <View style={[hole, { left: 4.8 * u, top: 1.2 * u }]} />
        <View style={[hole, { left: 3 * u, top: 4.6 * u }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  bar: {
    flexDirection: "row",
    paddingTop: 6,
    paddingHorizontal: 6,
    borderTopWidth: 3,
    borderTopColor: "#8A5C36",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  item: { flex: 1, height: BAR_HEIGHT - 12, alignItems: "center", justifyContent: "center", borderRadius: 12, minWidth: 48 },
  itemSel: { backgroundColor: "rgba(0,0,0,0.22)" },
  label: { fontSize: 12, fontWeight: "800", marginTop: 2 },
  underline: { position: "absolute", bottom: 3, width: "62%", height: 3, borderRadius: 2, backgroundColor: UI.gold },
  toast: { position: "absolute", bottom: BAR_HEIGHT + 16, alignSelf: "center", backgroundColor: "rgba(31,42,34,0.92)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8, zIndex: 5 },
  toastText: { color: "#FBF4E2", fontSize: 14, fontWeight: "700" },
});
