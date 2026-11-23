// SETTINGS (gear on Home): Vibration · Usage data · Edit name and team · Replay the
// tutorial (extraRows) · Send feedback · Contact us · Privacy policy, then "Pickle-Ballers <version> (<build>) · Shapr Mall Studios".
import { Ionicons } from "@react-native-vector-icons/ionicons";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React from "react";
import * as WebBrowser from "expo-web-browser";
import { Linking, Pressable, StyleSheet, Switch, View } from "react-native";

import { meta } from "@/src/game/meta";
import { gameEvents } from "@/src/game/meta/events";
import { FEEDBACK_URL, SUPPORT_EMAIL } from "@/src/game/meta/privacy";
import { analytics } from "@/src/game/services/analytics";
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
  const usage = save?.settings?.usageData ?? true;
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
      <Pressable style={styles.row} testID="settings-usage-data" accessibilityRole="switch" accessibilityState={{ checked: usage }} onPress={() => {
        if (!meta.loaded || !meta.setUsageData(!usage)) return;
        analytics.setEnabled(!usage);
        onChange();
      }}>
        <Ionicons name="stats-chart-outline" size={20} color={UI.ink} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Usage data</Text>
          <Text style={styles.sub}>Anonymous stats that help us improve the game</Text>
        </View>
        <View pointerEvents="none">
          <Switch testID="settings-usage-data-toggle" value={usage} trackColor={{ true: UI.green, false: UI.line }} thumbColor="#fff" />
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
      {FEEDBACK_URL ? (
        <SettingsRow
          icon="chatbox-ellipses-outline"
          label="Send feedback"
          testID="settings-feedback"
          onPress={() => {
            gameEvents.feedbackOpen();
            WebBrowser.openBrowserAsync(FEEDBACK_URL).catch(() => {});
          }}
        />
      ) : null}
      <SettingsRow
        icon="mail-outline"
        label="Contact us"
        sub={SUPPORT_EMAIL}
        testID="settings-contact"
        onPress={() => {
          gameEvents.contactOpen();
          // No mail app: the visible address is enough (no error).
          Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Pickle-Ballers ${versionLabel()}`)}`).catch(() => {});
        }}
      />
      <SettingsRow
        icon="shield-checkmark-outline"
        label="Privacy policy"
        testID="settings-privacy"
        onPress={() => {
          gameEvents.privacyOpen();
          onClose();
          router.push("/privacy");
        }}
      />
      <Text style={styles.version} testID="settings-version">Pickle-Ballers {versionLabel()} · Shapr Mall Studios</Text>
    </Overlay>
  );
}

export function SettingsRow({ icon, label, sub, onPress, testID }: { icon: IoniconName; label: string; sub?: string; onPress: () => void; testID: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={20} color={UI.ink} />
      {sub ? (
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.sub} testID={`${testID}-sub`}>{sub}</Text>
        </View>
      ) : (
        <Text style={styles.label}>{label}</Text>
      )}
      <Ionicons name="chevron-forward" size={18} color={UI.inkSoft} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: UI.line },
  sub: { color: UI.muted, fontSize: 12, marginTop: 1 },
  label: { flex: 1, color: UI.ink, fontSize: 16, fontWeight: "700" },
  version: { color: UI.muted, fontSize: 13, textAlign: "center", marginTop: 14 },
});
