// RECORDS (tab): Trophies · Stats · History. No title: the segmented control
// sits at the top. The last tab used is remembered for the session only.
import { useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { CabinetBody } from "@/src/ui/CabinetBody";
import { HistoryBody } from "@/src/ui/HistoryBody";
import { DestinationScreen } from "@/src/ui/DestinationScreen";
import { StatsBody } from "@/src/ui/HeaderActions";
import { Text } from "@/src/ui/Text";
import { Card, UI } from "@/src/ui/kit";
import { useSave } from "@/src/ui/useSave";

type Tab = "trophies" | "stats" | "history";
const TABS: { key: Tab; label: string }[] = [
  { key: "trophies", label: "Trophies" },
  { key: "stats", label: "Stats" },
  { key: "history", label: "History" },
];
let lastTab: Tab = "trophies"; // session memory (no storage write)

export default function Records() {
  const { tab: param } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.key === param) ? (param as Tab) : lastTab));
  const { save } = useSave();
  const pick = (t: Tab) => {
    lastTab = t;
    setTab(t);
  };

  return (
    <DestinationScreen
      active="records"
      testID="records-screen"
      header={
        <View style={styles.track} testID="records-tabs">
          {TABS.map((t) => (
            <Pressable key={t.key} testID={`records-tab-${t.key}`} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }} onPress={() => pick(t.key)} style={[styles.seg, tab === t.key && styles.segSel]}>
              <Text style={[styles.segText, tab === t.key && styles.segTextSel]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      }
    >
      {tab === "trophies" ? <CabinetBody save={save} /> : null}
      {tab === "stats" ? (
        <Card style={{ padding: 12 }}>
          <StatsBody save={save} />
        </Card>
      ) : null}
      {tab === "history" ? <HistoryBody /> : null}
    </DestinationScreen>
  );
}

const styles = StyleSheet.create({
  track: { flex: 1, flexDirection: "row", backgroundColor: UI.creamDeep, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: UI.line },
  seg: { flex: 1, minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  segSel: { backgroundColor: "#fff", elevation: 2, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segText: { color: UI.inkSoft, fontSize: 15, fontWeight: "700" },
  segTextSel: { color: UI.ink, fontWeight: "900" },
});
