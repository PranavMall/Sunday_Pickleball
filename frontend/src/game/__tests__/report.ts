/* Gameplay measurement harness (not a pass/fail suite).
 * Run: yarn tsx src/game/__tests__/report.ts
 *
 * Uses the REAL default configuration: slot 0 is the "human" simulated by a
 * CLUB-level AI, slot 1 is the default AI partner (CLUB), slots 2-3 are the two
 * opponents at the chosen difficulty. Reports:
 *   - return-of-serve success rate by RECEIVING difficulty
 *   - share of the opponents' serve-returns the NEAR ("my") team can reach
 *   - Rookie points-per-game (CLUB near team vs ROOKIE far team)
 *   - average rally length (strikes/point) per difficulty
 */
import { GameSimulation } from "../sim/GameSimulation";
import type { Difficulty, Team } from "../sim/types";

const other = (t: Team): Team => (t === "near" ? "far" : "near");

interface PointRec {
  serving: Team; // which team served this point
  strikes: number; // total strikes in the rally (serve = 1)
  reason: string; // terminating fault reason
}

function playAndTrack(seed: number, opp: Difficulty) {
  const sim = new GameSimulation({
    seed,
    difficulty: opp,
    controllers: ["AI", "AI", "AI", "AI"],
    // slot0 = CLUB "human", slot1 undefined → default partner (CLUB),
    // slots2-3 undefined → match difficulty (opp). Tests the real setup.
    difficulties: ["CLUB", undefined as any, undefined as any, undefined as any],
  });
  const points: PointRec[] = [];
  let ticks = 0;
  const max = 60 * 60 * 25;
  let servingThisPoint: Team = sim.score.servingTeam;
  let recorded = -1;
  while (sim.phase !== "game_over" && ticks < max) {
    const before = sim.phase;
    sim.step();
    ticks++;
    const after = sim.phase;
    if (before === "waiting_serve" && after === "rally") servingThisPoint = sim.score.servingTeam;
    if (after === "point_over" && sim.stats.pointsPlayed !== recorded) {
      recorded = sim.stats.pointsPlayed;
      points.push({ serving: servingThisPoint, strikes: sim.rallyStrikeCount, reason: sim.lastFault?.reason ?? "" });
    }
  }
  return { points, nearScore: sim.score.nearScore, farScore: sim.score.farScore };
}

function reportFor(opp: Difficulty, seeds: number[]) {
  // return stats keyed by receiving difficulty label
  let farRecvTotal = 0, farRecvReturned = 0; // far team = opp, receiving
  let nearRecvTotal = 0, nearRecvReturned = 0; // near team = CLUB, receiving
  let nearServedFarReturned = 0, nearReachedReturn = 0;
  let rallySum = 0, rallyCount = 0;
  for (const seed of seeds) {
    const { points } = playAndTrack(seed, opp);
    for (const p of points) {
      rallySum += p.strikes; rallyCount++;
      const serveGood = !p.reason.startsWith("SERVE");
      if (!serveGood) continue; // serve fault: not a return stat
      const recv = other(p.serving);
      if (recv === "far") { farRecvTotal++; if (p.strikes >= 2) farRecvReturned++; }
      else { nearRecvTotal++; if (p.strikes >= 2) nearRecvReturned++; }
      // near served, far returned (strikes>=2): could near reach it (strikes>=3)?
      if (p.serving === "near" && p.strikes >= 2) {
        nearServedFarReturned++;
        if (p.strikes >= 3) nearReachedReturn++;
      }
    }
  }
  const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(0) + "%" : "n/a");
  console.log(`\n[${opp} opponents]  (near = CLUB "me"+partner)`);
  console.log(`  ${opp} return-of-serve success (far receiving): ${pct(farRecvReturned, farRecvTotal)}  (${farRecvReturned}/${farRecvTotal})`);
  console.log(`  CLUB return-of-serve success (near receiving):  ${pct(nearRecvReturned, nearRecvTotal)}  (${nearRecvReturned}/${nearRecvTotal})`);
  console.log(`  share of ${opp} serve-returns my team reaches:  ${pct(nearReachedReturn, nearServedFarReturned)}  (${nearReachedReturn}/${nearServedFarReturned})`);
  console.log(`  avg rally length: ${(rallySum / rallyCount).toFixed(1)} strikes/point  (${rallyCount} points)`);
}

function rookiePPG(seeds: number[]) {
  let sum = 0;
  const scores: number[] = [];
  for (const seed of seeds) {
    const { nearScore, farScore } = playAndTrack(seed, "ROOKIE");
    sum += farScore; // far = ROOKIE points per game
    scores.push(farScore);
  }
  const avg = (sum / seeds.length).toFixed(1);
  const min = Math.min(...scores), max = Math.max(...scores);
  console.log(`\n[Rookie points-per-game] CLUB near vs ROOKIE far over ${seeds.length} games: avg=${avg}  range=${min}-${max}`);
}

// Engine-side swipe→contact latency: ticks from the moment a swipe is buffered
// (as soon as the human CAN hit) to the moment the ball is actually struck.
// This isolates the simulation/buffer contribution; rendering + gesture + rAF
// on a real device add on top and are the authoritative perceived-latency check.
function latencyProbe() {
  const DT = 1000 / 60;
  const samples: number[] = [];
  for (let s = 0; s < 60; s++) {
    const sim = new GameSimulation({ seed: 9000 + s, difficulty: "CLUB" });
    let ticks = 0;
    const max = 60 * 120;
    let armedAt = -1;
    while (sim.phase !== "game_over" && ticks < max && samples.length < 400) {
      // Human serves immediately when it's their turn.
      if (sim.humanIsServer()) sim.submitSwipe({ dx: 0, dy: -140, power: 0.6, tap: false });
      const canHitBefore = sim.humanCanHit();
      if (canHitBefore && armedAt < 0) {
        armedAt = ticks;
        sim.submitSwipe({ dx: 0, dy: -120, power: 0.6, tap: false }); // swipe as soon as reachable
      }
      const hitByHumanBefore = sim.ball.lastHitBy === 0;
      sim.step();
      ticks++;
      if (armedAt >= 0 && sim.ball.lastHitBy === 0 && !hitByHumanBefore) {
        samples.push(ticks - armedAt);
        armedAt = -1;
      }
      if (!sim.humanCanHit() && armedAt >= 0 && ticks - armedAt > 30) armedAt = -1; // missed window; rearm
    }
  }
  if (!samples.length) { console.log("\n[Input latency] no samples captured"); return; }
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const sorted = samples.slice().sort((a, b) => a - b);
  const p90 = sorted[Math.floor(sorted.length * 0.9)];
  console.log(`\n[Input latency] engine swipe→contact over ${samples.length} contacts: avg=${avg.toFixed(1)} ticks (${(avg * DT).toFixed(0)} ms), p90=${p90} ticks (${(p90 * DT).toFixed(0)} ms)`);
}

const seeds = Array.from({ length: 40 }, (_, i) => 2000 + i);
console.log("=== Picklewood gameplay report (real default config) ===");
for (const d of ["ROOKIE", "CLUB", "PRO"] as Difficulty[]) reportFor(d, seeds);
rookiePPG(seeds);
latencyProbe();
console.log("\ndone");
