import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import React, { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Fullscreen } from "@/src/components/fullscreen";
import { IdentityEditor } from "@/src/components/identity-editor";
import { SHOW_COMING_SOON } from "@/src/game/config/features";
import { DEFAULT_PLAYER, DEFAULT_TEAM, getIdentity, hasIdentity, saveIdentity, skipIdentity } from "@/src/game/services/profile";
import { makeStyles, useTheme } from "@/src/theme";

type LockedItem = { key: string; title: string; icon: IoniconName; testID: string };
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const LOCKED: LockedItem[] = [
  { key: "career", title: "Career", icon: "briefcase-outline", testID: "menu-career" },
  { key: "training", title: "Training", icon: "fitness-outline", testID: "menu-training" },
  { key: "passport", title: "Passport", icon: "airplane-outline", testID: "menu-passport" },
  { key: "trophy", title: "Trophies", icon: "trophy-outline", testID: "menu-trophy" },
];

export default function MainMenu() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [identity, setIdentity] = useState({ playerName: DEFAULT_PLAYER, teamName: DEFAULT_TEAM });
  const [promptOpen, setPromptOpen] = useState(false);

  const refreshIdentity = useCallback(() => {
    getIdentity().then(setIdentity);
  }, []);

  useEffect(() => {
    (async () => {
      const seen = await hasIdentity();
      refreshIdentity();
      if (!seen) setPromptOpen(true);
    })();
  }, [refreshIdentity]);

  // Pick up edits made on the Profile screen when we return here.
  useFocusEffect(refreshIdentity);

  const onSaveIdentity = async (p: string, t: string) => {
    await saveIdentity(p, t);
    setPromptOpen(false);
    refreshIdentity();
  };
  const onSkipIdentity = async () => {
    await skipIdentity();
    setPromptOpen(false);
    refreshIdentity();
  };

  const initial = identity.playerName.trim().charAt(0).toUpperCase() || "P";

  return (
    <View style={styles.root} testID="main-menu-screen">
      <Fullscreen />
      <Image source={require("@/assets/images/court_background.webp")} style={styles.bg} contentFit="cover" />
      {/* Light top/bottom gradients only, so the artwork stays the hero. */}
      <LinearGradient colors={["rgba(20,26,18,0.55)", "rgba(20,26,18,0)"]} style={[styles.topShade, { height: insets.top + 150 }]} pointerEvents="none" />
      <LinearGradient colors={["rgba(20,26,18,0)", "rgba(20,26,18,0.7)"]} style={[styles.bottomShade, { height: insets.bottom + 260 }]} pointerEvents="none" />

      {/* TOP: profile chip + small round secondary actions */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
        <Pressable
          testID="menu-profile"
          accessibilityRole="button"
          accessibilityLabel={`Profile: ${identity.playerName}, Team ${identity.teamName}`}
          style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          onPress={() => router.push("/profile")}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.chipText}>
            <Text style={styles.chipName} numberOfLines={1} testID="home-player-name">{identity.playerName}</Text>
            <Text style={styles.chipTeam} numberOfLines={1} testID="home-team-name">Team {identity.teamName}</Text>
          </View>
        </Pressable>
        <View style={styles.topIcons}>
          <RoundIcon testID="menu-history" icon="stats-chart" label="Match History" onPress={() => router.push("/history")} color={colors.onSurface} />
          <RoundIcon testID="menu-settings" icon="settings-sharp" label="Profile and settings" onPress={() => router.push("/profile")} color={colors.onSurface} />
        </View>
      </View>

      <View style={styles.titleWrap} pointerEvents="none">
        <Text style={styles.title}>Picklewood</Text>
        <Text style={styles.kicker}>GARDEN COURT DOUBLES</Text>
      </View>

      <View style={styles.spacer} />

      {/* LOWER: one dominant PLAY + locked future modes */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 20, paddingLeft: insets.left + 24, paddingRight: insets.right + 24 }]}>
        <Pressable
          testID="menu-quick-match"
          accessibilityRole="button"
          accessibilityLabel="Play quick match"
          style={({ pressed }) => [styles.play, pressed && styles.playPressed]}
          onPress={() => router.push("/difficulty")}
        >
          <Ionicons name="play" size={28} color={colors.onBrandPrimary} />
          <Text style={styles.playText}>PLAY</Text>
        </Pressable>

        {SHOW_COMING_SOON ? (
          <View style={styles.lockedRow} testID="coming-soon-row">
            {LOCKED.map((it) => (
              <View
                key={it.key}
                testID={it.testID}
                style={styles.lockedItem}
                accessible
                accessibilityLabel={`${it.title}, coming soon`}
                accessibilityState={{ disabled: true }}
              >
                <View style={styles.lockedCircle}>
                  <Ionicons name={it.icon} size={20} color={colors.onSurfaceInverse} />
                  <View style={styles.lockBadge}>
                    <Ionicons name="lock-closed" size={10} color={colors.onSurface} />
                  </View>
                </View>
                <Text style={styles.lockedLabel} numberOfLines={1}>{it.title}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {promptOpen ? (
        <View style={styles.modalWrap} testID="identity-prompt">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalCenter}>
            <View style={styles.modal}>
              <Text style={styles.modalKicker}>WELCOME</Text>
              <Text style={styles.modalTitle}>What should we call you?</Text>
              <Text style={styles.modalSub}>Pick a player and team name. You can change these anytime.</Text>
              <IdentityEditor
                initialPlayer=""
                initialTeam=""
                submitLabel="Let's play"
                onSubmit={onSaveIdentity}
                onSkip={onSkipIdentity}
              />
            </View>
          </KeyboardAvoidingView>
        </View>
      ) : null}
    </View>
  );
}

function RoundIcon(props: { testID: string; icon: IoniconName; label: string; color: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      hitSlop={6}
      style={({ pressed }) => [styles.roundIcon, pressed && styles.pressed]}
      onPress={props.onPress}
    >
      <Ionicons name={props.icon} size={20} color={props.color} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceInverse },
  bg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  topShade: { position: "absolute", top: 0, left: 0, right: 0 },
  bottomShade: { position: "absolute", bottom: 0, left: 0, right: 0 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  chip: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(251,246,233,0.92)", borderRadius: 26, paddingVertical: 5, paddingLeft: 5, paddingRight: 14, maxWidth: "62%", minHeight: 48 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.brandPrimary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: c.onBrandPrimary, fontSize: 17, fontWeight: "800" },
  chipText: { marginLeft: 9, flexShrink: 1 },
  chipName: { color: c.onSurface, fontSize: 15, fontWeight: "800" },
  chipTeam: { color: c.muted, fontSize: 11, fontWeight: "700" },
  topIcons: { flexDirection: "row", gap: 10 },
  roundIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(251,246,233,0.92)", alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  titleWrap: { alignItems: "center", marginTop: 18 },
  title: { color: c.onSurfaceInverse, fontSize: 30, fontWeight: "800", letterSpacing: -0.5, textShadowColor: "rgba(0,0,0,0.35)", textShadowRadius: 6, textShadowOffset: { width: 0, height: 2 } },
  kicker: { color: c.onSurfaceInverse, fontSize: 10, fontWeight: "800", letterSpacing: 3, marginTop: 2, textShadowColor: "rgba(0,0,0,0.6)", textShadowRadius: 4 },
  spacer: { flex: 1 },
  bottom: { alignItems: "center", gap: 18 },
  play: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: c.brandPrimary,
    borderRadius: 36,
    height: 72,
    width: "100%",
    maxWidth: 340,
    borderWidth: 3,
    borderColor: "rgba(251,246,233,0.9)",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  playPressed: { transform: [{ scale: 0.97 }], opacity: 0.95 },
  playText: { color: c.onBrandPrimary, fontSize: 26, fontWeight: "900", letterSpacing: 4 },
  lockedRow: { flexDirection: "row", justifyContent: "center", gap: 18 },
  lockedItem: { alignItems: "center", width: 62, opacity: 0.7 },
  lockedCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(20,26,18,0.55)", borderWidth: 1, borderColor: "rgba(251,246,233,0.4)", alignItems: "center", justifyContent: "center" },
  lockBadge: { position: "absolute", right: -3, bottom: -3, width: 18, height: 18, borderRadius: 9, backgroundColor: c.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  lockedLabel: { color: c.onSurfaceInverse, fontSize: 10, fontWeight: "700", marginTop: 4 },
  modalWrap: { ...StyleSheet_abs(), backgroundColor: "rgba(20,26,18,0.78)" },
  modalCenter: { flex: 1, justifyContent: "center", paddingHorizontal: 24 },
  modal: { backgroundColor: c.surface, borderRadius: 24, padding: 22, width: "100%", maxWidth: 420, alignSelf: "center" },
  modalKicker: { color: c.accentGold, fontSize: 12, fontWeight: "800", letterSpacing: 3 },
  modalTitle: { color: c.onSurface, fontSize: 24, fontWeight: "800", marginTop: 4 },
  modalSub: { color: c.muted, fontSize: 14, marginTop: 6, lineHeight: 20 },
}));

function StyleSheet_abs() {
  return { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
}
