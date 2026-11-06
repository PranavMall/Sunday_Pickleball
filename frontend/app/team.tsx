import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Text } from "@/src/ui/Text";

import { meta } from "@/src/game/meta";
import { heartsOf, PARTNERS, TRAINING_MODES, type PartnerId } from "@/src/game/meta/economyConfig";
import { levelView } from "@/src/game/meta/levels";
import { pairingKey } from "@/src/game/meta/metaStore";
import { discoveredPartners, rosterStatus, type RosterStatus } from "@/src/game/meta/team";
import { DestinationScreen } from "@/src/ui/DestinationScreen";
import { HeaderActions, Overlay } from "@/src/ui/HeaderActions";
import { Badge, Card, chemOf, Coin, Hearts, Kicker, MeterRow, SERIF, UI, type IoniconName } from "@/src/ui/kit";
import { useSave } from "@/src/ui/useSave";

export default function Team() {
  const router = useRouter();
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const { save, refresh } = useSave();
  const [signing, setSigning] = useState<null | { id: PartnerId; step: 1 | 2 }>(null);
  const [info, setInfo] = useState(false);
  const [open, setOpen] = useState<PartnerId | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // A quick double-tap on Sign must not also answer the make-active question.
  const stepAt = useRef(0);
  const ids = save ? discoveredPartners(save) : [];
  const usage = save && meta.loaded ? meta.dailyUsage(Date.now()) : { training: 0, scrimmage: 0 };
  const activeHearts = save ? heartsOf(chemOf(save.chemistryHalves[pairingKey(save.activePartnerId)])) : 0;

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
      setOpen(null);
      refresh();
      setToast(`${PARTNERS[id].name} is your Career partner`);
    } else if (a === "train") {
      meta.setTrainingPartner(id);
      setOpen(null);
      refresh();
      setToast(`${PARTNERS[id].name} is your Training partner`);
    } else if (a === "quick") {
      setOpen(null);
      meta.setQuickPartner(id);
      router.push("/quickplay");
    } else {
      setOpen(null);
      meta.setTrainingPartner(id);
      router.push({ pathname: "/match", params: { mode: "scrimmage" } });
    }
  };

  const sp = signing ? PARTNERS[signing.id] : null;
  const op = open ? PARTNERS[open] : null;

  return (
    <DestinationScreen
      active="team"
      testID="team-screen"
      header={
        <View style={styles.headRight}>
          <View style={styles.coinChip} testID="team-coins">
            <Coin size={22} />
            <Text style={styles.coinText}>{save?.coins ?? "–"}</Text>
          </View>
          <HeaderActions save={save} onChange={refresh} />
        </View>
      }
    >
      {toast ? (
        <View style={styles.toast} pointerEvents="none" testID="team-toast">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
      <View style={styles.kRow}>
        <Kicker style={{ color: "#1E4D33", marginLeft: 4 }}>YOUR TEAM · {ids.length}</Kicker>
        <Pressable testID="team-info" accessibilityRole="button" style={styles.infoBtn} onPress={() => setInfo(true)}>
          <Ionicons name="information-circle" size={16} color={UI.inkSoft} />
          <Text style={styles.infoText}>What do these do?</Text>
        </Pressable>
      </View>
      <View style={styles.grid} testID="roster">
        {ids.map((id) => {
          const p = PARTNERS[id];
          const st = rosterStatus(save!, id);
          const ps = save!.partners[id];
          const lv = levelView(ps?.growth ?? 0, save!.career.nextMatchId);
          const chem = chemOf(save!.chemistryHalves[pairingKey(id)]);
          const isCareer = save!.activePartnerId === id;
          const isTraining = save!.trainingPartnerId === id;
          const body = (
            <Card style={[styles.card, highlight === id && styles.cardHi]}>
                <View style={styles.cardTop}>
                  <Badge id={id} name={p.name} color={p.color} size={44} />
                  {ps?.signed ? (
                    <View style={styles.lv}>
                      <Text style={styles.lvText} testID={`level-${id}`}>LV {lv.level}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.name}>{p.name}</Text>
                <View style={styles.archRow}>
                  <Text style={styles.arch}>{p.archetype}</Text>
                  {ps?.signed && isCareer ? (
                    <View style={[styles.tag, styles.tagCareer]} testID={`tag-career-${id}`}><Text style={styles.tagCareerText}>CAREER</Text></View>
                  ) : ps?.signed && isTraining ? (
                    <View style={[styles.tag, styles.tagTrain]} testID={`tag-training-${id}`}><Text style={styles.tagCareerText}>TRAINING</Text></View>
                  ) : null}
                </View>
                {ps?.signed ? (
                  <>
                    <View style={styles.miniTrack}><View style={[styles.miniFill, { width: `${lv.frac * 100}%` }]} /></View>
                    <Hearts filled={heartsOf(chem)} size={11} testID={`hearts-${id}`} />
                  </>
                ) : (
                  <StatusPill st={st} onPress={() => onStatus(id, st)} testID={`status-${id}`} />
                )}
            </Card>
          );
          // Unsigned cards are a plain View (no nested buttons around the Sign button).
          return ps?.signed ? (
            <Pressable key={id} testID={`roster-${id}`} accessibilityRole="button" accessibilityLabel={p.name} onPress={() => setOpen(id)} style={({ pressed }) => [styles.cell, pressed && { opacity: 0.9 }]}>
              {body}
            </Pressable>
          ) : (
            <View key={id} testID={`roster-${id}`} style={styles.cell}>
              {body}
            </View>
          );
        })}
        <View style={styles.cell}>
          <View style={[styles.card, styles.soon]} testID="roster-new-players">
            <View style={styles.q}><Text style={styles.qText}>?</Text></View>
            <Text style={styles.soonTitle}>New players</Text>
            <Text style={styles.soonSub}>Join in the South Cup</Text>
          </View>
        </View>
      </View>

      <Overlay visible={!!op} title={op?.name ?? ""} onClose={() => setOpen(null)} testID="partner-popup">
        {op && save ? <PartnerDetail id={op.id} save={save} usage={usage} onAct={(a) => act(op.id, a)} /> : null}
      </Overlay>

      <Overlay visible={info} title="Partner stats" onClose={() => setInfo(false)} testID="team-info-overlay">
        <InfoRow icon="star" tile="#FCEBC0" color={UI.growth} title="Growth" text="Win together to level up. Each level: fewer mistakes, quicker reactions." />
        <View style={styles.sep} />
        <InfoRow icon="heart" tile="#FBD9E0" color={UI.chem} title="Chemistry" text="Play as a pair. Every heart adds a little teamwork. Fades if you play with others, but hearts stay." />
        <View style={{ marginLeft: 58, marginTop: 6 }}>
          <Hearts filled={activeHearts} size={16} testID="info-hearts" />
        </View>
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

function PartnerDetail({ id, save, usage, onAct }: { id: PartnerId; save: NonNullable<ReturnType<typeof useSave>["save"]>; usage: { training: number; scrimmage: number }; onAct: (a: "career" | "train" | "scrimmage" | "quick") => void }) {
  const p = PARTNERS[id];
  const lv = levelView(save.partners[id]?.growth ?? 0, save.career.nextMatchId);
  const key = pairingKey(id);
  const chem = chemOf(save.chemistryHalves[key]);
  const rusty = (save.chemistryHalves[key] ?? 0) < (save.chemistryPeakHalves?.[key] ?? 0);
  const isCareer = save.activePartnerId === id;
  const isTraining = save.trainingPartnerId === id;
  const role = isCareer ? "Career partner" : isTraining ? "Training partner" : "Bench";
  return (
    <View>
      <View style={styles.dHead}>
        <View style={styles.goldRing}><Badge id={id} name={p.name} color={p.color} size={58} /></View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.dRole}>{p.archetype} · {role}</Text>
          <View style={[styles.lv, { alignSelf: "flex-start", marginTop: 4 }]}><Text style={styles.lvText}>LV {lv.level}</Text></View>
        </View>
      </View>
      <MeterRow icon="star" label="Growth" value={lv.frac * 100} num={lv.max ? lv.text : `Next: Lv ${lv.level + 1}`} color={UI.growth} testID={`growth-${id}`} />
      {lv.max ? <Text style={styles.maxLine}>{lv.max}</Text> : null}
      <MeterRow icon="heart" label="Chemistry" value={chem} color={UI.chem} testID={`chem-${id}`} />
      <View style={{ marginLeft: 22, marginTop: 4, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Hearts filled={heartsOf(chem)} size={13} />
        {chem >= 100 ? <Text style={styles.perfect}>♥ Perfect pair</Text> : null}
      </View>
      {rusty ? <Text style={styles.rusty} testID={`rusty-${id}`}>Rusty · play together to recover</Text> : null}
      <View style={styles.actions}>
        <Action icon="trophy" label="Career" on={isCareer} onPress={() => onAct("career")} testID={`act-career-${id}`} />
        <Action icon="fitness" label="Train" sub={`${Math.max(0, TRAINING_MODES.training.dailyCap - usage.training)} left`} on={isTraining} onPress={() => onAct("train")} testID={`act-train-${id}`} />
        <Action icon="people" label="Scrimmage" sub={`${Math.max(0, TRAINING_MODES.scrimmage.dailyCap - usage.scrimmage)} left`} onPress={() => onAct("scrimmage")} testID={`act-scrimmage-${id}`} />
        <Action icon="flash" label="Quick Play" onPress={() => onAct("quick")} testID={`act-quick-${id}`} />
      </View>
    </View>
  );
}

function InfoRow({ icon, tile, color, title, text }: { icon: IoniconName; tile: string; color: string; title: string; text: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={[styles.infoTile, { backgroundColor: tile }]}><Ionicons name={icon} size={24} color={color} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoTitle}>{title}</Text>
        <Text style={styles.infoBody}>{text}</Text>
      </View>
    </View>
  );
}

// Small action: 20 pt icon in a 36 tile, 10 pt label, whole column ≥ 44 tall.
function Action({ icon, label, sub, on, onPress, testID }: { icon: IoniconName; label: string; sub?: string; on?: boolean; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={sub ? `${label}, ${sub}` : label} onPress={onPress} style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}>
      <View style={[styles.actTile, on && styles.actTileOn]}>
        <Ionicons name={icon} size={20} color={on ? "#fff" : UI.inkSoft} />
      </View>
      <Text style={styles.actLabel}>{label}</Text>
      {sub ? <Text style={styles.actSub}>{sub}</Text> : null}
    </Pressable>
  );
}

function rosterCost(save: ReturnType<typeof useSave>["save"], id: PartnerId): number {
  const st = save ? rosterStatus(save, id) : null;
  return st?.kind === "sign" ? st.cost : 0;
}

function StatusPill({ st, onPress, testID }: { st: RosterStatus; onPress: () => void; testID: string }) {
  if (st.kind === "sign")
    return (
      <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.pill, styles.pillGold, pressed && { opacity: 0.85 }]}>
        <Text style={styles.pillGoldText}>Sign ·</Text>
        <Coin size={16} />
        <Text style={styles.pillGoldText}>{st.cost.toLocaleString("en-US")}</Text>
      </Pressable>
    );
  return (
    <View style={[styles.pill, styles.pillLocked]} testID={testID} accessibilityState={{ disabled: true }}>
      {st.kind === "locked" ? <Ionicons name="lock-closed" size={11} color={UI.muted} /> : <Coin size={14} />}
      <Text style={styles.pillLockedText}>{st.kind === "need" ? `Need ${st.more} more` : st.kind === "locked" ? st.text : ""}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  coinChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: UI.cardBg, borderRadius: 12, paddingHorizontal: 10, height: 36, borderWidth: 1, borderColor: UI.line },
  coinText: { color: UI.ink, fontSize: 15, fontWeight: "800" },
  kRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  infoBtn: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingHorizontal: 10, borderRadius: 12, backgroundColor: UI.cardBg },
  infoText: { color: UI.inkSoft, fontSize: 12, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  cell: { width: "48.5%", flexDirection: "column" },
  card: { minHeight: 128, flexGrow: 1, padding: 10, borderRadius: 16 },
  cardHi: { backgroundColor: "rgba(252,240,205,0.92)", borderWidth: 2, borderColor: UI.gold },
  cardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  name: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 17, marginTop: 4 },
  archRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, flexWrap: "wrap" },
  arch: { color: UI.inkSoft, fontSize: 12 },
  lv: { backgroundColor: UI.green, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  lvText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  tag: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  tagCareer: { backgroundColor: UI.green },
  tagTrain: { backgroundColor: "#2F6FB8" },
  tagCareerText: { color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  miniTrack: { height: 5, borderRadius: 3, backgroundColor: UI.track, overflow: "hidden", marginTop: 6, marginBottom: 5 },
  miniFill: { height: 5, borderRadius: 3, backgroundColor: UI.growth },
  soon: { borderWidth: 1.5, borderStyle: "dashed", borderColor: UI.muted, backgroundColor: "rgba(251,244,226,0.82)", alignItems: "center", justifyContent: "center" },
  q: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(124,115,94,0.35)", alignItems: "center", justifyContent: "center" },
  qText: { color: "#fff", fontSize: 22, fontWeight: "900" },
  soonTitle: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 15, marginTop: 4 },
  soonSub: { color: UI.inkSoft, fontSize: 11, textAlign: "center" },
  pill: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 6, minHeight: 44, marginTop: 6 },
  pillGold: { backgroundColor: UI.gold, borderWidth: 1.5, borderColor: UI.goldDeep },
  pillGoldText: { color: UI.goldInk, fontSize: 13, fontWeight: "900" },
  pillLocked: { backgroundColor: UI.creamDeep, borderWidth: 1, borderColor: UI.line },
  pillLockedText: { color: UI.inkSoft, fontSize: 10, fontWeight: "800", textAlign: "center", flexShrink: 1 },
  dHead: { flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 4 },
  goldRing: { borderWidth: 3, borderColor: UI.gold, borderRadius: 34, padding: 2 },
  dRole: { color: UI.inkSoft, fontSize: 14 },
  maxLine: { color: UI.muted, fontSize: 12, fontWeight: "700", marginLeft: 22, marginTop: 2 },
  perfect: { color: UI.chem, fontSize: 12, fontWeight: "800" },
  rusty: { color: "#A0522D", fontSize: 11.5, fontWeight: "700", marginTop: 3, marginLeft: 22 },
  actions: { flexDirection: "row", marginTop: 10, borderTopWidth: 1, borderTopColor: UI.line, paddingTop: 8 },
  action: { flex: 1, alignItems: "center", minHeight: 44, justifyContent: "center" },
  actTile: { width: 36, height: 36, borderRadius: 10, backgroundColor: UI.creamDeep, alignItems: "center", justifyContent: "center" },
  actTileOn: { backgroundColor: UI.green },
  actLabel: { color: UI.ink, fontSize: 10, fontWeight: "700", marginTop: 2, textAlign: "center" },
  actSub: { color: UI.muted, fontSize: 9.5, fontWeight: "700" },
  infoRow: { flexDirection: "row", gap: 12, alignItems: "flex-start", marginTop: 6 },
  infoTile: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  infoTitle: { color: UI.ink, fontSize: 15, fontWeight: "800" },
  infoBody: { color: UI.inkSoft, fontSize: 13.5, lineHeight: 19 },
  sep: { height: 1, backgroundColor: UI.line, marginVertical: 10 },
  toast: { alignSelf: "center", backgroundColor: "rgba(31,42,34,0.92)", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8 },
  toastText: { color: "#FBF4E2", fontSize: 14, fontWeight: "700" },
  dialogText: { color: UI.ink, fontSize: 18, fontFamily: SERIF, marginVertical: 10 },
  dialogRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  dBtn: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: UI.gold, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: UI.goldDeep },
  dBtnAlt: { backgroundColor: UI.creamDeep, borderColor: UI.line },
  dBtnText: { color: UI.goldInk, fontSize: 16, fontWeight: "800" },
});
