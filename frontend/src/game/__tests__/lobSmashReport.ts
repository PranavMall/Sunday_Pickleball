/* Lob + smash outcome measurement (not pass/fail).
 * Run: npx tsx src/game/__tests__/lobSmashReport.ts
 * Lob outcome by first-bounce depth from the receiving baseline:
 *   deep (≤ 8 ft) / sits up (8–14 ft) / short (> 14 ft, or volleyed / smashed
 *   before landing), plus how often the next opponent shot was a smash.
 * Smash: in (won the point or forced a return) vs out/net (the smasher's
 * fault), and the defenders' return rate split by where the defender closest
 * to the landing spot stood when the smash was hit (back vs at the net).
 */
import { COURT, isInsideCourt } from "../config/court";
import { GameSimulation } from "../sim/GameSimulation";
import { firstBouncePoint } from "../sim/physics";
import type { Difficulty, Team } from "../sim/types";

export interface LobSmashStats {
  lobs: number; lobDeep: number; lobSitsUp: number; lobShort: number; lobSmashedBack: number;
  smashes: number; smashIn: number; smashOut: number;
  defBack: number; defBackRet: number; defNet: number; defNetRet: number;
}

export function lobSmashStats(diffs: (Difficulty | undefined)[], opp: Difficulty, seeds: number[], drive?: (sim: GameSimulation) => void): LobSmashStats {
  const s: LobSmashStats = { lobs: 0, lobDeep: 0, lobSitsUp: 0, lobShort: 0, lobSmashedBack: 0, smashes: 0, smashIn: 0, smashOut: 0, defBack: 0, defBackRet: 0, defNet: 0, defNetRet: 0 };
  for (const seed of seeds) {
    const sim = new GameSimulation({ seed, difficulty: opp, controllers: drive ? ["LOCAL_HUMAN", "AI", "AI", "AI"] : ["AI", "AI", "AI", "AI"], difficulties: diffs as Difficulty[] });
    // pending trackers
    let lob: { team: Team; depth: number | null } | null = null;
    let smash: { team: Team; def: "back" | "net"; inCourt: boolean } | null = null;
    let ticks = 0;
    const closeLob = (cls: "deep" | "sits" | "short") => { s.lobs++; if (cls === "deep") s.lobDeep++; else if (cls === "sits") s.lobSitsUp++; else s.lobShort++; };
    while (sim.phase !== "game_over" && ticks < 60 * 60 * 20) {
      drive?.(sim);
      const wasRally = sim.phase === "rally";
      sim.step();
      ticks++;
      for (const ev of sim.consumeContactEvents()) {
        if (lob && ev.team !== lob.team) {
          // the lob was played before/after landing
          // Volleyed before landing: classify by where it was taken.
          const d = lob.depth ?? (lob.team === "near" ? ev.y : COURT.LENGTH - ev.y);
          closeLob(d === null ? "short" : d <= 8 ? "deep" : d <= 14 ? "sits" : "short");
          if (ev.shotType === "smash") s.lobSmashedBack++;
          lob = null;
        }
        if (smash && ev.team !== smash.team) {
          s.smashIn++; // it stayed in and was played
          if (!ev.miss) { if (smash.def === "back") s.defBackRet++; else s.defNetRet++; }
          smash = null;
        }
        if (ev.isServe || ev.miss) continue;
        if (ev.shotType === "lob") lob = { team: ev.team, depth: null };
        if (ev.shotType === "smash") {
          s.smashes++;
          const fb = firstBouncePoint(sim.ball);
          const defenders = sim.players.filter((p) => p.team !== ev.team);
          const spot = fb ?? { x: sim.ball.x, y: sim.ball.y };
          const d = defenders.sort((a, b) => Math.hypot(a.x - spot.x, a.y - spot.y) - Math.hypot(b.x - spot.x, b.y - spot.y))[0];
          const kl = d.team === "near" ? COURT.NEAR_KITCHEN_Y : COURT.FAR_KITCHEN_Y;
          const def = Math.abs(d.y - kl) < 5 ? "net" : "back";
          if (def === "back") s.defBack++; else s.defNet++;
          smash = { team: ev.team, def, inCourt: !!fb && isInsideCourt(fb.x, fb.y) };
        }
      }
      for (const b of sim.consumeBounceEvents()) {
        if (lob && lob.depth === null) lob.depth = lob.team === "near" ? b.y : COURT.LENGTH - b.y;
      }
      if (wasRally && sim.phase === "point_over") {
        if (lob) { const d = lob.depth; closeLob(d === null ? "short" : d <= 8 ? "deep" : d <= 14 ? "sits" : "short"); lob = null; }
        if (smash) {
          const smasherFault = sim.lastFault?.faultingTeam === smash.team;
          if (smasherFault) s.smashOut++; else s.smashIn++;
          smash = null;
        }
      }
    }
  }
  return s;
}

// Controlled smash-defence scenario: a near-team smash from the kitchen line
// at a far defender standing either at the NET (kitchen line) or BACK (near the
// baseline). Returns the share of smashes the defending team got back in play.
export function smashDefence(where: "net" | "back", diff: Difficulty, n = 60): number {
  let ret = 0;
  for (let i = 0; i < n; i++) {
    const sim = new GameSimulation({ seed: 6100 + i, difficulty: diff, controllers: ["AI", "AI", "AI", "AI"] });
    sim.phase = "rally"; sim.rallyStrikeCount = 8; sim.serveCtx.active = false;
    for (const p of sim.players) p.isServing = false;
    const smasher = sim.players[0];
    smasher.x = 6 + (i % 5) * 2; smasher.y = COURT.NEAR_KITCHEN_Y + 1.5;
    sim.players[1].x = 4; sim.players[1].y = 40;
    const dy = where === "net" ? COURT.FAR_KITCHEN_Y - 1.2 : 3;
    sim.players[2].x = 5; sim.players[2].y = dy;
    sim.players[3].x = 15; sim.players[3].y = dy;
    for (const p of sim.players) { p.targetX = p.x; p.targetY = p.y; }
    Object.assign(sim.ball, { x: smasher.x, y: smasher.y - 0.5, z: 3.6, vx: 0, vy: 0, vz: -2, inPlay: true, lastHitTeam: "far", lastHitBy: 2, bouncesSinceHit: 0, crossedNetSinceHit: true });
    const target = { x: 4 + (i % 7) * 2, y: 4 + (i % 4) * 2 };
    (sim as any).executeShot(smasher, "smash", target.x, target.y, { accuracy: 1, unforcedError: 0 });
    for (let t = 0; t < 240 && sim.phase === "rally"; t++) {
      sim.step();
      const evs = sim.consumeContactEvents();
      if (evs.some((e) => e.team === "far" && !e.miss)) { ret++; break; }
    }
  }
  return ret / n;
}

export function fmtLobSmash(s: LobSmashStats): string {
  const p = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "n/a");
  return `lobs=${s.lobs} deep=${p(s.lobDeep, s.lobs)} sitsUp=${p(s.lobSitsUp, s.lobs)} short=${p(s.lobShort, s.lobs)} smashedBack=${p(s.lobSmashedBack, s.lobs)} | smashes=${s.smashes} in=${p(s.smashIn, s.smashes)} out=${p(s.smashOut, s.smashes)} | return vs smash: back ${p(s.defBackRet, s.defBack)} (${s.defBack}) net ${p(s.defNetRet, s.defNet)} (${s.defNet})`;
}

if (process.argv[1]?.includes("lobSmashReport")) {
  const seeds = Array.from({ length: 30 }, (_, i) => 2000 + i);
  console.log("=== Lob / smash report (AI, real default config) ===");
  for (const d of ["ROOKIE", "CLUB", "PRO"] as Difficulty[]) {
    console.log(`${d.padEnd(6)} ${fmtLobSmash(lobSmashStats(["CLUB", undefined, undefined, undefined], d, seeds))}`);
  }
  console.log("Controlled smash defence (defending tier → return rate):");
  for (const d of ["ROOKIE", "CLUB", "PRO"] as Difficulty[]) {
    console.log(`  ${d.padEnd(6)} back ${(smashDefence("back", d) * 100).toFixed(0)}%  net ${(smashDefence("net", d) * 100).toFixed(0)}%`);
  }
}
