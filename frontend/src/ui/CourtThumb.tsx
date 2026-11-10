// Court thumbnail cropped from the court's OWN painted image (its upper scenery band).
import { Image, type ImageStyle } from "expo-image";
import React, { useState } from "react";
import { StyleSheet, View, type StyleProp } from "react-native";

import { UI } from "./kit";

export const COURT_IMG: Record<string, number> = {
  bandra_garden: require("@/assets/images/court_bandra_garden.webp"),
  mumbai_local: require("@/assets/images/court_mumbai_local.webp"),
  nashik: require("@/assets/images/court_nashik.webp"),
  mahabaleshwar: require("@/assets/images/court_strawberry.webp"),
  pune: require("@/assets/images/court_pune.webp"),
  maharashtra_night: require("@/assets/images/court_maharashtra_night.webp"),
};
const CROP = { x: 112, y: 0, w: 800, h: 560 };

// One court's picture, never another's: keyed per court (and per attempt), one
// retry on error (remount with a new key), then nothing (the caller's plain tile).
export function CourtImage({ court, style, contentFit, testID }: { court: string; style: StyleProp<ImageStyle>; contentFit: "fill" | "cover"; testID?: string }) {
  return <CourtImageInner key={court} court={court} style={style} contentFit={contentFit} testID={testID} />;
}
function CourtImageInner({ court, style, contentFit, testID }: { court: string; style: StyleProp<ImageStyle>; contentFit: "fill" | "cover"; testID?: string }) {
  const [attempt, setAttempt] = useState(0);
  if (attempt > 1 || !COURT_IMG[court]) return null;
  const k = `${court}:${attempt}`;
  return <Image key={k} recyclingKey={k} source={COURT_IMG[court]} style={style} contentFit={contentFit} cachePolicy="memory-disk" onError={() => setAttempt((a) => a + 1)} testID={testID} />;
}

export function CourtThumb({ court, width, testID = "court-thumb" }: { court: string; width: number; testID?: string }) {
  const s = width / CROP.w;
  return (
    <View style={[styles.thumb, { width, height: CROP.h * s }]} testID={testID}>
      <CourtImage court={court} style={{ position: "absolute", left: -CROP.x * s, top: -CROP.y * s, width: 1024 * s, height: 1536 * s }} contentFit="fill" />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { borderRadius: 10, overflow: "hidden", borderWidth: 2, borderColor: UI.cream, backgroundColor: UI.creamDeep },
});
