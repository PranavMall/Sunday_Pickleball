import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Text } from "@/src/ui/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { partnerOf } from "@/src/game/meta/matchSetup";
import { QUICK_PLAY_REWARDS } from "@/src/game/meta/economyConfig";
import { DIM } from "@/src/ui/DestinationScreen";
import { Badge, Card, Coin, IconSquare, SERIF, UI } from "@/src/ui/kit";
import { useSave } from "@/src/ui/useSave";


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
      <View style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} pointerEvents="none" />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 20 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.headRow}>
          <IconSquare testID="back-button" icon="chevron-back" label="Back" onPress={() => router.back()} />
        </View>
        <Text style={styles.title}>Quick Play</Text>

        <View style={styles.toggle} testID="format-toggle">
          {(["DOUBLES", "1v1"] as const).map((k) => {
            const sel = (k === "1v1") === singles;
            return (
              <Pressable
                key={k}
                testID={k === "1v1" ? "toggle-singles" : "toggle-doubles"}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                hitSlop={4}
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
              <Card style={[styles.level, compact && { paddingVertical: 6 }]}>
                <Image source={l.icon} style={styles.levelIcon} contentFit="contain" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.levelTitle}>{l.title}</Text>
                  <Text style={styles.levelBlurb}>{l.blurb}</Text>
                </View>
                <View style={styles.chev}>
                  <Ionicons name="chevron-forward" size={18} color={UI.goldInk} />
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
  root: { flex: 1, backgroundColor: "transparent" },
  content: { paddingHorizontal: 18, alignItems: "stretch" },
  headRow: { flexDirection: "row" },
  title: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 30, textAlign: "center", textShadowColor: "rgba(255,255,255,0.7)", textShadowRadius: 8 },
  toggle: { flexDirection: "row", alignSelf: "center", width: "76%", backgroundColor: UI.cream, borderRadius: 14, padding: 3, marginTop: 8, borderWidth: 1, borderColor: UI.line },
  seg: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: 11 },
  segSel: { backgroundColor: UI.gold, borderWidth: 1, borderColor: UI.goldDeep },
  segText: { color: UI.ink, fontSize: 16, fontWeight: "700" },
  segTextSel: { fontWeight: "900" },
  partnerRow: { flexDirection: "row", alignItems: "center", gap: 14, alignSelf: "center", marginTop: 12, paddingVertical: 8, paddingHorizontal: 22 },
  partnerLabel: { color: UI.ink, fontFamily: SERIF, fontSize: 17 },
  partnerName: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 22 },
  level: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  levelIcon: { width: 72, height: 64 },
  levelTitle: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 20 },
  levelBlurb: { color: UI.inkSoft, fontFamily: SERIF, fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  chev: { width: 36, height: 36, borderRadius: 10, backgroundColor: UI.gold, borderWidth: 1, borderColor: UI.goldDeep, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  note: { flexDirection: "row", alignItems: "center", alignSelf: "center", marginTop: 16, paddingVertical: 10, paddingHorizontal: 18, gap: 12 },
  noteDivider: { width: 1, alignSelf: "stretch", backgroundColor: UI.line },
  noteText: { color: UI.ink, fontSize: 14, lineHeight: 20 },
  devBtn: { marginTop: 14, borderRadius: 12, paddingVertical: 10, alignItems: "center", borderWidth: 1, borderColor: UI.inkSoft, borderStyle: "dashed", backgroundColor: "rgba(251,244,226,0.7)" },
  devText: { color: UI.inkSoft, fontSize: 12, fontWeight: "700", letterSpacing: 1 },
});
