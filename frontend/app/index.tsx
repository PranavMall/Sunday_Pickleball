import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IdentityEditor } from "@/src/components/identity-editor";
import { DEFAULT_PLAYER, DEFAULT_TEAM, getIdentity, hasIdentity, saveIdentity, skipIdentity } from "@/src/game/services/profile";
import { makeStyles } from "@/src/theme";

type ActiveItem = { key: string; title: string; sub: string; route: string; testID: string };
type LockedItem = { key: string; title: string; testID: string };

const ACTIVE: ActiveItem[] = [
  { key: "quick", title: "Quick Match", sub: "Jump into a 2v2 rally", route: "/difficulty", testID: "menu-quick-match" },
  { key: "history", title: "Match History", sub: "Your results & stats", route: "/history", testID: "menu-history" },
  { key: "profile", title: "Profile", sub: "Name & team", route: "/profile", testID: "menu-profile" },
];

const LOCKED: LockedItem[] = [
  { key: "career", title: "Career", testID: "menu-career" },
  { key: "training", title: "Training", testID: "menu-training" },
  { key: "passport", title: "Passport", testID: "menu-passport" },
  { key: "trophy", title: "Trophy Room", testID: "menu-trophy" },
];

export default function MainMenu() {
  const router = useRouter();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const [identity, setIdentity] = useState({ playerName: DEFAULT_PLAYER, teamName: DEFAULT_TEAM });
  const [promptOpen, setPromptOpen] = useState(false);
  const [comingSoon, setComingSoon] = useState<string | null>(null);

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

  const tapLocked = (title: string) => {
    setComingSoon(title);
    setTimeout(() => setComingSoon((c) => (c === title ? null : c)), 1600);
  };

  return (
    <View style={styles.root} testID="main-menu-screen">
      <Image source={require("@/assets/images/court_background.webp")} style={styles.bg} contentFit="cover" />
      <LinearGradient colors={["rgba(251,246,233,0.12)", "rgba(46,61,42,0.72)"]} style={styles.overlay} />

      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24, paddingHorizontal: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleWrap}>
          <Text style={styles.kicker}>GARDEN COURT DOUBLES</Text>
          <Text style={styles.title}>Picklewood</Text>
          <Text style={styles.subtitle}>
            Team {identity.teamName} · {identity.playerName}
          </Text>
        </View>

        <View style={styles.menu}>
          {ACTIVE.map((it) => (
            <Pressable
              key={it.key}
              testID={it.testID}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              onPress={() => router.push(it.route as never)}
            >
              <View style={styles.itemText}>
                <Text style={styles.itemTitle}>{it.title}</Text>
                <Text style={styles.itemSub}>{it.sub}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}

          <Text style={styles.sectionLabel}>Coming soon</Text>
          {LOCKED.map((it) => (
            <Pressable
              key={it.key}
              testID={it.testID}
              style={({ pressed }) => [styles.item, styles.itemLocked, pressed && styles.pressed]}
              onPress={() => tapLocked(it.title)}
            >
              <View style={styles.itemText}>
                <Text style={[styles.itemTitle, styles.lockedTitle]}>{it.title}</Text>
              </View>
              <View style={styles.soonPill}>
                <Text style={styles.soonText}>SOON</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {comingSoon ? (
        <View style={[styles.toast, { bottom: insets.bottom + 24 }]} pointerEvents="none" testID="coming-soon-toast">
          <Text style={styles.toastText}>{comingSoon} is coming soon</Text>
        </View>
      ) : null}

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

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceInverse },
  bg: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  titleWrap: { alignItems: "flex-start", marginBottom: 24 },
  kicker: { color: c.accentGold, fontSize: 12, fontWeight: "700", letterSpacing: 3, marginBottom: 6 },
  title: { color: c.onSurfaceInverse, fontSize: 48, fontWeight: "800", letterSpacing: -1 },
  subtitle: { color: c.onSurfaceInverse, opacity: 0.9, fontSize: 15, marginTop: 6, fontWeight: "600" },
  menu: { gap: 12 },
  item: {
    backgroundColor: "rgba(251,246,233,0.94)",
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  itemLocked: { backgroundColor: "rgba(243,234,211,0.82)" },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  itemText: { flex: 1 },
  itemTitle: { color: c.onSurface, fontSize: 20, fontWeight: "800" },
  lockedTitle: { color: c.muted },
  itemSub: { color: c.onSurfaceTertiary, fontSize: 13, marginTop: 3 },
  chevron: { color: c.brandPrimary, fontSize: 28, fontWeight: "700" },
  sectionLabel: { color: c.onSurfaceInverse, opacity: 0.75, fontSize: 12, fontWeight: "700", letterSpacing: 2, marginTop: 14, marginBottom: 2 },
  soonPill: { backgroundColor: c.surfaceTertiary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  soonText: { color: c.onSurfaceTertiary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  toast: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(46,61,42,0.92)", borderRadius: 16, paddingHorizontal: 18, paddingVertical: 10 },
  toastText: { color: c.onSurfaceInverse, fontSize: 14, fontWeight: "600" },
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
