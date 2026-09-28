import { COURT, serviceBoxFor, teamOfY } from "../config/court";
import { DIFFICULTY_TABLE, PERSONALITY_BIAS, type AIParams } from "../config/ai";
import { KITCHEN, MATCH, PHYS, PLAYER, SHOTS, INPUT } from "../config/tuning";
import { RNG } from "../core/rng";
import { decideServe, decideShot } from "./aiController";
import { updateMovement, type MovementInfo } from "./movement";
import { RuleManager, type ServeContext } from "./rules";
import { ScoreManager } from "./score";
import { solveShot } from "./shots";
import type {
  BallState,
  ControllerType,
  CourtSide,
  Difficulty,
  FaultEvent,
  MatchPhase,
  MatchStats,
  Personality,
  PlayerState,
  ScoreState,
  ShotType,
  Team,
} from "./types";

export interface SwipeInput {
  dx: number; // screen swipe delta x (px)
  dy: number; // screen swipe delta y (px, up is negative)
  power: number; // 0..1
  tap: boolean; // true if below movement threshold (serve release)
}

export interface SimOptions {
  seed: number;
  difficulty: Difficulty;
  difficulties?: Difficulty[]; // optional per-slot override (headless tests)
  controllers?: ControllerType[]; // 4 slots, default human + 3 AI
  personalities?: (Personality | undefined)[]; // 4 slots
  names?: string[];
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
    kitchenFaults: 0,
    pointsPlayed: 0,
  };

  difficulty: Difficulty;
  controllers: ControllerType[];
  personalities: (Personality | undefined)[];

  serveCtx: ServeContext = { active: false, servingTeam: "near", box: { xLo: 0, xHi: 0, yLo: 0, yHi: 0 } };
  rallyStrikeCount = 0;
  crossedNetSinceHit = false;
  serverSlot: number | null = null;

  private pointResetTimer = 0;
  private serveTimer = 0;
  private pendingInput: SwipeInput | null = null;
  private canHit: boolean[] = [false, false, false, false];
  private strikerSlot: number | null = null;

  messages: FloatingMessage[] = [];
  lastFault: FaultEvent | null = null;
  winner: Team | null = null;
  holdKitchen = false; // optional player toggle: hold near team at the kitchen

  constructor(opts: SimOptions) {
    this.rng = new RNG(opts.seed);
    this.difficulty = opts.difficulty;
    this.controllers = opts.controllers ?? ["LOCAL_HUMAN", "AI", "AI", "AI"];
    this.personalities =
      opts.personalities ?? [undefined, "DEFENSIVE", "AGGRESSIVE", "TACTICAL"];
    const names = opts.names ?? ["You", "Partner", "Rival", "Rival"];

    const mk = (slot: number, team: Team, side: CourtSide): PlayerState => ({
      slot,
      team,
      controller: this.controllers[slot],
      name: names[slot],
      colorKey: team === "near" ? (slot === 0 ? "teamYou" : "teamPartner") : "teamRival",
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      courtSide: side,
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
      difficulty: this.controllers[slot] === "AI" ? (opts.difficulties?.[slot] ?? this.difficulty) : undefined,
      personality: this.personalities[slot],
      swingCue: -10,
    });
    this.players = [
      mk(0, "near", "R"),
      mk(1, "near", "L"),
      mk(2, "far", "R"),
      mk(3, "far", "L"),
    ];

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

    this.score = ScoreManager.initial("near");
    this.setupServe();
  }

  private paramsFor(slot: number): AIParams {
    return DIFFICULTY_TABLE[this.players[slot].difficulty ?? this.difficulty];
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
    }

    const servingTeam = this.score.servingTeam;
    const serveSide = ScoreManager.serveSide(this.score);
    const serving = this.players.filter((p) => p.team === servingTeam);
    const receiving = this.players.filter((p) => p.team !== servingTeam);

    // Server occupies serveSide; partner opposite.
    const server = serving.find((p) => p.courtSide === serveSide) ?? serving[0];
    const partner = serving.find((p) => p !== server)!;
    server.courtSide = serveSide;
    partner.courtSide = serveSide === "R" ? "L" : "R";
    server.isServing = true;
    this.serverSlot = server.slot;

    const nearTeam = servingTeam === "near";
    const baseY = nearTeam ? COURT.LENGTH - 1.0 : 1.0;
    server.x = this.sideX(server.courtSide);
    server.y = baseY;
    partner.x = this.sideX(partner.courtSide);
    partner.y = nearTeam ? COURT.LENGTH - PLAYER.RECOVER_DEPTH_BASELINE : PLAYER.RECOVER_DEPTH_BASELINE;

    // Receiving team: diagonal receiver deep to return the serve.
    receiving[0].courtSide = "R";
    receiving[1].courtSide = "L";
    for (const r of receiving) {
      r.x = this.sideX(r.courtSide);
      r.y = r.team === "near" ? COURT.LENGTH - PLAYER.RECOVER_DEPTH_BASELINE - 1 : PLAYER.RECOVER_DEPTH_BASELINE + 1;
      r.targetX = r.x;
      r.targetY = r.y;
    }
    server.targetX = server.x;
    server.targetY = server.y;
    partner.targetX = partner.x;
    partner.targetY = partner.y;

    // Place ball at server.
    this.ball.x = server.x;
    this.ball.y = server.y;
    this.ball.z = 0;
    this.ball.vx = this.ball.vy = this.ball.vz = 0;
  }

  private sideX(side: CourtSide): number {
    return side === "R" ? COURT.WIDTH * 0.72 : COURT.WIDTH * 0.28;
  }

  // ---- Input ---------------------------------------------------------------
  submitSwipe(input: SwipeInput) {
    this.pendingInput = input;
  }

  // Public: is the human currently able to strike?
  humanCanHit(): boolean {
    const humanSlot = this.controllers.findIndex((c) => c === "LOCAL_HUMAN");
    if (humanSlot < 0) return false;
    return this.canHit[humanSlot] && this.strikerSlot === humanSlot;
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

    if (this.phase === "game_over") return;

    if (this.phase === "point_over") {
      this.pointResetTimer -= dt;
      if (this.pointResetTimer <= 0) {
        if (ScoreManager.isGameOver(this.score)) {
          this.phase = "game_over";
        } else {
          this.setupServe();
        }
      }
      return;
    }

    // Update kitchen flags + timers for everyone.
    for (const p of this.players) {
      const wasInK = p.inKitchen;
      RuleManager.updateKitchenFlags(p);
      // Re-establishment: both feet OUT of the kitchen for REESTABLISH_TIME.
      if (!p.inKitchen && !p.touchingKitchenLine && p.wasInKitchen) {
        p.reestablishTimer += dt;
        if (p.reestablishTimer >= KITCHEN.REESTABLISH_TIME) {
          p.feetEstablished = true;
          p.wasInKitchen = false;
        }
      }
      // Momentum: a fault if a just-volleyed player enters the NVZ.
      if (p.momentumTimer > 0) {
        p.momentumTimer -= dt;
        if (!wasInK && p.inKitchen) {
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
      const serverIsHuman = this.players[this.serverSlot!].controller === "LOCAL_HUMAN";
      if (serverIsHuman) {
        if (this.pendingInput) {
          this.executeServe(this.pendingInput);
          this.pendingInput = null;
        }
      } else {
        this.serveTimer += dt;
        if (this.serveTimer >= MATCH.SERVE_DELAY) this.executeServe(null);
      }
      // players still settle into position
      this.updateMovementAndReach(dt);
      return;
    }

    // RALLY
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
      affinityFor: (slot) => {
        const p = this.players[slot];
        if (p.team === "near" && this.holdKitchen) return 0.9;
        if (p.controller !== "AI") return 0.6;
        return this.paramsFor(slot).kitchenAffinity;
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
    if (!this.ball.inPlay) return;
    const side = teamOfY(this.ball.y);
    const requireBounce = this.rallyStrikeCount < 3;
    let best: { slot: number; d: number } | null = null;
    for (const p of this.players) {
      if (p.team !== side) continue;
      const cooldownOk = this.time - p.lastHitTime > PLAYER.HIT_COOLDOWN;
      const bounceOk = !requireBounce || this.ball.bouncesSinceHit >= 1;
      const d = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
      const reachOk = d <= PLAYER.REACH * 1.15 && this.ball.z <= 4.6;
      if (cooldownOk && bounceOk && reachOk) {
        this.canHit[p.slot] = true;
        if (!best || d < best.d) best = { slot: p.slot, d };
      }
    }
    if (best) this.strikerSlot = best.slot;
  }

  private resolveStrikes() {
    if (this.strikerSlot === null) return;
    const p = this.players[this.strikerSlot];
    if (p.controller === "LOCAL_HUMAN") {
      if (this.pendingInput && !this.pendingInput.tap) {
        this.executeHumanHit(p, this.pendingInput);
        this.pendingInput = null;
      }
      return;
    }
    if (p.controller === "AI") {
      if (!p.committedToBall) {
        p.committedToBall = true;
        p.reactionUntil = this.time + this.paramsFor(p.slot).reactionDelay;
      }
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
        });
        this.executeShot(p, intent.shotType, intent.targetX, intent.targetY, {
          accuracy: intent.accuracy,
          unforcedError: intent.unforcedError,
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
      b.z = 0;
      b.vz = -b.vz * PHYS.BOUNCE_RESTITUTION;
      b.vx *= PHYS.BOUNCE_FRICTION;
      b.vy *= PHYS.BOUNCE_FRICTION;
      b.bouncesSinceHit++;
      b.totalBounces++;
      b.bounceSideCount++;
      b.lastBounce = { x: b.x, y: b.y, side: teamOfY(b.y) };

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
      const power = Math.max(0.25, input.power);
      const lo = box.yLo;
      const hi = box.yHi;
      // deeper serve with more power (toward receiving baseline)
      const depthT = this.score.servingTeam === "near" ? 1 - power : power;
      targetY = lo + (hi - lo) * depthT;
      const cx = (box.xLo + box.xHi) / 2;
      const lateral = (input.dx / INPUT.POWER_MAX_PX) * (box.xHi - box.xLo) * 0.7;
      targetX = Math.max(box.xLo + 0.4, Math.min(box.xHi - 0.4, cx + lateral));
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

  private executeHumanHit(p: PlayerState, input: SwipeInput) {
    const power = input.power;
    const nearKitchen = Math.abs(p.y - COURT.NEAR_KITCHEN_Y) < 3 || p.inKitchen;
    let shotType: ShotType;
    if (nearKitchen && power < INPUT.DINK_POWER_MAX) shotType = "dink";
    else if (power < INPUT.DROP_POWER_MAX && !nearKitchen) shotType = "drop";
    else if (power >= INPUT.DRIVE_POWER_MIN) shotType = "drive";
    else shotType = "drive";

    // Aim from swipe: lateral from dx, depth from power & shot type.
    const tune = SHOTS[shotType];
    const depth = tune.maxDepth + (tune.minDepth - tune.maxDepth) * Math.min(1, power / 0.9);
    const targetY = this.depthToY(p.team, depth);
    const lateral = (input.dx / INPUT.POWER_MAX_PX) * 12;
    let targetX = p.x + lateral;
    targetX = Math.max(COURT.RADIUS_MARGIN, Math.min(COURT.WIDTH - COURT.RADIUS_MARGIN, targetX));

    this.executeShot(p, shotType, targetX, targetY, { accuracy: 1, unforcedError: 0 });
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
    opts: { accuracy: number; unforcedError: number },
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
    opts: { accuracy: number; unforcedError: number; isServe: boolean },
  ) {
    const b = this.ball;
    const wasVolley = !opts.isServe && b.bouncesSinceHit === 0 && b.z > 0.05;

    // Pressure ramp: the longer a rally goes, the more likely a mistake — keeps
    // rallies believable and guarantees they resolve. Skill (base
    // unforcedError) still dominates, so the better AI errs less and wins more.
    const pressure = opts.isServe ? 0 : Math.min(0.3, this.rallyStrikeCount * 0.006);
    const effUnforced = p.controller === "AI" ? opts.unforcedError + pressure : 0;
    const forcedMiss = !opts.isServe && effUnforced > 0 && this.rng.chance(effUnforced);

    if (forcedMiss) {
      // Unforced error: a weak dump that faults right away (into the net / own
      // court) — it cannot be volley-rescued, so rallies always resolve.
      const contactZ = SHOTS[shotType].contactH;
      const dir = p.team === "near" ? -1 : 1; // toward the net
      b.x = p.x;
      b.y = p.y + dir * 0.4;
      b.z = contactZ;
      b.vx = this.rng.noise(6);
      b.vy = dir * 16;
      b.vz = 3; // too flat to clear the net from here → dumps short
      this.finishStrike(p, shotType, wasVolley, opts.isServe, true);
      return;
    }

    const shot = solveShot(p.x, p.y, targetX, targetY, shotType, {
      accuracy: opts.accuracy,
      unforcedError: 0,
      rng: p.controller === "AI" ? this.rng : undefined,
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
    p.committedToBall = false;

    // A volley from outside the kitchen starts a momentum window.
    if (wasVolley && !p.inKitchen && !p.touchingKitchenLine) {
      p.momentumTimer = KITCHEN.MOMENTUM_WINDOW;
    }

    // Reset the OTHER players' commitment so they can react next.
    for (const o of this.players) if (o !== p) o.committedToBall = false;

    this.rallyStrikeCount++;
    this.stats.rallyCount = this.rallyStrikeCount;
    if (this.rallyStrikeCount > this.stats.longestRally) this.stats.longestRally = this.rallyStrikeCount;
    if (shotType === "dink" && !miss) this.stats.dinks++;

    if (!isServe && !miss) {
      this.pushMessage(cap(shotType), p.x, p.y, shotType === "dink" ? "info" : "success");
    }
  }

  // ---- Fault / scoring -----------------------------------------------------
  private registerFault(fault: FaultEvent) {
    this.lastFault = fault;
    this.ball.inPlay = false;
    this.phase = "point_over";
    this.pointResetTimer = MATCH.POINT_RESET_DELAY;
    this.stats.pointsPlayed++;
    this.stats.totalRallies++;
    if (fault.reason.startsWith("KITCHEN")) this.stats.kitchenFaults++;
    this.pushMessage(fault.message, fault.x, fault.y, "error");

    const rallyWinner: Team = fault.faultingTeam === "near" ? "far" : "near";
    const outcome = ScoreManager.resolve(this.score, rallyWinner);
    this.score = outcome.score;

    if (outcome.serverSwitchSides) {
      // Serving team keeps the serve; the two serving players swap sides.
      const serving = this.players.filter((p) => p.team === this.score.servingTeam);
      const tmp = serving[0].courtSide;
      serving[0].courtSide = serving[1].courtSide;
      serving[1].courtSide = tmp;
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
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
