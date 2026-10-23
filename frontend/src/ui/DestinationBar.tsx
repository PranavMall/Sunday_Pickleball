// The one shared destination bar (wooden style): Home · Career · Team · Locker · Training.
// Sits on the existing Stack: switching destinations REPLACES the screen, so
// only one destination (and one background) is mounted at a time.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { UI, type IoniconName } from "./kit";

export type Destination = "home" | "career" | "team" | "locker" | "training";

const ITEMS: { key: Destination; label: string; icon: IoniconName; path?: "/" | "/career" | "/team" | "/training" }[] = [
  { key: "home", label: "Home", icon: "home", path: "/" },
  { key: "career", label: "Career", icon: "trophy", path: "/career" },
  { key: "team", label: "Team", icon: "people", path: "/team" },
  { key: "locker", label: "Locker", icon: "lock-closed" },
  { key: "training", label: "Training", icon: "tennisball", path: "/training" },
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
              <Ionicons name={it.icon} size={26} color={color} />
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
  label: { fontSize: 13, fontWeight: "800", marginTop: 2 },
  underline: { position: "absolute", bottom: 3, width: "62%", height: 3, borderRadius: 2, backgroundColor: UI.gold },
  toast: { position: "absolute", bottom: BAR_HEIGHT + 16, alignSelf: "center", backgroundColor: "rgba(31,42,34,0.92)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8, zIndex: 5 },
  toastText: { color: "#FBF4E2", fontSize: 14, fontWeight: "700" },
});
