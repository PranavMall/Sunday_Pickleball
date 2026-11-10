// "New to pickleball?" pop-up: the welcome step 2 on Home, and once before Match 1.
import React from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { TUTORIAL_REWARD_COINS } from "@/src/game/meta/tutorial";
import { Text } from "./Text";
import { SkillChips } from "./TutorialLayer";
import { Coin, GoldButton, SERIF, UI } from "./kit";

export function TutorialOffer({ visible, kicker, partnerName, secondary, onLearn, onSecondary, onClose, testID }: { visible: boolean; kicker: string; partnerName: string; secondary: string; onLearn: () => void; onSecondary: () => void; onClose: () => void; testID: string }) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" testID={`${testID}-backdrop`} />
        <View style={styles.card} testID={testID}>
          <View style={styles.head}>
            <Text style={styles.kicker}>{kicker}</Text>
            <Pressable testID={`${testID}-close`} accessibilityLabel="Close" onPress={onClose} style={styles.close}>
              <Text style={styles.closeText}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.title}>New to pickleball?</Text>
          <Text style={styles.sub}>Learn the six shots in a short practice match with {partnerName}. About 2 minutes.</Text>
          <View style={{ alignItems: "flex-start", marginTop: 10 }}>
            <SkillChips done={[]} testID={`${testID}-chips`} />
          </View>
          <View style={styles.reward}>
            <Coin size={22} />
            <Text style={styles.rewardText}>+{TUTORIAL_REWARD_COINS} Coins when you finish</Text>
          </View>
          <GoldButton testID={`${testID}-learn`} label="LEARN THE BASICS" onPress={onLearn} style={{ marginTop: 12, minHeight: 56 }} />
          <Pressable testID={`${testID}-secondary`} accessibilityRole="button" onPress={onSecondary} style={styles.textBtn}>
            <Text style={styles.textBtnText}>{secondary}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(20,26,18,0.78)", justifyContent: "center", paddingHorizontal: 22 },
  card: { backgroundColor: UI.cream, borderRadius: 24, padding: 20, width: "100%", maxWidth: 420, alignSelf: "center" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: { color: UI.goldDeep, fontSize: 12, fontWeight: "800", letterSpacing: 3, flexShrink: 1 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10, marginTop: -10 },
  closeText: { color: UI.inkSoft, fontSize: 20, fontWeight: "700" },
  title: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 24 },
  sub: { color: UI.muted, fontSize: 14, marginTop: 6, lineHeight: 20 },
  reward: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  rewardText: { color: UI.ink, fontSize: 14, fontWeight: "700" },
  textBtn: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 6 },
  textBtnText: { color: UI.inkSoft, fontSize: 15, fontWeight: "700" },
});
