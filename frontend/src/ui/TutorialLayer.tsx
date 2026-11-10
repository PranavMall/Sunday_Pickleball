// TUTORIAL overlays on the match screen: "TUTORIAL · N OF 6" chip, Skip ›,
// the six skill chips under the scoreboard and the partner's lesson box.
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { PARTNERS, type PartnerId } from "@/src/game/meta/economyConfig";
import { LESSON_CHIPS, LESSON_IDS, type LessonId } from "@/src/game/meta/tutorial";
import { DialogueScene } from "./DialogueScene";
import { Text } from "./Text";
import { UI } from "./kit";

export function SkillChips({ done, current, testID = "tutorial-chips" }: { done: readonly string[]; current?: LessonId | null; testID?: string }) {
  return (
    <View style={styles.chips} testID={testID} pointerEvents="none">
      {LESSON_IDS.map((id) => {
        const d = done.includes(id);
        const cur = !d && id === current;
        return (
          <View key={id} style={[styles.chip, d && styles.chipDone, cur && styles.chipCur]} testID={`chip-${id}${d ? "-done" : cur ? "-current" : ""}`}>
            <Text style={[styles.chipText, d && { color: "#fff" }]}>{d ? `✓ ${LESSON_CHIPS[id]}` : LESSON_CHIPS[id]}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function TutorialLayer(props: {
  done: readonly string[];
  current: LessonId | null;
  chipsTop: number;
  top: number;
  bottom: number;
  lines: string[] | null;
  partnerId: string;
  onLinesDone: () => void;
  onSkip: () => void;
}) {
  const p = PARTNERS[props.partnerId as PartnerId] ?? PARTNERS.anli;
  const speaker = { name: p.name.toUpperCase(), color: p.color, portraitId: p.id };
  const n = Math.min(LESSON_IDS.length, props.done.length + 1);
  return (
    <>
      {props.lines ? (
        <View style={[styles.lessonArea, { top: props.top + 60 }]} testID="tutorial-lesson">
          <DialogueScene key={props.lines.join("|")} lines={props.lines.map((text) => ({ speaker, text }))} onDone={props.onLinesDone} bottom={props.bottom} />
        </View>
      ) : null}
      <View style={[styles.topChip, { top: props.top + 10 }]} pointerEvents="none" testID="tutorial-progress">
        <Text style={styles.topChipText}>TUTORIAL · {n} OF 6</Text>
      </View>
      <Pressable testID="tutorial-skip" accessibilityRole="button" accessibilityLabel="Leave tutorial" onPress={props.onSkip} style={[styles.skip, { top: props.top + 6 }]}>
        <Text style={styles.skipText}>Skip ›</Text>
      </Pressable>
      <View style={[styles.chipsWrap, { top: props.chipsTop }]} pointerEvents="none">
        <SkillChips done={props.done} current={props.current} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  lessonArea: { position: "absolute", left: 0, right: 0, bottom: 0 },
  chipsWrap: { position: "absolute", left: 8, right: 8, alignItems: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 5 },
  chip: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: UI.cream, borderWidth: 1, borderColor: UI.line },
  chipDone: { backgroundColor: UI.green, borderColor: UI.green },
  chipCur: { backgroundColor: UI.gold, borderColor: UI.goldDeep },
  chipText: { color: UI.ink, fontSize: 12, fontWeight: "800" },
  topChip: { position: "absolute", left: 14, backgroundColor: UI.cream, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: UI.line },
  topChipText: { color: "#1E4D33", fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  skip: { position: "absolute", right: 70, minHeight: 44, minWidth: 64, paddingHorizontal: 12, borderRadius: 14, backgroundColor: UI.cream, borderWidth: 1, borderColor: UI.line, alignItems: "center", justifyContent: "center" },
  skipText: { color: UI.ink, fontSize: 14, fontWeight: "800" },
});
