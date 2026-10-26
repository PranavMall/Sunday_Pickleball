// MATCH END UI (display only — every reward was already granted by
// MetaStore.completeMatch): celebration pop-ups (one per big moment, in order)
// and the result card with its ~1.5 s count-up. Mounted only after the match
// loop has stopped.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { cancelAnimation, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

import { COURT_NAMES, PARTNERS, SIGN_COST, STAGE_NAMES, type CourtId, type PartnerId } from "@/src/game/meta/economyConfig";
import type { Moment } from "@/src/game/meta/metaStore";
import { COURT_IMG, CourtThumb } from "./CourtThumb";
import { Text } from "./Text";
import { Badge, Coin, SERIF, UI, type IoniconName } from "./kit";

const TROPHY = require("@/assets/images/trophy_mumbai.webp");

// ---- Pop-up copy -----------------------------------------------------------
function momentCopy(m: Moment) {
  if (m.kind === "stage") {
    const stage = STAGE_NAMES[m.stageKey] ?? "";
    return { kicker: stage.toUpperCase(), title: `Champions of the ${stage}!`, body: `You beat ${m.rival} in the final.${m.milestone ? `\n${m.milestone} reached.` : ""}` };
  }
  if (m.kind === "court") {
    const name = COURT_NAMES[m.court as CourtId] ?? m.court;
    return { kicker: "NEW COURT UNLOCKED", title: name, body: "The Mumbai Local Series is played here." };
  }
  const p = PARTNERS[m.partnerId as PartnerId];
  if (m.flag === "signable") return { kicker: "NEW PARTNER", title: `${p.name} can now be signed`, body: `A ${p.archetype} who lives at the kitchen line.\nSign her in Team for ${SIGN_COST[p.id] ?? 0} Coins.` };
  if (p.id === "matz") return { kicker: "SCOUT", title: "Matz is watching you", body: "A Banger from the Mumbai Local Series. Keep winning." };
  return { kicker: "NEW FRIEND", title: `You met ${p.name}`, body: "Nice game in Dadar. Win the Community Cup and come find me." };
}

export function momentChip(m: Moment): { icon: IoniconName; text: string; partnerId?: string } {
  if (m.kind === "stage") return { icon: "trophy", text: "Cup won" };
  if (m.kind === "court") return { icon: "grid", text: COURT_NAMES[m.court as CourtId] ?? m.court };
  const p = PARTNERS[m.partnerId as PartnerId];
  return { icon: "person", text: m.flag === "signable" ? `${p.name} signable` : p.id === "matz" ? "Matz watching" : `Met ${p.name}`, partnerId: p.id };
}

export function Celebration({ moments, index, onContinue, onSign }: { moments: Moment[]; index: number; onContinue: () => void; onSign: (partnerId: string) => void }) {
  const { width } = useWindowDimensions();
  const m = moments[index];
  const c = momentCopy(m);
  const signable = m.kind === "partner" && m.flag === "signable";
  const artW = Math.min(300, width - 96);
  return (
    <View style={styles.popWrap} testID={`celebration-${index}`}>
      <View style={styles.popCard}>
        <Text style={styles.popKicker} testID="celebration-kicker">{c.kicker}</Text>
        {m.kind === "stage" ? <Image source={TROPHY} style={{ width: artW * 0.62, height: artW * 0.62 }} contentFit="contain" cachePolicy="memory-disk" /> : null}
        {m.kind === "court" && COURT_IMG[m.court] ? <CourtThumb court={m.court} width={artW} testID="celebration-court" /> : null}
        {m.kind === "partner" ? <Badge id={m.partnerId} name={PARTNERS[m.partnerId as PartnerId].name} color={PARTNERS[m.partnerId as PartnerId].color} size={128} ring /> : null}
        <Text style={styles.popTitle} testID="celebration-title">{c.title}</Text>
        <Text style={styles.popBody}>{c.body}</Text>
        <Pressable testID={signable ? "celebration-sign" : "celebration-continue"} accessibilityRole="button" style={({ pressed }) => [styles.popBtn, pressed && { opacity: 0.88 }]} onPress={() => (signable ? onSign(m.partnerId) : onContinue())}>
          <Text style={styles.popBtnText}>{signable ? "SIGN IN TEAM" : "CONTINUE"}</Text>
          <Ionicons name="chevron-forward" size={18} color={UI.goldInk} />
        </Pressable>
        {signable ? (
          <Pressable testID="celebration-later" accessibilityRole="button" style={styles.later} onPress={onContinue}>
            <Text style={styles.laterText}>Later</Text>
          </Pressable>
        ) : null}
        {moments.length > 1 ? (
          <View style={styles.dots} testID="celebration-dots">
            {moments.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ---- Result card -----------------------------------------------------------
export interface ResultTile {
  before: number;
  after: number;
  parts: string[];
}
export interface ResultPartner {
  id: string;
  name: string;
  color: string;
  level: string; // "LV 2"
  gain: string; // "+12 Growth · +2 Chemistry"
  lvUp?: string; // "LV UP · Lv 3"
  growth: { from: number; to: number; text: string; max?: string }; // fractions 0..1
  chem: { from: number; to: number; text: string };
}
export interface ResultButton {
  label: string;
  testID: string;
  onPress: () => void;
  kind: "primary" | "secondary" | "share";
}

export function ResultCard(props: {
  won: boolean;
  title: string;
  score: string;
  sub: string;
  stats: { longest: number; rallies: number; dinks: number };
  loading: boolean;
  coins?: ResultTile;
  fans?: ResultTile;
  partner?: ResultPartner;
  chips: { icon: IoniconName; text: string; partnerId?: string }[];
  lines: string[]; // extra text (e.g. "Progress used today — play for fun")
  next?: string | null;
  buttons: ResultButton[];
}) {
  const coinT = useSharedValue(0);
  const fanT = useSharedValue(0);
  const barT = useSharedValue(0);
  const chipT = useSharedValue(0);
  const [coinsShown, setCoinsShown] = useState(props.coins?.before ?? 0);
  const [fansShown, setFansShown] = useState(props.fans?.before ?? 0);
  const { loading } = props;

  useEffect(() => {
    if (loading) return;
    coinT.value = withTiming(1, { duration: 600 });
    fanT.value = withDelay(600, withTiming(1, { duration: 400 }));
    barT.value = withDelay(1000, withTiming(1, { duration: 500 }));
    chipT.value = withDelay(1500, withTiming(1, { duration: 250 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const cB = props.coins?.before ?? 0, cA = props.coins?.after ?? 0, fB = props.fans?.before ?? 0, fA = props.fans?.after ?? 0;
  useAnimatedReaction(() => Math.round(cB + (cA - cB) * coinT.value), (v, prev) => { if (v !== prev) runOnJS(setCoinsShown)(v); }, [cB, cA]);
  useAnimatedReaction(() => Math.round(fB + (fA - fB) * fanT.value), (v, prev) => { if (v !== prev) runOnJS(setFansShown)(v); }, [fB, fA]);

  const skip = () => {
    for (const s of [coinT, fanT, barT, chipT]) {
      cancelAnimation(s);
      s.value = 1;
    }
  };
  const chipStyle = useAnimatedStyle(() => ({ opacity: chipT.value }));
  const p = props.partner;

  return (
    <Pressable style={styles.card} onPress={skip} testID="result-card" accessible={false}>
      <Text style={[styles.kicker, !props.won && styles.kickerLoss]} testID="result-title">{props.title}</Text>
      <Text style={[styles.score, !props.won && { color: UI.ink }]} testID="final-score">{props.score}</Text>
      <Text style={styles.sub} numberOfLines={1} adjustsFontSizeToFit testID="result-sub">{props.sub}</Text>
      <View style={styles.statRow}>
        <StatChip icon="pulse" value={props.stats.longest} label="longest rally" />
        <StatChip icon="repeat" value={props.stats.rallies} label="rallies" />
        <StatChip icon="tennisball" value={props.stats.dinks} label="my dinks" />
      </View>
      {props.loading ? null : (
        <>
          {props.coins || props.fans ? (
            <View style={styles.tiles}>
              {props.coins ? <Tile icon={<Coin size={26} />} value={coinsShown} tile={props.coins} testID="tile-coins" /> : null}
              {props.fans ? <Tile icon={<Ionicons name="people" size={26} color={UI.fans} />} value={fansShown} tile={props.fans} testID="tile-fans" /> : null}
            </View>
          ) : null}
          {props.lines.map((l, i) => (
            <Text key={i} style={styles.line} testID={`reward-line-${i}`}>{l}</Text>
          ))}
          {p ? (
            <View style={styles.partner} testID="result-partner">
              <View style={styles.pHead}>
                <Badge id={p.id} name={p.name} color={p.color} size={36} />
                <Text style={styles.pName}>{p.name}</Text>
                <View style={styles.lv}><Text style={styles.lvText}>{p.level}</Text></View>
                <View style={{ flex: 1 }} />
                <Text style={styles.pGain} numberOfLines={1} adjustsFontSizeToFit testID="result-partner-gain">{p.gain}</Text>
              </View>
              {p.lvUp ? <Animated.Text style={[styles.lvUp, chipStyle]} testID="result-lvup">{p.lvUp}</Animated.Text> : null}
              <Bar icon="star" color={UI.growth} bar={p.growth} t={barT} testID="result-growth" />
              <Bar icon="heart" color={UI.chem} bar={p.chem} t={barT} testID="result-chem" />
            </View>
          ) : null}
          {props.chips.length ? (
            <Animated.View style={[styles.chips, chipStyle]} testID="moment-chips">
              {props.chips.map((c, i) => (
                <View key={i} style={styles.chip}>
                  {c.partnerId ? <Badge id={c.partnerId} name={c.text} color={PARTNERS[c.partnerId as PartnerId]?.color ?? UI.green} size={18} /> : <Ionicons name={c.icon} size={13} color={UI.goldDeep} />}
                  <Text style={styles.chipText}>{c.text}</Text>
                </View>
              ))}
            </Animated.View>
          ) : null}
          {props.next ? <Text style={styles.next} numberOfLines={1} adjustsFontSizeToFit testID="next-goal">{props.next}</Text> : null}
        </>
      )}
      <View style={styles.btnRow}>
        {props.buttons.map((b) => (
          <Pressable
            key={b.testID}
            testID={b.testID}
            accessibilityRole="button"
            accessibilityLabel={b.kind === "share" ? "Share" : b.label}
            disabled={props.loading && b.kind !== "secondary"}
            onPress={b.onPress}
            style={({ pressed }) => [b.kind === "primary" ? styles.primary : b.kind === "share" ? styles.share : styles.secondary, props.loading && b.kind !== "secondary" && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
          >
            {b.kind === "share" ? (
              <Ionicons name="share-social" size={20} color={UI.ink} />
            ) : (
              <>
                <Text style={b.kind === "primary" ? styles.primaryText : styles.secondaryText} numberOfLines={1} adjustsFontSizeToFit>{b.label}</Text>
                {b.kind === "primary" ? <Ionicons name="chevron-forward" size={16} color={UI.goldInk} /> : null}
              </>
            )}
          </Pressable>
        ))}
      </View>
    </Pressable>
  );
}

function StatChip({ icon, value, label }: { icon: IoniconName; value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={12} color={UI.inkSoft} />
      <Text style={styles.statNum}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Tile({ icon, value, tile, testID }: { icon: React.ReactNode; value: number; tile: ResultTile; testID: string }) {
  return (
    <View style={styles.tile} testID={testID}>
      <View style={styles.tileTop}>
        {icon}
        <View style={{ marginLeft: 8 }}>
          <Text style={styles.tileNum} testID={`${testID}-value`}>{value}</Text>
          <Text style={styles.tileDelta}>+{tile.after - tile.before}</Text>
        </View>
      </View>
      <Text style={styles.tileFrom} numberOfLines={2} testID={`${testID}-from`}>{tile.parts.join(" · ")}</Text>
    </View>
  );
}

function Bar({ icon, color, bar, t, testID }: { icon: IoniconName; color: string; bar: { from: number; to: number; text: string; max?: string }; t: { value: number }; testID: string }) {
  const lighter = useAnimatedStyle(() => ({ width: `${(bar.from + (bar.to - bar.from) * t.value) * 100}%` }));
  return (
    <View style={styles.barRow} testID={testID}>
      <Ionicons name={icon} size={13} color={color} />
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: color, opacity: 0.45 }, lighter]} />
        <View style={[styles.fill, { backgroundColor: color, width: `${Math.min(bar.from, bar.to) * 100}%` }]} />
      </View>
      <Text style={styles.barNum} numberOfLines={1}>{bar.max ?? bar.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  popWrap: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(16,34,30,0.94)", alignItems: "center", justifyContent: "center", padding: 24 },
  popCard: { width: "100%", maxWidth: 380, alignItems: "center", gap: 10 },
  popKicker: { color: UI.gold, fontSize: 12, fontWeight: "800", letterSpacing: 3 },
  popTitle: { color: "#FBF4E2", fontFamily: SERIF, fontWeight: "700", fontSize: 24, textAlign: "center", marginTop: 6 },
  popBody: { color: "rgba(251,244,226,0.88)", fontSize: 14, lineHeight: 20, textAlign: "center" },
  popBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "stretch", minHeight: 48, borderRadius: 14, backgroundColor: UI.gold, borderWidth: 1.5, borderColor: UI.goldDeep, marginTop: 8 },
  popBtnText: { color: UI.goldInk, fontSize: 16, fontWeight: "900", letterSpacing: 1.5 },
  later: { minHeight: 44, minWidth: 88, alignItems: "center", justifyContent: "center" },
  laterText: { color: "#FBF4E2", fontSize: 14, fontWeight: "700" },
  dots: { flexDirection: "row", gap: 6, marginTop: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(251,244,226,0.4)" },
  dotOn: { backgroundColor: UI.gold },
  card: { backgroundColor: UI.cream, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 14, width: "100%", maxWidth: 380, alignItems: "center", borderWidth: 1, borderColor: UI.line },
  kicker: { color: UI.goldDeep, fontSize: 13, fontWeight: "900", letterSpacing: 3 },
  kickerLoss: { color: "#8A3A2E" },
  score: { color: UI.green, fontFamily: SERIF, fontSize: 24, fontWeight: "900", fontVariant: ["tabular-nums"] },
  sub: { color: UI.inkSoft, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  statRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  stat: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: UI.creamDeep, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  statNum: { color: UI.ink, fontSize: 12, fontWeight: "800" },
  statLabel: { color: UI.inkSoft, fontSize: 10.5 },
  tiles: { flexDirection: "row", gap: 8, alignSelf: "stretch", marginTop: 10 },
  tile: { flex: 1, backgroundColor: UI.creamDeep, borderRadius: 12, padding: 8, borderWidth: 1, borderColor: UI.line },
  tileTop: { flexDirection: "row", alignItems: "center" },
  tileNum: { color: UI.ink, fontSize: 20, fontWeight: "900", fontVariant: ["tabular-nums"] },
  tileDelta: { color: UI.green, fontSize: 11, fontWeight: "800" },
  tileFrom: { color: UI.inkSoft, fontSize: 10, marginTop: 3 },
  line: { color: UI.muted, fontSize: 13, fontWeight: "700", marginTop: 8, textAlign: "center" },
  partner: { alignSelf: "stretch", marginTop: 10, backgroundColor: "rgba(241,230,203,0.55)", borderRadius: 12, padding: 8, borderWidth: 1, borderColor: UI.line },
  pHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  pName: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 16 },
  lv: { backgroundColor: UI.green, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  lvText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  pGain: { color: UI.green, fontSize: 11, fontWeight: "800", flexShrink: 1 },
  lvUp: { color: UI.goldDeep, fontSize: 12, fontWeight: "900", letterSpacing: 1, marginTop: 4 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: UI.track, overflow: "hidden" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 4 },
  barNum: { color: UI.ink, fontSize: 11, fontWeight: "700", minWidth: 58, textAlign: "right" },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 12, borderWidth: 1, borderColor: UI.goldDeep, backgroundColor: "#fff", paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { color: UI.ink, fontSize: 11, fontWeight: "700" },
  next: { color: UI.inkSoft, fontSize: 12, fontWeight: "700", marginTop: 10 },
  btnRow: { flexDirection: "row", gap: 8, alignSelf: "stretch", marginTop: 12 },
  primary: { flex: 1.6, flexDirection: "row", gap: 4, minHeight: 48, borderRadius: 14, backgroundColor: UI.gold, borderWidth: 1.5, borderColor: UI.goldDeep, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  primaryText: { color: UI.goldInk, fontSize: 15, fontWeight: "900", letterSpacing: 1 },
  secondary: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: UI.creamDeep, borderWidth: 1, borderColor: UI.line, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  secondaryText: { color: UI.ink, fontSize: 14, fontWeight: "800", letterSpacing: 1 },
  share: { width: 48, minHeight: 48, borderRadius: 14, backgroundColor: UI.creamDeep, borderWidth: 1, borderColor: UI.line, alignItems: "center", justifyContent: "center" },
});
