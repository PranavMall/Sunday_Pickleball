import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Text } from "@/src/ui/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Fullscreen } from "@/src/components/fullscreen";
import { IdentityEditor } from "@/src/components/identity-editor";
import { PLAYER_BADGE_COLOR, stageNameOf } from "@/src/game/meta/economyConfig";
import { hasIdentity, migrateLegacyTeamName, saveIdentity, skipIdentity } from "@/src/game/services/profile";
import { DestinationBar } from "@/src/ui/DestinationBar";
import { HeaderActions } from "@/src/ui/HeaderActions";
import Animated, { FadeIn } from "react-native-reanimated";

import { Badge, Card, Coin, GoldButton, Kicker, SERIF, UI } from "@/src/ui/kit";
import { useSave } from "@/src/ui/useSave";

const LOGO = require("@/assets/images/logo_pickleballers.webp");
const TROPHY = require("@/assets/images/trophy_mumbai.webp");
const ART_QP = require("@/assets/images/art_quickplay.webp");

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height < 740;
  const { save, identity, refresh } = useSave();
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    (async () => {
      await migrateLegacyTeamName();
      if (!(await hasIdentity())) setPromptOpen(true);
      refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSaveIdentity = async (p: string, t: string) => {
    await saveIdentity(p, t);
    setPromptOpen(false);
    refresh();
  };
  const onSkipIdentity = async () => {
    await skipIdentity();
    setPromptOpen(false);
    refresh();
  };

  const fresh = !save || (save.career.cleared.length === 0 && save.career.firstClearLosses === 0);
  const stage = stageNameOf(save?.career.nextMatchId ?? "mumbai.community.01");
  const playerName = identity?.playerName ?? "";

  return (
    <View style={styles.root} testID="main-menu-screen">
      <Fullscreen />
      <Animated.View entering={FadeIn.duration(150)} style={{ flex: 1 }}>
      <View style={[styles.top, { paddingTop: insets.top + (compact ? 6 : 12) }]}>
        <View style={styles.header}>
          <Image source={LOGO} style={[styles.logo, compact && { height: 52 }]} contentFit="contain" contentPosition="left" accessibilityLabel="Pickle-Ballers" />
          <HeaderActions save={save} />
        </View>

        <Card style={[styles.status, compact && { paddingVertical: 8 }]} testID="status-row">
          <StatusCell icon={<Coin size={24} />} label="Coins" value={save ? String(save.coins) : "–"} testID="status-coins" />
          <View style={styles.divider} />
          <StatusCell icon={<Ionicons name="people" size={24} color={UI.fans} />} label="Fans" value={save ? String(save.fans) : "–"} testID="status-fans" />
        </Card>

        <Pressable
          testID="menu-profile"
          accessibilityRole="button"
          accessibilityLabel={`Profile: ${playerName}, Team ${identity?.teamName ?? ""}`}
          style={({ pressed }) => [styles.chip, pressed && { opacity: 0.85 }]}
          onPress={() => router.push("/profile")}
        >
          <Badge name={playerName || "P"} color={PLAYER_BADGE_COLOR} size={48} ring />
          <View style={styles.chipBody}>
            <Text style={styles.chipName} numberOfLines={1} testID="home-player-name">{playerName}</Text>
            <Text style={styles.chipTeam} numberOfLines={1} testID="home-team-name">Team {identity?.teamName ?? ""}</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.spacer} />

      <View style={styles.cards}>
        <Card style={[styles.careerCard, compact && { paddingVertical: 10 }]} testID="career-card">
          <View style={styles.careerTop}>
            <View style={{ flex: 1 }}>
              <Kicker>CAREER</Kicker>
              <Text style={styles.careerStage} numberOfLines={1} testID="career-card-stage">{stage}</Text>
              <Text style={styles.careerSub} numberOfLines={1}>Continue your journey in Mumbai</Text>
            </View>
            <Image source={TROPHY} style={styles.trophy} contentFit="contain" />
          </View>
          <GoldButton
            big
            testID="menu-career"
            label={fresh ? "START CAREER" : "CONTINUE CAREER"}
            onPress={() => router.replace("/career")}
            style={{ marginTop: compact ? 6 : 10 }}
          />
        </Card>

        <Pressable testID="menu-quick-match" accessibilityRole="button" accessibilityLabel="Quick Play" onPress={() => router.push("/quickplay")} style={({ pressed }) => [pressed && { transform: [{ scale: 0.98 }] }]}>
          <Card style={styles.qpCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.qpTitle}>QUICK PLAY</Text>
              <Text style={styles.qpSub} numberOfLines={2}>Jump into a match{"\n"}anytime</Text>
            </View>
            <Image source={ART_QP} style={styles.qpArt} contentFit="contain" />
            <Ionicons name="chevron-forward" size={26} color={UI.ink} />
          </Card>
        </Pressable>
      </View>
      </Animated.View>

      <DestinationBar active="home" />

      {promptOpen ? (
        <View style={styles.modalWrap} testID="identity-prompt">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalCenter}>
            <View style={styles.modal}>
              <Text style={styles.modalKicker}>WELCOME</Text>
              <Text style={styles.modalTitle}>What should we call you?</Text>
              <Text style={styles.modalSub}>Pick a player and team name. You can change these anytime.</Text>
              <IdentityEditor initialPlayer="" initialTeam="" submitLabel="Let's play" onSubmit={onSaveIdentity} onSkip={onSkipIdentity} />
            </View>
          </KeyboardAvoidingView>
        </View>
      ) : null}
    </View>
  );
}

function StatusCell({ icon, label, value, testID }: { icon: React.ReactNode; label: string; value: string; testID: string }) {
  return (
    <View style={styles.cell} testID={testID}>
      {icon}
      <View style={{ marginLeft: 8 }}>
        <Text style={styles.cellLabel}>{label}</Text>
        <Text style={styles.cellValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  top: { paddingHorizontal: 16, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  logo: { flex: 1, height: 64, marginRight: 12 },
  status: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 10 },
  cell: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  cellLabel: { color: UI.inkSoft, fontSize: 12 },
  cellValue: { color: UI.ink, fontSize: 18, fontWeight: "800" },
  divider: { width: 1, alignSelf: "stretch", backgroundColor: UI.line },
  chip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", maxWidth: "78%" },
  chipBody: { backgroundColor: UI.cardBg, borderTopRightRadius: 14, borderBottomRightRadius: 14, paddingLeft: 16, paddingRight: 18, paddingVertical: 7, marginLeft: -10, zIndex: -1, borderWidth: 1, borderColor: UI.line, flexShrink: 1 },
  chipName: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 17 },
  chipTeam: { color: UI.inkSoft, fontSize: 12 },
  spacer: { flex: 1 },
  cards: { paddingHorizontal: 16, gap: 12, paddingBottom: 12 },
  careerCard: { paddingHorizontal: 14, paddingVertical: 12 },
  careerTop: { flexDirection: "row", alignItems: "center" },
  careerStage: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 24, marginTop: 4 },
  careerSub: { color: UI.inkSoft, fontSize: 13, marginTop: 2 },
  trophy: { width: 72, height: 72, marginLeft: 6 },
  qpCard: { flexDirection: "row", alignItems: "center", minHeight: 76, paddingVertical: 8, paddingLeft: 18, backgroundColor: "rgba(232,240,246,0.8)" },
  qpTitle: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 18 },
  qpSub: { color: UI.inkSoft, fontSize: 13, marginTop: 2 },
  qpArt: { width: 107, height: 60 },
  modalWrap: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(20,26,18,0.78)" },
  modalCenter: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  modal: { backgroundColor: UI.cream, borderRadius: 24, padding: 22, width: "100%", maxWidth: 420, alignSelf: "center" },
  modalKicker: { color: UI.goldDeep, fontSize: 12, fontWeight: "800", letterSpacing: 3 },
  modalTitle: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 24, marginTop: 4 },
  modalSub: { color: UI.muted, fontSize: 14, marginTop: 6, lineHeight: 20 },
});
