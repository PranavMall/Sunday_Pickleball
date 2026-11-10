// TUTORIAL COMPLETE (Celebration layout: dark full screen).
import { Ionicons } from "@react-native-vector-icons/ionicons";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { PARTNERS, type PartnerId } from "@/src/game/meta/economyConfig";
import { LESSON_IDS } from "@/src/game/meta/tutorial";
import { Text } from "./Text";
import { SkillChips } from "./TutorialLayer";
import { Badge, Coin, SERIF, UI } from "./kit";

export function TutorialFinish({ partnerId, coins, button, onPress }: { partnerId: string; coins: number; button: string; onPress: () => void }) {
  const p = PARTNERS[partnerId as PartnerId] ?? PARTNERS.anli;
  return (
    <View style={styles.wrap} testID="tutorial-finish">
      <View style={styles.card}>
        <Text style={styles.kicker}>TUTORIAL COMPLETE</Text>
        <Badge id={p.id} name={p.name} color={p.color} size={128} ring />
        <Text style={styles.title}>You're ready!</Text>
        <SkillChips done={LESSON_IDS} testID="tutorial-finish-chips" />
        <Text style={styles.body}>You know the basics. Your Mumbai journey starts at Bandra Garden.</Text>
        {coins > 0 ? (
          <View style={styles.coins} testID="tutorial-finish-coins">
            <Coin size={24} />
            <Text style={styles.coinText}>+{coins} Coins</Text>
          </View>
        ) : null}
        <Pressable testID="tutorial-finish-button" accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.88 }]}>
          <Text style={styles.btnText}>{button}</Text>
          <Ionicons name="chevron-forward" size={18} color={UI.goldInk} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(16,34,26,0.94)", justifyContent: "center", paddingHorizontal: 22 },
  card: { alignItems: "center", gap: 12, maxWidth: 420, width: "100%", alignSelf: "center" },
  kicker: { color: UI.gold, fontSize: 12, fontWeight: "900", letterSpacing: 3 },
  title: { color: "#FBF4E2", fontFamily: SERIF, fontWeight: "700", fontSize: 30 },
  body: { color: "rgba(251,244,226,0.85)", fontSize: 15, textAlign: "center", lineHeight: 21 },
  coins: { flexDirection: "row", alignItems: "center", gap: 8 },
  coinText: { color: "#FBF4E2", fontSize: 18, fontWeight: "900" },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, alignSelf: "stretch", minHeight: 56, borderRadius: 16, backgroundColor: UI.gold, marginTop: 6 },
  btnText: { color: UI.goldInk, fontSize: 18, fontWeight: "900", letterSpacing: 1 },
});
