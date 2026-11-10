// The one shared bottom bar (wooden style): Team · Passport · Home · Locker · Records.
// Home is a raised round gold button in the middle. Sits on the existing
// Stack: switching places REPLACES the screen, so only one is mounted at a time.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { BackHandler, Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/src/ui/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { UI, type IoniconName } from "./kit";

export type Destination = "team" | "passport" | "home" | "locker" | "records";

const ITEMS: { key: Destination; label: string; icon: IoniconName; path?: "/" | "/career" | "/team" | "/records" }[] = [
  { key: "team", label: "Team", icon: "people", path: "/team" },
  { key: "passport", label: "Passport", icon: "map", path: "/career" },
  { key: "home", label: "Home", icon: "home", path: "/" },
  { key: "locker", label: "Locker", icon: "lock-closed" },
  { key: "records", label: "Records", icon: "ribbon", path: "/records" },
];

export const BAR_HEIGHT = 74;
const RAISE = 26; // the Home button sits this far above the bar
const HOME_D = 58;

export function DestinationBar({ active }: { active: Destination }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  // Android back from a tab returns Home (Home exits as usual).
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

  const go = (it: (typeof ITEMS)[number]) => {
    if (it.key === "locker") return setToast(true);
    if (it.key !== active && it.path) router.replace(it.path);
    else if (it.key === "home" && router.canGoBack()) router.replace("/"); // from Quick Play / Training / Profile
  };
  const homeSel = active === "home";

  return (
    <View style={styles.wrap} testID="destination-bar" pointerEvents="box-none">
      {toast ? (
        <View style={styles.toast} pointerEvents="none" testID="locker-coming-soon">
          <Text style={styles.toastText}>Locker — coming soon</Text>
        </View>
      ) : null}
      <LinearGradient colors={["#6E4729", UI.wood, UI.woodDark]} style={[styles.bar, { paddingBottom: insets.bottom + 6 }]}>
        {ITEMS.map((it) => {
          if (it.key === "home") return <View key={it.key} style={styles.item} />;
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
              onPress={() => go(it)}
            >
              <Ionicons name={it.icon} size={22} color={color} />
              <Text style={[styles.label, { color }]} numberOfLines={1}>
                {it.label}
              </Text>
              {sel ? <View style={styles.underline} /> : null}
            </Pressable>
          );
        })}
      </LinearGradient>
      <Pressable
        testID="nav-home"
        accessibilityRole="tab"
        accessibilityState={{ selected: homeSel }}
        accessibilityLabel="Home"
        onPress={() => go(ITEMS[2])}
        style={({ pressed }) => [styles.homeBtn, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.homeCircle}>
          <Ionicons name="home" size={26} color={UI.woodDark} />
        </View>
        <Text style={[styles.label, { color: homeSel ? UI.gold : "#FBF4E2" }]}>Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", paddingTop: RAISE },
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
  homeBtn: { position: "absolute", top: 0, alignSelf: "center", width: 80, alignItems: "center", minHeight: 44 },
  homeCircle: { width: HOME_D + 6, height: HOME_D + 6, borderRadius: (HOME_D + 6) / 2, backgroundColor: UI.gold, borderWidth: 3, borderColor: UI.cream, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  toast: { position: "absolute", bottom: BAR_HEIGHT + 16, alignSelf: "center", backgroundColor: "rgba(31,42,34,0.92)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8, zIndex: 5 },
  toastText: { color: "#FBF4E2", fontSize: 14, fontWeight: "700" },
});
