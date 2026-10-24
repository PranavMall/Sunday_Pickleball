import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
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
  type CareerMatchDef,
} from "@/src/game/meta/economyConfig";
import { partnerOf } from "@/src/game/meta/matchSetup";
import { DestinationScreen } from "@/src/ui/DestinationScreen";
import { HeaderActions } from "@/src/ui/HeaderActions";
import { Badge, Card, Coin, GoldButton, Kicker, MeterRow, SERIF, UI } from "@/src/ui/kit";
import { useSave } from "@/src/ui/useSave";

const COURT_IMG = {
  bandra_garden: require("@/assets/images/court_bandra_garden.webp"),
  mumbai_local: require("@/assets/images/court_mumbai_local.webp"),
};
const GROUPS: { key: CareerMatchDef["stageKey"]; nums: number[] }[] = [
  { key: "community", nums: [1, 2, 3] },
  { key: "local", nums: [4, 5, 6] },
  { key: "district", nums: [7, 8, 9, 10] },
];

export default function Career() {
  const router = useRouter();
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
  const growth = save?.partners[partner.id]?.growth ?? 0;
  const chem = Math.floor((save?.chemistryHalves[`player+${partner.id}`] ?? 0) / 2);

  return (
    <DestinationScreen
      active="career"
      testID="career-screen"
      header={<HeaderActions save={save} onChange={refresh} />}
    >
      <Card style={styles.pad} testID="career-progress">
        <Kicker style={{ fontSize: 11 }}>TOURNAMENT PROGRESS</Kicker>
        <View style={styles.groups}>
          {GROUPS.map((g, gi) => {
            const locked = CAREER_MATCHES[g.nums[0] - 1].enabled === false;
            const activeGroup = g.key === next.stageKey;
            return (
              <View key={g.key} style={[styles.group, { flex: g.nums.length }, gi > 0 && styles.groupDivider]}>
                <View style={styles.groupHead}>
                  {locked ? <Ionicons name="lock-closed" size={11} color={UI.muted} /> : null}
                  <Text style={[styles.groupName, activeGroup && { color: "#1E4D33", fontWeight: "800" }, locked && { color: UI.muted }]} numberOfLines={1}>
                    {g.key === "district" ? "District Champ." : STAGE_NAMES[g.key].replace(" Series", "")}
                  </Text>
                </View>
                <View style={styles.nodes}>
                  {g.nums.map((n, i) => {
                    const m = CAREER_MATCHES[n - 1];
                    const done = cleared.includes(m.id);
                    const current = m.id === next.id;
                    const tappable = done || m.id === nextOpen.id;
                    return (
                      <React.Fragment key={n}>
                        {i > 0 ? <View style={[styles.link, done && styles.linkDone]} /> : null}
                        <Pressable
                          style={styles.nodeHit}
                          testID={`node-${n}`}
                          disabled={!tappable}
                          accessibilityRole="button"
                          accessibilityLabel={done ? `Replay match ${n}` : `Match ${n}`}
                          onPress={() => setPickedId(m.id === nextOpen.id ? null : m.id)}
                        >
                          <View style={[styles.node, done && styles.nodeDone, current && styles.nodeCurrent, !m.enabled && styles.nodeLocked]}>
                            {done ? (
                              <Ionicons name="checkmark" size={14} color="#fff" />
                            ) : m.round === "FINAL" ? (
                              <Ionicons name="star" size={12} color={current ? UI.goldInk : "#8B826C"} />
                            ) : null}
                          </View>
                          <Text style={[styles.nodeNum, !m.enabled && { color: UI.muted }]}>{n}</Text>
                        </Pressable>
                      </React.Fragment>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      <Card style={styles.pad} testID="next-match-card">
        <View style={styles.nmHead}>
          <Kicker>{replay ? "REPLAY" : "NEXT MATCH"}</Kicker>
          <Text style={styles.nmOf} testID="next-match-number">Match {next.number} of 10</Text>
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
                <Badge name={identity?.playerName ?? "P"} color={PLAYER_BADGE_COLOR} size={50} />
                <Text style={styles.sideName} numberOfLines={2} testID="nm-player-name">{identity?.playerName ?? ""}</Text>
                <Text style={styles.sideName} numberOfLines={2} testID="nm-team-name">Team {identity?.teamName ?? ""}</Text>
              </View>
              <Text style={styles.vs}>VS</Text>
              <View style={styles.side}>
                <Badge name={next.rival} color={next.color} size={50} testID="rival-badge" />
                <Text style={styles.sideName} numberOfLines={2} testID="rival-name">{next.rival}</Text>
                {next.namedRival ? (
                  <View style={styles.rivalTag} testID="badge-rival">
                    <Text style={styles.rivalTagText}>RIVAL TEAM</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.rewards} testID="reward-preview">
              <View style={styles.reward}>
                <Coin size={26} />
                <View style={{ marginLeft: 6, flexShrink: 1 }}>
                  <Text style={styles.rewardNum} testID="reward-coins">+{reward.coins}</Text>
                  <Text style={styles.rewardSub} numberOfLines={2}>Coins ({reward.coinParts.join(" + ")})</Text>
                </View>
              </View>
              <View style={styles.reward}>
                <Ionicons name="people" size={24} color={UI.fans} />
                <View style={{ marginLeft: 6, flexShrink: 1 }}>
                  <Text style={styles.rewardNum} testID="reward-fans">+{reward.fans}</Text>
                  <Text style={styles.rewardSub} numberOfLines={2}>Fans ({reward.fanParts.join(" + ")})</Text>
                </View>
              </View>
            </View>
          </View>
          {next.court ? (
            <View style={{ marginLeft: 8, alignItems: "center" }}>
              <CourtThumb court={next.court} />
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
          <Badge name={partner.name} color={partner.color} size={52} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.partnerName}>{partner.name}</Text>
              <View style={styles.activeChip}>
                <Text style={styles.activeText}>Active</Text>
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
        <MeterRow icon="star" label="Growth" value={growth} color={UI.growth} testID="partner-growth" />
        <MeterRow icon="heart" label="Chemistry" value={chem} color={UI.chem} testID="partner-chem" />
      </Card>
    </DestinationScreen>
  );
}

// Thumbnail cropped from the match's OWN court image (its upper scenery band).
const CROP = { x: 112, y: 0, w: 800, h: 560 };
function CourtThumb({ court }: { court: keyof typeof COURT_IMG }) {
  const { width } = useWindowDimensions();
  const W = width < 385 ? 96 : 118; // narrow phones: leave the names room
  const s = W / CROP.w;
  return (
    <View style={[styles.thumb, { width: W, height: CROP.h * s }]} testID="court-thumb">
      <Image source={COURT_IMG[court]} style={{ position: "absolute", left: -CROP.x * s, top: -CROP.y * s, width: 1024 * s, height: 1536 * s }} contentFit="fill" />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 12 },
  groups: { flexDirection: "row", marginTop: 8 },
  group: { paddingHorizontal: 4 },
  groupDivider: { borderLeftWidth: 1, borderLeftColor: UI.line },
  groupHead: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, marginBottom: 6 },
  groupName: { color: UI.inkSoft, fontSize: 11, fontWeight: "600", textAlign: "center" },
  nodes: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center" },
  link: { height: 3, flex: 1, maxWidth: 16, backgroundColor: "#CFC4A8", marginTop: 11 },
  linkDone: { backgroundColor: UI.green },
  node: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#D9D0B9", borderWidth: 1.5, borderColor: "#B9AE92", alignItems: "center", justifyContent: "center" },
  nodeDone: { backgroundColor: UI.green, borderColor: "#1F5A37" },
  nodeCurrent: { backgroundColor: UI.gold, borderColor: UI.goldDeep, transform: [{ scale: 1.15 }] },
  nodeLocked: { opacity: 0.45 },
  nodeHit: { alignItems: "center", minWidth: 28, minHeight: 44 },
  soon: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 58, borderRadius: 16, marginTop: 10, backgroundColor: UI.creamDeep, borderWidth: 1, borderColor: UI.line },
  soonText: { color: UI.muted, fontSize: 20, fontWeight: "900", letterSpacing: 1 },
  nodeNum: { color: UI.ink, fontSize: 11, marginTop: 3 },
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
  thumb: { borderRadius: 10, overflow: "hidden", borderWidth: 2, borderColor: UI.cream },
  courtName: { color: UI.inkSoft, fontSize: 11, marginTop: 3, fontWeight: "600" },
  arch: { color: UI.inkSoft, fontSize: 14 },
  partnerRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  partnerName: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 20 },
  activeChip: { backgroundColor: UI.green, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  activeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  viewBtn: { borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: UI.line, minHeight: 44, justifyContent: "center" },
  viewText: { color: UI.ink, fontSize: 13, fontWeight: "800", paddingHorizontal: 12, paddingVertical: 10, textAlign: "center" },
});
