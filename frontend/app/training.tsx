import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { meta } from "@/src/game/meta";
import { PARTNER_IDS, PARTNERS, TRAINING_MODES } from "@/src/game/meta/economyConfig";
import { partnerOf } from "@/src/game/meta/matchSetup";
import { DestinationScreen } from "@/src/ui/DestinationScreen";
import { HeaderActions, Overlay } from "@/src/ui/HeaderActions";
import { Badge, Card, GoldButton, Kicker, ScreenTitle, SERIF, UI } from "@/src/ui/kit";
import { useSave } from "@/src/ui/useSave";

const ART = { training: require("@/assets/images/art_quickplay.webp"), scrimmage: require("@/assets/images/icon_scrimmage.webp") };

export default function Training() {
  const router = useRouter();
  const { save, refresh } = useSave();
  const [picker, setPicker] = useState(false);
  // Training partner: separate from the Career active partner; defaults to it.
  const tpId = save && save.partners[save.trainingPartnerId]?.signed ? save.trainingPartnerId : save?.activePartnerId;
  const tp = partnerOf(tpId);
  const usage = save && meta.loaded ? meta.dailyUsage(Date.now()) : { training: 0, scrimmage: 0 };
  const signed = save ? PARTNER_IDS.filter((id) => save.partners[id]?.signed) : [];

  return (
    <DestinationScreen
      active="training"
      bg={require("@/assets/images/bg_home.webp")}
      dim
      testID="training-screen"
      header={
        <>
          <ScreenTitle title="Training" />
          <HeaderActions save={save} onChange={refresh} />
        </>
      }
    >
      <Card style={{ padding: 12 }} testID="training-with">
        <Kicker style={{ fontSize: 11 }}>TRAINING WITH</Kicker>
        <View style={styles.withRow}>
          <Badge name={tp.name} color={tp.color} size={54} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.name} testID="training-partner-name">{tp.name}</Text>
            <Text style={styles.arch}>{tp.archetype}</Text>
          </View>
          <Pressable testID="training-change" accessibilityRole="button" onPress={() => setPicker(true)} style={({ pressed }) => [styles.change, pressed && { opacity: 0.8 }]}>
            <Text style={styles.changeText}>Change</Text>
            <Ionicons name="chevron-forward" size={16} color={UI.ink} />
          </Pressable>
        </View>
      </Card>

      {(["training", "scrimmage"] as const).map((mode) => {
        const t = TRAINING_MODES[mode];
        const left = Math.max(0, t.dailyCap - usage[mode]);
        return (
          <Card key={mode} style={styles.modeCard} testID={`${mode}-card`}>
            <Image source={ART[mode]} style={styles.art} contentFit="contain" />
            <View style={styles.modeDivider} />
            <View style={{ flex: 1 }}>
              <Text style={styles.modeTitle}>{mode.toUpperCase()}</Text>
              <View style={styles.gains}>
                <Ionicons name="star" size={15} color={UI.growth} />
                <Text style={styles.gainText}>
                  <Text style={{ fontWeight: "800" }}>+{t.growth}</Text> Growth ·{" "}
                </Text>
                <Ionicons name="heart" size={15} color={UI.chem} />
                <Text style={styles.gainText}>
                  <Text style={{ fontWeight: "800" }}>+{t.chemistry}</Text> Chemistry
                </Text>
              </View>
              <Text style={styles.vs}>First to 7 vs {t.vs}</Text>
              <Text style={styles.left} testID={`${mode}-left`}>
                {left > 0 ? `${left} of ${t.dailyCap} sessions left today` : "Progress used today — play for fun"}
              </Text>
              <GoldButton testID={`${mode}-start`} label="START" onPress={() => router.push({ pathname: "/match", params: { mode } })} style={{ marginTop: 6 }} />
            </View>
          </Card>
        );
      })}

      <View style={styles.note} testID="training-note">
        <Ionicons name="information-circle" size={20} color={UI.inkSoft} />
        <Text style={styles.noteText}>Training builds your partner. It never pays Coins.</Text>
      </View>

      <Overlay visible={picker} title="Train with" onClose={() => setPicker(false)} testID="training-picker">
        {signed.map((id) => {
          const p = PARTNERS[id];
          return (
            <Pressable
              key={id}
              testID={`pick-${id}`}
              style={styles.pickRow}
              onPress={() => {
                if (meta.setTrainingPartner(id)) refresh();
                setPicker(false);
              }}
            >
              <Badge name={p.name} color={p.color} size={40} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.pickName}>{p.name}</Text>
                <Text style={styles.arch}>{p.archetype}</Text>
              </View>
              {id === tp.id ? <Ionicons name="checkmark-circle" size={24} color={UI.green} /> : null}
            </Pressable>
          );
        })}
      </Overlay>
    </DestinationScreen>
  );
}

const styles = StyleSheet.create({
  withRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  name: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 24 },
  arch: { color: UI.inkSoft, fontSize: 14 },
  change: { flexDirection: "row", alignItems: "center", gap: 2, borderWidth: 1, borderColor: UI.line, backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, minHeight: 44 },
  changeText: { color: UI.ink, fontSize: 15, fontWeight: "700" },
  modeCard: { flexDirection: "row", alignItems: "center", padding: 12 },
  art: { width: 96, height: 96 },
  modeDivider: { width: 1, alignSelf: "stretch", backgroundColor: UI.line, marginHorizontal: 10 },
  modeTitle: { color: "#1E4D33", fontFamily: SERIF, fontWeight: "700", fontSize: 22 },
  gains: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2, flexWrap: "wrap" },
  gainText: { color: UI.ink, fontSize: 14 },
  vs: { color: UI.inkSoft, fontSize: 14, marginTop: 3 },
  left: { color: UI.inkSoft, fontSize: 12, marginTop: 3 },
  note: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(232,240,236,0.92)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "stretch" },
  noteText: { color: UI.ink, fontSize: 13, flexShrink: 1 },
  pickRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: UI.line },
  pickName: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 18 },
});
