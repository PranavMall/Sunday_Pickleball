// TROPHY CABINET (display of achievements only). Opened from the Home
// Trophies cell, over bg_career_mumbai. One shelf per tour.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Fullscreen } from "@/src/components/fullscreen";
import { PARTNERS, STAGE_NAMES, type PartnerId } from "@/src/game/meta/economyConfig";
import { finalOf, lockedLine, shareText, STAGE_ORDER, TROPHY_SHORT, trophiesWon } from "@/src/game/meta/trophies";
import type { TrophyRecord } from "@/src/game/meta/metaStore";
import { Overlay } from "@/src/ui/HeaderActions";
import { withLink } from "@/src/game/meta/share";
import { TROPHY_BY_STAGE } from "@/src/game/render/sprites";
import { Text } from "@/src/ui/Text";
import { Card, IconSquare, Kicker, SERIF, UI } from "@/src/ui/kit";
import { useSave } from "@/src/ui/useSave";

const BG = require("@/assets/images/bg_career_mumbai.webp");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Cabinet() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { save } = useSave();
  const [picked, setPicked] = useState<string | null>(null);
  const won = save ? trophiesWon(save) : [];
  const rec = picked ? save?.career.trophies?.[picked] : undefined;

  return (
    <View style={styles.root} testID="cabinet-screen">
      <Fullscreen />
      <Image source={BG} style={StyleSheet.absoluteFill} contentFit="cover" />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24, paddingHorizontal: 14, gap: 12 }}>
        <View style={styles.head}>
          <IconSquare testID="cabinet-back" icon="arrow-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />
          <Pressable testID="cabinet-share" accessibilityRole="button" accessibilityLabel="Share" onPress={() => Share.share({ message: withLink(shareText(won)) }).catch(() => {})} style={({ pressed }) => [styles.share, pressed && { opacity: 0.85 }]}>
            <Ionicons name="share-social" size={18} color={UI.woodDark} />
            <Text style={styles.shareText}>Share</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>Trophy cabinet</Text>

        <Card testID="shelf-mumbai">
          <Kicker>MUMBAI · {won.length} OF 4</Kicker>
          <View style={styles.shelf}>
            {STAGE_ORDER.map((k) => {
              const isWon = won.includes(k);
              return (
                <Pressable key={k} testID={`trophy-${k}`} onPress={() => setPicked(k)} style={styles.slot} accessibilityRole="button" accessibilityLabel={isWon ? STAGE_NAMES[k] : `${STAGE_NAMES[k]}, locked`}>
                  <Image source={TROPHY_BY_STAGE[k]} style={[styles.trophy, !isWon && { opacity: 0.45 }]} contentFit="contain" tintColor={isWon ? undefined : "#000"} />
                  <Text style={[styles.slotText, isWon && styles.slotWon]} numberOfLines={2}>{TROPHY_SHORT[k]}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.plank} />
        </Card>

        <Card testID="shelf-south">
          <Kicker>SOUTH CUP · COMING SOON</Kicker>
          <View style={styles.shelf}>
            {STAGE_ORDER.map((k) => (
              <View key={k} style={styles.slot}>
                <View>
                  <Image source={TROPHY_BY_STAGE[k]} style={[styles.trophy, { opacity: 0.45 }]} contentFit="contain" tintColor="#000" />
                  <Text style={styles.q}>?</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.plank} />
        </Card>
      </ScrollView>
      <Overlay visible={!!picked} title={picked ? STAGE_NAMES[picked] : ""} onClose={() => setPicked(null)} testID="trophy-popup">
        {picked ? <TrophyPopup stageKey={picked} won={won.includes(picked)} rec={rec} /> : null}
      </Overlay>
    </View>
  );
}

function TrophyPopup({ stageKey, won, rec }: { stageKey: string; won: boolean; rec?: TrophyRecord }) {
  const fm = finalOf(stageKey);
  const rows: [string, string][] = rec
    ? [["Date", fmtDate(rec.wonAt)], ["Final", `${rec.score} vs ${rec.rival}`], ["Partner", PARTNERS[rec.partnerId as PartnerId]?.name ?? rec.partnerId], ["Court", rec.court]]
    : [];
  return (
    <View style={{ alignItems: "center" }} testID={won ? "trophy-popup-won" : "trophy-popup-locked"}>
      <Image source={TROPHY_BY_STAGE[stageKey]} style={[styles.big, !won && { opacity: 0.45 }]} contentFit="contain" tintColor={won ? undefined : "#000"} />
      <Kicker style={{ marginTop: 6 }}>{won ? `WON · MATCH ${fm.number} FINAL` : "LOCKED"}</Kicker>
      {won ? (
        <View style={{ alignSelf: "stretch", marginTop: 8 }}>
          {rows.map(([k, v]) => (
            <View key={k} style={styles.dRow} testID={`trophy-row-${k.toLowerCase()}`}>
              <Text style={styles.dKey}>{k}</Text>
              <Text style={styles.dVal}>{v}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.lockLine} testID="trophy-locked-line">{lockedLine(stageKey)}</Text>
      )}
    </View>
  );
}

function fmtDate(t: number): string {
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#2A3A2E" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  share: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: UI.cream, borderWidth: 1, borderColor: UI.line, elevation: 4 },
  shareText: { color: UI.woodDark, fontSize: 14, fontWeight: "800" },
  title: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 28, textShadowColor: "rgba(251,244,226,0.9)", textShadowRadius: 6 },
  shelf: { flexDirection: "row", marginTop: 8, alignItems: "flex-end" },
  slot: { flex: 1, alignItems: "center", gap: 2, minHeight: 44 },
  trophy: { width: 64, height: 64 },
  q: { position: "absolute", left: 0, right: 0, top: 18, textAlign: "center", color: "#FBF4E2", fontSize: 22, fontWeight: "900" },
  slotText: { color: UI.muted, fontSize: 10, fontWeight: "700", textAlign: "center" },
  slotWon: { color: UI.ink },
  plank: { height: 6, borderRadius: 3, backgroundColor: UI.wood, marginTop: 4 },
  big: { width: 150, height: 150 },
  dRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: UI.line },
  dKey: { color: UI.inkSoft, fontSize: 14 },
  dVal: { color: UI.ink, fontSize: 14, fontWeight: "800", flexShrink: 1, textAlign: "right" },
  lockLine: { color: UI.inkSoft, fontSize: 14, textAlign: "center", marginTop: 6, lineHeight: 20 },
});
