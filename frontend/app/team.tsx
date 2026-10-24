import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/src/ui/Text";

import { meta } from "@/src/game/meta";
import { PARTNERS, type PartnerId } from "@/src/game/meta/economyConfig";
import { discoveredPartners, rosterStatus, type RosterStatus } from "@/src/game/meta/team";
import { DestinationScreen } from "@/src/ui/DestinationScreen";
import { HeaderActions, Overlay } from "@/src/ui/HeaderActions";
import { Badge, Card, Coin, Kicker, MeterRow, SERIF, UI } from "@/src/ui/kit";
import { useSave } from "@/src/ui/useSave";

export default function Team() {
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const { save, refresh } = useSave();
  const [signing, setSigning] = useState<null | { id: PartnerId; step: 1 | 2 }>(null);
  // A quick double-tap on Sign must not also answer the make-active question.
  const stepAt = useRef(0);
  const ids = save ? discoveredPartners(save) : [];

  const onStatus = (id: PartnerId, st: RosterStatus) => {
    if (st.kind === "set_active") {
      if (meta.setActivePartner(id)) refresh();
    } else if (st.kind === "sign") setSigning({ id, step: 1 });
  };

  const sp = signing ? PARTNERS[signing.id] : null;

  return (
    <DestinationScreen
      active="team"
      testID="team-screen"
      header={
        <>
          <View style={styles.headRight}>
            <View style={styles.coinChip} testID="team-coins">
              <Coin size={26} />
              <Text style={styles.coinText}>{save?.coins ?? "–"}</Text>
            </View>
            <HeaderActions save={save} onChange={refresh} />
          </View>
        </>
      }
    >
      <Card style={{ padding: 12, alignSelf: "stretch" }} testID="roster">
        <Kicker style={{ color: "#1E4D33", marginBottom: 4 }}>YOUR TEAM</Kicker>
        {ids.map((id, i) => {
          const p = PARTNERS[id];
          const st = rosterStatus(save!, id);
          return (
            <View key={id} style={[styles.row, i > 0 && styles.rowDivider, highlight === id && styles.rowHi]} testID={`roster-${id}`}>
              <View style={styles.rowTop}>
                <Badge name={p.name} color={p.color} size={52} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={styles.arch}>{p.archetype}</Text>
                    <View style={styles.tier}>
                      <Text style={styles.tierText}>{p.tier}</Text>
                    </View>
                  </View>
                </View>
                <StatusPill st={st} onPress={() => onStatus(id, st)} testID={`status-${id}`} />
              </View>
              <MeterRow icon="star" label="Growth" value={save!.partners[id]?.growth ?? 0} color={UI.growth} />
              <MeterRow icon="heart" label="Chemistry" value={Math.floor((save!.chemistryHalves[`player+${id}`] ?? 0) / 2)} color={UI.chem} />
            </View>
          );
        })}
      </Card>

      <Overlay visible={!!signing} title={signing?.step === 1 ? "Sign partner" : "Active partner"} onClose={() => setSigning(null)} testID="sign-dialog">
        {sp && signing ? (
          <View>
            <Text style={styles.dialogText} testID="sign-dialog-text">
              {signing.step === 1 ? `Sign ${sp.name} for ${rosterCost(save, signing.id)} Coins?` : `Make ${sp.name} your active partner?`}
            </Text>
            <View style={styles.dialogRow}>
              <Pressable testID="sign-dialog-no" style={[styles.dBtn, styles.dBtnAlt]} onPress={() => setSigning(null)}>
                <Text style={styles.dBtnText}>{signing.step === 1 ? "Cancel" : "Not now"}</Text>
              </Pressable>
              <Pressable
                testID="sign-dialog-yes"
                style={styles.dBtn}
                onPress={() => {
                  if (Date.now() - stepAt.current < 500) return;
                  stepAt.current = Date.now();
                  // Step 1: the one serialized signing transaction (spends once).
                  // Step 2: offer to make the new partner active.
                  if (signing.step === 1) {
                    const signed = meta.signPartner(signing.id, Date.now());
                    refresh();
                    setSigning(signed ? { id: signing.id, step: 2 } : null);
                  } else {
                    if (meta.setActivePartner(signing.id)) refresh();
                    setSigning(null);
                  }
                }}
              >
                <Text style={styles.dBtnText}>{signing.step === 1 ? "Sign" : "Yes"}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </Overlay>
    </DestinationScreen>
  );
}

function rosterCost(save: ReturnType<typeof useSave>["save"], id: PartnerId): number {
  const st = save ? rosterStatus(save, id) : null;
  return st?.kind === "sign" ? st.cost : 0;
}

function StatusPill({ st, onPress, testID }: { st: RosterStatus; onPress: () => void; testID: string }) {
  if (st.kind === "active")
    return (
      <View style={[styles.pill, styles.pillActive]} testID={testID}>
        <Text style={styles.pillActiveText}>ACTIVE</Text>
      </View>
    );
  if (st.kind === "set_active" || st.kind === "sign")
    return (
      <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.pill, styles.pillGold, pressed && { opacity: 0.85 }]}>
        {st.kind === "sign" ? (
          <>
            <Text style={styles.pillGoldSmall}>SIGN</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Coin size={18} />
              <Text style={styles.pillGoldText}>{st.cost} COINS</Text>
            </View>
          </>
        ) : (
          <Text style={styles.pillGoldText}>SET ACTIVE</Text>
        )}
      </Pressable>
    );
  return (
    <View style={[styles.pill, styles.pillLocked]} testID={testID} accessibilityState={{ disabled: true }}>
      {st.kind === "locked" ? <Ionicons name="lock-closed" size={12} color={UI.muted} /> : null}
      <Text style={styles.pillLockedText}>{st.kind === "need" ? `NEED ${st.more} MORE COINS` : st.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  coinChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: UI.cardBg, borderRadius: 14, paddingHorizontal: 10, height: 50, borderWidth: 1, borderColor: UI.line },
  coinText: { color: UI.ink, fontSize: 18, fontWeight: "800" },
  row: { paddingVertical: 12, paddingHorizontal: 4, borderRadius: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: UI.line },
  rowHi: { backgroundColor: "rgba(246,201,74,0.18)", borderWidth: 2, borderColor: UI.gold },
  rowTop: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  name: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 20 },
  arch: { color: UI.inkSoft, fontSize: 14 },
  tier: { backgroundColor: UI.creamDeep, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 1 },
  tierText: { color: UI.inkSoft, fontSize: 11 },
  pill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, alignItems: "center", justifyContent: "center", maxWidth: 140, minHeight: 44 },
  pillActive: { backgroundColor: UI.green },
  pillActiveText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  pillGold: { backgroundColor: UI.gold, borderWidth: 1.5, borderColor: UI.goldDeep },
  pillGoldSmall: { color: UI.goldInk, fontSize: 11, fontWeight: "900" },
  pillGoldText: { color: UI.goldInk, fontSize: 14, fontWeight: "900" },
  pillLocked: { backgroundColor: UI.creamDeep, flexDirection: "row", gap: 4, borderWidth: 1, borderColor: UI.line },
  pillLockedText: { color: UI.inkSoft, fontSize: 11, fontWeight: "800", textAlign: "center", flexShrink: 1 },
  dialogText: { color: UI.ink, fontSize: 18, fontFamily: SERIF, marginVertical: 10 },
  dialogRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  dBtn: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: UI.gold, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: UI.goldDeep },
  dBtnAlt: { backgroundColor: UI.creamDeep, borderColor: UI.line },
  dBtnText: { color: UI.goldInk, fontSize: 16, fontWeight: "800" },
});
