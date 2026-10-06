import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { NAME_MAX, validateName } from "@/src/game/services/profile";
import { makeStyles, useTheme } from "@/src/theme";

interface Props {
  initialPlayer: string;
  initialTeam: string;
  submitLabel: string;
  onSubmit: (player: string, team: string) => void;
  onSkip?: () => void;
}

// Reusable Player Name / Team Name form with validation. Used by the first-time
// prompt (with Skip) and the Profile screen (without Skip).
export function IdentityEditor({ initialPlayer, initialTeam, submitLabel, onSubmit, onSkip }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [player, setPlayer] = useState(initialPlayer);
  const [team, setTeam] = useState(initialTeam);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const p = validateName(player, "Player name");
    if (!p.ok) return setError(p.error!);
    const t = validateName(team, "Team name");
    if (!t.ok) return setError(t.error!);
    setError(null);
    onSubmit(p.value, t.value);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Player name</Text>
      <TextInput
        testID="player-name-input"
        style={styles.input}
        value={player}
        onChangeText={(v) => {
          setPlayer(v);
          setError(null);
        }}
        placeholder="Player"
        placeholderTextColor={colors.muted}
        maxLength={NAME_MAX}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="next"
      />
      <Text style={styles.label}>Team name</Text>
      <TextInput
        testID="team-name-input"
        style={styles.input}
        value={team}
        onChangeText={(v) => {
          setTeam(v);
          setError(null);
        }}
        placeholder="Picklewood"
        placeholderTextColor={colors.muted}
        maxLength={NAME_MAX}
        autoCapitalize="words"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {error ? (
        <Text testID="identity-error" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Pressable testID="identity-save-button" style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={submit}>
        <Text style={styles.primaryText}>{submitLabel}</Text>
      </Pressable>
      {onSkip ? (
        <Pressable testID="identity-skip-button" style={styles.skipBtn} onPress={onSkip} hitSlop={8}>
          <Text style={styles.skipText}>Skip for now</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { width: "100%" },
  label: { color: c.onSurfaceSecondary, fontSize: 13, fontWeight: "700", marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: c.surfaceTertiary,
    color: c.onSurfaceTertiary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: c.border,
  },
  error: { color: c.error, fontSize: 13, fontWeight: "600", marginTop: 10 },
  primaryBtn: { backgroundColor: c.brandPrimary, borderRadius: 16, paddingVertical: 15, alignItems: "center", marginTop: 18 },
  primaryText: { color: c.onBrandPrimary, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  skipBtn: { alignItems: "center", paddingVertical: 12, marginTop: 4 },
  skipText: { color: c.muted, fontSize: 14, fontWeight: "600" },
}));
