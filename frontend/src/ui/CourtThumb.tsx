// Court thumbnail cropped from the court's OWN painted image (its upper scenery band).
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, View } from "react-native";

import { UI } from "./kit";

export const COURT_IMG: Record<string, number> = {
  bandra_garden: require("@/assets/images/court_bandra_garden.webp"),
  mumbai_local: require("@/assets/images/court_mumbai_local.webp"),
};
const CROP = { x: 112, y: 0, w: 800, h: 560 };

export function CourtThumb({ court, width, testID = "court-thumb" }: { court: string; width: number; testID?: string }) {
  const s = width / CROP.w;
  return (
    <View style={[styles.thumb, { width, height: CROP.h * s }]} testID={testID}>
      <Image source={COURT_IMG[court]} style={{ position: "absolute", left: -CROP.x * s, top: -CROP.y * s, width: 1024 * s, height: 1536 * s }} contentFit="fill" cachePolicy="memory-disk" />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { borderRadius: 10, overflow: "hidden", borderWidth: 2, borderColor: UI.cream },
});
