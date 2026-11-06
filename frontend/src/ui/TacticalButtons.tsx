// TACTICAL BUTTONS (match HUD): LOB + NET / BACK. Same positions and 1-tap
// rules as before; round (≥ 64 pt), cream 2 pt ring, soft shadow, press-down
// scale 0.94. The NET / BACK cooldown is a ring of segments filling around the
// button (static geometry, precomputed once; no per-frame allocation).
import { Ionicons } from "@react-native-vector-icons/ionicons";
import React, { memo, useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

import { Text } from "./Text";

export const KB_SIZE = 64;
const SEGS = 20;
const SEG_T = Array.from({ length: SEGS }, (_, i) => [{ rotate: `${(i * 360) / SEGS}deg` }, { translateY: -(KB_SIZE / 2 - 3) }]);

const CooldownRing = memo(function CooldownRing({ filled }: { filled: number }) {
  return (
    <View style={styles.ring} pointerEvents="none" testID="kitchen-cooldown-ring">
      {SEG_T.map((t, i) => (
        <View key={i} style={[styles.seg, { transform: t }, i < filled ? styles.segOn : null]} />
      ))}
    </View>
  );
});

// NET (hold the kitchen line) ↔ BACK (retreat toward the baseline).
export const KitchenButton = memo(function KitchenButton(props: { mode: "hold" | "retreat"; cooldown: number; pulse: boolean; onPress: () => void }) {
  const hold = props.mode === "hold";
  const cooling = props.cooldown > 0;
  return (
    <Pressable
      testID="kitchen-button"
      accessibilityLabel={hold ? "At the net. Tap to move back" : "Back court. Tap to rush the net"}
      onPress={props.onPress}
      disabled={cooling}
      style={({ pressed }) => [styles.btn, styles.dark, props.pulse && styles.pulse, pressed && styles.pressed]}
    >
      <Ionicons name={hold ? "arrow-down" : "arrow-up"} size={22} color="#FBF4E2" />
      <Text style={styles.label} testID="kitchen-button-state">{hold ? "BACK" : "NET"}</Text>
      {cooling ? <CooldownRing filled={Math.round((1 - props.cooldown) * SEGS)} /> : null}
    </Pressable>
  );
});

// LOB arm: tap arms my next strike as a lob; tap again to clear.
export const LobButton = memo(function LobButton(props: { armed: boolean; onPress: () => void }) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (props.armed) s.value = withRepeat(withTiming(1.06, { duration: 450 }), -1, true);
    else {
      cancelAnimation(s);
      s.value = 1;
    }
  }, [props.armed, s]);
  const pulse = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={pulse}>
      <Pressable
        testID="lob-button"
        accessibilityLabel={props.armed ? "Lob armed. Tap to cancel" : "Arm a lob for my next shot"}
        onPress={props.onPress}
        style={({ pressed }) => [styles.btn, props.armed ? styles.gold : styles.dark, pressed && styles.pressed]}
      >
        <Ionicons name="return-up-forward" size={22} color={props.armed ? "#2A1F0A" : "#FBF4E2"} />
        <Text style={[styles.label, props.armed && { color: "#2A1F0A" }]} testID="lob-button-state">LOB</Text>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  btn: {
    width: KB_SIZE, height: KB_SIZE, borderRadius: KB_SIZE / 2, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#FBF4E2",
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  dark: { backgroundColor: "rgba(30,77,51,0.92)" },
  gold: { backgroundColor: "#F6C94A" },
  pulse: { borderColor: "#F6C94A", borderWidth: 4, transform: [{ scale: 1.08 }] },
  pressed: { transform: [{ scale: 0.94 }] },
  label: { color: "#FBF4E2", fontSize: 11, fontWeight: "900", letterSpacing: 1, marginTop: -1 },
  ring: { position: "absolute", left: 0, top: 0, width: KB_SIZE - 4, height: KB_SIZE - 4, alignItems: "center", justifyContent: "center" },
  seg: { position: "absolute", width: 3, height: 6, borderRadius: 1.5, backgroundColor: "rgba(251,244,226,0.25)" },
  segOn: { backgroundColor: "#F6C94A" },
});
