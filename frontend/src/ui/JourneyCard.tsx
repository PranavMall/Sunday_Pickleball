// MUMBAI JOURNEY: the Career progress card. Four stage columns (trophy,
// WON ribbon, lock, two-line name, three match nodes), built from
// CAREER_MATCHES (never hard-coded counts). Tapping a ✓ node picks a replay.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CAREER_MATCHES, COURT_NAMES, PLAYER_BADGE_COLOR, STAGE_NAMES, type CareerMatchDef } from "@/src/game/meta/economyConfig";
import { TROPHY_BY_STAGE } from "@/src/game/render/sprites";
import { Badge, Card, Kicker, UI } from "./kit";
import { Text } from "./Text";

const STAGES = CAREER_MATCHES.reduce<{ key: CareerMatchDef["stageKey"]; matches: CareerMatchDef[] }[]>((acc, m) => {
  const last = acc[acc.length - 1];
  if (last?.key === m.stageKey) last.matches.push(m);
  else acc.push({ key: m.stageKey, matches: [m] });
  return acc;
}, []);

// "Mumbai Local Series" → "Mumbai" / "Local Series".
function twoLines(name: string): string {
  const i = name.indexOf(" ");
  return i < 0 ? name : `${name.slice(0, i)}\n${name.slice(i + 1)}`;
}

export function JourneyCard({ cleared, nextOpen, picked, playerName, onPick }: { cleared: string[]; nextOpen: CareerMatchDef; picked: string | null; playerName: string; onPick: (id: string | null) => void }) {
  const allDone = CAREER_MATCHES.every((m) => cleared.includes(m.id));
  return (
    <Card style={styles.card} testID="career-progress">
      <View style={styles.head}>
        <Kicker style={styles.kicker}>MUMBAI JOURNEY</Kicker>
        <Text style={styles.of} testID="journey-of">Match {nextOpen.number} of {CAREER_MATCHES.length}</Text>
      </View>
      <View style={styles.cols}>
        {STAGES.map((st) => {
          const final = st.matches[st.matches.length - 1];
          const won = cleared.includes(final.id);
          const open = st.matches.some((m) => cleared.includes(m.id) || m.id === nextOpen.id);
          const current = !allDone && st.key === nextOpen.stageKey;
          return (
            <View key={st.key} style={[styles.col, current && styles.colCurrent]} testID={`stage-${st.key}`}>
              <View style={styles.trophyBox}>
                <Image source={TROPHY_BY_STAGE[st.key]} style={[styles.trophy, !open && { opacity: 0.3 }]} contentFit="contain" cachePolicy="memory-disk" />
                {!open ? (
                  <View style={styles.lock} testID={`stage-lock-${st.key}`}>
                    <Ionicons name="lock-closed" size={12} color={UI.goldDeep} />
                  </View>
                ) : null}
                {won ? (
                  <View style={styles.won} testID={`stage-won-${st.key}`}>
                    <Text style={styles.wonText}>WON</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.name, current && styles.nameCurrent]} testID={`stage-name-${st.key}`}>{twoLines(STAGE_NAMES[st.key])}</Text>
              <View style={styles.nodes}>
                {st.matches.map((m, i) => {
                  const done = cleared.includes(m.id);
                  const here = !allDone && m.id === nextOpen.id;
                  const sel = picked === m.id;
                  return (
                    <React.Fragment key={m.id}>
                      {i > 0 ? <View style={[styles.link, done && styles.linkDone]} /> : null}
                      <Pressable
                        style={styles.hit}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        testID={`node-${m.number}`}
                        disabled={!done && !here}
                        accessibilityRole="button"
                        accessibilityLabel={done ? `Replay match ${m.number}` : `Match ${m.number}`}
                        onPress={() => onPick(here ? null : m.id)}
                      >
                        {here ? (
                          <View style={styles.meRing}>
                            <Badge name={playerName || "P"} color={PLAYER_BADGE_COLOR} size={20} testID={`node-me-${m.number}`} />
                          </View>
                        ) : (
                          <View style={[styles.node, done && styles.nodeDone, sel && styles.nodeSel]}>
                            {done ? <Ionicons name="checkmark" size={12} color="#fff" /> : m.round === "FINAL" ? <Ionicons name="star" size={10} color="#8B826C" /> : null}
                          </View>
                        )}
                        <Text style={[styles.num, !open && { color: UI.muted }]}>{m.number}</Text>
                      </Pressable>
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
      <Text style={styles.next} testID="journey-next">
        {allDone ? (
          "Mumbai Journey complete"
        ) : (
          <>
            Next: <Text style={styles.nextHi}>Match {nextOpen.number}</Text>
            {nextOpen.court ? ` · ${COURT_NAMES[nextOpen.court]}` : ""}
          </>
        )}
      </Text>
      {cleared.length ? <Text style={styles.caption} testID="replay-caption">Tap ✓ to replay</Text> : null}
    </Card>
  );
}

const NODE = 22;
const styles = StyleSheet.create({
  card: { paddingVertical: 10, paddingHorizontal: 6 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6 },
  kicker: { fontSize: 11, color: "#1E4D33", letterSpacing: 2 },
  of: { color: UI.inkSoft, fontSize: 12.5, fontWeight: "800" },
  cols: { flexDirection: "row", marginTop: 6, gap: 2 },
  col: { flex: 1, alignItems: "center", paddingVertical: 4, borderRadius: 10, borderWidth: 1.5, borderColor: "transparent" },
  colCurrent: { backgroundColor: "rgba(240,200,90,0.18)", borderColor: UI.gold },
  trophyBox: { height: 50, width: "100%", alignItems: "center", justifyContent: "flex-end" },
  trophy: { width: 46, height: 46 },
  lock: { position: "absolute", top: 16, alignSelf: "center", backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 9, width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  won: { position: "absolute", bottom: -2, alignSelf: "center", backgroundColor: UI.green, borderRadius: 5, paddingHorizontal: 5 },
  wonText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  name: { color: "#7D7462", fontSize: 9.5, lineHeight: 12, textAlign: "center", marginTop: 4, minHeight: 24 },
  nameCurrent: { color: "#1E4D33", fontWeight: "800" },
  nodes: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", marginTop: 4 },
  hit: { alignItems: "center", minHeight: 40, minWidth: NODE },
  link: { height: 2, width: 3, backgroundColor: "#CFC4A8", marginTop: NODE / 2 },
  linkDone: { backgroundColor: UI.green },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: "#D9D0B9", borderWidth: 1.5, borderColor: "#B9AE92", alignItems: "center", justifyContent: "center" },
  nodeDone: { backgroundColor: UI.green, borderColor: "#1F5A37" },
  nodeSel: { borderColor: UI.gold, borderWidth: 2.5 },
  meRing: { width: NODE, height: NODE, borderRadius: NODE / 2, borderWidth: 1.5, borderColor: UI.gold, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  num: { color: UI.ink, fontSize: 10, marginTop: 2 },
  next: { color: UI.ink, fontSize: 13, fontWeight: "700", textAlign: "center", marginTop: 6 },
  nextHi: { color: UI.green, fontWeight: "900" },
  caption: { color: UI.inkSoft, fontSize: 11, textAlign: "center", marginTop: 2 },
});
