import { COURT, isInsideCourt, serviceBoxFor, teamOfY } from "../config/court";
import { DIFFICULTY_TABLE, PARTNER_DIFFICULTY, PERSONALITY_BIAS, type AIParams } from "../config/ai";
import { HUMAN, KITCHEN, MATCH, PHYS, PLAYER, SHOTS, INPUT, TACTIC, TWO_BOUNCE } from "../config/tuning";
import {
  type MatchConfig,
  type MatchFormat,
  buildMatchConfig,
} from "../config/matchConfig";
import { NEUTRAL_STATS, applyChemistry, normaliseStats, type StatMultipliers } from "../config/profiles";
import { RNG } from "../core/rng";
import { decideServe, decideShot } from "./aiController";
import { updateMovement, STRIKE_MAX_Z, type MovementInfo } from "./movement";
import { RuleManager, type ServeContext } from "./rules";
import { ScoreManager } from "./score";
import { solveShot } from "./shots";
import { firstBouncePoint, predictOverhead } from "./physics";
import type {
  BallState,
  BounceEvent,
  ContactEvent,
  ControllerType,
  CourtSide,
  Difficulty,
  FaultEvent,
  InputTraceEntry,
  MatchPhase,
  MatchStats,
  Personality,
  PlayerState,
  ScoreState,
  ShotType,
  Team,
} from "./types";

export type KitchenMode = "hold" | "retreat";

export interface SwipeInput {
  dx: number; // screen swipe delta x (px)
  dy: number; // screen swipe delta y (px, up is negative)
  power: number; // 0..1
  tap: boolean; // true if below movement threshold (serve release)
  speed?: number; // px/s stable average gesture speed (0/undefined = slow)
}

export interface SimOptions {
  seed: number;
  difficulty: Difficulty;
  difficulties?: Difficulty[]; // optional per-slot override (headless tests)
  controllers?: ControllerType[]; // 4 slots, default human + 3 AI
  personalities?: (Personality | undefined)[]; // 4 slots
  names?: string[];
  partnerDifficulty?: Difficulty; // fixed level for the human's AI partner
}

export interface FloatingMessage {
  text: string;
  x: number;
  y: number;
  color: "success" | "error" | "warning" | "info";
  life: number;
}

export class GameSimulation {
  rng: RNG;
  time = 0;
  ball: BallState;
  players: PlayerState[] = [];
  score: ScoreState;
  phase: MatchPhase = "waiting_serve";
  stats: MatchStats = {
    rallyCount: 0,
    longestRally: 0,
    totalRallies: 0,
    dinks: 0,
    myDinks: 0,
    kitchenFaults: 0,
    pointsPlayed: 0,
  };

  difficulty: Difficulty;
  controllers: ControllerType[];
  personalities: (Personality | undefined)[];

  // §11 architecture: the match is launched from DATA. The engine never
  // inspects matchType — it is mode-agnostic.
  config: MatchConfig;
  format: MatchFormat;
  statNormalization: boolean;
  pointsToWin: number;
  winBy: number;

  // Contact events (one per real strike) + dev-only input/contact trace.
  private contactEvents: ContactEvent[] = [];
  private contactCursor = 0;
  private contactId = 0;
  private bounceEvents: BounceEvent[] = [];
  private bounceCursor = 0;
  private bounceId = 0;
  private armHeld = false; // a swipe is armed and the finger is still down
  private trace: InputTraceEntry[] = [];

  serveCtx: ServeContext = { active: false, servingTeam: "near", box: { xLo: 0, xHi: 0, yLo: 0, yHi: 0 } };
  rallyStrikeCount = 0;
  crossedNetSinceHit = false;
  serverSlot: number | null = null;

  private pointResetTimer = 0;
  private serveTimer = 0;
  private pendingInput: SwipeInput | null = null;
  private pendingInputTime = -1;
  private canHit: boolean[] = [false, false, false, false];
  private strikerSlot: number | null = null;
  private humanMinDist = Infinity; // closest approach seen while human is striker
  private humanLastDist = Infinity; // previous tick distance (to detect receding)
  // AI read "that ball is going OUT — let it go" (decided once per commit).
  private aiLetGo: boolean[] = [false, false, false, false];

  messages: FloatingMessage[] = [];
  lastFault: FaultEvent | null = null;
  winner: Team | null = null;
  // KITCHEN BUTTON (near team): "hold" = advance to / hold just behind the
  // kitchen line once the two-bounce phase allows it (the default, identical to
  // automatic play); "retreat" = stay back toward the baseline. This only
  // positions players relative to the line — it never means "step into the
  // kitchen"; RuleManager alone decides re-establishment.
  // null = automatic (all-AI near team, e.g. headless parity batteries). A near
  // team with a local human starts in "hold" (identical to the previous
  // automatic advance for the human + CLUB partner).
  kitchenMode: KitchenMode | null = null;
  private kitchenModeChangedAt = -10;
  lastHumanShot: { type: ShotType; time: number } | null = null; // for the HUD label
  // Predicted landing spot of the current shot during the two-bounce phase
  // (for the "let it bounce" cue). Set once per strike.
  bounceCueSpot: { x: number; y: number } | null = null;
  // LOB ARM (near human): the next legal strike by ME is a lob. Clears on my
  // team's next strike (mine or my partner's), at point end, or a second tap.
  lobArmed = false;
  // Shot type of the last real strike (AI reads an incoming smash → block).
  lastShotType: ShotType | null = null;
  // GAME FEEL (renderer reads these; updated in place, no per-frame allocation):
  // the last REAL contact (one flash + ball squash per contact) and the last
  // point result (celebrate / frustration reactions).
  lastContact = { time: -10, x: 0, y: 0, z: 0, power: 0, miss: false };
  lastPoint = { time: -10, winner: null as Team | null };
  // Highest the ball has flown since the last strike (a "high ball" for smash).
  apexSinceHit = 0;
  // Sim time of the last court bounce (two-bounce visibility delay).
  private lastBounceAt = -10;
  // Last real strike, for the movement net-transition read (reused object).
  private lastShotInfo: { type: ShotType; landY: number | null; miss: boolean } = { type: "serve", landY: null, miss: false };
  // A human swipe read as a clear airborne volley in the two-bounce phase;
  // executed (and faulted by RuleManager) on the next step.
  private volleyAttempt = false;
  // SMASH CUE + LATCH (human only). smashPredicted is computed ONCE per
  // opponent strike (predictOverhead); smashLatched = a firm swipe made while
  // the cue showed — it is not expired by SWIPE_BUFFER_TIME and clears on
  // contact, bounce, any strike or point end. All-AI matches never set either.
  private humanSlot = -1;
  private smashPredicted = false;
  smashLatched = false;

  constructor(cfg: MatchConfig | SimOptions) {
    const config = isMatchConfig(cfg) ? cfg : optionsToConfig(cfg);
    this.config = config;
    this.format = config.format;
    this.statNormalization = config.statNormalization;
    this.pointsToWin = config.ruleModifiers?.pointsToWin ?? MATCH.POINTS_TO_WIN;
    this.winBy = config.ruleModifiers?.winBy ?? MATCH.WIN_BY;
    this.rng = new RNG(config.seed);

    // Build players from DATA. Near team first (slots 0..n-1), then far team.
    // Within a team the first player takes the RIGHT service court, the second
    // the LEFT. Team size comes from the config (1 = singles, 2 = doubles) —
    // nothing assumes exactly four players.
    const sides: CourtSide[] = ["R", "L"];
    let slot = 0;
    const makePlayers = (players: { controller: ControllerType; name: string; profileId?: Difficulty; personality?: Personality; stats?: StatMultipliers; chemistry?: number }[], team: Team): PlayerState[] =>
      players.map((pc, i) => ({
        slot: slot++,
        team,
        controller: pc.controller,
        name: pc.name,
        colorKey: team === "near" ? (i === 0 ? "teamYou" : "teamPartner") : "teamRival",
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        courtSide: sides[i] ?? "R",
        isServing: false,
        inKitchen: false,
        touchingKitchenLine: false,
        feetEstablished: true,
        wasInKitchen: false,
        momentumTimer: 0,
        reestablishTimer: 0,
        lastHitTime: -10,
        reactionUntil: 0,
        committedToBall: false,
        difficulty: pc.controller === "AI" ? pc.profileId : undefined,
        personality: pc.personality,
        stats: normaliseStats(pc.stats, this.statNormalization),
        chemistry: pc.chemistry ?? 1,
        swingCue: -10,
        windUpCue: -10,
      }));

    this.players = [...makePlayers(config.near.players, "near"), ...makePlayers(config.far.players, "far")];
    this.controllers = this.players.map((p) => p.controller);
    this.humanSlot = this.controllers.findIndex((c) => c === "LOCAL_HUMAN");
    if (this.players.some((p) => p.team === "near" && p.controller === "LOCAL_HUMAN")) this.kitchenMode = "hold";
    this.personalities = this.players.map((p) => p.personality);
    // Nominal match difficulty (the opponents') for the overlay / analytics.
    this.difficulty = config.far.players.find((p) => p.profileId)?.profileId ?? "CLUB";

    // Sensible ready positions so the very first frame doesn't snap from (0,0).
    for (const p of this.players) {
      p.x = this.sideX(p.team, p.courtSide);
      p.y = p.team === "near" ? COURT.LENGTH - PLAYER.RECOVER_DEPTH_BASELINE : PLAYER.RECOVER_DEPTH_BASELINE;
      p.targetX = p.x;
      p.targetY = p.y;
    }

    this.ball = {
      x: COURT.CENTER_X,
      y: COURT.LENGTH - 2,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      inPlay: false,
      lastHitBy: null,
      lastHitTeam: null,
      bouncesSinceHit: 0,
      bounceSideCount: 0,
      currentSide: "near",
      totalBounces: 0,
      crossedNetSinceHit: false,
      lastBounce: null,
      trail: [],
    };

    const firstServer = config.startingScore?.servingTeam ?? "near";
    this.score = ScoreManager.initial(firstServer, this.format);
    if (config.startingScore) {
      this.score.nearScore = config.startingScore.near;
      this.score.farScore = config.startingScore.far;
      this.score.servingTeam = config.startingScore.servingTeam;
      if (config.startingScore.serverNumber) this.score.serverNumber = config.startingScore.serverNumber;
    }
    this.setupServe();
  }

  private paramsFor(slot: number): AIParams {
    const p = this.players[slot];
    return applyChemistry(DIFFICULTY_TABLE[p.difficulty ?? this.difficulty], p.chemistry);
  }

  // The slot of a team's partner (the other player on the same team). In
  // singles there is none, so it returns the player's own slot.
  private partnerSlot(slot: number): number {
    const team = this.players[slot].team;
    return this.players.find((p) => p.team === team && p.slot !== slot)?.slot ?? slot;
  }

  // On a side-out, the incoming serving team's player currently in their
  // TEAM-RELATIVE right court becomes the server (singles: the single player).
  private pickServerSlot(team: Team): number {
    const right = this.players.find((p) => p.team === team && p.courtSide === "R");
    return (right ?? this.players.find((p) => p.team === team)!).slot;
  }

  // ---- Serve setup ---------------------------------------------------------
  setupServe() {
    this.phase = "waiting_serve";
    this.serveTimer = 0;
    this.rallyStrikeCount = 0;
    this.crossedNetSinceHit = false;
    this.stats.rallyCount = 0;
    this.ball.inPlay = false;
    this.ball.trail = [];
    for (const p of this.players) {
      p.inKitchen = false;
      p.touchingKitchenLine = false;
      p.wasInKitchen = false;
      p.feetEstablished = true;
      p.momentumTimer = 0;
      p.reestablishTimer = 0;
      p.isServing = false;
      p.committedToBall = false;
      p.netIntent = false;
      p.netDecidedFor = -1;
    }

    if (this.serverSlot === null) this.serverSlot = this.pickServerSlot(this.score.servingTeam);
    const server = this.players[this.serverSlot];
    server.isServing = true;

    // Singles serve rule: serve from the RIGHT when the server's score is even,
    // LEFT when odd (there is no server number / partner swap). One player, so
    // set their service court directly from the score each serve.
    if (this.format === "singles") server.courtSide = ScoreManager.serveSide(this.score);

    // Aim the server at their serve spot BEHIND the baseline, but let them WALK
    // there (don't snap). The partner and BOTH receivers keep their positions
    // (not reset each point); automatic movement flows everyone to ready spots.
    server.targetX = this.sideX(server.team, server.courtSide);
    server.targetY =
      server.team === "near"
        ? COURT.LENGTH + PLAYER.SERVE_STANDOFF
        : -PLAYER.SERVE_STANDOFF;

    // The ball sits with the server until the serve is struck (tracked each tick
    // while waiting), so it follows them as they walk into position.
    this.ball.x = server.x;
    this.ball.y = server.y;
    this.ball.z = 0;
    this.ball.vx = this.ball.vy = this.ball.vz = 0;
  }

  // Global x for a TEAM-RELATIVE court side.
  private sideX(team: Team, side: CourtSide): number {
    const globalRight = (team === "near") === (side === "R");
    return globalRight ? COURT.WIDTH * 0.72 : COURT.WIDTH * 0.28;
  }

  // ---- Input ---------------------------------------------------------------
  // Finger-up / tap path: a single swipe that lives for the short deterministic
  // buffer window (used by headless tests and quick taps/serves).
  submitSwipe(input: SwipeInput) {
    this.pendingInput = input;
    this.pendingInputTime = this.time;
    this.armHeld = false;
    this.pushTrace("received", input, this.strikerSlot);
    this.maybeWindUp(input);
    this.volleyAttempt = this.isClearAirborneVolley(input);
    this.smashLatched = this.latchWorthy(input);
  }

  // Finger-DOWN path (low latency): arm ONE swipe for the gesture as soon as it
  // clearly passes the threshold. The snapshot is refreshed via updateArmedSwipe
  // while the finger stays down (so a long swipe still builds full power), and
  // it will not expire until release. Only one armed input per gesture.
  armSwipe(input: SwipeInput) {
    this.pendingInput = input;
    this.pendingInputTime = this.time;
    this.armHeld = true;
    this.pushTrace("received", input, this.strikerSlot);
    this.pushTrace("buffered", input, this.strikerSlot);
    this.maybeWindUp(input);
    this.volleyAttempt = this.isClearAirborneVolley(input);
    this.smashLatched = this.latchWorthy(input);
  }

  // A FIRM swipe (fast or power ≥ DRIVE_POWER_MIN) made while either smash
  // cue phase shows latches (human only).
  private latchWorthy(input: SwipeInput): boolean {
    if (input.tap || this.humanSlot < 0) return false;
    const firm = (input.speed ?? 0) >= INPUT.DRIVE_SPEED_MIN || input.power >= INPUT.DRIVE_POWER_MIN;
    return firm && this.humanSmashCuePhase() !== null;
  }

  // Drop a latched swipe (bounce / strike / point end): the latch and its
  // pending swipe clear together, and the held gesture can't re-arm it.
  private clearSmashLatch() {
    this.smashLatched = false;
    this.pendingInput = null;
    this.armHeld = false;
  }

  // TWO-BOUNCE (human, serve return / third shot only): is this fresh swipe a
  // CLEAR airborne volley? The opponents' unbounced ball must already be within
  // realistic strike reach AND more than the grace window from its bounce.
  // Otherwise (out of reach, or just before it lands) the swipe stays buffered
  // as an intended groundstroke — the existing forgiving behaviour.
  private isClearAirborneVolley(input: SwipeInput): boolean {
    if (input.tap || this.phase !== "rally" || this.rallyStrikeCount >= 3) return false;
    const slot = this.controllers.findIndex((c) => c === "LOCAL_HUMAN");
    if (slot < 0) return false;
    const h = this.players[slot];
    const b = this.ball;
    if (!b.inPlay || b.lastHitTeam === h.team || b.bouncesSinceHit > 0 || b.z <= 0.05 || b.z > STRIKE_MAX_Z) return false;
    if (teamOfY(b.y) !== h.team || this.time - h.lastHitTime <= PLAYER.HIT_COOLDOWN) return false;
    if (Math.hypot(b.x - h.x, b.y - h.y) > PLAYER.REACH * PLAYER.REACH_MULT * h.stats.reach) return false;
    const tBounce = (b.vz + Math.sqrt(b.vz * b.vz + 2 * PHYS.GRAVITY * b.z)) / PHYS.GRAVITY;
    return tBounce > TWO_BOUNCE.GRACE;
  }

  // Refresh the armed swipe's dx/dy/power from the latest finger position.
  updateArmedSwipe(input: SwipeInput) {
    if (!this.armHeld || !this.pendingInput) return;
    this.pendingInput.dx = input.dx;
    this.pendingInput.dy = input.dy;
    this.pendingInput.power = input.power;
    this.pendingInput.speed = input.speed;
    if (!this.smashLatched) this.smashLatched = this.latchWorthy(this.pendingInput);
  }

  // Finger-up: finalise the armed snapshot and start the deterministic buffer
  // from NOW. If the armed swipe was already consumed mid-gesture, do nothing.
  releaseSwipe(input: SwipeInput) {
    if (!this.armHeld) return; // already consumed, or never armed
    this.pendingInput = input;
    this.pendingInputTime = this.time;
    this.armHeld = false;
    if (!this.smashLatched) this.smashLatched = this.latchWorthy(input);
  }

  private maybeWindUp(input: SwipeInput) {
    if (!input.tap && (this.humanCanHit() || this.humanIsServer())) {
      const humanSlot = this.controllers.findIndex((c) => c === "LOCAL_HUMAN");
      if (humanSlot >= 0) this.players[humanSlot].windUpCue = this.time;
    }
  }

  // Dev-only circular trace (last 20 input/contact events). Cheap to record;
  // the match screen only RENDERS it behind a dev toggle, so prod is unaffected.
  private pushTrace(kind: InputTraceEntry["kind"], input: SwipeInput | null, strikerSlot: number | null) {
    this.trace.push({
      time: this.time,
      kind,
      dx: input?.dx ?? 0,
      dy: input?.dy ?? 0,
      power: input?.power ?? 0,
      strikerSlot,
      contactTime: kind === "consumed" ? this.time : undefined,
      lastHitBy: this.ball.lastHitBy,
    });
    if (this.trace.length > 20) this.trace.shift();
  }

  getInputTrace(): InputTraceEntry[] {
    return this.trace.slice();
  }

  // Contact events recorded since the last call (one per real strike). The
  // renderer/UI drains these to fire feedback once, on the contact frame.
  consumeContactEvents(): ContactEvent[] {
    const out = this.contactEvents.slice(this.contactCursor);
    this.contactCursor = this.contactEvents.length;
    return out;
  }

  // Bounce events recorded since the last call (one per real court bounce).
  consumeBounceEvents(): BounceEvent[] {
    const out = this.bounceEvents.slice(this.bounceCursor);
    this.bounceCursor = this.bounceEvents.length;
    return out;
  }

  // For tests: is a swipe currently buffered (not yet consumed or expired)?
  hasBufferedSwipe(): boolean {
    return this.pendingInput !== null;
  }

  // For tests: resolve one point with a given rally winner (no physics needed),
  // then advance to the next serve. Exercises the real scoring + serve-rotation
  // path so tests can assert the actual serving PLAYER and SIDE deterministically.
  debugPlayPoint(rallyWinner: Team) {
    const faultingTeam: Team = rallyWinner === "near" ? "far" : "near";
    this.registerFault({
      reason: "OUT",
      faultingTeam,
      x: COURT.CENTER_X,
      y: COURT.NET_Y,
      message: "debug point",
    });
    if (this.phase !== "game_over") {
      this.pointResetTimer = 0;
      this.setupServe();
    }
  }

  // Toggle the near team's kitchen mode. Ignored during the short cooldown.
  toggleKitchenMode(): boolean {
    if (this.kitchenCooldownLeft() > 0) return false;
    this.kitchenMode = this.kitchenMode === "retreat" ? "hold" : "retreat";
    this.kitchenModeChangedAt = this.time;
    return true;
  }
  // Tap LOB: arm my next strike as a lob; a second tap clears it.
  toggleLob(): boolean {
    if (this.phase === "game_over") return false;
    this.lobArmed = !this.lobArmed;
    return this.lobArmed;
  }
  // Is the human in a legal SMASH window right now (high, hittable, legal)?
  humanSmashWindow(): boolean {
    if (this.phase !== "rally" || !this.humanCanHit() || this.lobArmed) return false;
    return this.highBall() && this.humanStrikeLegal(this.players[this.strikerSlot!]);
  }
  // SMASH CUE: a high ball is coming down to ME (not yet necessarily in
  // reach) and striking it would be legal — shown briefly ahead of contact.
  humanSmashCue(): boolean {
    const slot = this.controllers.findIndex((c) => c === "LOCAL_HUMAN");
    if (slot < 0 || this.phase !== "rally" || this.lobArmed) return false;
    const h = this.players[slot];
    const b = this.ball;
    if (b.lastHitTeam === h.team || b.bouncesSinceHit > 0 || b.vz >= 0) return false;
    if (b.z < TACTIC.SMASH_MIN_Z || this.apexSinceHit < TACTIC.SMASH_MIN_APEX) return false;
    if (teamOfY(b.y) !== h.team && Math.abs(b.y - COURT.NET_Y) > 4) return false;
    if (Math.hypot(b.x - h.x, b.y - h.y) > PLAYER.REACH * PLAYER.REACH_MULT * h.stats.reach * 1.8) return false;
    if (!smashPositionOk(h)) return false;
    return this.humanStrikeLegal(h);
  }
  // TWO-PHASE SMASH CUE (human only, display + latch gate):
  //   "smash" — the existing smash window is open (humanSmashWindow()).
  //   "ready" — the opponents' high ball was predicted (once, at their strike)
  //             to come down through smash height in my strike zone, it has
  //             not bounced, and I'm within SMASH_MAX_NET_DIST of the net.
  humanSmashCuePhase(): "ready" | "smash" | null {
    if (this.humanSmashWindow()) return "smash";
    if (!this.smashPredicted || this.phase !== "rally" || this.lobArmed || this.ball.bouncesSinceHit > 0) return null;
    // Once the ball has dropped below smash height, the READY phase is over.
    if (this.ball.vz < 0 && this.ball.z < TACTIC.SMASH_MIN_Z) return null;
    const h = this.players[this.humanSlot];
    if (!smashPositionOk(h)) return null;
    return "ready";
  }
  // A genuinely HIGH ball: at smash height and descending from a high arc.
  highBall(): boolean {
    return this.ball.bouncesSinceHit === 0 && this.ball.z >= TACTIC.SMASH_MIN_Z && this.ball.vz < 0 && this.apexSinceHit >= TACTIC.SMASH_MIN_APEX;
  }
  // Seconds of kitchen-button cooldown remaining (0 = available).
  kitchenCooldownLeft(): number {
    return Math.max(0, KITCHEN.BUTTON_COOLDOWN - (this.time - this.kitchenModeChangedAt));
  }

  // Public: is the human currently able to strike?
  humanCanHit(): boolean {
    const humanSlot = this.controllers.findIndex((c) => c === "LOCAL_HUMAN");
    if (humanSlot < 0) return false;
    return this.canHit[humanSlot] && this.strikerSlot === humanSlot;
  }
  // Would striking the ball right now be legal for this player (RuleManager)?
  private humanStrikeLegal(p: PlayerState): boolean {
    return RuleManager.validateStrike(this.ball, p, this.rallyStrikeCount + 1, false) === null;
  }
  humanIsServer(): boolean {
    const humanSlot = this.controllers.findIndex((c) => c === "LOCAL_HUMAN");
    return this.serverSlot === humanSlot && this.phase === "waiting_serve";
  }

  // ---- Main fixed-timestep step -------------------------------------------
  step(dt = MATCH.FIXED_DT) {
    this.time += dt;

    // decay floating messages
    this.messages = this.messages.filter((m) => (m.life -= dt) > 0);

    // Expire a stale swipe: an input only stays valid for a short deterministic
    // window, so an early swipe can never fire seconds later. EXCEPTION: while
    // the human is the designated striker of a LEGALLY hittable ball (within
    // reach, legal height, no rule violation) the swipe stays alive — it must
    // not expire just because player and ball are moving together.
    if (
      this.pendingInput &&
      !this.armHeld &&
      this.time - this.pendingInputTime > INPUT.SWIPE_BUFFER_TIME &&
      !this.smashLatched &&
      !(this.phase === "rally" && this.humanCanHit() && this.humanStrikeLegal(this.players[this.strikerSlot!]))
    ) {
      this.pushTrace("expired", this.pendingInput, this.strikerSlot);
      this.pendingInput = null;
    }

    if (this.phase === "game_over") return;

    if (this.phase === "point_over") {
      this.pointResetTimer -= dt;
      if (this.pointResetTimer <= 0) {
        if (ScoreManager.isGameOver(this.score, this.pointsToWin, this.winBy)) {
          this.phase = "game_over";
        } else {
          this.setupServe();
        }
      }
      return;
    }

    // Update kitchen flags + timers for everyone.
    for (const p of this.players) {
      const wasContact = RuleManager.isKitchenContact(p);
      RuleManager.updateKitchenFlags(p);
      // Re-establishment (line contact counts as being in the kitchen; the timer
      // only runs when fully outside AND off the line).
      RuleManager.tickKitchenRecovery(p, dt);
      // Momentum: a fault if a just-volleyed player's momentum carries them into
      // the NVZ OR onto its line.
      if (p.momentumTimer > 0) {
        p.momentumTimer -= dt;
        if (!wasContact && RuleManager.isKitchenContact(p)) {
          this.registerFault({
            reason: "KITCHEN_MOMENTUM",
            faultingTeam: p.team,
            x: p.x,
            y: p.y,
            message: "Kitchen fault — momentum into the NVZ",
          });
          return;
        }
      }
    }

    // Handle serving.
    if (this.phase === "waiting_serve") {
      // players settle into position first
      this.updateMovementAndReach(dt);
      const server = this.players[this.serverSlot!];
      // The ball stays in the server's hand until struck.
      this.ball.x = server.x;
      this.ball.y = server.y;
      this.ball.z = 0;
      // The server must have walked into position behind the baseline.
      const inPosition = Math.hypot(server.targetX - server.x, server.targetY - server.y) < 0.6;
      if (server.controller === "LOCAL_HUMAN") {
        // Serve on RELEASE (full swipe) — a still-held armed swipe waits.
        if (this.pendingInput && !this.armHeld && inPosition) {
          const consumed = this.pendingInput;
          this.executeServe(consumed);
          this.pendingInput = null;
          this.pushTrace("consumed", consumed, server.slot);
        }
      } else {
        this.serveTimer += dt;
        // Serve once settled AND the delay has elapsed (hard cap avoids stalls).
        if ((this.serveTimer >= MATCH.SERVE_DELAY && inPosition) || this.serveTimer >= MATCH.SERVE_DELAY * 2.5) {
          this.executeServe(null);
        }
      }
      return;
    }

    // RALLY
    // A clear human airborne volley in the two-bounce phase: execute it so the
    // authoritative RuleManager calls TWO_BOUNCE (never decided here).
    if (this.volleyAttempt) {
      this.volleyAttempt = false;
      const slot = this.controllers.findIndex((c) => c === "LOCAL_HUMAN");
      if (this.pendingInput && slot >= 0 && this.ball.bouncesSinceHit === 0) {
        const consumed = this.pendingInput;
        this.pendingInput = null;
        this.armHeld = false;
        this.pushTrace("consumed", consumed, slot);
        this.executeHumanHit(this.players[slot], consumed, 0);
        if (this.phase !== "rally") return;
      }
    }
    this.integrateBall(dt);
    if (this.phase !== "rally") return; // a fault may have ended the point

    this.updateMovementAndReach(dt);
    this.resolveStrikes();
  }

  private updateMovementAndReach(dt: number) {
    const info: MovementInfo = {
      rallyStrikeCount: this.rallyStrikeCount,
      serving: this.phase === "waiting_serve",
      serverSlot: this.serverSlot,
      apexSinceHit: this.apexSinceHit,
      lastShot: this.lastShotInfo,
      kitchenModeFor: (slot) => (this.players[slot].team === "near" ? this.kitchenMode : null),
      affinityFor: (slot) => {
        const p = this.players[slot];
        if (p.controller !== "AI") return 0.6;
        // Net-transition tendency: difficulty kitchen sense + personality rush.
        return this.paramsFor(slot).kitchenAffinity + PERSONALITY_BIAS[p.personality ?? "TACTICAL"].kitchenRush;
      },
      posErrorFor: (slot) => {
        const p = this.players[slot];
        if (p.controller !== "AI") return 0;
        return this.paramsFor(slot).positionError * 0.15;
      },
    };
    updateMovement(this.players, this.ball, info, dt);
    this.computeReach();
  }

  // Determine who can strike and designate a single striker per eligible side.
  private computeReach() {
    this.canHit = [false, false, false, false];
    this.strikerSlot = null;
    if (!this.ball.inPlay) {
      this.humanMinDist = this.humanLastDist = Infinity;
      return;
    }
    const side = teamOfY(this.ball.y);
    const requireBounce = this.rallyStrikeCount < 3;
    let best: { slot: number; d: number } | null = null;
    for (const p of this.players) {
      if (p.team !== side) continue;
      const cooldownOk = this.time - p.lastHitTime > PLAYER.HIT_COOLDOWN;
      const bounceOk = !requireBounce || this.ball.bouncesSinceHit >= 1;
      const d = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
      const reachOk = d <= PLAYER.REACH * PLAYER.REACH_MULT * p.stats.reach && this.ball.z <= STRIKE_MAX_Z;
      // Post-kitchen fairness: don't auto-designate a not-yet-re-established
      // player to VOLLEY an airborne ball (automatic movement must not
      // manufacture an unavoidable kitchen fault). A genuine illegal volley is
      // still faulted by RuleManager if one is executed.
      const airborneOk = RuleManager.eligibleForAirborneVolley(p, this.ball);
      if (cooldownOk && bounceOk && reachOk && airborneOk) {
        this.canHit[p.slot] = true;
        if (!best || d < best.d) best = { slot: p.slot, d };
      }
    }
    if (best) this.strikerSlot = best.slot;
    // Reset human contact tracking whenever the human is not the current striker.
    const humanSlot = this.controllers.findIndex((c) => c === "LOCAL_HUMAN");
    if (this.strikerSlot !== humanSlot) {
      this.humanMinDist = this.humanLastDist = Infinity;
    }
  }

  private resolveStrikes() {
    if (this.strikerSlot === null) return;
    const p = this.players[this.strikerSlot];
    if (p.controller === "LOCAL_HUMAN") {
      // Track the ball's closest approach to the player while in the hit window,
      // so a buffered swipe is executed at the BEST contact moment (not at the
      // edge of reach) and timing quality is scored by how early/late the swipe
      // was relative to that ideal contact — not by raw player-to-ball distance.
      const d = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
      if (d < this.humanMinDist) this.humanMinDist = d;
      const receding = d > this.humanLastDist + 1e-3;
      // "Not closing": the gap is no longer meaningfully shrinking (e.g. the
      // player and a slow post-bounce ball moving together). Waiting longer
      // gains nothing, so fire instead of letting the swipe expire.
      const notClosing = this.humanLastDist !== Infinity && this.humanLastDist - d < 0.02;
      this.humanLastDist = d;
      if (this.pendingInput && !this.pendingInput.tap) {
        const windowClosing =
          this.ball.z > 4.0 || d > PLAYER.REACH * PLAYER.REACH_MULT * p.stats.reach * 0.98;
        // A bounced ball that is low and falling toward its SECOND bounce must
        // be taken now.
        const lowToSecondBounce = this.ball.bouncesSinceHit >= 1 && this.ball.vz < 0 && this.ball.z < 0.9;
        const legal = this.humanStrikeLegal(p);
        // Two-bounce phase: let the required bounce be SEEN — hold a legal
        // contact for VISIBLE_DELAY after the bounce unless the ball is about
        // to leave reach (never lose the ball to the delay).
        const bounceHold =
          this.rallyStrikeCount < 3 && !windowClosing && !lowToSecondBounce && this.time - this.lastBounceAt < TWO_BOUNCE.VISIBLE_DELAY - 1e-6;
        if (!bounceHold && (receding || windowClosing || (legal && (notClosing || lowToSecondBounce)))) {
          const lateness = Math.max(0, d - this.humanMinDist);
          const consumed = this.pendingInput;
          this.executeHumanHit(p, consumed, lateness);
          this.pendingInput = null;
          this.armHeld = false;
          this.humanMinDist = this.humanLastDist = Infinity;
          this.pushTrace("consumed", consumed, p.slot);
        }
        // else: the ball is still approaching and comfortably reachable — wait a
        // tick for a cleaner contact. (The 0.28 s buffer still bounds the wait.)
      }
      return;
    }
    if (p.controller === "AI") {
      if (!p.committedToBall) {
        p.committedToBall = true;
        const prm = this.paramsFor(p.slot);
        // A high lob / pop-up has been in the air long enough to read — the
        // reaction delay is already spent watching it (makes smash windows
        // genuinely playable; everything else keeps the normal delay).
        // A very FAST incoming ball (a smash) needs more reaction time — so
        // net players rarely get a smash back while deeper players, facing a
        // bounced (slower) ball, sometimes block it. Emerges from speed.
        const spd = Math.hypot(this.ball.vx, this.ball.vy, this.ball.vz);
        const fastMult = 1 + Math.max(0, spd - TACTIC.FAST_BALL_SPEED) * TACTIC.FAST_BALL_REACTION_PER_FT;
        // The zero-reaction high-ball read applies to later rally overheads
        // only. In the two-bounce phase (serve return / third shot) a high
        // arc is still read in flight, but contact waits VISIBLE_DELAY after
        // the required bounce so the bounce is seen (never on the bounce frame).
        const twoBouncePhase = this.rallyStrikeCount < 3;
        const highRead = this.apexSinceHit >= TACTIC.SMASH_MIN_APEX;
        p.reactionUntil = this.time + (highRead ? 0 : prm.reactionDelay * fastMult);
        if (twoBouncePhase) p.reactionUntil = Math.max(p.reactionUntil, this.lastBounceAt + TWO_BOUNCE.VISIBLE_DELAY);
        // LONG-GRIND GUARD: deep into a rally (where the pressure ramp makes
        // mishits common) an unbounced ball heading OUT is let go instead of
        // being volleyed back into play, so the ramp genuinely resolves the
        // point. Normal-length rallies are unaffected.
        const fb = this.ball.bouncesSinceHit === 0 && this.rallyStrikeCount > 20 ? firstBouncePoint(this.ball) : null;
        const goingOut = !!fb && teamOfY(fb.y) === p.team && !isInsideCourt(fb.x, fb.y);
        this.aiLetGo[p.slot] = goingOut && this.rng.chance(0.35 + prm.anticipation * 0.55);
      }
      if (this.aiLetGo[p.slot]) return;
      if (this.time >= p.reactionUntil) {
        // Never take a volley the rules forbid (in/near the kitchen, or before
        // feet are re-established). A good player holds and lets it bounce.
        const prospective = RuleManager.validateStrike(this.ball, p, this.rallyStrikeCount + 1, false);
        if (prospective && prospective.reason.startsWith("KITCHEN")) return;
        const intent = decideShot(p, this.ball, {
          params: this.paramsFor(p.slot),
          bias: PERSONALITY_BIAS[p.personality ?? "TACTICAL"],
          opponents: this.players.filter((o) => o.team !== p.team),
          rng: this.rng,
          strikeNumber: this.rallyStrikeCount + 1,
          incomingShot: this.lastShotType,
          highBall: this.highBall() && smashPositionOk(p),
        });
        this.executeShot(p, intent.shotType, intent.targetX, intent.targetY, {
          accuracy: intent.accuracy,
          unforcedError: intent.unforcedError,
          flightScale: intent.flightScale,
        });
      }
    }
  }

  // ---- Ball integration ----------------------------------------------------
  private integrateBall(dt: number) {
    const b = this.ball;
    if (!b.inPlay) return;
    const px = b.x;
    const py = b.y;
    const pz = b.z;

    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.z += b.vz * dt;
    b.vz -= PHYS.GRAVITY * dt;
    if (b.z > this.apexSinceHit) this.apexSinceHit = b.z;

    b.trail.push({ x: b.x, y: b.y, z: b.z });
    if (b.trail.length > 22) b.trail.shift();

    // Net crossing.
    const crossed = (py - COURT.NET_Y) * (b.y - COURT.NET_Y) < 0;
    if (crossed) {
      const f = (COURT.NET_Y - py) / (b.y - py);
      const zAtNet = pz + (b.z - pz) * f;
      const xAtNet = px + (b.x - px) * f;
      const fault = RuleManager.checkNetCrossing(
        xAtNet,
        zAtNet,
        b.lastHitTeam ?? teamOfY(py),
        this.serveCtx.active,
      );
      if (fault) {
        // freeze ball at net for feedback
        b.z = Math.max(0, zAtNet);
        this.registerFault(fault);
        return;
      }
      this.crossedNetSinceHit = true;
      b.crossedNetSinceHit = true;
      b.bounceSideCount = 0;
      b.currentSide = teamOfY(b.y);
    }

    // Bounce.
    if (b.z <= 0 && b.vz < 0) {
      const impactSpeed = -b.vz; // downward speed at contact (before restitution)
      b.z = 0;
      b.vz = -b.vz * PHYS.BOUNCE_RESTITUTION;
      b.vx *= PHYS.BOUNCE_FRICTION;
      b.vy *= PHYS.BOUNCE_FRICTION;
      b.bouncesSinceHit++;
      b.totalBounces++;
      b.bounceSideCount++;
      b.lastBounce = { x: b.x, y: b.y, side: teamOfY(b.y) };
      this.lastBounceAt = this.time;
      this.smashPredicted = false;
      if (this.smashLatched) this.clearSmashLatch();

      // Authoritative BOUNCE event (one per court contact), separate from
      // CONTACT. Never inferred from shot type.
      this.bounceEvents.push({
        id: ++this.bounceId,
        time: this.time,
        x: b.x,
        y: b.y,
        speed: impactSpeed,
        serve: this.serveCtx.active,
      });
      if (this.bounceEvents.length > 60) {
        this.bounceEvents.shift();
        this.bounceCursor = Math.max(0, this.bounceCursor - 1);
      }

      const res = RuleManager.classifyBounce(
        b,
        this.serveCtx,
        b.bounceSideCount,
        this.crossedNetSinceHit,
      );
      if (res.serveGood) {
        this.serveCtx.active = false;
        this.pushMessage("Good serve", b.x, b.y, "success");
      }
      if (res.fault) {
        this.registerFault(res.fault);
        return;
      }
    }

    // Hard out-of-bounds safety (ball sailing far without a useful bounce).
    if (b.y < -12 || b.y > COURT.LENGTH + 12 || b.x < -10 || b.x > COURT.WIDTH + 10) {
      // Already bounced IN on the receiving side (a fast smash/drive that ran
      // away): the receiving side failed to return it — not the hitter's out.
      if (b.bounceSideCount >= 1 && b.lastBounce && b.lastBounce.side !== b.lastHitTeam) {
        this.registerFault({
          reason: "DEAD_BALL",
          faultingTeam: b.lastBounce.side,
          x: Math.max(0, Math.min(COURT.WIDTH, b.x)),
          y: Math.max(0, Math.min(COURT.LENGTH, b.y)),
          message: "Winner",
        });
        return;
      }
      this.registerFault({
        reason: this.serveCtx.active ? "SERVE_OUT" : "OUT",
        faultingTeam: b.lastHitTeam ?? teamOfY(b.y),
        x: Math.max(0, Math.min(COURT.WIDTH, b.x)),
        y: Math.max(0, Math.min(COURT.LENGTH, b.y)),
        message: "Out",
      });
      return;
    }

    // Dead ball (rolled to a stop) — the side it rests on failed to return.
    const speed = Math.hypot(b.vx, b.vy);
    if (speed < PHYS.DEAD_BALL_SPEED && b.z < 0.15 && b.bounceSideCount >= 1) {
      this.registerFault({
        reason: "DEAD_BALL",
        faultingTeam: teamOfY(b.y),
        x: b.x,
        y: b.y,
        message: "Dead ball",
      });
    }
  }

  // ---- Strike execution ----------------------------------------------------
  private executeServe(input: SwipeInput | null) {
    const server = this.players[this.serverSlot!];
    const box = serviceBoxFor(this.score.servingTeam, server.courtSide);
    this.serveCtx = { active: true, servingTeam: this.score.servingTeam, box };

    let targetX: number;
    let targetY: number;
    let accuracy = 1;
    let unforced = 0;
    if (input) {
      // Human swipe → placement within the legal box. Up = deeper, x = lateral.
      // NOTE: no hard clamp into the box — a poor serve must be able to miss.
      const t = this.humanServeTarget(input, box);
      targetX = t.x;
      targetY = t.y;
      // Serve quality: a very short swipe or an extreme angle can fault.
      const q = humanServeQuality(input);
      accuracy = q.accuracy;
      unforced = q.unforcedError;
    } else {
      const intent = decideServe(server, box, this.paramsFor(server.slot), this.rng);
      targetX = intent.targetX;
      targetY = intent.targetY;
      accuracy = intent.accuracy;
      unforced = intent.unforcedError;
    }

    this.launch(server, "serve", targetX, targetY, { accuracy, unforcedError: unforced, isServe: true });
    server.isServing = false;
    this.phase = "rally";
    this.pushMessage("Serve!", server.x, server.y, "info");
  }

  private humanServeTarget(input: { dx: number; power: number }, box: { xLo: number; xHi: number; yLo: number; yHi: number }, out = { x: 0, y: 0 }) {
    const power = Math.max(0.25, input.power);
    // deeper serve with more power (toward receiving baseline)
    const depthT = this.score.servingTeam === "near" ? 1 - power : power;
    out.y = box.yLo + (box.yHi - box.yLo) * depthT;
    out.x = (box.xLo + box.xHi) / 2 + (input.dx / INPUT.POWER_MAX_PX) * (box.xHi - box.xLo) * 0.7;
    return out;
  }

  // SERVE AIM HELPER: where my serve would land right now — follows the live
  // held swipe, else a standard swipe. null when I'm not about to serve.
  // Writes into a reused object (no per-frame allocation).
  private aimOut = { x: 0, y: 0 };
  private aimDefault = { dx: 0, power: 0.6 };
  serveAimPreview(): { x: number; y: number } | null {
    if (!this.humanIsServer()) return null;
    const server = this.players[this.serverSlot!];
    const box = serviceBoxFor(this.score.servingTeam, server.courtSide);
    const live = this.armHeld && this.pendingInput ? this.pendingInput : this.aimDefault;
    return this.humanServeTarget(live, box, this.aimOut);
  }

  private executeHumanHit(p: PlayerState, input: SwipeInput, lateness: number) {
    const power = input.power;
    // HUMAN-ONLY latch tolerance: a latched firm swipe still smashes a ball
    // slightly (≤ SMASH_LATCH_Z_TOLERANCE) below SMASH_MIN_Z.
    const latchHigh =
      this.smashLatched &&
      this.ball.bouncesSinceHit === 0 &&
      this.ball.z >= TACTIC.SMASH_MIN_Z - INPUT.SMASH_LATCH_Z_TOLERANCE &&
      this.apexSinceHit >= TACTIC.SMASH_MIN_APEX;
    const shotType = classifyHumanShot(p, input, (this.highBall() || latchHigh) && smashPositionOk(p), this.lobArmed);

    // Aim from the FULL swipe vector: lateral from dx, depth from power & shot
    // type. A downward/backward swipe (dy > 0) is a mishit — it overcooks the
    // depth (tends long/out) and is penalised in quality below.
    const tune = SHOTS[shotType];
    const len = Math.hypot(input.dx, input.dy) || 1;
    const downward = clamp01(input.dy / len); // 0 = pure up, 1 = pure down
    // Timing quality: how early/late the swipe was vs the ball's closest
    // approach (lateness), plus height, aim and swipe-direction penalties.
    // A smash is MEANT for a high ball: no height penalty, a little forgiving.
    const q = humanShotQuality(shotType === "smash" ? 0 : this.ball.z, lateness, input, shotType === "smash" ? TACTIC.SMASH_FORGIVENESS : 1);
    let depth = tune.maxDepth + (tune.minDepth - tune.maxDepth) * Math.min(1, power / 0.9);
    if (shotType === "lob") {
      // Good lob = full + on time → deep. Weak swipe or poor timing/aim → it
      // lands SHORT (sits up / gives the opponent a smash).
      depth = TACTIC.LOB_BASE_DEPTH + Math.max(0, 0.55 - power) * 12 + q.errLevel * TACTIC.LOB_SHORT_PER_ERR;
    }
    depth -= downward * 7; // backward swipe sends it long (toward/over the baseline)
    let targetY = this.depthToY(p.team, depth);
    if (shotType === "dink") {
      // A DINK lands in the opponent's KITCHEN: depth is measured from the NET
      // (1.5 ft for the softest touch → 6 ft, still inside the 7 ft NVZ).
      const fromNet = 1.5 + Math.min(1, power / INPUT.DINK_POWER_MAX) * 4.5 + downward * 7;
      targetY = p.team === "near" ? COURT.NET_Y - fromNet : COURT.NET_Y + fromNet;
    }
    const lateral = (input.dx / INPUT.POWER_MAX_PX) * 12;
    let targetX = p.x + lateral;
    // A SMASH is not kept in for you: an extreme angle can sail wide.
    const smash = shotType === "smash";
    if (!smash) targetX = Math.max(COURT.RADIUS_MARGIN, Math.min(COURT.WIDTH - COURT.RADIUS_MARGIN, targetX));

    this.lastHumanShot = { type: shotType, time: this.time };
    this.executeShot(p, shotType, targetX, targetY, {
      accuracy: q.accuracy,
      unforcedError: q.unforcedError,
      allowOut: smash,
    });
  }

  // "LET IT BOUNCE": during the two-bounce phase, the opponents' serve or
  // return is heading to the human's team and has not bounced yet — the human
  // must not volley it.
  humanMustLetBounce(): boolean {
    const slot = this.controllers.findIndex((c) => c === "LOCAL_HUMAN");
    if (slot < 0 || this.phase !== "rally") return false;
    const team = this.players[slot].team;
    return (
      this.rallyStrikeCount <= 2 &&
      this.ball.lastHitTeam !== null &&
      this.ball.lastHitTeam !== team &&
      this.ball.bouncesSinceHit === 0
    );
  }

  // Is the human currently positioned within dink range of their kitchen line?
  humanInDinkRange(): boolean {
    const slot = this.controllers.findIndex((c) => c === "LOCAL_HUMAN");
    if (slot < 0) return false;
    const p = this.players[slot];
    const kl = p.team === "near" ? COURT.NEAR_KITCHEN_Y : COURT.FAR_KITCHEN_Y;
    return Math.abs(p.y - kl) < INPUT.DINK_RANGE_FT || p.inKitchen;
  }

  // depth = ft from the RECEIVING baseline; returns a logical y for that team.
  private depthToY(hittingTeam: Team, depth: number): number {
    return hittingTeam === "near" ? depth : COURT.LENGTH - depth;
  }

  private executeShot(
    p: PlayerState,
    shotType: ShotType,
    targetX: number,
    targetY: number,
    opts: { accuracy: number; unforcedError: number; flightScale?: number; allowOut?: boolean },
  ) {
    // Validate legality at contact BEFORE launching.
    const strikeNumber = this.rallyStrikeCount + 1;
    const fault = RuleManager.validateStrike(this.ball, p, strikeNumber, false);
    if (fault) {
      this.registerFault(fault);
      return;
    }
    this.launch(p, shotType, targetX, targetY, { ...opts, isServe: false });
  }

  private launch(
    p: PlayerState,
    shotType: ShotType,
    targetX: number,
    targetY: number,
    opts: { accuracy: number; unforcedError: number; isServe: boolean; flightScale?: number; allowOut?: boolean },
  ) {
    const b = this.ball;
    const wasVolley = !opts.isServe && b.bouncesSinceHit === 0 && b.z > 0.05;

    // Pressure ramp: the longer a rally goes, the more likely a mistake — keeps
    // rallies believable, snappy (arcade pacing) and guarantees they resolve.
    // Skill (base unforcedError) still dominates early, so the better AI errs
    // less and wins more; the ramp only bites in long grinds. AI only.
    const rally = this.rallyStrikeCount;
    const pressure = opts.isServe ? 0 : Math.min(0.6, rally * 0.015 + Math.max(0, rally - 20) * 0.03);
    const effUnforced = opts.unforcedError + (opts.isServe ? 0 : p.controller === "AI" ? pressure : 0);
    const forcedMiss = effUnforced > 0 && this.rng.chance(effUnforced);

    if (forcedMiss) {
      // A genuine mishit, varied so errors aren't all the same flat net dump:
      //   net  — too flat, fails to clear the net (short)
      //   long — overcooked past the baseline (out deep)
      //   wide — sprayed outside the sideline (out wide)
      const contactZ = SHOTS[shotType].contactH;
      const dir = p.team === "near" ? -1 : 1; // toward the net
      const kind = this.rng.int(0, 3);
      if (kind === 0) {
        // NET: a flat dump that cannot clear the net.
        b.x = p.x;
        b.y = p.y + dir * 0.4;
        b.z = contactZ;
        b.vx = this.rng.noise(5);
        b.vy = dir * 16;
        b.vz = 3;
        this.finishStrike(p, shotType, wasVolley, opts.isServe, true);
        return;
      }
      // LONG or WIDE: solve a shot to an OUT target so it clears the net but
      // lands out (no in-bounds clamp). Keeps the miss believable and varied.
      const longY = this.depthToY(p.team, -2.5); // past the far baseline
      const wideX = this.rng.chance(0.5) ? -2 : COURT.WIDTH + 2;
      const missTargetX = kind === 2 ? wideX : p.x + this.rng.noise(3);
      const missTargetY = kind === 1 ? longY : this.depthToY(p.team, this.rng.range(2, 6));
      const shotM = solveShot(p.x, p.y, missTargetX, missTargetY, shotType, { accuracy: 1, clampInBounds: false });
      b.x = p.x;
      b.y = p.y + (p.team === "near" ? -0.4 : 0.4);
      b.z = shotM.contactZ;
      b.vx = shotM.vx;
      b.vy = shotM.vy;
      b.vz = shotM.vz;
      this.finishStrike(p, shotType, wasVolley, opts.isServe, true);
      return;
    }

    const shot = solveShot(p.x, p.y, targetX, targetY, shotType, {
      accuracy: opts.accuracy,
      unforcedError: 0,
      control: p.stats.control,
      flightScale: opts.flightScale,
      rng: opts.accuracy < 1 ? this.rng : undefined,
      clampInBounds: !opts.isServe && !opts.allowOut, // serves (and human smashes) may spray out
    });

    b.x = p.x;
    b.y = p.y + (p.team === "near" ? -0.4 : 0.4);
    b.z = shot.contactZ;
    b.vx = shot.vx;
    b.vy = shot.vy;
    b.vz = shot.vz;
    this.finishStrike(p, shotType, wasVolley, opts.isServe, false);
  }

  private finishStrike(
    p: PlayerState,
    shotType: ShotType,
    wasVolley: boolean,
    isServe: boolean,
    miss: boolean,
  ) {
    const b = this.ball;
    b.lastHitBy = p.slot;
    b.lastHitTeam = p.team;
    b.bouncesSinceHit = 0;
    b.bounceSideCount = 0;
    b.crossedNetSinceHit = false;
    b.inPlay = true;
    this.crossedNetSinceHit = false;

    p.lastHitTime = this.time;
    p.swingCue = this.time;
    this.lastShotType = shotType;
    this.apexSinceHit = b.z;
    const ls = this.lastShotInfo;
    ls.type = shotType; ls.miss = miss;
    ls.landY = isServe || miss ? null : firstBouncePoint(b)?.y ?? null;
    // An armed lob only ever applies to the very next strike by my team.
    if (this.lobArmed && this.players.some((h) => h.controller === "LOCAL_HUMAN" && h.team === p.team)) this.lobArmed = false;
    p.committedToBall = false;

    // A volley from outside the kitchen starts a momentum window.
    if (wasVolley && !p.inKitchen && !p.touchingKitchenLine) {
      p.momentumTimer = KITCHEN.MOMENTUM_WINDOW;
    }

    // Reset the OTHER players' commitment so they can react next.
    for (const o of this.players) if (o !== p) o.committedToBall = false;

    this.rallyStrikeCount++;
    this.stats.rallyCount = this.rallyStrikeCount;
    this.bounceCueSpot = this.rallyStrikeCount <= 2 && !miss ? firstBouncePoint(b) : null;
    // Smash cue/latch (human only): any strike clears the latch; an opponent
    // strike predicts ONCE whether its high ball comes down to me.
    if (this.smashLatched) this.clearSmashLatch();
    this.smashPredicted = this.humanSlot >= 0 && !isServe && this.predictSmashForHuman(p);
    if (this.rallyStrikeCount > this.stats.longestRally) this.stats.longestRally = this.rallyStrikeCount;
    if (shotType === "dink" && !miss) {
      this.stats.dinks++;
      if (p.controller === "LOCAL_HUMAN") this.stats.myDinks++;
    }

    const lc = this.lastContact;
    lc.time = this.time; lc.x = b.x; lc.y = b.y; lc.z = b.z; lc.miss = miss;
    lc.power = Math.min(1, Math.hypot(b.vx, b.vy, b.vz) / 60);
    // Emit the single authoritative contact event for this strike.
    this.contactEvents.push({
      id: ++this.contactId,
      time: this.time,
      slot: p.slot,
      team: p.team,
      shotType,
      isServe,
      isVolley: wasVolley,
      miss,
      power: Math.min(1, Math.hypot(b.vx, b.vy, b.vz) / 60),
      x: b.x,
      y: b.y,
    });
    if (this.contactEvents.length > 60) {
      this.contactEvents.shift();
      this.contactCursor = Math.max(0, this.contactCursor - 1);
    }

    if (!isServe && !miss) {
      this.pushMessage(cap(shotType), p.x, p.y, shotType === "dink" ? "info" : "success");
    }
  }

  // Will this opponent strike's ball come down through smash height (from a
  // high arc) in MY strike zone, at a point where my volley is legal (strike
  // 4+)? "Mine" = I'm at least as close to the spot as my partner. Pure.
  private predictSmashForHuman(striker: PlayerState): boolean {
    const h = this.players[this.humanSlot];
    if (striker.team === h.team || this.rallyStrikeCount < 3) return false;
    const o = predictOverhead(this.ball, h.team, this.ball.z, TACTIC.SMASH_MIN_APEX, TACTIC.SMASH_MIN_Z);
    if (!o || !smashPositionOk(o)) return false;
    const mate = this.players[this.partnerSlot(h.slot)];
    return mate === h || Math.hypot(o.x - h.x, o.y - h.y) <= Math.hypot(o.x - mate.x, o.y - mate.y);
  }

  // ---- Fault / scoring -----------------------------------------------------
  private registerFault(fault: FaultEvent) {
    this.lastFault = fault;
    this.smashPredicted = false;
    if (this.smashLatched) this.clearSmashLatch();
    this.lobArmed = false; // point end clears an armed lob
    this.ball.inPlay = false;
    this.phase = "point_over";
    this.pointResetTimer = MATCH.POINT_RESET_DELAY;
    this.stats.pointsPlayed++;
    this.stats.totalRallies++;
    if (fault.reason.startsWith("KITCHEN")) this.stats.kitchenFaults++;
    this.pushMessage(fault.message, fault.x, fault.y, "error");

    const rallyWinner: Team = fault.faultingTeam === "near" ? "far" : "near";
    this.lastPoint.time = this.time;
    this.lastPoint.winner = rallyWinner;
    const outcome = ScoreManager.resolve(this.score, rallyWinner, this.format);
    this.score = outcome.score;

    // Advance the SERVER (tracked as a real player), per doubles rules:
    //  - point         → same server keeps serving; the two teammates swap sides
    //  - second_server → the PARTNER becomes Server 2, serving from where they stand
    //  - side_out      → the incoming team's right-court player is the new Server 1
    if (outcome.event === "point") {
      this.swapServingSides();
    } else if (outcome.event === "second_server") {
      this.serverSlot = this.partnerSlot(this.serverSlot!);
    } else if (outcome.event === "side_out") {
      this.serverSlot = this.pickServerSlot(this.score.servingTeam);
    }

    if (outcome.event === "side_out") this.pushMessage("Side out", COURT.CENTER_X, COURT.NET_Y, "warning");
    else if (outcome.event === "second_server") this.pushMessage("2nd server", COURT.CENTER_X, COURT.NET_Y, "warning");
    else if (outcome.event === "point") this.pushMessage("Point!", COURT.CENTER_X, COURT.NET_Y, "success");

    if (outcome.gameOver) {
      this.winner = outcome.winner;
      this.pointResetTimer = 0.8;
    }
  }

  private pushMessage(text: string, x: number, y: number, color: FloatingMessage["color"]) {
    this.messages.push({ text, x, y, color, life: 1.4 });
    if (this.messages.length > 6) this.messages.shift();
  }

  // Serving team keeps the serve after a point; the two teammates swap courts so
  // the same server moves to the other service box (keeps score-parity valid).
  // Singles: there is one server, so flip their court side instead.
  private swapServingSides() {
    const serving = this.players.filter((p) => p.team === this.score.servingTeam);
    if (serving.length >= 2) {
      const tmp = serving[0].courtSide;
      serving[0].courtSide = serving[1].courtSide;
      serving[1].courtSide = tmp;
    } else if (serving.length === 1) {
      serving[0].courtSide = serving[0].courtSide === "R" ? "L" : "R";
    }
  }
}

// Detect a MatchConfig vs a legacy SimOptions object.
function isMatchConfig(cfg: MatchConfig | SimOptions): cfg is MatchConfig {
  return "format" in cfg && "near" in cfg;
}

// Convert the legacy SimOptions (used by the headless tests) into the exact
// same four-player doubles MatchConfig the engine built before — preserving the
// slot order, difficulties, personalities and names so behaviour is identical.
function optionsToConfig(opts: SimOptions): MatchConfig {
  const controllers = opts.controllers ?? ["LOCAL_HUMAN", "AI", "AI", "AI"];
  const personalities = opts.personalities ?? [undefined, "DEFENSIVE", "AGGRESSIVE", "TACTICAL"];
  const names = opts.names ?? ["You", "Partner", "Rival", "Rival"];
  const partnerDiff = opts.partnerDifficulty ?? PARTNER_DIFFICULTY;
  const diffForSlot = (slot: number, team: Team): Difficulty | undefined => {
    if (controllers[slot] !== "AI") return undefined;
    if (opts.difficulties?.[slot]) return opts.difficulties[slot];
    return team === "near" ? partnerDiff : opts.difficulty;
  };
  return buildMatchConfig({
    seed: opts.seed,
    format: "doubles",
    near: {
      controllers: [controllers[0], controllers[1]],
      difficulties: [diffForSlot(0, "near"), diffForSlot(1, "near")],
      personalities: [personalities[0], personalities[1]],
      names: [names[0], names[1]],
    },
    far: {
      controllers: [controllers[2], controllers[3]],
      difficulties: [diffForSlot(2, "far"), diffForSlot(3, "far")],
      personalities: [personalities[2], personalities[3]],
      names: [names[2], names[3]],
    },
  });
}

// Smash only from the front/mid court (not from the baseline under a deep lob).
function smashPositionOk(p: { y: number }): boolean {
  return Math.abs(p.y - COURT.NET_Y) <= TACTIC.SMASH_MAX_NET_DIST;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---- Human shot/serve quality (pure, unit-testable) ----------------------
// Timing quality comes from how LATE the swipe was vs the ball's closest
// approach (ft past the minimum distance), NOT raw contact distance. A
// downward/backward swipe (dy > 0) is treated as a mishit. Good swipes
// (on-time, forward, sane aim) never randomly miss.
export function humanShotQuality(
  ballZ: number,
  lateness: number,
  input: { dx: number; dy: number },
  extraForgiveness = 1,
): { accuracy: number; unforcedError: number; errLevel: number } {
  const timingErr = clamp01(lateness / HUMAN.lateRangeFt);
  const zErr = ballZ > HUMAN.highZ ? Math.min(1, (ballZ - HUMAN.highZ) / HUMAN.highZRange) : 0;
  const len = Math.hypot(input.dx, input.dy) || 1;
  const downward = clamp01(input.dy / len); // >0 when swiping downward/backward
  const lateralFt = (input.dx / INPUT.POWER_MAX_PX) * 12;
  const aimExtreme = clamp01((Math.abs(lateralFt) - HUMAN.extremeAimFt) / HUMAN.extremeAimRange);
  let errLevel = Math.max(timingErr, zErr * 0.6, downward * HUMAN.downwardPenalty);
  errLevel = Math.min(1, errLevel + aimExtreme * 0.5);
  errLevel = Math.min(1, errLevel / (HUMAN.forgiveness * extraForgiveness));
  const accuracy = 1 - errLevel * HUMAN.maxInaccuracy;
  const unforcedError =
    errLevel > HUMAN.faultThreshold
      ? ((errLevel - HUMAN.faultThreshold) / (1 - HUMAN.faultThreshold)) * HUMAN.maxFaultChance
      : 0;
  return { accuracy, unforcedError, errLevel };
}

// HUMAN SHOT VOCABULARY (pure, unit-testable):
//   LOB   — the LOB button armed my next strike
//   SMASH — a high (≥ SMASH_MIN_Z) legal ball + a fast/firm swipe
//   DRIVE — a fast swipe (stable speed ≥ DRIVE_SPEED_MIN) or a long/firm one
//   DINK  — short + gentle near my kitchen line
//   DROP  — short + gentle from mid/back court
export function classifyHumanShot(
  p: { team: Team; y: number; inKitchen: boolean },
  input: { power: number; speed?: number },
  highBall: boolean,
  lobArmed: boolean,
): ShotType {
  if (lobArmed) return "lob";
  const power = input.power;
  const fast = (input.speed ?? 0) >= INPUT.DRIVE_SPEED_MIN;
  const firm = fast || power >= INPUT.DRIVE_POWER_MIN;
  if (highBall && firm) return "smash";
  if (fast) return "drive";
  const kitchenLineY = p.team === "near" ? COURT.NEAR_KITCHEN_Y : COURT.FAR_KITCHEN_Y;
  const nearKitchen = Math.abs(p.y - kitchenLineY) < INPUT.DINK_RANGE_FT || p.inKitchen;
  if (nearKitchen && power < INPUT.DINK_POWER_MAX) return "dink";
  if (power < INPUT.DROP_POWER_MAX && !nearKitchen) return "drop";
  return "drive";
}

// Serve quality: the human controls the serve's timing, so quality comes from
// the swipe itself — a very short swipe (low power) or an extreme angle can
// fault. Normal serves stay safe.
export function humanServeQuality(input: { dx: number; dy: number; power: number }): {
  accuracy: number;
  unforcedError: number;
  errLevel: number;
} {
  const S = HUMAN.serve;
  const powerErr = clamp01((S.lowPower - input.power) / S.lowPower); // short swipe = poor
  const lateralFt = (input.dx / INPUT.POWER_MAX_PX) * 12;
  const aimExtreme = clamp01((Math.abs(lateralFt) - S.extremeAimFt) / S.extremeAimRange);
  const len = Math.hypot(input.dx, input.dy) || 1;
  const downward = clamp01(input.dy / len);
  let errLevel = Math.max(powerErr, downward * HUMAN.downwardPenalty);
  errLevel = Math.min(1, errLevel + aimExtreme * 0.5);
  errLevel = Math.min(1, errLevel / HUMAN.forgiveness);
  const accuracy = 1 - errLevel * S.maxInaccuracy;
  const unforcedError =
    errLevel > S.faultThreshold
      ? ((errLevel - S.faultThreshold) / (1 - S.faultThreshold)) * S.maxFaultChance
      : 0;
  return { accuracy, unforcedError, errLevel };
}
