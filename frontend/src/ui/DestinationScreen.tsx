// Shell layout for a destination: one background, pinned header, scrollable
// middle, pinned bar.
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Fullscreen } from "@/src/components/fullscreen";
import { DestinationBar, type Destination } from "./DestinationBar";
import { ScreenBg } from "./kit";

export function DestinationScreen({ active, bg, dim, header, children, testID }: { active: Destination; bg: number; dim?: boolean; header: React.ReactNode; children: React.ReactNode; testID: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root} testID={testID}>
      <Fullscreen />
      <ScreenBg source={bg} dim={dim} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>{header}</View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      <DestinationBar active={active} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#2E3D2A" },
  header: { paddingHorizontal: 16, paddingBottom: 6, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 12 },
});
