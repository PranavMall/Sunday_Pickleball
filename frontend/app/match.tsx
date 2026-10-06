import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Platform, Pressable, Share, Text, useWindowDimensions, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GameSimulation, MATCH, quickMatchConfig, devSinglesConfig, type Difficulty, type MatchConfig } from "@/src/game";
import { INPUT } from "@/src/game/config/tuning";
import { makeProjector } from "@/src/game/render/perspective";
import { CourtRenderer } from "@/src/game/render/CourtRenderer";
import { analytics } from "@/src/game/services/analytics";
import { sfx, SFX_AVAILABLE } from "@/src/game/services/sfx";
import { logMatchResult } from "@/src/game/services/matchLog";
import { makeStyles } from "@/src/theme";

// Reserve a small edge margin from game swipe input. (The focused back handler
// is the real Android-back protection — not this margin.)
const EDGE_MARGIN = 24;

function buildMatch(difficulty: Difficulty, singles: boolean): { sim: GameSimulation; config: MatchConfig } {
  const seed = (Math.random() * 1e9) | 0;
  const config = singles ? devSinglesConfig(difficulty, seed) : quickMatchConfig(difficulty, seed);
  const sim = new GameSimulation(config);
  analytics.track("match_started", { difficulty, format: config.format });
  return { sim, config };
}

// Memoised HUD — only re-renders when these primitives change (not every frame).
const Hud = memo(function Hud(props: {
  serving: number;
  recv: number;
  serverNumber: number;
  doubles: boolean;
  near: number;
  far: number;
  rally: number;
  servingNear: boolean;
  paused: boolean;
  top: number;
  onPause: () => void;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.hud, { top: props.top + 8 }]} pointerEvents="box-none">
      <View style={styles.scorePanel}>
        <Text style={styles.scoreText} testID="score-display">
          {props.serving}
          <Text style={styles.scoreDim}> – </Text>
          {props.recv}
          {props.doubles ? (
            <>
              <Text style={styles.scoreDim}> – </Text>
              {props.serverNumber}
            </>
          ) : null}
        </Text>
        <Text style={styles.serveLabel}>
          {props.servingNear ? "You serve" : "Rival serves"} · You {props.near} · Rival {props.far}
          {props.doubles ? "" : "  · Singles"}
        </Text>
      </View>
      <View style={styles.hudRight}>
        <Text style={styles.rally}>Rally {props.rally}</Text>
        <Pressable testID="pause-button" style={styles.iconBtn} onPress={props.onPause}>
          <Text style={styles.iconText}>{props.paused ? "▶" : "⏸"}</Text>
        </Pressable>
      </View>
    </View>
  );
});

export default function Match() {
  const params = useLocalSearchParams<{ difficulty?: string; singles?: string }>();
  const difficulty = (params.difficulty as Difficulty) || "CLUB";
  const singles = params.singles === "1";
  const router = useRouter();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  const [match, setMatch] = useState(() => buildMatch(difficulty, singles));
  const sim = match.sim;
  const config = match.config;
  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showDev, setShowDev] = useState(false);
  const [fps, setFps] = useState(60);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const gameOverRef = useRef(false);
  const loggedRef = useRef(false);
  const armedRef = useRef(false); // one armed swipe per physical gesture

  const humanSlot = useMemo(() => sim.controllers.findIndex((c) => c === "LOCAL_HUMAN"), [sim]);
  const projector = useMemo(() => makeProjector(width, height), [width, height]);

  useEffect(() => {
    let alive = true;
    if (SFX_AVAILABLE) sfx.preload().then(() => alive && setMuted(sfx.muted));
    return () => {
      alive = false;
      sfx.teardown();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (gameOverRef.current) {
          router.replace("/");
          return true;
        }
        setPaused((p) => !p);
        return true;
      };
      const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
      return () => sub.remove();
    }, [router]),
  );

  // Fixed-timestep loop.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let acc = 0;
    let fpsAcc = 0;
    let fpsCount = 0;
    const loop = (t: number) => {
      if (last === 0) last = t;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      fpsAcc += dt;
      fpsCount++;
      if (fpsAcc >= 0.5) {
        setFps(Math.round(fpsCount / fpsAcc));
        fpsAcc = 0;
        fpsCount = 0;
      }
      if (!pausedRef.current) {
        acc += dt;
        let guard = 0;
        while (acc >= MATCH.FIXED_DT && guard++ < 5) {
          sim.step();
          acc -= MATCH.FIXED_DT;
        }
        // One sound per real contact (mishits included) + one per real bounce.
        for (const ev of sim.consumeContactEvents()) {
          sfx.playForContact(ev);
          if (ev.slot === humanSlot && Platform.OS !== "web") {
            Haptics.impactAsync(
              ev.power > 0.55 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
            ).catch(() => {});
          }
        }
        for (const ev of sim.consumeBounceEvents()) sfx.playForBounce(ev);

        if (sim.phase === "game_over" && !loggedRef.current) {
          loggedRef.current = true;
          logMatchResult(config, sim);
          analytics.track("match_ended", { difficulty, format: config.format, near: sim.score.nearScore, far: sim.score.farScore });
        }
      }
      setFrame((f) => (f + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim, config, difficulty, humanSlot]);

  // ---- Input: arm on finger-DOWN once past threshold, refresh while held ----
  const toInput = useCallback((tx: number, ty: number) => {
    const len = Math.hypot(tx, ty);
    return { dx: tx, dy: ty, power: Math.min(1, len / INPUT.POWER_MAX_PX), tap: len < INPUT.MIN_SWIPE, len };
  }, []);

  const onGestureUpdate = useCallback(
    (tx: number, ty: number, startX: number) => {
      if (startX < EDGE_MARGIN || startX > width - EDGE_MARGIN) return;
      const i = toInput(tx, ty);
      if (i.len < INPUT.MIN_SWIPE) return; // not yet a clear swipe
      if (!armedRef.current) {
        armedRef.current = true;
        sim.armSwipe(i);
      } else {
        sim.updateArmedSwipe(i);
      }
    },
    [sim, width, toInput],
  );

  const onGestureEnd = useCallback(
    (tx: number, ty: number, startX: number) => {
      const i = toInput(tx, ty);
      if (armedRef.current) {
        sim.releaseSwipe(i); // finalise the armed snapshot (or no-op if consumed)
      } else if (startX >= EDGE_MARGIN && startX <= width - EDGE_MARGIN) {
        sim.submitSwipe(i); // a tap / short swipe (serve release / no-op)
      }
      armedRef.current = false;
    },
    [sim, width, toInput],
  );

  const resetArmed = useCallback(() => {
    armedRef.current = false;
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onUpdate((e) => {
          runOnJS(onGestureUpdate)(e.translationX, e.translationY, e.x - e.translationX);
        })
        .onEnd((e) => {
          runOnJS(onGestureEnd)(e.translationX, e.translationY, e.x - e.translationX);
        })
        .onFinalize(() => {
          runOnJS(resetArmed)();
        }),
    [onGestureUpdate, onGestureEnd, resetArmed],
  );

  const rematch = () => {
    analytics.track("rematch_selected", { difficulty });
    loggedRef.current = false;
    armedRef.current = false;
    setMatch(buildMatch(difficulty, singles));
    setPaused(false);
  };
  const goMenu = () => router.replace("/");
  const toggleMute = () => sfx.toggleMuted().then(setMuted);

  const gameOver = sim.phase === "game_over";
  gameOverRef.current = gameOver;
  const nearWon = sim.winner === "near";
  const dinkCue = !paused && !gameOver && sim.humanInDinkRange();
  const shotLabel =
    !paused && !gameOver && sim.lastHumanShot && sim.time - sim.lastHumanShot.time < 1
      ? sim.lastHumanShot.type.toUpperCase()
      : null;
  const servingScore = sim.score.servingTeam === "near" ? sim.score.nearScore : sim.score.farScore;
  const recvScore = sim.score.servingTeam === "near" ? sim.score.farScore : sim.score.nearScore;
  const doubles = config.format === "doubles";
  const serveHint = sim.humanIsServer()
    ? "Your serve — swipe up to serve"
    : sim.phase === "waiting_serve"
      ? "Get ready…"
      : sim.humanCanHit()
        ? "Swipe to hit!"
        : "";

  if (landscape) {
    return (
      <View style={styles.rotate} testID="rotate-overlay">
        <Stack.Screen options={{ gestureEnabled: false }} />
        <Text style={styles.rotateEmoji}>📱↻</Text>
        <Text style={styles.rotateText}>Please rotate your phone to portrait</Text>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="match-screen">
      <Stack.Screen options={{ gestureEnabled: false }} />
      <GestureDetector gesture={pan}>
        <View style={styles.canvasWrap}>
          <CourtRenderer sim={sim} projector={projector} width={width} height={height} frame={0} />
        </View>
      </GestureDetector>

      <Hud
        serving={servingScore}
        recv={recvScore}
        serverNumber={sim.score.serverNumber}
        doubles={doubles}
        near={sim.score.nearScore}
        far={sim.score.farScore}
        rally={sim.stats.rallyCount}
        servingNear={sim.score.servingTeam === "near"}
        paused={paused}
        top={insets.top}
        onPause={() => setPaused((p) => !p)}
      />

      {dinkCue && (
        <View style={[styles.dinkCue, { bottom: insets.bottom + 74 }]} pointerEvents="none">
          <Text style={styles.dinkCueText}>Dink range — short swipe</Text>
        </View>
      )}
      {shotLabel && (
        <View style={[styles.shotLabel, { bottom: insets.bottom + 108 }]} pointerEvents="none">
          <Text style={styles.shotLabelText}>{shotLabel}</Text>
        </View>
      )}
      {serveHint ? (
        <View style={[styles.hint, { bottom: insets.bottom + 24 }]} pointerEvents="none">
          <Text style={styles.hintText}>{serveHint}</Text>
        </View>
      ) : null}

      {/* Dev stats + input trace — only behind an explicit toggle. */}
      {__DEV__ && (
        <Pressable testID="dev-toggle" onPress={() => setShowDev((s) => !s)} style={[styles.devToggle, { top: insets.top + 60 }]}>
          <Text style={styles.devToggleText}>{showDev ? "DEV ✕" : "DEV"}</Text>
        </Pressable>
      )}
      {__DEV__ && showDev && (
        <View style={[styles.debug, { top: insets.top + 90 }]} pointerEvents="none">
          <Text style={styles.debugText}>
            {fps} fps · {sim.phase} · z{sim.ball.z.toFixed(1)} · sfx {sfx.ready ? "rdy" : "…"} {sfx.lastLatencyMs.toFixed(1)}ms · snd{sfx.playedCount}
          </Text>
          {sim
            .getInputTrace()
            .slice(-4)
            .map((e, i) => (
              <Text key={i} style={styles.traceText}>
                {e.time.toFixed(2)} {e.kind} dx{e.dx.toFixed(0)} dy{e.dy.toFixed(0)} p{e.power.toFixed(2)} lh{e.lastHitBy ?? "-"}
              </Text>
            ))}
        </View>
      )}

      {paused && !gameOver && (
        <View style={[styles.modalWrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]} testID="pause-overlay">
          <View style={styles.pauseModal}>
            <Text style={styles.modalTitle}>Paused</Text>
            <Pressable testID="resume-button" style={styles.primaryBtn} onPress={() => setPaused(false)}>
              <Text style={styles.primaryText}>Resume</Text>
            </Pressable>
            <Pressable testID="mute-button" style={styles.pauseSecondaryBtn} onPress={toggleMute}>
              <Text style={styles.secondaryText}>Sound: {muted ? "Off" : "On"}</Text>
            </Pressable>
            <Pressable testID="restart-button" style={styles.pauseSecondaryBtn} onPress={rematch}>
              <Text style={styles.secondaryText}>Restart</Text>
            </Pressable>
            <Pressable testID="quit-button" style={styles.pauseSecondaryBtn} onPress={goMenu}>
              <Text style={styles.secondaryText}>Quit to Menu</Text>
            </Pressable>
          </View>
        </View>
      )}

      {gameOver && (
        <View style={styles.modalWrap} testID="result-overlay">
          <View style={styles.modal}>
            <Text style={styles.resultKicker}>{nearWon ? "VICTORY" : "DEFEAT"}</Text>
            <Text style={styles.modalTitle}>{nearWon ? "You win!" : "Rivals win"}</Text>
            <Text style={styles.finalScore} testID="final-score">
              {sim.score.nearScore} – {sim.score.farScore}
            </Text>
            <View style={styles.statsRow}>
              <Stat label="Longest rally" value={sim.stats.longestRally} />
              <Stat label="Rallies" value={sim.stats.totalRallies} />
              <Stat label="Dinks" value={sim.stats.dinks} />
              <Stat label="Kitchen faults" value={sim.stats.kitchenFaults} />
            </View>
            <Pressable testID="rematch-button" style={styles.primaryBtn} onPress={rematch}>
              <Text style={styles.primaryText}>REMATCH</Text>
            </Pressable>
            <View style={styles.resultRow}>
              <Pressable testID="menu-button" style={styles.secondaryBtn} onPress={goMenu}>
                <Text style={styles.secondaryText}>Main Menu</Text>
              </Pressable>
              <Pressable
                testID="share-button"
                style={styles.secondaryBtn}
                onPress={() => {
                  analytics.track("share_clicked", { difficulty });
                  Share.share({
                    message: `I ${nearWon ? "won" : "lost"} ${sim.score.nearScore}-${sim.score.farScore} on ${difficulty} in Picklewood! 🥒`,
                  });
                }}
              >
                <Text style={styles.secondaryText}>Share</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.surfaceInverse },
  canvasWrap: { ...abs() },
  hud: { position: "absolute", left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  scorePanel: { backgroundColor: "rgba(46,61,42,0.72)", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  scoreText: { color: c.accentGold, fontSize: 22, fontWeight: "800" },
  scoreDim: { color: c.onSurfaceInverse, opacity: 0.55, fontSize: 18 },
  serveLabel: { color: c.onSurfaceInverse, opacity: 0.85, fontSize: 11, marginTop: 2 },
  hudRight: { alignItems: "flex-end", gap: 8 },
  rally: { color: c.onSurfaceInverse, backgroundColor: "rgba(46,61,42,0.72)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: "600", overflow: "hidden" },
  iconBtn: { backgroundColor: "rgba(46,61,42,0.72)", width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  iconText: { color: c.onSurfaceInverse, fontSize: 18 },
  dinkCue: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(197,160,40,0.9)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 },
  dinkCueText: { color: "#1c2417", fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  shotLabel: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(20,26,18,0.6)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4 },
  shotLabelText: { color: c.accentGold, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  hint: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(46,61,42,0.78)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  hintText: { color: c.onSurfaceInverse, fontSize: 14, fontWeight: "600" },
  devToggle: { position: "absolute", left: 12, backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  devToggleText: { color: "#9fe", fontSize: 10, fontWeight: "700" },
  debug: { position: "absolute", left: 12, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, maxWidth: 260 },
  debugText: { color: "#fff", fontSize: 10, fontFamily: "monospace" as any },
  traceText: { color: "#9fe", fontSize: 9, fontFamily: "monospace" as any },
  modalWrap: { ...abs(), backgroundColor: "rgba(20,26,18,0.72)", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { backgroundColor: c.surface, borderRadius: 24, padding: 24, width: "100%", maxWidth: 380, alignItems: "center" },
  pauseModal: { backgroundColor: c.surface, borderRadius: 24, paddingVertical: 20, paddingHorizontal: 20, width: "100%", maxWidth: 360, alignItems: "center", gap: 10 },
  pauseSecondaryBtn: { backgroundColor: c.surfaceSecondary, borderRadius: 16, paddingVertical: 14, width: "100%", alignItems: "center", borderWidth: 1, borderColor: c.border },
  resultKicker: { color: c.accentGold, fontSize: 13, fontWeight: "800", letterSpacing: 3 },
  modalTitle: { color: c.onSurface, fontSize: 28, fontWeight: "800", marginTop: 4 },
  finalScore: { color: c.brandPrimary, fontSize: 44, fontWeight: "800", marginVertical: 8 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14, marginVertical: 12 },
  stat: { alignItems: "center", minWidth: 70 },
  statValue: { color: c.onSurface, fontSize: 22, fontWeight: "800" },
  statLabel: { color: c.muted, fontSize: 11, marginTop: 2 },
  primaryBtn: { backgroundColor: c.brandPrimary, borderRadius: 18, paddingVertical: 16, width: "100%", alignItems: "center", marginTop: 8 },
  primaryText: { color: c.onBrandPrimary, fontSize: 18, fontWeight: "800", letterSpacing: 1 },
  secondaryBtn: { backgroundColor: c.surfaceSecondary, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18, alignItems: "center", flex: 1, borderWidth: 1, borderColor: c.border },
  secondaryText: { color: c.onSurfaceSecondary, fontSize: 15, fontWeight: "700" },
  resultRow: { flexDirection: "row", gap: 12, marginTop: 12, width: "100%" },
  rotate: { flex: 1, backgroundColor: c.surfaceInverse, alignItems: "center", justifyContent: "center", padding: 32 },
  rotateEmoji: { fontSize: 48, marginBottom: 16 },
  rotateText: { color: c.onSurfaceInverse, fontSize: 18, fontWeight: "600", textAlign: "center" },
}));

function abs() {
  return { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
}
