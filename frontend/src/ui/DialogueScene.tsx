// DIALOGUE SCENE (generic: Match talk now, Match 1 teaching / Tutorial later).
// One line at a time in a bottom box; the text types in (~30 ms / char). Tap:
// while typing → show it in full; otherwise → next line (150 ms fade / slide).
// After the last line a tap calls onDone. No earlier lines stay on screen.
import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Text } from "./Text";
import { Badge, UI } from "./kit";

export interface DialogueSpeaker {
  name: string; // shown in muted caps
  color: string;
  portraitId?: string; // PORTRAITS key (partners)
  face?: number; // a face image module (rivals)
}
export interface DialogueLine {
  speaker: DialogueSpeaker;
  text: string;
}

const CHAR_MS = 30;
const LOCK_MS = 300;

export function DialogueScene({ lines, onDone, bottom = 16 }: { lines: DialogueLine[]; onDone: () => void; bottom?: number }) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const line = lines[index];
  const full = line ? line.text.length : 0;
  const typing = shown < full;

  useEffect(() => {
    if (!line || shown >= full) return;
    const t = setTimeout(() => setShown((n) => Math.min(full, n + 1)), CHAR_MS);
    return () => clearTimeout(t);
  }, [line, shown, full]);

  // A line that just finished typing (by itself or by a tap) ignores taps for
  // LOCK_MS, so a quick tap can't skip it unread.
  const doneAt = useRef(0);
  useEffect(() => {
    if (line && shown >= full) doneAt.current = Date.now();
  }, [line, shown, full]);

  const onTap = () => {
    if (!line) return onDone();
    if (typing) return setShown(full);
    if (Date.now() - doneAt.current < LOCK_MS) return;
    if (index + 1 >= lines.length) return onDone();
    setIndex(index + 1);
    setShown(0);
  };

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={onTap} testID="dialogue-tap" accessibilityRole="button" accessibilityLabel={typing ? "Show line" : "Next"}>
      {line ? (
        <View style={[styles.wrap, { bottom }]} pointerEvents="none">
          <Animated.View key={index} entering={FadeInDown.duration(150)} style={styles.box} testID="dialogue-box">
            <View style={styles.badge}>
              {line.speaker.face ? (
                <View style={[styles.face, { backgroundColor: line.speaker.color }]}>
                  <Image source={line.speaker.face} style={{ width: "100%", height: "100%" }} contentFit="cover" cachePolicy="memory-disk" />
                </View>
              ) : (
                <Badge id={line.speaker.portraitId} name={line.speaker.name} color={line.speaker.color} size={56} ring />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} testID="dialogue-speaker">{line.speaker.name}</Text>
              <Text style={styles.text} testID="dialogue-text">{line.text.slice(0, shown)}</Text>
            </View>
            {!typing ? <Text style={styles.more}>▼</Text> : null}
          </Animated.View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 14, right: 14 },
  box: { flexDirection: "row", gap: 12, backgroundColor: UI.cream, borderRadius: 18, padding: 14, paddingBottom: 18, minHeight: 112, borderWidth: 1, borderColor: UI.line, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  badge: { width: 56 },
  face: { width: 56, height: 56, borderRadius: 28, overflow: "hidden", borderWidth: 3, borderColor: UI.cream },
  name: { color: UI.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  text: { color: UI.ink, fontSize: 16, lineHeight: 22, fontWeight: "600", marginTop: 3 },
  more: { position: "absolute", right: 14, bottom: 6, color: UI.goldDeep, fontSize: 12 },
});
