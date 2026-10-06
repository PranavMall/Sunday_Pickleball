import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IdentityEditor } from "@/src/components/identity-editor";
import { DEFAULT_PLAYER, DEFAULT_TEAM, getIdentity, saveIdentity } from "@/src/game/services/profile";
import { makeStyles } from "@/src/theme";

export default function Profile() {
  const router = useRouter();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [loaded, setLoaded] = useState(false);
  const [player, setPlayer] = useState(DEFAULT_PLAYER);
  const [team, setTeam] = useState(DEFAULT_TEAM);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getIdentity().then((id) => {
      setPlayer(id.playerName);
      setTeam(id.teamName);
      setLoaded(true);
    });
  }, []);

  const onSubmit = async (p: string, t: string) => {
    await saveIdentity(p, t);
    setPlayer(p);
    setTeam(t);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <View style={styles.root} testID="profile-screen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 22 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable testID="back-button" onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
          <Text style={styles.heading}>Profile</Text>
          <Text style={styles.sub}>Your name and team show up in matches and history.</Text>

          <View style={styles.card}>
            {loaded ? (
              <IdentityEditor key={`${player}|${team}`} initialPlayer={player} initialTeam={team} submitLabel="Save" onSubmit={onSubmit} />
            ) : null}
            {saved ? (
              <Text testID="profile-saved" style={styles.savedNote}>
                Saved ✓
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surface },
  back: { color: c.brandPrimary, fontSize: 16, fontWeight: "600", marginBottom: 12 },
  heading: { color: c.onSurface, fontSize: 30, fontWeight: "800" },
  sub: { color: c.muted, fontSize: 15, marginTop: 6 },
  card: { backgroundColor: c.surfaceSecondary, borderRadius: 18, padding: 18, marginTop: 20, borderWidth: 1, borderColor: c.border },
  savedNote: { color: c.success, fontSize: 14, fontWeight: "700", textAlign: "center", marginTop: 14 },
}));
