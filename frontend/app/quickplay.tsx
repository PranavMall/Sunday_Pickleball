import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Text } from "@/src/ui/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { partnerOf } from "@/src/game/meta/matchSetup";
import { PARTNER_IDS, PARTNERS, QUICK_PLAY_REWARDS } from "@/src/game/meta/economyConfig";
import { meta } from "@/src/game/meta";
import { levelView } from "@/src/game/meta/levels";
import { Overlay } from "@/src/ui/HeaderActions";
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
  const { save, refresh } = useSave();
  const [singles, setSingles] = useState(false);
  const [picker, setPicker] = useState(false);
  // Quick Play partner: its own saved choice (defaults to the Career partner).
  const qpId = save?.quickPartnerId && save.partners[save.quickPartnerId]?.signed ? save.quickPartnerId : save?.activePartnerId;
  const partner = partnerOf(qpId);
  const career = partnerOf(save?.activePartnerId);
  const lv = levelView(save?.partners[partner.id]?.growth ?? 0, save?.career.nextMatchId ?? "mumbai.community.01");
  const signed = save ? PARTNER_IDS.filter((id) => save.partners[id]?.signed) : [];

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
          <>
            <Card style={styles.partnerRow} testID="qp-partner">
              <Text style={styles.partnerLabel}>Your partner</Text>
              <Badge id={partner.id} name={partner.name} color={partner.color} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.partnerName} numberOfLines={1} testID="qp-partner-name">{partner.name}</Text>
                <Text style={styles.partnerSub} numberOfLines={1}>{partner.archetype} · LV {lv.level}</Text>
              </View>
              <Pressable testID="qp-change" accessibilityRole="button" onPress={() => setPicker(true)} style={({ pressed }) => [styles.change, pressed && { opacity: 0.8 }]}>
                <Text style={styles.changeText}>Change</Text>
                <Ionicons name="chevron-forward" size={14} color={UI.ink} />
              </Pressable>
            </Card>
            {partner.id !== career.id ? (
              <Text style={styles.caption} testID="qp-caption">Only for Quick Play · your Career partner stays {career.name}</Text>
            ) : null}
          </>
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
      <Overlay visible={picker} title="Quick Play partner" onClose={() => setPicker(false)} testID="qp-picker">
        {signed.map((id) => {
          const p = PARTNERS[id];
          return (
            <Pressable
              key={id}
              testID={`qp-pick-${id}`}
              style={styles.pickRow}
              onPress={() => {
                if (meta.setQuickPartner(id)) refresh();
                setPicker(false);
              }}
            >
              <Badge id={id} name={p.name} color={p.color} size={40} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.pickName}>{p.name}</Text>
                <Text style={styles.partnerSub}>{p.archetype}</Text>
              </View>
              {id === partner.id ? <Ionicons name="checkmark-circle" size={24} color={UI.green} /> : null}
            </Pressable>
          );
        })}
      </Overlay>
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
  partnerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, paddingVertical: 6, paddingHorizontal: 12 },
  partnerLabel: { color: UI.inkSoft, fontSize: 13 },
  partnerName: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 17 },
  partnerSub: { color: UI.inkSoft, fontSize: 12 },
  change: { flexDirection: "row", alignItems: "center", gap: 2, borderWidth: 1, borderColor: UI.line, backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 10, minHeight: 44 },
  changeText: { color: UI.ink, fontSize: 14, fontWeight: "700" },
  caption: { color: UI.ink, fontSize: 12, textAlign: "center", marginTop: 4, backgroundColor: "rgba(251,244,226,0.7)", alignSelf: "center", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  pickRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: UI.line },
  pickName: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 18 },
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
