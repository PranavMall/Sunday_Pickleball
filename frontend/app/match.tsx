import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Platform, Pressable, Share, Text, useWindowDimensions, View } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GameSimulation, MATCH, quickMatchConfig, devSinglesConfig, type Difficulty, type MatchConfig } from "@/src/game";
import { INPUT, KITCHEN } from "@/src/game/config/tuning";
import { makeProjector } from "@/src/game/render/perspective";
import { CourtRenderer } from "@/src/game/render/CourtRenderer";
import { analytics } from "@/src/game/services/analytics";
import { sfx, SFX_AVAILABLE, SFX_ENABLED } from "@/src/game/services/sfx";
import { logMatchResult } from "@/src/game/services/matchLog";
import { getIdentity } from "@/src/game/services/profile";
import { Fullscreen } from "@/src/components/fullscreen";
import { makeStyles } from "@/src/theme";

// Reserve a small edge margin from game swipe input. (The focused back handler
// is the real Android-back protection — not this margin.)
const EDGE_MARGIN = 24;
// TACTICAL ROW (bottom-right, inside the bottom safe area): LOB + NET/BACK,
// same size, side by side. Clear of the pause button (top-right) and the
// centred hint/cue pills (which sit ABOVE the row). Swipes that START anywhere
// on the row are ignored.
const KB_SIZE = 64;
const KB_RIGHT = 14;
const KB_BOTTOM = 14; // + safe-area bottom inset
const KB_GAP = 10;
const ROW_W = KB_SIZE * 2 + KB_GAP;
const PILL_BASE = KB_BOTTOM + KB_SIZE + 12; // pills start above the row

// Memoised kitchen button: NET (hold the kitchen line) ↔ BACK (retreat toward
// the baseline), with a short cooldown bar after each toggle.
const KitchenButton = memo(function KitchenButton(props: {
  mode: "hold" | "retreat";
  cooldown: number; // 0..1 remaining
  pulse: boolean; // "BACK ▼" hint right after my lob (no automatic retreat)
  onPress: () => void;
}) {
  const styles = useStyles();
  const hold = props.mode === "hold";
  const cooling = props.cooldown > 0;
  return (
    <Pressable
      testID="kitchen-button"
      accessibilityLabel={hold ? "At the net. Tap to move back" : "Back court. Tap to rush the net"}
      onPress={props.onPress}
      disabled={cooling}
      style={[styles.kitchenBtn, hold ? styles.kitchenBtnBack : styles.kitchenBtnHold, cooling && styles.kitchenBtnCooling, props.pulse && styles.kitchenBtnPulse]}
    >
      {/* Shows the ACTION a tap performs; the small dot row shows where we are now. */}
      <Text style={[styles.kitchenBtnText, hold && styles.kitchenBtnTextBack]} testID="kitchen-button-state">
        {hold ? "BACK ▼" : "NET ▲"}
      </Text>
      <Text style={[styles.kitchenBtnNow, hold && styles.kitchenBtnTextBack]} testID="kitchen-button-now">
        {hold ? "● at net" : "● back"}
      </Text>
      {cooling ? (
        <View style={styles.kitchenCdTrack}>
          <View style={[styles.kitchenCdFill, { width: `${Math.round(props.cooldown * 100)}%` }]} />
        </View>
      ) : null}
    </Pressable>
  );
});

// LOB arm button: tap arms my next strike as a lob; tap again to clear.
const LobButton = memo(function LobButton(props: { armed: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      testID="lob-button"
      accessibilityLabel={props.armed ? "Lob armed. Tap to cancel" : "Arm a lob for my next shot"}
      onPress={props.onPress}
      style={[styles.kitchenBtn, props.armed ? styles.lobArmed : styles.kitchenBtnBack]}
    >
      <Text style={[styles.kitchenBtnText, !props.armed && styles.kitchenBtnTextBack]} testID="lob-button-state">LOB</Text>
      <Text style={[styles.kitchenBtnNow, !props.armed && styles.kitchenBtnTextBack]}>{props.armed ? "● ARMED" : "tap to arm"}</Text>
    </Pressable>
  );
});

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
  playerName: string | null; // null = identity not loaded yet
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
        {props.playerName !== null ? (
          <Text style={styles.serveLabel} numberOfLines={1} testID="serve-label">
            {props.servingNear ? `${props.playerName} serves` : "Rival serves"} · {props.playerName} {props.near} · Rival {props.far}
            {props.doubles ? "" : "  · Singles"}
          </Text>
        ) : null}
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
  // null until loaded from storage — the HUD never flashes a placeholder name.
  const [identity, setIdentity] = useState<{ playerName: string; teamName: string } | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  // LOADING COVER: held until the court image has decoded AND a first frame
  // has been drawn; the sim does not run underneath it.
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  readyRef.current = ready;
  const onCourtReady = useCallback(() => {
    requestAnimationFrame(() => setReady(true));
  }, []);
  // DEV perf probe (pause/resume diagnosis): renders/s, loop work ms/frame,
  // projector rebuilds, window-size changes.
  const perf = useRef({ renders: 0, rendersPerSec: 0, workMs: 0, projBuilds: 0, sizeChanges: 0, lastW: 0, lastH: 0 });
  perf.current.renders++;
  if (__DEV__) (globalThis as any).__pwPerf = perf.current; // read by the dev pause/resume probe
  const gameOverRef = useRef(false);
  const loggedRef = useRef(false);
  const armedRef = useRef(false); // one armed swipe per physical gesture
  const gestureT0 = useRef(0); // touch-down time (ms) for the stable speed signal

  const humanSlot = useMemo(() => sim.controllers.findIndex((c) => c === "LOCAL_HUMAN"), [sim]);
  const projector = useMemo(() => {
    perf.current.projBuilds++;
    return makeProjector(width, height);
  }, [width, height]);
  if (perf.current.lastW !== width || perf.current.lastH !== height) {
    if (perf.current.lastW !== 0) perf.current.sizeChanges++;
    perf.current.lastW = width;
    perf.current.lastH = height;
  }

  useEffect(() => {
    let alive = true;
    if (SFX_AVAILABLE && SFX_ENABLED) sfx.preload().then(() => alive && setMuted(sfx.muted));
    getIdentity().then((id) => alive && setIdentity(id));
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
    let renders0 = perf.current.renders;
    let wasIdle = true;
    const loop = (t: number) => {
      const w0 = performance.now();
      if (last === 0) last = t;
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      // PAUSED (or still loading): no sim steps AND no React re-render — the
      // frozen frame stays on screen. (Root cause of the post-resume slowdown
      // was a full 60 Hz re-render of the match + overlay while paused.)
      // (__DEV__ A/B switch for the diagnosis: globalThis.__PW_LEGACY_PAUSE
      // restores the old "re-render every frame while paused" behaviour.)
      const legacy = __DEV__ && (globalThis as any).__PW_LEGACY_PAUSE && readyRef.current;
      if (legacy && pausedRef.current) {
        setFrame((f) => (f + 1) % 1000000);
        raf = requestAnimationFrame(loop);
        return;
      }
      const idle = pausedRef.current || !readyRef.current;
      if (idle) {
        if (!wasIdle) setFrame((f) => (f + 1) % 1000000); // one render to show the pause state
        wasIdle = true;
        acc = 0;
        fpsAcc = 0;
        fpsCount = 0;
        raf = requestAnimationFrame(loop);
        return;
      }
      wasIdle = false;
      fpsAcc += dt;
      fpsCount++;
      if (fpsAcc >= 0.5) {
        setFps(Math.round(fpsCount / fpsAcc));
        perf.current.rendersPerSec = Math.round((perf.current.renders - renders0) / fpsAcc);
        renders0 = perf.current.renders;
        fpsAcc = 0;
        fpsCount = 0;
      }
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
      setFrame((f) => (f + 1) % 1000000);
      perf.current.workMs = perf.current.workMs * 0.9 + (performance.now() - w0) * 0.1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim, config, difficulty, humanSlot]);

  // ---- Input: arm on finger-DOWN once past threshold, refresh while held ----
  // speed = average px/s since touch-down with a clamped minimum elapsed time
  // (stable; a tiny instant flick can't read as fast), capped.
  const toInput = useCallback((tx: number, ty: number) => {
    const len = Math.hypot(tx, ty);
    const elapsed = Math.max(INPUT.SPEED_MIN_ELAPSED, (Date.now() - gestureT0.current) / 1000);
    const speed = Math.min(INPUT.SPEED_CAP, len / elapsed);
    return { dx: tx, dy: ty, power: Math.min(1, len / INPUT.POWER_MAX_PX), tap: len < INPUT.MIN_SWIPE, len, speed };
  }, []);

  // A swipe that starts anywhere on the tactical row is not a game swipe.
  const onKitchenBtn = useCallback(
    (x: number, y: number) =>
      x >= width - KB_RIGHT - ROW_W - 8 && y >= height - insets.bottom - KB_BOTTOM - KB_SIZE - 8 && y <= height - insets.bottom - KB_BOTTOM + 8,
    [width, height, insets.bottom],
  );
  const onGestureBegin = useCallback(() => {
    gestureT0.current = Date.now();
  }, []);

  const onGestureUpdate = useCallback(
    (tx: number, ty: number, startX: number, startY: number) => {
      if (startX < EDGE_MARGIN || startX > width - EDGE_MARGIN) return;
      if (onKitchenBtn(startX, startY)) return;
      const i = toInput(tx, ty);
      if (i.len < INPUT.MIN_SWIPE) return; // not yet a clear swipe
      if (!armedRef.current) {
        armedRef.current = true;
        sim.armSwipe(i);
      } else {
        sim.updateArmedSwipe(i);
      }
    },
    [sim, width, toInput, onKitchenBtn],
  );

  const onGestureEnd = useCallback(
    (tx: number, ty: number, startX: number, startY: number) => {
      const i = toInput(tx, ty);
      if (armedRef.current) {
        sim.releaseSwipe(i); // finalise the armed snapshot (or no-op if consumed)
      } else if (startX >= EDGE_MARGIN && startX <= width - EDGE_MARGIN && !onKitchenBtn(startX, startY)) {
        sim.submitSwipe(i); // a tap / short swipe (serve release / no-op)
      }
      armedRef.current = false;
    },
    [sim, width, toInput, onKitchenBtn],
  );

  const resetArmed = useCallback(() => {
    armedRef.current = false;
  }, []);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin(() => {
          runOnJS(onGestureBegin)();
        })
        .onUpdate((e) => {
          runOnJS(onGestureUpdate)(e.translationX, e.translationY, e.x - e.translationX, e.y - e.translationY);
        })
        .onEnd((e) => {
          runOnJS(onGestureEnd)(e.translationX, e.translationY, e.x - e.translationX, e.y - e.translationY);
        })
        .onFinalize(() => {
          runOnJS(resetArmed)();
        }),
    [onGestureUpdate, onGestureEnd, resetArmed, onGestureBegin],
  );

  const rematch = () => {
    analytics.track("rematch_selected", { difficulty });
    loggedRef.current = false;
    armedRef.current = false;
    setMatch(buildMatch(difficulty, singles));
    setPaused(false);
  };
  // Re-assert immersive mode on resume (a system-bar reveal during pause is
  // otherwise never re-hidden, leaving a resized window behind the game).
  useEffect(() => {
    if (!paused && Platform.OS === "android") NavigationBar.setVisibilityAsync("hidden").catch(() => {});
  }, [paused]);
  const goMenu = () => router.replace("/");
  const toggleKitchen = useCallback(() => {
    if (!pausedRef.current) sim.toggleKitchenMode();
  }, [sim]);
  const toggleLob = useCallback(() => {
    if (!pausedRef.current) sim.toggleLob();
  }, [sim]);
  const toggleMute = () => sfx.toggleMuted().then(setMuted);

  const gameOver = sim.phase === "game_over";
  gameOverRef.current = gameOver;
  const nearWon = sim.winner === "near";
  const letBounceCue = !paused && !gameOver && sim.humanMustLetBounce();
  const smashCue = !paused && !gameOver && !letBounceCue && sim.humanSmashCue();
  const dinkCue = !paused && !gameOver && !letBounceCue && !smashCue && sim.humanInDinkRange();
  // Right after MY lob: pulse "BACK ▼" (a hint only — no automatic retreat).
  const lobBackPulse =
    !paused && !gameOver && sim.kitchenMode === "hold" && sim.lastHumanShot?.type === "lob" && sim.time - sim.lastHumanShot.time < 1.4
      ? Math.floor(sim.time * 5) % 2 === 0
      : false;
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
      <Fullscreen />
      <GestureDetector gesture={pan}>
        <View style={styles.canvasWrap}>
          <CourtRenderer sim={sim} projector={projector} width={width} height={height} frame={0} onReady={onCourtReady} />
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
        playerName={identity?.playerName ?? null}
        onPause={() => setPaused((p) => !p)}
      />

      {!gameOver && (
        <View style={[styles.tacticalRow, { bottom: insets.bottom + KB_BOTTOM }]} testID="tactical-row">
          <LobButton armed={sim.lobArmed} onPress={toggleLob} />
          <KitchenButton
            mode={sim.kitchenMode ?? "hold"}
            cooldown={Math.ceil((sim.kitchenCooldownLeft() / KITCHEN.BUTTON_COOLDOWN) * 10) / 10}
            pulse={lobBackPulse}
            onPress={toggleKitchen}
          />
        </View>
      )}

      {letBounceCue && (
        <View style={[styles.bounceCue, { bottom: insets.bottom + PILL_BASE + 50 }]} pointerEvents="none" testID="let-it-bounce-cue">
          <Text style={styles.bounceCueText}>LET IT BOUNCE</Text>
        </View>
      )}
      {dinkCue && (
        <View style={[styles.dinkCue, { bottom: insets.bottom + PILL_BASE + 50 }]} pointerEvents="none">
          <Text style={styles.dinkCueText}>Dink range — short swipe</Text>
        </View>
      )}
      {smashCue && (
        <View style={[styles.smashCue, { bottom: insets.bottom + PILL_BASE + 50 }]} pointerEvents="none" testID="smash-cue">
          <Text style={styles.smashCueText}>SMASH!</Text>
        </View>
      )}
      {shotLabel && (
        <View style={[styles.shotLabel, { bottom: insets.bottom + PILL_BASE + 84 }]} pointerEvents="none">
          <Text style={styles.shotLabelText}>{shotLabel}</Text>
        </View>
      )}
      {serveHint ? (
        <View style={[styles.hint, { bottom: insets.bottom + PILL_BASE }]} pointerEvents="none">
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
          <Text style={styles.debugText} testID="perf-probe">
            renders/s {perf.current.rendersPerSec} · work {perf.current.workMs.toFixed(1)}ms · proj {perf.current.projBuilds} · resize {perf.current.sizeChanges} · {width}x{height}
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

      {!ready && (
        <View style={styles.loadingCover} testID="loading-cover">
          <Text style={styles.loadingTitle}>PICKLEWOOD</Text>
          <ActivityIndicator color="#FBF6E9" style={{ marginTop: 16 }} />
        </View>
      )}

      {paused && !gameOver && (
        <View style={[styles.modalWrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]} testID="pause-overlay">
          <View style={styles.pauseModal}>
            <Text style={styles.modalTitle}>Paused</Text>
            <Pressable testID="resume-button" style={styles.primaryBtn} onPress={() => setPaused(false)}>
              <Text style={styles.primaryText}>Resume</Text>
            </Pressable>
            {SFX_ENABLED && (
              <Pressable testID="mute-button" style={styles.pauseSecondaryBtn} onPress={toggleMute}>
                <Text style={styles.secondaryText}>Sound: {muted ? "Off" : "On"}</Text>
              </Pressable>
            )}
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
            <Text style={styles.modalTitle} numberOfLines={1} ellipsizeMode="tail" testID="result-title">
              {nearWon ? `${identity?.playerName ?? "You"} wins!` : "Rivals win"}
            </Text>
            <Text style={styles.teamName} numberOfLines={1} ellipsizeMode="tail" testID="result-team-name">
              Team {identity?.teamName ?? ""}
            </Text>
            <Text style={styles.finalScore} testID="final-score">
              {sim.score.nearScore} – {sim.score.farScore}
            </Text>
            <View style={styles.statsRow}>
              <Stat label="Longest rally" value={sim.stats.longestRally} />
              <Stat label="Rallies" value={sim.stats.totalRallies} />
              <Stat label="My dinks" value={sim.stats.myDinks} />
              <Stat label="Match dinks" value={sim.stats.dinks} />
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
  bounceCue: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(20,26,18,0.62)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(197,160,40,0.8)" },
  bounceCueText: { color: c.accentGold, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
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
  teamName: { color: c.muted, fontSize: 14, fontWeight: "700", marginTop: 2, maxWidth: "100%" },
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
  tacticalRow: { position: "absolute", right: KB_RIGHT, flexDirection: "row", gap: KB_GAP },
  lobArmed: { backgroundColor: "rgba(214,96,60,0.95)", borderColor: "#FBF6E9" },
  kitchenBtnPulse: { borderColor: c.accentGold, borderWidth: 4, transform: [{ scale: 1.08 }] },
  smashCue: { position: "absolute", alignSelf: "center", backgroundColor: "rgba(214,96,60,0.95)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 5 },
  smashCueText: { color: "#FBF6E9", fontSize: 13, fontWeight: "900", letterSpacing: 2 },
  kitchenBtn: { width: KB_SIZE, height: KB_SIZE, borderRadius: KB_SIZE / 2, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  kitchenBtnHold: { backgroundColor: "rgba(197,160,40,0.92)", borderColor: "#FBF6E9" },
  kitchenBtnBack: { backgroundColor: "rgba(46,61,42,0.82)", borderColor: "rgba(251,246,233,0.55)" },
  kitchenBtnCooling: { opacity: 0.6 },
  kitchenBtnText: { color: "#1c2417", fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  kitchenBtnNow: { color: "#1c2417", fontSize: 8, fontWeight: "700", opacity: 0.75, marginTop: 1 },
  kitchenBtnTextBack: { color: c.onSurfaceInverse },
  kitchenCdTrack: { position: "absolute", bottom: 9, left: 14, right: 14, height: 3, borderRadius: 2, backgroundColor: "rgba(0,0,0,0.25)", overflow: "hidden" },
  kitchenCdFill: { height: 3, backgroundColor: "#FBF6E9" },
  loadingCover: { ...abs(), backgroundColor: c.surfaceInverse, alignItems: "center", justifyContent: "center" },
  loadingTitle: { color: c.accentGold, fontSize: 30, fontWeight: "900", letterSpacing: 6 },
  rotate: { flex: 1, backgroundColor: c.surfaceInverse, alignItems: "center", justifyContent: "center", padding: 32 },
  rotateEmoji: { fontSize: 48, marginBottom: 16 },
  rotateText: { color: c.onSurfaceInverse, fontSize: 18, fontWeight: "600", textAlign: "center" },
}));

function abs() {
  return { position: "absolute" as const, top: 0, left: 0, right: 0, bottom: 0 };
}
