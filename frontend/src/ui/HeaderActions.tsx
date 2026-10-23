// Header actions shared by every destination: Inbox + Stats icon buttons and
// their overlays (no animation, no server).
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { SaveDoc } from "@/src/game/meta/metaStore";
import { Card, IconSquare, Kicker, SERIF, UI } from "./kit";

export function HeaderActions({ save }: { save: SaveDoc | null; onChange?: () => void }) {
  const [open, setOpen] = useState<null | "inbox" | "stats">(null);
  return (
    <View style={styles.row}>
      <IconSquare testID="header-inbox" icon="mail" label="Inbox" onPress={() => setOpen("inbox")} />
      <IconSquare testID="header-stats" icon="bar-chart" label="Stats" onPress={() => setOpen("stats")} />
      <Overlay visible={open !== null} title={open === "inbox" ? "Inbox" : "Stats"} onClose={() => setOpen(null)} testID={`${open ?? "none"}-overlay`}>
        {open === "inbox" ? <Text style={styles.empty}>No messages yet.</Text> : null}
        {open === "stats" ? <StatsBody save={save} onClose={() => setOpen(null)} /> : null}
      </Overlay>
    </View>
  );
}

function StatsBody({ onClose }: { save: SaveDoc | null; onClose: () => void }) {
  const router = useRouter();
  return (
    <Pressable
      testID="stats-history-link"
      style={styles.link}
      onPress={() => {
        onClose();
        router.push("/history");
      }}
    >
      <Text style={styles.linkText}>Match History ›</Text>
    </Pressable>
  );
}

export function Overlay({ visible, title, onClose, children, testID }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[styles.scrim, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]} onPress={onClose}>
        <Pressable style={styles.sheetWrap} onPress={() => {}}>
          <Card style={styles.sheet} testID={testID}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable testID="overlay-close" accessibilityLabel="Close" hitSlop={10} onPress={onClose} style={styles.close}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 4 }}>
              {children}
            </ScrollView>
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export { Kicker };

export const overlayStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: UI.line },
  rowText: { flex: 1, color: UI.ink, fontSize: 15, fontWeight: "600" },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: UI.red },
});

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  scrim: { flex: 1, backgroundColor: "rgba(20,26,18,0.6)", justifyContent: "center", paddingHorizontal: 20 },
  sheetWrap: { width: "100%", maxWidth: 420, alignSelf: "center", maxHeight: "100%" },
  sheet: { padding: 18, maxHeight: "100%" },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  sheetTitle: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 26 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  closeText: { color: UI.inkSoft, fontSize: 20, fontWeight: "700" },
  empty: { color: UI.muted, fontSize: 15, paddingVertical: 12 },
  link: { marginTop: 14, backgroundColor: UI.creamDeep, borderRadius: 12, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: UI.line },
  linkText: { color: UI.ink, fontSize: 16, fontWeight: "800" },
});
