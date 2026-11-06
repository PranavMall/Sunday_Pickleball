// Twist chip "TWIST · <NAME>" (gold) — Career Next Match card and Match talk.
import React from "react";
import { StyleSheet, View } from "react-native";

import type { MatchTwist } from "@/src/game/meta/economyConfig";
import { Text } from "./Text";
import { UI } from "./kit";

export function TwistChip({ twist, testID = "twist-chip" }: { twist: MatchTwist; testID?: string }) {
  return (
    <View style={styles.chip} testID={testID}>
      <Text style={styles.text}>TWIST · {twist.name.toUpperCase()}</Text>
    </View>
  );
}

// Small starting-score card (only when the twist sets a starting score).
export function StartScoreCard({ twist, myCode, rivalCode }: { twist: MatchTwist; myCode: string; rivalCode: string }) {
  const s = twist.startingScore;
  if (!s) return null;
  return (
    <View style={styles.score} testID="twist-score">
      <View style={styles.side}>
        <Text style={styles.num}>{s.near}</Text>
        <Text style={styles.code}>{myCode}</Text>
      </View>
      <Text style={styles.dash}>–</Text>
      <View style={styles.side}>
        <Text style={styles.num}>{s.far}</Text>
        <Text style={styles.code}>{rivalCode}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: "center", backgroundColor: UI.gold, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: UI.goldDeep },
  text: { color: UI.goldInk, fontSize: 10, fontWeight: "900", letterSpacing: 0.8, textAlign: "center" },
  score: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: UI.cream, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 6, borderWidth: 1, borderColor: UI.line },
  side: { alignItems: "center", minWidth: 40 },
  num: { color: UI.ink, fontSize: 26, fontWeight: "900", fontVariant: ["tabular-nums"] },
  code: { color: UI.inkSoft, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  dash: { color: UI.muted, fontSize: 20, fontWeight: "700" },
});
