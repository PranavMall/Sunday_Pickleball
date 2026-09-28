// Design tokens for this app. Light theme only.Always modify the colors and theme to Dark, Light or Dark and Light according to the design guidelines.
//
// The keys match the "color" block of /app/design_guidelines.json. Fill the
// values from that file (or from the user's brand colors). Keep every key; do
// not add a second theme or colors file; do not write color literals in
// components.
//
// How the names work: a plain key is a background, and its `on` partner is the
// text or icon color that sits on top of it. Always use them as a pair.
//   <View style={{ backgroundColor: colors.brandPrimary }}>
//     <Text style={{ color: colors.onBrandPrimary }}>Continue</Text>
//   </View>
//
// Styling a screen or component: build the sheet with makeStyles so colors
// and layout live together and follow the active scheme:
//   const useStyles = makeStyles((colors) => ({
//     card: { backgroundColor: colors.surfaceSecondary, padding: 16 },
//     title: { color: colors.onSurfaceSecondary, fontSize: 16 },
//   }));
//   function Screen() {
//     const styles = useStyles();
//     return <View style={styles.card}><Text style={styles.title}>Hi</Text></View>;
//   }
// For color props that are not styles (icon color, placeholderTextColor,
// ActivityIndicator) read useTheme().colors inside the component.
// Never call StyleSheet.create with color values at module level; it cannot
// follow the scheme.
//
// To support dark mode later: add `dark` to `themes` with every key filled.
// Nothing else changes; the device setting takes over automatically.
// Feel free to add as many new colors as you need to support the design guidelines.

import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const light = {
  // ---------------------------------------------------------------------------
  // Picklewood — warm hand-painted watercolour garden palette.
  // Surfaces: warm cream paper tones.
  // ---------------------------------------------------------------------------
  surface: "#FBF6E9", // warm cream paper
  onSurface: "#3A3327", // warm dark brown ink
  surfaceSecondary: "#F3EAD3", // cards / panels
  onSurfaceSecondary: "#4A4534",
  surfaceTertiary: "#E8DCBF", // inputs / chips / deepest nesting
  onSurfaceTertiary: "#5A5240",
  surfaceInverse: "#2E3D2A", // deep garden green (dialogs popping against cream)
  onSurfaceInverse: "#FBF6E9",
  muted: "#8A7F66", // captions, timestamps, placeholders

  // Brand — garden green.
  brand: "#4E7C3A",
  onBrand: "#FBF6E9",
  brandPrimary: "#4E7C3A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#E8DCBF",
  onBrandSecondary: "#3A3327",
  brandTertiary: "#DCEBC8",
  onBrandTertiary: "#2E3D2A",

  // Status — muted watercolour semantics.
  success: "#4E7C3A",
  onSuccess: "#FFFFFF",
  warning: "#C8892F",
  onWarning: "#FFFFFF",
  error: "#B4472F",
  onError: "#FFFFFF",
  info: "#3E6F8E",
  onInfo: "#FFFFFF",

  // Lines.
  border: "#D8C9A6",
  borderStrong: "#C2B084",
  divider: "#E2D6BA",

  // ---------------------------------------------------------------------------
  // Game canvas tokens (the watercolour court scene is the same in any scheme).
  // ---------------------------------------------------------------------------
  accentGold: "#E9A23B",
  courtLine: "#FBF3DC", // soft cream, slightly hand-drawn strokes
  kitchenFill: "#E9A23B", // NVZ highlight (alpha applied in code)
  kitchenFlash: "#B4472F", // NVZ fault flash
  netColor: "#33413C", // net mesh
  netPost: "#6B5B43",
  teamYou: "#3E6F8E", // human — deep watercolour blue
  teamPartner: "#6FA8C7", // partner — lighter blue
  teamRival: "#B4472F", // opponents — terracotta
  ballColor: "#F2E33F", // pickleball yellow
  ballShadow: "#23301F",
  hudBg: "#2E3D2A", // translucent HUD panel (alpha in code)
  hudText: "#FBF6E9",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light };

// In-app theme toggle, only after `dark` exists in `themes`. Call
// setColorScheme("dark"), setColorScheme("light"), or setColorScheme(null) to
// follow the device. Every useTheme() consumer re-renders. Persisting the
// choice and re-applying it on launch is the toggle's job.
export function setColorScheme(scheme: ColorScheme | null) {
  // RN 0.86 re-reads the device scheme only for the literal "unspecified";
  // null would pin useColorScheme() to null and the app to light.
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

// Keep native surfaces (alerts, pickers, navigation chrome) on the schemes this
// app ships: light only forces light; once `dark` exists the device decides.
// Optional call because react-native-web does not implement it.
setColorScheme?.(themes.dark ? null : defaultScheme);

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

// Themed StyleSheet: returns a hook that builds the sheet from the active
// scheme's colors and memoizes it until the scheme changes.
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}


