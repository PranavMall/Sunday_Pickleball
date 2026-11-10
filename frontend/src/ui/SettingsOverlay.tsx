// SETTINGS (gear on Home): Vibration, Edit name and team, Privacy policy (hidden
// while PRIVACY_URL is empty), the app version.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React from "react";
import { Linking, Pressable, StyleSheet, Switch, View } from "react-native";

import { meta } from "@/src/game/meta";
import type { SaveDoc } from "@/src/game/meta/metaStore";
import { Overlay } from "./HeaderActions";
import { Text } from "./Text";
import { UI, type IoniconName } from "./kit";

export const PRIVACY_URL = ""; // gets the link in Release 15

export function SettingsOverlay({ visible, onClose, save, onChange, extraRows }: { visible: boolean; onClose: () => void; save: SaveDoc | null; onChange: () => void; extraRows?: React.ReactNode }) {
  const router = useRouter();
  const haptics = save?.settings?.haptics ?? true;
  return (
    <Overlay visible={visible} title="Settings" onClose={onClose} testID="settings-overlay">
      <View style={styles.row} testID="settings-vibration">
        <Ionicons name="phone-portrait-outline" size={20} color={UI.ink} />
        <Text style={styles.label}>Vibration</Text>
        <Switch
          testID="settings-vibration-toggle"
          value={haptics}
          onValueChange={(v) => {
            if (meta.loaded && meta.setHaptics(v)) onChange();
          }}
          trackColor={{ true: UI.green, false: UI.line }}
          thumbColor="#fff"
        />
      </View>
      <SettingsRow
        icon="create-outline"
        label="Edit name and team"
        testID="settings-edit-name"
        onPress={() => {
          onClose();
          router.push("/profile");
        }}
      />
      {extraRows}
      {PRIVACY_URL ? <SettingsRow icon="shield-checkmark-outline" label="Privacy policy" testID="settings-privacy" onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})} /> : null}
      <Text style={styles.version} testID="settings-version">Pickle-Ballers {Constants.expoConfig?.version ?? ""}</Text>
    </Overlay>
  );
}

export function SettingsRow({ icon, label, onPress, testID }: { icon: IoniconName; label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={20} color={UI.ink} />
      <Text style={styles.label}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={UI.inkSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: UI.line },
  label: { flex: 1, color: UI.ink, fontSize: 16, fontWeight: "700" },
  version: { color: UI.muted, fontSize: 13, textAlign: "center", marginTop: 14 },
});
