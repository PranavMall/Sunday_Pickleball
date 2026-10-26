import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/src/ui/Text";

import { meta } from "@/src/game/meta";
import { PARTNERS, TRAINING_MODES, type PartnerId } from "@/src/game/meta/economyConfig";
import { levelView } from "@/src/game/meta/levels";
import { pairingKey } from "@/src/game/meta/metaStore";
import { discoveredPartners, rosterStatus, type RosterStatus } from "@/src/game/meta/team";
import { DestinationScreen } from "@/src/ui/DestinationScreen";
import { HeaderActions, Overlay } from "@/src/ui/HeaderActions";
import { Badge, Card, chemOf, Coin, Kicker, MeterRow, SERIF, UI, type IoniconName } from "@/src/ui/kit";
import { useSave } from "@/src/ui/useSave";

const INFO =
  "Growth: how good your partner is. Max Lv 3 in the Community Cup, Lv 5 in the Mumbai Local Series.\n\nChemistry: how well you two play together. It fades if you play many matches with someone else.\n\nBoth start to affect matches in a coming update.";

export default function Team() {
  const router = useRouter();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const { save, refresh } = useSave();
  const [signing, setSigning] = useState<null | { id: PartnerId; step: 1 | 2 }>(null);
  const [info, setInfo] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // A quick double-tap on Sign must not also answer the make-active question.
  const stepAt = useRef(0);
  const ids = save ? discoveredPartners(save) : [];
  const usage = save && meta.loaded ? meta.dailyUsage(Date.now()) : { training: 0, scrimmage: 0 };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const onStatus = (id: PartnerId, st: RosterStatus) => {
    if (st.kind === "sign") setSigning({ id, step: 1 });
  };
  const act = (id: PartnerId, a: "career" | "train" | "scrimmage" | "quick") => {
    if (a === "career") {
      meta.setActivePartner(id);
      refresh();
      setToast(`${PARTNERS[id].name} is your Career partner`);
    } else if (a === "quick") {
      meta.setQuickPartner(id);
      router.push("/quickplay");
    } else {
      meta.setTrainingPartner(id);
      router.push({ pathname: "/match", params: { mode: a === "train" ? "training" : "scrimmage" } });
    }
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
              <Coin size={22} />
              <Text style={styles.coinText}>{save?.coins ?? "–"}</Text>
            </View>
            <HeaderActions save={save} onChange={refresh} />
          </View>
        </>
      }
    >
      {toast ? (
        <View style={styles.toast} pointerEvents="none" testID="team-toast">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
      <View style={styles.roster} testID="roster">
        <View style={styles.kRow}>
          <Kicker style={{ color: "#1E4D33", marginLeft: 4 }}>YOUR TEAM</Kicker>
          <Pressable testID="team-info" accessibilityRole="button" style={styles.infoBtn} onPress={() => setInfo(true)}>
            <Ionicons name="information-circle" size={16} color={UI.inkSoft} />
            <Text style={styles.infoText}>What do these do?</Text>
          </Pressable>
        </View>
        {ids.map((id) => {
          const p = PARTNERS[id];
          const st = rosterStatus(save!, id);
          const ps = save!.partners[id];
          const lv = levelView(ps?.growth ?? 0, save!.career.nextMatchId);
          const key = pairingKey(id);
          const chem = chemOf(save!.chemistryHalves[key]);
          const rusty = (save!.chemistryHalves[key] ?? 0) < (save!.chemistryPeakHalves?.[key] ?? 0);
          const isCareer = save!.activePartnerId === id;
          const isTraining = save!.trainingPartnerId === id;
          return (
            <Card key={id} style={[styles.row, highlight === id && styles.rowHi]} testID={`roster-${id}`}>
              <View style={styles.rowTop}>
                <Badge id={id} name={p.name} color={p.color} size={42} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                    {ps?.signed ? (
                      <View style={styles.lv}>
                        <Text style={styles.lvText} testID={`level-${id}`}>LV {lv.level}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.arch}>{p.archetype}</Text>
                </View>
                {ps?.signed ? (
                  isCareer ? (
                    <View style={[styles.tag, styles.tagCareer]} testID={`tag-career-${id}`}>
                      <Text style={styles.tagCareerText}>CAREER PARTNER</Text>
                    </View>
                  ) : isTraining ? (
                    <View style={styles.tag} testID={`tag-training-${id}`}>
                      <Text style={styles.tagText}>TRAINING PARTNER</Text>
                    </View>
                  ) : null
                ) : (
                  <StatusPill st={st} onPress={() => onStatus(id, st)} testID={`status-${id}`} />
                )}
              </View>
              {ps?.signed ? (
                <>
                  <MeterRow icon="star" label="Growth" value={lv.frac * 100} num={lv.max ?? lv.text} color={UI.growth} testID={`growth-${id}`} />
                  <MeterRow icon="heart" label="Chemistry" value={chem} color={UI.chem} testID={`chem-${id}`} />
                  {rusty ? <Text style={styles.rusty} testID={`rusty-${id}`}>Rusty · play together to recover</Text> : null}
                  <View style={styles.actions}>
                    <Action icon="trophy" label="Career" on={isCareer} onPress={() => act(id, "career")} testID={`act-career-${id}`} />
                    <Action icon="fitness" label="Train" sub={`${Math.max(0, TRAINING_MODES.training.dailyCap - usage.training)} left`} on={isTraining} onPress={() => act(id, "train")} testID={`act-train-${id}`} />
                    <Action icon="people" label="Scrimmage" sub={`${Math.max(0, TRAINING_MODES.scrimmage.dailyCap - usage.scrimmage)} left`} onPress={() => act(id, "scrimmage")} testID={`act-scrimmage-${id}`} />
                    <Action icon="flash" label="Quick Play" onPress={() => act(id, "quick")} testID={`act-quick-${id}`} />
                  </View>
                </>
              ) : null}
            </Card>
          );
        })}
      </View>

      <Overlay visible={info} title="What do these do?" onClose={() => setInfo(false)} testID="team-info-overlay">
        <Text style={styles.infoBody}>{INFO}</Text>
      </Overlay>

      <Overlay visible={!!signing} title={signing?.step === 1 ? "Sign partner" : "Career partner"} onClose={() => setSigning(null)} testID="sign-dialog">
        {sp && signing ? (
          <View>
            <Text style={styles.dialogText} testID="sign-dialog-text">
              {signing.step === 1 ? `Sign ${sp.name} for ${rosterCost(save, signing.id)} Coins?` : `Make ${sp.name} your Career partner?`}
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
                  // Step 2: offer to make the new partner the Career partner.
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

// Small action: 20 pt icon in a 36 tile, 10 pt label, whole column ≥ 44 tall.
function Action({ icon, label, sub, on, onPress, testID }: { icon: IoniconName; label: string; sub?: string; on?: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={sub ? `${label}, ${sub}` : label} onPress={onPress} style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}>
      <View style={[styles.actTile, on && styles.actTileOn]}>
        <Ionicons name={icon} size={20} color={on ? "#fff" : UI.inkSoft} />
      </View>
      <Text style={styles.actLabel} numberOfLines={1}>{label}</Text>
      {sub ? <Text style={styles.actSub} numberOfLines={1}>{sub}</Text> : null}
    </Pressable>
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
  coinChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: UI.cardBg, borderRadius: 12, paddingHorizontal: 10, height: 36, borderWidth: 1, borderColor: UI.line },
  coinText: { color: UI.ink, fontSize: 15, fontWeight: "800" },
  roster: { gap: 10, alignSelf: "stretch" },
  row: { paddingVertical: 10, paddingHorizontal: 10 },
  rowHi: { backgroundColor: "rgba(252,240,205,0.9)", borderWidth: 2, borderColor: UI.gold },
  rowTop: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  kRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  infoBtn: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingHorizontal: 10, borderRadius: 12, backgroundColor: UI.cardBg },
  infoText: { color: UI.inkSoft, fontSize: 12, fontWeight: "700" },
  infoBody: { color: UI.ink, fontSize: 15, lineHeight: 21, marginTop: 6 },
  lv: { backgroundColor: UI.green, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  lvText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  tag: { borderRadius: 6, borderWidth: 1, borderColor: UI.line, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { color: UI.inkSoft, fontSize: 9.5, fontWeight: "800", letterSpacing: 0.5 },
  tagCareer: { backgroundColor: UI.green, borderColor: UI.green },
  tagCareerText: { color: "#fff", fontSize: 9.5, fontWeight: "800", letterSpacing: 0.5 },
  rusty: { color: "#A0522D", fontSize: 11.5, fontWeight: "700", marginTop: 3, marginLeft: 22 },
  actions: { flexDirection: "row", marginTop: 8, borderTopWidth: 1, borderTopColor: UI.line, paddingTop: 6 },
  action: { flex: 1, alignItems: "center", minHeight: 44, justifyContent: "center" },
  actTile: { width: 36, height: 36, borderRadius: 10, backgroundColor: UI.creamDeep, alignItems: "center", justifyContent: "center" },
  actTileOn: { backgroundColor: UI.green },
  actLabel: { color: UI.ink, fontSize: 10, fontWeight: "700", marginTop: 2 },
  actSub: { color: UI.muted, fontSize: 9.5, fontWeight: "700" },
  toast: { alignSelf: "center", backgroundColor: "rgba(31,42,34,0.92)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8 },
  toastText: { color: "#FBF4E2", fontSize: 14, fontWeight: "700" },
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
