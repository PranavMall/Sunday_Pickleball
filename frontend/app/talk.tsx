// MATCH TALK: a short dialogue between PLAY (Career) and the match, first play
// only. The court (dimmed) behind; "MATCH N OF 12", "vs <rival>", the twist
// chip + line + starting score (twist matches only); Skip › top-right. The only
// storage write is "seen" for the match ID when the talk ends (or is skipped).
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Fullscreen } from "@/src/components/fullscreen";
import { meta } from "@/src/game/meta";
import { CAREER_MATCHES, MATCH_TALK, PARTNERS, PLAYER_BADGE_COLOR, careerMatch } from "@/src/game/meta/economyConfig";
import { partnerOf, talkRival } from "@/src/game/meta/matchSetup";
import { FACES, faceKeyOf } from "@/src/game/render/sprites";
import { teamCode } from "@/src/game/services/profile";
import { CourtImage } from "@/src/ui/CourtThumb";
import { DialogueScene, type DialogueLine, type DialogueSpeaker } from "@/src/ui/DialogueScene";
import { Text } from "@/src/ui/Text";
import { StartScoreCard, TwistChip } from "@/src/ui/TwistChip";
import { Card, Kicker, SERIF, UI } from "@/src/ui/kit";
import { useSave } from "@/src/ui/useSave";

export default function Talk() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { careerId } = useLocalSearchParams<{ careerId?: string }>();
  const m = careerMatch(careerId);
  const { save, identity } = useSave();

  const lines = useMemo((): DialogueLine[] => {
    const signed = (id: string) => !!save?.partners[id]?.signed;
    const r = talkRival(m, signed);
    const rival: DialogueSpeaker = r.partnerId
      ? { name: PARTNERS[r.partnerId].name.toUpperCase(), color: PARTNERS[r.partnerId].color, portraitId: r.partnerId }
      : { name: m.rival.toUpperCase(), color: m.color, face: r.look ? FACES[faceKeyOf(r.look)] : undefined };
    const p = partnerOf(save?.activePartnerId);
    const partner: DialogueSpeaker = { name: p.name.toUpperCase(), color: p.color, portraitId: p.id };
    const name = identity?.playerName ?? "You";
    const you: DialogueSpeaker = { name: name.toUpperCase(), color: PLAYER_BADGE_COLOR };
    return (MATCH_TALK[m.number] ?? []).map((l) => ({ speaker: l.speaker === "R" ? rival : l.speaker === "P" ? partner : you, text: l.text }));
  }, [m, save, identity]);

  const start = () => {
    if (meta.loaded) meta.markTalkSeen(m.id);
    router.replace({ pathname: "/match", params: { mode: "career", careerId: m.id } });
  };

  return (
    <View style={styles.root} testID="talk-screen">
      <Fullscreen />
      {m.court ? <CourtImage court={m.court} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <View style={[StyleSheet.absoluteFill, styles.dim]} />
      <DialogueScene lines={lines} onDone={start} bottom={insets.bottom + 16} />
      <View style={[styles.top, { paddingTop: insets.top + 10 }]} pointerEvents="box-none">
        <View style={styles.row} pointerEvents="box-none">
          <Card style={styles.numChip}>
            <Kicker style={{ fontSize: 11, letterSpacing: 1.5 }}>MATCH {m.number} OF {CAREER_MATCHES.length}</Kicker>
          </Card>
          <Pressable testID="talk-skip" accessibilityRole="button" accessibilityLabel="Skip" onPress={start} style={({ pressed }) => [styles.skip, pressed && { opacity: 0.85 }]}>
            <Text style={styles.skipText}>Skip ›</Text>
          </Pressable>
        </View>
        <View pointerEvents="none" style={{ alignItems: "center", gap: 8, marginTop: 14 }}>
          <Text style={styles.vs} testID="talk-rival">vs {m.rival}</Text>
          {m.twist ? (
            <>
              <TwistChip twist={m.twist} testID="talk-twist" />
              <Text style={styles.twistLine} testID="talk-twist-line">{m.twist.line}</Text>
              <StartScoreCard twist={m.twist} myCode={teamCode(identity?.teamName ?? "", m.code)} rivalCode={m.code} />
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#10221E" },
  dim: { backgroundColor: "rgba(16,34,30,0.45)" },
  top: { position: "absolute", left: 0, right: 0, top: 0, paddingHorizontal: 14 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  numChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: UI.cream },
  skip: { minHeight: 44, minWidth: 64, paddingHorizontal: 12, borderRadius: 14, backgroundColor: UI.cream, borderWidth: 1, borderColor: UI.line, alignItems: "center", justifyContent: "center", elevation: 4 },
  skipText: { color: UI.ink, fontSize: 14, fontWeight: "800" },
  vs: { color: "#FBF4E2", fontFamily: SERIF, fontWeight: "700", fontSize: 26, textAlign: "center", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 6 },
  twistLine: { color: "#FBF4E2", fontSize: 14, fontWeight: "700", textAlign: "center", textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 },
});
