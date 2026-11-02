import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Text } from "@/src/ui/Text";

import {
  CAREER_MATCHES,
  COURT_NAMES,
  PLAYER_BADGE_COLOR,
  STAGE_NAMES,
  careerMatch,
  careerRewardPreview,
} from "@/src/game/meta/economyConfig";
import { partnerOf } from "@/src/game/meta/matchSetup";
import { levelView } from "@/src/game/meta/levels";
import { teamCode } from "@/src/game/services/profile";
import { DestinationScreen } from "@/src/ui/DestinationScreen";
import { HeaderActions } from "@/src/ui/HeaderActions";
import { Badge, Card, chemOf, Coin, GoldButton, Kicker, MeterRow, SERIF, UI } from "@/src/ui/kit";
import { useSave } from "@/src/ui/useSave";
import { CourtThumb } from "@/src/ui/CourtThumb";
import { JourneyCard } from "@/src/ui/JourneyCard";

export default function Career() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { save, identity, refresh } = useSave();
  const nextOpen = careerMatch(save?.career.nextMatchId);
  const cleared = save?.career.cleared ?? [];
  // The card shows the next open match, or a cleared match picked for replay.
  const [pickedId, setPickedId] = useState<string | null>(null);
  const next = pickedId && cleared.includes(pickedId) ? careerMatch(pickedId) : nextOpen;
  const replay = cleared.includes(next.id);
  const stage = STAGE_NAMES[next.stageKey];
  const reward = careerRewardPreview(next, replay);
  const partner = partnerOf(save?.activePartnerId);
  const lv = levelView(save?.partners[partner.id]?.growth ?? 0, save?.career.nextMatchId ?? next.id);
  const myCode = teamCode(identity?.teamName ?? "", next.code);
  const chem = chemOf(save?.chemistryHalves[`player+${partner.id}`]);

  return (
    <DestinationScreen
      active="career"
      testID="career-screen"
      header={<HeaderActions save={save} onChange={refresh} />}
    >
      <JourneyCard cleared={cleared} nextOpen={nextOpen} picked={replay ? next.id : null} playerName={identity?.playerName ?? ""} onPick={setPickedId} />

      <Card style={styles.pad} testID="next-match-card">
        <View style={styles.nmHead}>
          <Kicker>{replay ? "REPLAY" : "NEXT MATCH"}</Kicker>
          <Text style={styles.nmOf} testID="next-match-number">Match {next.number} of {CAREER_MATCHES.length}</Text>
          {next.round ? (
            <View style={styles.roundBadge} testID="badge-round">
              <Text style={styles.roundText}>{next.round}</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <Text style={styles.nmStage} numberOfLines={1} testID="nm-stage">{stage}</Text>
        </View>
        <View style={styles.nmBody}>
          <View style={{ flex: 1 }}>
            <View style={styles.vsRow}>
              <View style={styles.side}>
                <Badge name={identity?.playerName ?? "P"} color={PLAYER_BADGE_COLOR} size={44} />
                <Text style={styles.sideName} numberOfLines={1} adjustsFontSizeToFit testID="nm-player-name">{identity?.playerName ?? ""}</Text>
                <Text style={styles.code} testID="nm-team-code">{myCode}</Text>
              </View>
              <Text style={styles.vs}>VS</Text>
              <View style={styles.side}>
                <Badge name={next.rival} color={next.color} size={44} testID="rival-badge" />
                <Text style={styles.code} testID="rival-code">{next.code}</Text>
                <Text style={styles.rivalFull} numberOfLines={2} testID="rival-name">{next.rival}</Text>
                {next.namedRival ? (
                  <View style={styles.rivalTag} testID="badge-rival">
                    <Text style={styles.rivalTagText}>RIVAL TEAM</Text>
                  </View>
                ) : null}
              </View>
            </View>
            {next.enabled ? (
            <View style={styles.rewards} testID="reward-preview">
              <View style={styles.reward}>
                <Coin size={26} />
                <View style={{ marginLeft: 6, flexShrink: 1 }}>
                  <Text style={styles.rewardNum} testID="reward-coins">+{reward.coins}</Text>
                  <Text style={styles.rewardSub} numberOfLines={2}>Coins ({reward.coinParts.join(" + ")})</Text>
                </View>
              </View>
              {reward.fans > 0 ? (
              <View style={styles.reward}>
                <Ionicons name="people" size={24} color={UI.fans} />
                <View style={{ marginLeft: 6, flexShrink: 1 }}>
                  <Text style={styles.rewardNum} testID="reward-fans">+{reward.fans}</Text>
                  <Text style={styles.rewardSub} numberOfLines={2}>Fans ({reward.fanParts.join(" + ")})</Text>
                </View>
              </View>
              ) : null}
            </View>
            ) : null}
          </View>
          {next.court ? (
            <View style={{ marginLeft: 8, alignItems: "center" }}>
              <View>
                <CourtThumb court={next.court} width={width < 385 ? 96 : 118} />
                {save && !(save.courtsPlayed ?? []).includes(next.court) ? (
                  <View style={styles.newTag} testID="court-new">
                    <Text style={styles.newText}>NEW</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.courtName} testID="court-name">{COURT_NAMES[next.court]}</Text>
            </View>
          ) : null}
        </View>
        {next.enabled ? (
          <GoldButton
            big
            testID="play-match"
            label={replay ? "REPLAY MATCH" : "PLAY MATCH"}
            onPress={() => router.push({ pathname: "/match", params: { mode: "career", careerId: next.id } })}
            style={{ marginTop: 10 }}
          />
        ) : (
          <View style={styles.soon} testID="play-match-locked" accessibilityState={{ disabled: true }}>
            <Ionicons name="lock-closed" size={18} color={UI.muted} />
            <Text style={styles.soonText}>COMING SOON</Text>
          </View>
        )}
      </Card>

      <Card style={styles.pad} testID="partner-block">
        <Kicker style={{ color: UI.ink }}>YOUR PARTNER</Kicker>
        <View style={styles.partnerRow}>
          <Badge id={partner.id} name={partner.name} color={partner.color} size={42} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.partnerName}>{partner.name}</Text>
              <View style={styles.activeChip}>
                <Text style={styles.activeText}>LV {lv.level}</Text>
              </View>
            </View>
            <Text style={styles.arch}>{partner.archetype}</Text>
          </View>
          <Pressable
            testID="view-in-team"
            accessibilityRole="button"
            style={({ pressed }) => [styles.viewBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.replace({ pathname: "/team", params: { highlight: partner.id } })}
          >
            <Text style={styles.viewText}>VIEW{"\n"}IN TEAM ›</Text>
          </Pressable>
        </View>
        <MeterRow icon="star" label="Growth" value={lv.frac * 100} num={lv.max ?? lv.text} color={UI.growth} testID="partner-growth" />
        <MeterRow icon="heart" label="Chemistry" value={chem} color={UI.chem} testID="partner-chem" />
      </Card>
    </DestinationScreen>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 10 },
  soon: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 58, borderRadius: 16, marginTop: 10, backgroundColor: UI.creamDeep, borderWidth: 1, borderColor: UI.line },
  soonText: { color: UI.muted, fontSize: 20, fontWeight: "900", letterSpacing: 1 },
  code: { color: UI.ink, fontSize: 15, fontWeight: "900", letterSpacing: 1.5, marginTop: 2 },
  rivalFull: { color: UI.inkSoft, fontSize: 11, textAlign: "center", alignSelf: "stretch" },
  newTag: { position: "absolute", top: -6, right: -6, backgroundColor: UI.red, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1.5, borderColor: UI.cream },
  newText: { color: "#fff", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  nmHead: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  nmOf: { color: UI.inkSoft, fontSize: 13 },
  nmStage: { color: UI.inkSoft, fontSize: 13 },
  roundBadge: { backgroundColor: UI.gold, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  roundText: { color: UI.goldInk, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  nmBody: { flexDirection: "row", marginTop: 8 },
  vsRow: { flexDirection: "row", alignItems: "flex-start" },
  side: { flex: 1, alignItems: "center" },
  sideName: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 15, marginTop: 4, textAlign: "center" },
  sideSub: { color: UI.inkSoft, fontSize: 12, textAlign: "center" },
  vs: { color: UI.inkSoft, fontFamily: SERIF, fontWeight: "700", fontSize: 16, marginTop: 16, marginHorizontal: 2 },
  rivalTag: { backgroundColor: "#7C8EA3", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, marginTop: 3 },
  rivalTagText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  rewards: { flexDirection: "row", marginTop: 10, borderTopWidth: 1, borderTopColor: UI.line, paddingTop: 8 },
  reward: { flex: 1, flexDirection: "row", alignItems: "center" },
  rewardNum: { color: UI.ink, fontSize: 18, fontWeight: "800" },
  rewardSub: { color: UI.inkSoft, fontSize: 10 },
  courtName: { color: UI.inkSoft, fontSize: 11, marginTop: 3, fontWeight: "600" },
  arch: { color: UI.inkSoft, fontSize: 14 },
  partnerRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  partnerName: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 20 },
  activeChip: { backgroundColor: UI.green, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  activeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  viewBtn: { borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: UI.line, minHeight: 44, justifyContent: "center" },
  viewText: { color: UI.ink, fontSize: 13, fontWeight: "800", paddingHorizontal: 12, paddingVertical: 10, textAlign: "center" },
});
