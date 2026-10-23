// Shell layout for a destination: pinned header, scrollable middle, pinned bar.
// No background of its own: the persistent DestinationBackdrop (root layout)
// shows through. Content fades in over 150 ms.
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Fullscreen } from "@/src/components/fullscreen";
import { DestinationBar, type Destination } from "./DestinationBar";

export const DIM = "rgba(251,244,226,0.28)"; // soft dim over bg_home (Training, Quick Play)

export function DestinationScreen({ active, dim, header, children, testID }: { active: Destination; dim?: boolean; header: React.ReactNode; children: React.ReactNode; testID: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root} testID={testID}>
      <Fullscreen />
      {dim ? <View style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} pointerEvents="none" /> : null}
      <Animated.View entering={FadeIn.duration(150)} style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>{header}</View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </Animated.View>
      <DestinationBar active={active} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  header: { paddingHorizontal: 16, paddingBottom: 6, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10 },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 12 },
});
