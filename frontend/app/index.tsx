// HOME: for playing (one labelled action per tile); the bottom bar is for places.
// Top bar (Coins pill · gear) · logo · name banner · (painting) · Career card ·
// mode row (Quick Play · Training).
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Text } from "@/src/ui/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import { Fullscreen } from "@/src/components/fullscreen";
import { IdentityEditor } from "@/src/components/identity-editor";
import { meta } from "@/src/game/meta";
import { COURT_NAMES, PLAYER_BADGE_COLOR, STAGE_NAMES } from "@/src/game/meta/economyConfig";
import { homeCareerView, trainingTileText } from "@/src/game/meta/home";
import { hasUnread } from "@/src/game/meta/inbox";
import { partnerOf } from "@/src/game/meta/matchSetup";
import { TROPHY_BY_STAGE } from "@/src/game/render/sprites";
import { hasIdentity, migrateLegacyTeamName, saveIdentity, skipIdentity } from "@/src/game/services/profile";
import { playCareerMatch } from "@/src/ui/careerNav";
import { DestinationBar } from "@/src/ui/DestinationBar";
import { SettingsOverlay } from "@/src/ui/SettingsOverlay";
import { Badge, Card, Coin, GoldButton, SERIF, UI } from "@/src/ui/kit";
import { useSave } from "@/src/ui/useSave";

const LOGO = require("@/assets/images/logo_pickleballers.webp");
const ART_QP = require("@/assets/images/art_quickplay.webp");

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const small = height < 700;
  const { save, identity, refresh } = useSave();
  const [promptOpen, setPromptOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const view = homeCareerView(save ?? { career: { cleared: [], nextMatchId: "mumbai.community.01", firstClearWins: 0, firstClearLosses: 0, trophies: {}, talkSeen: [] } });
  const m = view.match;
  const playerName = identity?.playerName ?? "";
  const partner = partnerOf(save?.activePartnerId);
  const unread = !!save && hasUnread(save);
  const trainingUsed = save && meta.loaded ? meta.dailyUsage(Date.now()).training : 0;
  const tileH = small ? 62 : 70;

  const onPlay = () => (view.allCleared ? router.replace("/career") : playCareerMatch(router, save, m.id));

  return (
    <View style={styles.root} testID="main-menu-screen">
      <Fullscreen />
      <Animated.View entering={FadeIn.duration(150)} style={{ flex: 1 }}>
        <View style={[styles.top, { paddingTop: insets.top + (small ? 6 : 10) }]}>
          <View style={styles.topBar} testID="status-row">
            <View style={styles.coinPill} testID="status-coins" accessibilityLabel={`Coins ${save?.coins ?? 0}`}>
              <Coin size={24} />
              <Text style={styles.coinText}>{save ? String(save.coins) : "–"}</Text>
            </View>
            <Pressable testID="home-settings" accessibilityRole="button" accessibilityLabel="Settings" onPress={() => setSettingsOpen(true)} style={({ pressed }) => [styles.gear, pressed && { opacity: 0.8 }]}>
              <Ionicons name="settings-sharp" size={22} color="#FBF4E2" />
            </Pressable>
          </View>
          <Image source={LOGO} style={[styles.logo, { height: small ? 44 : 54 }]} contentFit="contain" accessibilityLabel="Pickle-Ballers" />

          <Pressable
            testID="menu-profile"
            accessibilityRole="button"
            accessibilityLabel={`Profile: ${playerName}, Team ${identity?.teamName ?? ""}`}
            onPress={() => router.push("/profile")}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          >
            <Card style={styles.banner}>
              <Badge name={playerName || "P"} color={PLAYER_BADGE_COLOR} size={44} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.bannerName} numberOfLines={1} testID="home-player-name">{playerName}</Text>
                <View style={styles.bannerSub}>
                  <Text style={styles.bannerTeam} numberOfLines={1} testID="home-team-name">{identity?.teamName ?? ""} · </Text>
                  <Ionicons name="people" size={13} color={UI.fans} />
                  <Text style={styles.bannerFans} testID="status-fans">{save?.fans ?? 0}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={UI.ink} />
            </Card>
          </Pressable>
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.cards}>
          <Card style={styles.careerCard} testID="career-card">
            <Pressable testID="career-card-open" accessibilityRole="button" accessibilityLabel="Open Passport" onPress={() => router.replace("/career")}>
              <View style={styles.cRow}>
                <Image source={TROPHY_BY_STAGE[m.stageKey] ?? TROPHY_BY_STAGE.community} style={styles.trophy} contentFit="contain" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.cKicker} numberOfLines={1} testID="career-card-stage">CAREER · {STAGE_NAMES[m.stageKey].toUpperCase()}</Text>
                  <Text style={styles.cTitle} numberOfLines={1} testID="career-card-title">{view.title}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={UI.ink} />
              </View>
              <View style={styles.inner}>
                {view.allCleared ? (
                  <Text style={styles.rivalName} testID="career-card-soon">South Cup · coming soon</Text>
                ) : (
                  <>
                    <View style={styles.pair}>
                      <Badge name={playerName || "P"} color={PLAYER_BADGE_COLOR} size={30} />
                      <View style={{ marginLeft: -8 }}>
                        <Badge id={partner.id} name={partner.name} color={partner.color} size={30} />
                      </View>
                    </View>
                    <Text style={styles.vs}>vs</Text>
                    <Badge name={m.code} color={m.color} size={30} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.rivalName} numberOfLines={1} testID="career-card-rival">{m.rival}</Text>
                      <Text style={styles.courtName} numberOfLines={1}>{m.court ? COURT_NAMES[m.court] : ""}</Text>
                    </View>
                  </>
                )}
              </View>
            </Pressable>
            <GoldButton big testID="menu-career" label={view.button} onPress={onPlay} style={{ marginTop: 8, minHeight: 56 }} />
            {unread ? <View style={styles.dot} testID="home-inbox-dot" /> : null}
          </Card>

          <View style={styles.modeRow}>
            <Pressable testID="menu-quick-match" accessibilityRole="button" accessibilityLabel="Quick Play" onPress={() => router.push("/quickplay")} style={({ pressed }) => [styles.tile, styles.qpTile, { height: tileH }, pressed && { transform: [{ scale: 0.98 }] }]}>
              <Image source={ART_QP} style={{ width: small ? 56 : 64, height: small ? 32 : 36 }} contentFit="contain" />
              <Text style={styles.tileTitle}>Quick Play</Text>
            </Pressable>
            <Pressable testID="menu-training" accessibilityRole="button" accessibilityLabel="Training" onPress={() => router.push("/training")} style={({ pressed }) => [styles.tile, styles.trTile, { height: tileH }, pressed && { transform: [{ scale: 0.98 }] }]}>
              <View style={styles.trIcon}>
                <Ionicons name="barbell" size={16} color="#fff" />
              </View>
              <Text style={styles.tileTitle}>Training</Text>
              <Text style={styles.tileSub} testID="training-tile-left">{trainingTileText(trainingUsed)}</Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>

      <DestinationBar active="home" />

      <SettingsOverlay visible={settingsOpen} onClose={() => setSettingsOpen(false)} save={save} onChange={refresh} />

      {promptOpen ? (
        <View style={styles.modalWrap} testID="identity-prompt">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalCenter}>
            <View style={[styles.modal, width < 380 && { padding: 18 }]}>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  top: { paddingHorizontal: 16, gap: 8 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  coinPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(31,42,34,0.82)", borderRadius: 20, paddingLeft: 6, paddingRight: 12, minHeight: 36 },
  coinText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  gear: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(31,42,34,0.82)", alignItems: "center", justifyContent: "center" },
  logo: { width: "100%" },
  banner: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 10 },
  bannerName: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 16 },
  bannerSub: { flexDirection: "row", alignItems: "center", marginTop: 1 },
  bannerTeam: { color: UI.inkSoft, fontSize: 12, flexShrink: 1 },
  bannerFans: { color: UI.ink, fontSize: 12, fontWeight: "800", marginLeft: 3 },
  cards: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  careerCard: { paddingHorizontal: 12, paddingVertical: 10 },
  cRow: { flexDirection: "row", alignItems: "center" },
  trophy: { width: 46, height: 46 },
  cKicker: { color: "#1E4D33", fontSize: 10.5, fontWeight: "800", letterSpacing: 1.5 },
  cTitle: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 18, marginTop: 1 },
  inner: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8, minHeight: 44 },
  pair: { flexDirection: "row" },
  vs: { color: UI.inkSoft, fontFamily: SERIF, fontSize: 13, marginHorizontal: 8 },
  rivalName: { color: UI.ink, fontSize: 13, fontWeight: "800" },
  courtName: { color: UI.inkSoft, fontSize: 11.5 },
  dot: { position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: 7, backgroundColor: UI.red, borderWidth: 2, borderColor: UI.cream },
  modeRow: { flexDirection: "row", gap: 8 },
  tile: { flex: 1, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: UI.line, paddingHorizontal: 4 },
  qpTile: { backgroundColor: "rgba(232,240,246,0.88)" },
  trTile: { backgroundColor: "rgba(232,244,234,0.88)" },
  trIcon: { width: 26, height: 22, borderRadius: 7, backgroundColor: UI.green, alignItems: "center", justifyContent: "center" },
  tileTitle: { color: UI.ink, fontSize: 14, fontWeight: "800", marginTop: 2 },
  tileSub: { color: UI.inkSoft, fontSize: 11 },
  modalWrap: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(20,26,18,0.78)" },
  modalCenter: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  modal: { backgroundColor: UI.cream, borderRadius: 24, padding: 22, width: "100%", maxWidth: 420, alignSelf: "center" },
  modalKicker: { color: UI.goldDeep, fontSize: 12, fontWeight: "800", letterSpacing: 3 },
  modalTitle: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 24, marginTop: 4 },
  modalSub: { color: UI.muted, fontSize: 14, marginTop: 6, lineHeight: 20 },
});
