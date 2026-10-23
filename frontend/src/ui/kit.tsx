// Shared code-drawn UI kit for the destination screens (Phase 1A Session B).
// Everything here is drawn by code: badges, buttons, cards, chips, icons.
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { Image, type ImageSource } from "expo-image";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

export type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

// Serif headings everywhere (system serif: no font files, no new dependency).
export const SERIF = Platform.select({ ios: "Georgia", android: "serif", default: "Georgia, 'Times New Roman', serif" }) as string;

export const UI = {
  ink: "#1F2A22",
  inkSoft: "#4A4534",
  muted: "#7C735E",
  cream: "#FBF4E2",
  creamDeep: "#F1E6CB",
  line: "#E2D3AE",
  gold: "#F6C94A",
  goldDeep: "#E2A92B",
  goldInk: "#2A1F0A",
  green: "#2E7D4F",
  red: "#D9483B",
  wood: "#5B3A22",
  woodDark: "#3E2715",
  track: "#E8DDC4",
  growth: "#F2B632",
  chem: "#E8506A",
  coin: "#F2B632",
  fans: "#2F7FD8",
};

// Monogram badge: initial on a coloured disc.
export function Badge({ name, color, size = 48, ring = false, testID }: { name: string; color: string; size?: number; ring?: boolean; testID?: string }) {
  const letter = (name.trim().charAt(0) || "?").toUpperCase();
  return (
    <View
      testID={testID}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: ring ? Math.max(3, size * 0.06) : 0,
        borderColor: UI.cream,
      }}
    >
      <Text style={{ color: "#FFFFFF", fontFamily: SERIF, fontWeight: "700", fontSize: size * 0.5 }}>{letter}</Text>
    </View>
  );
}

// Code-drawn coin (gold disc, inner ring).
export function Coin({ size = 22 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: UI.coin, borderWidth: Math.max(1.5, size * 0.08), borderColor: "#C98A12", alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: size * 0.5, height: size * 0.5, borderRadius: size / 4, borderWidth: Math.max(1, size * 0.06), borderColor: "#C98A12" }} />
    </View>
  );
}

// Cream rounded panel.
export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View testID={testID} style={[kit.card, style]}>
      {children}
    </View>
  );
}

export function Kicker({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[kit.kicker, style]}>{children}</Text>;
}

// Primary yellow button.
export function GoldButton({ label, onPress, testID, big = false, disabled = false, style }: { label: string; onPress: () => void; testID?: string; big?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [kit.gold, big && kit.goldBig, disabled && kit.disabled, pressed && kit.pressed, style]}
    >
      <Text style={[kit.goldText, big && kit.goldTextBig]} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={big ? 24 : 18} color={UI.goldInk} />
    </Pressable>
  );
}

// Square cream icon button with optional red dot (header actions, back arrow).
export function IconSquare({ icon, label, onPress, dot = false, testID, size = 50 }: { icon: IoniconName; label: string; onPress: () => void; dot?: boolean; testID?: string; size?: number }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [kit.square, { width: size, height: size }, pressed && kit.pressed]}
    >
      <Ionicons name={icon} size={size * 0.48} color={UI.woodDark} />
      {dot ? <View style={kit.dot} testID={testID ? `${testID}-dot` : undefined} /> : null}
    </Pressable>
  );
}

// Labelled x/100 bar with numbers.
export function MeterRow({ icon, label, value, color, testID }: { icon: IoniconName; label: string; value: number; color: string; testID?: string }) {
  const v = Math.max(0, Math.min(100, Math.floor(value)));
  return (
    <View style={kit.meterRow} testID={testID}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={kit.meterLabel}>{label}</Text>
      <View style={kit.meterTrack}>
        <View style={[kit.meterFill, { width: `${v}%`, backgroundColor: color }]} />
      </View>
      <Text style={kit.meterNum}>{v} / 100</Text>
    </View>
  );
}

// Full-screen destination background. Mounted ONLY while the screen is
// focused, so exactly one full-screen background is decoded at a time.
export function ScreenBg({ source, dim = false }: { source: ImageSource | number; dim?: boolean }) {
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  if (!focused) return null;
  return (
    <>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" />
      {dim ? <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(251,244,226,0.28)" }]} pointerEvents="none" /> : null}
    </>
  );
}

// Big serif screen title with a yellow brush underline (Training / Team).
export function ScreenTitle({ title, small = false }: { title: string; small?: boolean }) {
  return (
    <View style={{ flexShrink: 1, marginRight: 8 }}>
      <Text style={[kit.title, small && { fontSize: 34 }]} numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Text>
      <View style={kit.underline} />
    </View>
  );
}

export const kit = StyleSheet.create({
  card: {
    backgroundColor: UI.cream,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: UI.line,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  kicker: { color: "#1E4D33", fontSize: 12, fontWeight: "800", letterSpacing: 2.5 },
  gold: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: UI.gold,
    borderRadius: 14,
    minHeight: 46,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: UI.goldDeep,
    shadowColor: "#7A5300",
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  goldBig: { minHeight: 58, borderRadius: 16 },
  goldText: { color: UI.goldInk, fontSize: 17, fontWeight: "900", letterSpacing: 1 },
  goldTextBig: { fontSize: 22 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
  square: {
    backgroundColor: UI.cream,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: UI.line,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dot: { position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: 7, backgroundColor: UI.red, borderWidth: 2, borderColor: UI.cream },
  meterRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  meterLabel: { color: UI.inkSoft, fontSize: 13, width: 72 },
  meterTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: UI.track, overflow: "hidden" },
  meterFill: { height: 10, borderRadius: 5 },
  meterNum: { color: UI.ink, fontSize: 13, fontWeight: "700", width: 62, textAlign: "right" },
  title: { color: UI.ink, fontFamily: SERIF, fontWeight: "700", fontSize: 40, letterSpacing: -0.5, textShadowColor: "rgba(255,255,255,0.6)", textShadowRadius: 6 },
  underline: { height: 5, width: "78%", backgroundColor: UI.gold, borderRadius: 3, marginTop: -2, transform: [{ rotate: "-1.5deg" }] },
});
