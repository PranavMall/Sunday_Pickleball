// "WARMING UP" (the loading screen): after the native splash, while fonts, the
// save and the first screen's images load. At least MIN_MS, then a 200 ms fade
// to the app; once per app session. All motion runs on the UI thread
// (Reanimated); Reduce Motion shows the still layout.
import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { Image as RNImage, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { SERIF } from "./kit";
import { Text } from "./Text";

const BG = require("@/assets/images/warmup_bg.webp");
const LOGO = require("@/assets/images/logo_pickleballers.webp");
const PADDLE_RED = require("@/assets/images/paddle_red.webp");
const PADDLE_NAVY = require("@/assets/images/paddle_navy.webp");
const BALL = require("@/assets/images/warmup_ball.webp");
const FIRST_SCREEN = [require("@/assets/images/bg_home.webp"), require("@/assets/images/bg_career_mumbai.webp")];

export const WARMUP_MIN_MS = 1200;
const FADE_MS = 200;
const CROSS_MS = 800;
const PADDLE_AR = 804 / 493; // paddle height / width
const BALL_AR = 235 / 271;

export const WARMUP_TIPS = [
  "Only the serving team can score.",
  "The return of serve must bounce. So must the next shot.",
  "No volleys from inside the kitchen.",
  "Tap NET to step up to the kitchen line.",
  "A short lob is a gift: SMASH it.",
  "Deep lob over your head? Tap BACK.",
  "Dinks are soft shots that land in their kitchen.",
  "Win by 2. Always.",
];

let shownThisSession = false;

// Prefetch the first screen's backgrounds (errors ignored; web decodes on mount).
function prefetchFirstScreen(): Promise<unknown> {
  try {
    const uris = FIRST_SCREEN.map((m) => RNImage.resolveAssetSource(m)?.uri).filter(Boolean) as string[];
    return uris.length ? Image.prefetch(uris, "memory-disk").catch(() => false) : Promise.resolve();
  } catch {
    return Promise.resolve();
  }
}

export function WarmingUp({ until }: { until: Promise<unknown> }) {
  const [gone, setGone] = useState(shownThisSession);
  const [tip] = useState(() => WARMUP_TIPS[Math.floor(Math.random() * WARMUP_TIPS.length)]);
  const fade = useSharedValue(1);
  useEffect(() => {
    if (shownThisSession) return;
    shownThisSession = true;
    let alive = true;
    const min = new Promise((r) => setTimeout(r, WARMUP_MIN_MS));
    Promise.all([min, until.catch(() => {}), prefetchFirstScreen()]).then(() => {
      if (!alive) return;
      fade.value = withTiming(0, { duration: FADE_MS }, (fin) => {
        if (fin) runOnJS(setGone)(true);
      });
    });
    return () => {
      alive = false;
    };
  }, [until, fade]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  if (gone) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, fadeStyle]} testID="warming-up">
      <WarmupScene tip={tip} />
    </Animated.View>
  );
}

function WarmupScene({ tip }: { tip: string }) {
  const { width: W, height: H } = useWindowDimensions();
  const still = useReducedMotion();
  // t: 0 = ball on the near (red) paddle, 1 = on the far (navy) paddle.
  const t = useSharedValue(0);
  const dots = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    const ease = Easing.inOut(Easing.quad);
    t.value = withRepeat(withSequence(withTiming(1, { duration: CROSS_MS, easing: ease }), withTiming(0, { duration: CROSS_MS, easing: ease })), -1);
    dots.value = withRepeat(withTiming(3, { duration: 1200, easing: Easing.linear }), -1);
  }, [still, t, dots]);

  const nearW = W * 0.28;
  const farW = W * 0.15;
  const nearC = { x: W * 0.35, y: H * 0.71 };
  const farC = { x: W * 0.68, y: H * 0.5 };
  // Contact points on the paddle faces (upper part of each paddle).
  const nearHit = { x: nearC.x + nearW * 0.04, y: nearC.y - nearW * PADDLE_AR * 0.2 };
  const farHit = { x: farC.x - farW * 0.05, y: farC.y - farW * PADDLE_AR * 0.18 };
  // Flat drive: the arc peaks just above the net tape (~54 %), never a lob.
  const arc = H * 0.045;

  const ballStyle = useAnimatedStyle(() => {
    const p = t.value;
    const size = interpolate(p, [0, 1], [W * 0.06, W * 0.035]);
    const x = nearHit.x + (farHit.x - nearHit.x) * p;
    const y = nearHit.y + (farHit.y - nearHit.y) * p - arc * Math.sin(Math.PI * p);
    return { width: size, height: size * BALL_AR, transform: [{ translateX: x - size / 2 }, { translateY: y - (size * BALL_AR) / 2 }] };
  });
  // Each paddle tilts ~12° back and forward around its hit.
  const nearStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-12 * Math.max(0, 1 - t.value / 0.18)}deg` }] }));
  const farStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${12 * Math.max(0, 1 - (1 - t.value) / 0.18)}deg` }] }));
  // Spark on the far paddle only, ~150 ms around contact.
  const sparkStyle = useAnimatedStyle(() => ({ opacity: !still && 1 - t.value < 0.03 ? 1 : 0 }));
  const d1 = useAnimatedStyle(() => ({ opacity: still || dots.value >= 0.4 ? 1 : 0.15 }));
  const d2 = useAnimatedStyle(() => ({ opacity: still || dots.value >= 1.2 ? 1 : 0.15 }));
  const d3 = useAnimatedStyle(() => ({ opacity: still || dots.value >= 2 ? 1 : 0.15 }));

  const paddle = (w: number, c: { x: number; y: number }) => ({ position: "absolute" as const, left: c.x - w / 2, top: c.y - (w * PADDLE_AR) / 2, width: w, height: w * PADDLE_AR });
  return (
    <>
      <Image source={BG} style={StyleSheet.absoluteFill} contentFit="cover" />
      <Image source={LOGO} style={{ position: "absolute", left: W * 0.1, top: H * 0.1, width: W * 0.8, height: W * 0.8 * (255 / 960) }} contentFit="contain" />
      <Animated.View style={[paddle(farW, farC), farStyle]}>
        <Image source={PADDLE_NAVY} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Animated.View>
      <Animated.View style={[styles.spark, { left: farHit.x - 22, top: farHit.y - 22 }, sparkStyle]} pointerEvents="none">
        {SPARK_ROT.map((r) => (
          <View key={r} style={[styles.sparkLine, { transform: [{ rotate: `${r}deg` }, { translateY: -15 }] }]} />
        ))}
      </Animated.View>
      {/* z-order: far paddle → ball → near paddle (the red paddle is always in front). */}
      <Animated.View style={[styles.ball, ballStyle, still && { opacity: 0 }]}>
        <Image source={BALL} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Animated.View>
      <Animated.View style={[paddle(nearW, nearC), nearStyle]}>
        <Image source={PADDLE_RED} style={StyleSheet.absoluteFill} contentFit="contain" />
      </Animated.View>
      <View style={[styles.textWrap, { top: H * 0.84 }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Warming up</Text>
          <Animated.Text allowFontScaling={false} style={[styles.title, d1]}> .</Animated.Text>
          <Animated.Text allowFontScaling={false} style={[styles.title, d2]}>.</Animated.Text>
          <Animated.Text allowFontScaling={false} style={[styles.title, d3]}>.</Animated.Text>
        </View>
        <Text style={styles.tip} numberOfLines={2} testID="warming-up-tip">
          {tip}
        </Text>
      </View>
    </>
  );
}

const SPARK_ROT = [-70, -35, 0, 35, 70];

const styles = StyleSheet.create({
  root: { backgroundColor: "#2150AC", zIndex: 100, elevation: 100 },
  ball: { position: "absolute", left: 0, top: 0 },
  spark: { position: "absolute", width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sparkLine: { position: "absolute", width: 3, height: 9, borderRadius: 1.5, backgroundColor: "#F6C94A" },
  textWrap: { position: "absolute", left: 24, right: 24, alignItems: "center" },
  titleRow: { flexDirection: "row", alignItems: "baseline" },
  title: { color: "#fff", fontFamily: SERIF, fontWeight: "700", fontSize: 30, letterSpacing: 1 },
  tip: { color: "rgba(255,255,255,0.85)", fontSize: 14, textAlign: "center", marginTop: 8, lineHeight: 19 },
});
