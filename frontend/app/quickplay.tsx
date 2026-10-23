import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { partnerOf } from "@/src/game/meta/matchSetup";
import { QUICK_PLAY_REWARDS } from "@/src/game/meta/economyConfig";
import { Badge, Card, Coin, IconSquare, ScreenBg, SERIF, UI } from "@/src/ui/kit";
import { useSave } from "@/src/ui/useSave";

const BG = require("@/assets/images/bg_home.webp");

const LEVELS = [
  { key: "ROOKIE", title: "ROOKIE", blurb: "Makes obvious mistakes. A gentle warm-up.", icon: require("@/assets/images/icon_rookie.webp") },
  { key: "CLUB", title: "CLUB", blurb: "Solid positioning and dinks. A real game.", icon: require("@/assets/images/icon_club.webp") },
  { key: "PRO", title: "PRO", blurb: "Anticipates, places and picks smart shots.", icon: require("@/assets/images/icon_pro.webp") },
] as const;

export default function QuickPlay() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 740;
  const { save } = useSave();
  const [singles, setSingles] = useState(false);
  const partner = partnerOf(save?.activePartnerId);

  const start = (difficulty: string) =>
    router.push({ pathname: "/match", params: { mode: "quick", difficulty, ...(singles ? { singles: "1" } : {}) } });

  return (
    <View style={styles.root} testID="quickplay-screen">
      <ScreenBg source={BG} dim />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.headRow}>
          <IconSquare testID="back-button" icon="chevron-back" label="Back" onPress={() => router.back()} size={48} />
        </View>
        <Text style={[styles.title, compact && { fontSize: 38, marginTop: -6 }]}>Quick Play</Text>

        <View style={styles.toggle} testID="format-toggle">
          {(["DOUBLES", "1v1"] as const).map((k) => {
            const sel = (k === "1v1") === singles;
            return (
              <Pressable
                key={k}
                testID={k === "1v1" ? "toggle-singles" : "toggle-doubles"}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                style={[styles.seg, sel && styles.segSel]}
                onPress={() => setSingles(k === "1v1")}
              >
                <Text style={[styles.segText, sel && styles.segTextSel]}>{k}</Text>
              </Pressable>
            );
          })}
        </View>

        {!singles ? (
          <Card style={styles.partnerRow} testID="qp-partner">
            <Text style={styles.partnerLabel}>Your partner:</Text>
            <Badge name={partner.name} color={partner.color} size={compact ? 40 : 46} />
            <Text style={styles.partnerName}>{partner.name}</Text>
          </Card>
        ) : null}

        <View style={{ gap: compact ? 10 : 14, marginTop: compact ? 10 : 14 }}>
          {LEVELS.map((l) => (
            <Pressable key={l.key} testID={`difficulty-${l.key.toLowerCase()}`} accessibilityRole="button" accessibilityLabel={`${l.title}. ${l.blurb}`} onPress={() => start(l.key)} style={({ pressed }) => [pressed && { transform: [{ scale: 0.98 }] }]}>
              <Card style={[styles.level, compact && { paddingVertical: 8 }]}>
                <Image source={l.icon} style={[styles.levelIcon, compact && { width: 84, height: 74 }]} contentFit="contain" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.levelTitle, compact && { fontSize: 24 }]}>{l.title}</Text>
                  <Text style={styles.levelBlurb}>{l.blurb}</Text>
                </View>
                <View style={styles.chev}>
                  <Ionicons name="chevron-forward" size={22} color={UI.goldInk} />
                </View>
              </Card>
            </Pressable>
          ))}
        </View>

        <Card style={styles.note} testID="qp-note">
          <Coin size={30} />
          <View style={styles.noteDivider} />
          <Text style={styles.noteText}>
            <Text style={{ fontWeight: "800" }}>Quick Play earns Coins only:</Text>
            {"\n"}Win +{QUICK_PLAY_REWARDS.winCoins} · Loss +{QUICK_PLAY_REWARDS.lossCoins}.
          </Text>
        </Card>

        {__DEV__ ? (
          <Pressable
            testID="dev-mumbai-court"
            style={styles.devBtn}
            onPress={() => router.push({ pathname: "/match", params: { mode: "quick", difficulty: "CLUB", court: "mumbai_local", ...(singles ? { singles: "1" } : {}) } })}
          >
            <Text style={styles.devText}>DEV · CLUB on Mumbai Local court</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#2E3D2A" },
  content: { paddingHorizontal: 18, alignItems: "stretch" },
  headRow: { flexDirection: "row" },
  title: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 46, textAlign: "center", textShadowColor: "rgba(255,255,255,0.7)", textShadowRadius: 8 },
  toggle: { flexDirection: "row", alignSelf: "center", width: "76%", backgroundColor: UI.cream, borderRadius: 14, padding: 3, marginTop: 8, borderWidth: 1, borderColor: UI.line },
  seg: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 11 },
  segSel: { backgroundColor: UI.gold, borderWidth: 1, borderColor: UI.goldDeep },
  segText: { color: UI.ink, fontSize: 16, fontWeight: "700" },
  segTextSel: { fontWeight: "900" },
  partnerRow: { flexDirection: "row", alignItems: "center", gap: 14, alignSelf: "center", marginTop: 12, paddingVertical: 8, paddingHorizontal: 22 },
  partnerLabel: { color: UI.ink, fontFamily: SERIF, fontSize: 17 },
  partnerName: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 22 },
  level: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  levelIcon: { width: 100, height: 88 },
  levelTitle: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 28 },
  levelBlurb: { color: UI.inkSoft, fontFamily: SERIF, fontSize: 14, lineHeight: 19, marginTop: 2 },
  chev: { width: 46, height: 46, borderRadius: 10, backgroundColor: UI.gold, borderWidth: 1, borderColor: UI.goldDeep, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  note: { flexDirection: "row", alignItems: "center", alignSelf: "center", marginTop: 16, paddingVertical: 10, paddingHorizontal: 18, gap: 12 },
  noteDivider: { width: 1, alignSelf: "stretch", backgroundColor: UI.line },
  noteText: { color: UI.ink, fontSize: 14, lineHeight: 20 },
  devBtn: { marginTop: 14, borderRadius: 12, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: UI.inkSoft, borderStyle: "dashed", backgroundColor: "rgba(251,244,226,0.7)" },
  devText: { color: UI.inkSoft, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
});
