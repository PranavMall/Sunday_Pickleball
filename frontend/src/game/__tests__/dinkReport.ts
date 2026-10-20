/* Dink-exchange + pace measurement (not pass/fail).
 * Run: npx tsx src/game/__tests__/dinkReport.ts
 * Uses the real default config (slot0 = CLUB stand-in for the human, CLUB
 * partner, opponents at difficulty). Reports avg rally length, dinks/point,
 * longest dink run, share of dinks that land in the kitchen, average bounce
 * apex after a dink, and how often a ball that sits up (z>2.4 at contact) is
 * attacked with a drive.
 */
import { COURT, isInKitchenZone } from "../config/court";
import { GameSimulation } from "../sim/GameSimulation";
import type { Difficulty } from "../sim/types";

export function dinkStats(opp: Difficulty, seeds: number[], diffs?: Difficulty[]) {
  let points = 0, strikes = 0, dinks = 0, dinkInKitchen = 0, dinkBounces = 0, apexSum = 0, apexN = 0;
  let runs = 0, runSum = 0, longestRun = 0, highBalls = 0, highAttacked = 0;
  let oppDinks = 0, oppStrikes = 0;
  for (const seed of seeds) {
    const sim = new GameSimulation({
      seed, difficulty: opp, controllers: ["AI", "AI", "AI", "AI"],
      difficulties: diffs ?? ["CLUB", undefined as any, undefined as any, undefined as any],
    });
    let ticks = 0, run = 0, lastDink = false, tracking = false, apex = 0, recorded = -1;
    while (sim.phase !== "game_over" && ticks < 60 * 60 * 20) {
      const zBefore = sim.ball.z;
      sim.step();
      ticks++;
      for (const ev of sim.consumeContactEvents()) {
        if (ev.isServe) continue;
        strikes++;
        if (ev.team === "far") oppStrikes++;
        if (zBefore > 2.4 && !ev.isServe) { highBalls++; if (ev.shotType === "drive") highAttacked++; }
        if (tracking) { apexSum += apex; apexN++; tracking = false; }
        if (ev.shotType === "dink" && !ev.miss) {
          dinks++;
          if (ev.team === "far") oppDinks++;
          run = lastDink ? run + 1 : 1;
          lastDink = true;
        } else {
          if (lastDink) { runs++; runSum += run; longestRun = Math.max(longestRun, run); }
          lastDink = false; run = 0;
        }
      }
      for (const bev of sim.consumeBounceEvents()) {
        if (lastDink && !tracking && sim.ball.bouncesSinceHit === 1) {
          dinkBounces++;
          if (isInKitchenZone(bev.x, bev.y)) dinkInKitchen++;
          tracking = true; apex = 0;
        }
      }
      if (tracking) apex = Math.max(apex, sim.ball.z);
      if (sim.phase === "point_over" && sim.stats.pointsPlayed !== recorded) {
        recorded = sim.stats.pointsPlayed;
        points++;
        if (lastDink) { runs++; runSum += run; longestRun = Math.max(longestRun, run); }
        lastDink = false; run = 0; tracking = false;
      }
    }
  }
  return {
    avgRally: strikes / points + 1,
    dinksPerPoint: dinks / points,
    oppDinkShare: oppDinks / Math.max(1, oppStrikes),
    avgDinkRun: runSum / Math.max(1, runs),
    longestRun,
    dinkInKitchen: dinkInKitchen / Math.max(1, dinkBounces),
    dinkApex: apexSum / Math.max(1, apexN),
    highAttack: highAttacked / Math.max(1, highBalls),
  };
}

if (process.argv[1]?.includes("dinkReport")) {
  void COURT;
  const seeds = Array.from({ length: 30 }, (_, i) => 2000 + i);
  console.log("=== Dink report (real default config) ===");
  for (const d of ["ROOKIE", "CLUB", "PRO"] as Difficulty[]) {
    const r = dinkStats(d, seeds);
    console.log(
      `${d.padEnd(6)} avgRally=${r.avgRally.toFixed(2)} dinks/pt=${r.dinksPerPoint.toFixed(2)} oppDinkShare=${(r.oppDinkShare * 100).toFixed(0)}% avgDinkRun=${r.avgDinkRun.toFixed(2)} longestRun=${r.longestRun} dinkInKitchen=${(r.dinkInKitchen * 100).toFixed(0)}% dinkApex=${r.dinkApex.toFixed(2)}ft highBallAttacked=${(r.highAttack * 100).toFixed(0)}%`,
    );
  }
}
