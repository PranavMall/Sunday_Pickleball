import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Share, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GameSimulation, MATCH, type Difficulty } from "@/src/game";
import { INPUT } from "@/src/game/config/tuning";
import { makeProjector } from "@/src/game/render/perspective";
import { CourtRenderer } from "@/src/game/render/CourtRenderer";
import { analytics } from "@/src/game/services/analytics";
import { makeStyles, useTheme } from "@/src/theme";

function newSim(difficulty: Difficulty) {
  const sim = new GameSimulation({ seed: (Math.random() * 1e9) | 0, difficulty });
  analytics.track("match_started", { difficulty });
  return sim;
}

export default function Match() {
  const params = useLocalSearchParams<{ difficulty?: string }>();
  const difficulty = (params.difficulty as Difficulty) || "CLUB";
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  const [sim, setSim] = useState(() => newSim(difficulty));
  const [frame, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fps, setFps] = useState(60);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const projector = useMemo(() => makeProjector(width, height), [width, height]);

  // Fixed-timestep game loop driven by requestAnimationFrame.
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
      }
      setFrame((f) => (f + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim]);

  const handleSwipe = (tx: number, ty: number) => {
    const len = Math.hypot(tx, ty);
    sim.submitSwipe({
      dx: tx,
      dy: ty,
      power: Math.min(1, len / INPUT.POWER_MAX_PX),
      tap: len < INPUT.MIN_SWIPE,
    });
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onEnd((e) => {
          runOnJS(handleSwipe)(e.translationX, e.translationY);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim],
  );
  const tap = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        runOnJS(handleSwipe)(0, 0);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim],
  );
  const gesture = Gesture.Exclusive(pan, tap);

  const rematch = () => {
    analytics.track("rematch_selected", { difficulty });
    setSim(newSim(difficulty));
    setPaused(false);
  };

  const goMenu = () => router.replace("/");

  const gameOver = sim.phase === "game_over";
  const nearWon = sim.winner === "near";
  const servingScore = sim.score.servingTeam === "near" ? sim.score.nearScore : sim.score.farScore;
  const recvScore = sim.score.servingTeam === "near" ? sim.score.farScore : sim.score.nearScore;

  const serveHint =
    sim.humanIsServer() ? "Your serve — swipe up to serve" :
    sim.phase === "waiting_serve" ? "Get ready…" :
    sim.humanCanHit() ? "Swipe to hit!" : "";

  if (landscape) {
    return (
      <View style={styles.rotate} testID="rotate-overlay">
        <Text style={styles.rotateEmoji}>📱↻</Text>
        <Text style={styles.rotateText}>Please rotate your phone to portrait</Text>
      </View>
    );
  }

  return (
    <View style={styles.root} testID="match-screen">
      <GestureDetector gesture={gesture}>
        <View style={styles.canvasWrap}>
          <CourtRenderer sim={sim} projector={projector} width={width} height={height} frame={frame} />
        </View>
      </GestureDetector>

      {/* Top HUD */}
      <View style={[styles.hud, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={styles.scorePanel}>
          <Text style={styles.scoreText} testID="score-display">
            {servingScore}<Text style={styles.scoreDim}> – </Text>{recvScore}<Text style={styles.scoreDim}> – </Text>{sim.score.serverNumber}
          </Text>
          <Text style={styles.serveLabel}>
            {sim.score.servingTeam === "near" ? "You serve" : "Rival serves"} · You {sim.score.nearScore} · Rival {sim.score.farScore}
          </Text>
        </View>
        <View style={styles.hudRight}>
          <Text style={styles.rally}>Rally {sim.stats.rallyCount}</Text>
          <Pressable testID="pause-button" style={styles.iconBtn} onPress={() => setPaused((p) => !p)}>
            <Text style={styles.iconText}>{paused ? "▶" : "⏸"}</Text>
          </Pressable>
        </View>
      </View>

      {/* Kitchen hold toggle (optional) */}
      <Pressable
        testID="kitchen-toggle"
        onPress={() => (sim.holdKitchen = !sim.holdKitchen)}
        style={[styles.kitchenBtn, { bottom: insets.bottom + 20 }, sim.holdKitchen && styles.kitchenBtnOn]}
      >
        <Text style={[styles.kitchenBtnText, sim.holdKitchen && styles.kitchenBtnTextOn]}>KITCHEN</Text>
      </Pressable>

      {/* Serve / hit hint */}
      {serveHint ? (
        <View style={[styles.hint, { bottom: insets.bottom + 24 }]} pointerEvents="none">
          <Text style={styles.hintText}>{serveHint}</Text>
        </View>
      ) : null}

      {/* Debug overlay (dev only) */}
      {__DEV__ && (
        <View style={[styles.debug, { top: insets.top + 70 }]} pointerEvents="none">
          <Text style={styles.debugText}>
            {fps} fps · {sim.phase} · z{sim.ball.z.toFixed(1)} · b{sim.ball.bouncesSinceHit}
          </Text>
        </View>
      )}

      {/* Pause overlay */}
      {paused && !gameOver && (
        <View style={styles.modalWrap} testID="pause-overlay">
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Paused</Text>
            <Pressable testID="resume-button" style={styles.primaryBtn} onPress={() => setPaused(false)}>
              <Text style={styles.primaryText}>Resume</Text>
            </Pressable>
            <Pressable testID="restart-button" style={styles.secondaryBtn} onPress={rematch}>
              <Text style={styles.secondaryText}>Restart</Text>
            </Pressable>
            <Pressable testID="quit-button" style={styles.secondaryBtn} onPress={goMenu}>
              <Text style={styles.secondaryText}>Quit to menu</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Result overlay */}
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
  canvasWrap: { ...StyleSheetAbsolute() },
  hud: { position: "absolute", left: 12, right: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  scorePanel: { backgroundColor: "rgba(46,61,42,0.72)", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  scoreText: { color: c.accentGold, fontSize: 22, fontWeight: "800" },
  scoreDim: { color: c.onSurfaceInverse, opacity: 0.55, fontSize: 18 },
  serveLabel: { color: c.onSurfaceInverse, opacity: 0.85, fontSize: 11, marginTop: 2 },
  hudRight: { alignItems: "flex-end", gap: 8 },
  rally: { color: c.onSurfaceInverse, backgroundColor: "rgba(46,61,42,0.72)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, fontSize: 12, fontWeight: "600", overflow: "hidden" },
  iconBtn: { backgroundColor: "rgba(46,61,42,0.72)", width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  iconText: { color: c.onSurfaceInverse, fontSize: 18 },
  kitchenBtn: { position: "absolute", right: 16, backgroundColor: "rgba(46,61,42,0.72)", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 2, borderColor: "transparent" },
  kitchenBtnOn: { backgroundColor: c.accentGold, borderColor: c.onSurfaceInverse },
  kitchenBtnText: { color: c.onSurfaceInverse, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  kitchenBtnTextOn: { color: c.surfaceInverse },
  hint: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(46,61,42,0.78)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  hintText: { color: c.onSurfaceInverse, fontSize: 14, fontWeight: "600" },
  debug: { position: "absolute", right: 12, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  debugText: { color: "#fff", fontSize: 10, fontFamily: "monospace" as any },
  modalWrap: { ...StyleSheetAbsolute(), backgroundColor: "rgba(20,26,18,0.72)", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { backgroundColor: c.surface, borderRadius: 24, padding: 24, width: "100%", maxWidth: 380, alignItems: "center" },
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

function StyleSheetAbsolute() {
  return { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
}
