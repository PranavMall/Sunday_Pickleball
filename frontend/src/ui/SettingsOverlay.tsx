// SETTINGS (gear on Home): Vibration · Edit name and team · Replay the tutorial
// (extraRows), then "Pickle-Ballers <version> (<build>) · Shapr Mall Studios".
import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";

import { meta } from "@/src/game/meta";
import type { SaveDoc } from "@/src/game/meta/metaStore";
import { Overlay } from "./HeaderActions";
import { Text } from "./Text";
import { UI, type IoniconName } from "./kit";

// Native build: "1.0.0 (11)"; Expo Go / web: the version only.
export function versionLabel(): string {
  const v = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "";
  const b = Constants.executionEnvironment === "storeClient" ? null : Application.nativeBuildVersion;
  return b ? `${v} (${b})` : v;
}

export function SettingsOverlay({ visible, onClose, save, onChange, extraRows }: { visible: boolean; onClose: () => void; save: SaveDoc | null; onChange: () => void; extraRows?: React.ReactNode }) {
  const router = useRouter();
  const haptics = save?.settings?.haptics ?? true;
  return (
    <Overlay visible={visible} title="Settings" onClose={onClose} testID="settings-overlay">
    <Pressable style={styles.row} testID="settings-vibration" accessibilityRole="switch" accessibilityState={{ checked: haptics }} onPress={() => meta.loaded && meta.setHaptics(!haptics) && onChange()}>
        <Ionicons name="phone-portrait-outline" size={20} color={UI.ink} />
        <Text style={styles.label}>Vibration</Text>
        <View pointerEvents="none">
          <Switch
            testID="settings-vibration-toggle"
            value={haptics}
            trackColor={{ true: UI.green, false: UI.line }}
            thumbColor="#fff"
          />
        </View>
      </Pressable>
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
      <Text style={styles.version} testID="settings-version">Pickle-Ballers {versionLabel()} · Shapr Mall Studios</Text>
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
