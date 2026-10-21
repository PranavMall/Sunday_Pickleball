/* B3 authenticity measurement (not pass/fail).
 * Run: npx tsx src/game/__tests__/b3Report.ts [seedCount]
 * Same real default config as shotMix.ts (slot0 = CLUB stand-in for the human,
 * CLUB partner, opponents at the tier). Reports per tier:
 *   - serve return / third shot struck on the SAME frame as the bounce (%)
 *   - share of rally time with ALL players within 4 ft (shotMix atLine) of their kitchen line
 *   - share of player-rally-time physically inside the kitchen, entries/rally
 *   - avg rally length (strikes/point incl. serve), opponent win rate, stuck
 */
import { COURT } from "../config/court";
import { GameSimulation } from "../sim/GameSimulation";
import type { Difficulty } from "../sim/types";

export function b3Stats(opp: Difficulty, seeds: number[]) {
  let rallyTicks = 0, allNetTicks = 0, playerTicks = 0, kitchenTicks = 0, entries = 0;
  let strikes = 0, points = 0, oppWins = 0, stuck = 0;
  let earlyN = 0, sameFrame = 0, retN = 0, retSame = 0, thirdN = 0, thirdSame = 0, postBounceSum = 0, contactZSum = 0;
  for (const seed of seeds) {
    const sim = new GameSimulation({
      seed, difficulty: opp, controllers: ["AI", "AI", "AI", "AI"],
      difficulties: ["CLUB", undefined as any, undefined as any, undefined as any],
    });
    const wasIn = sim.players.map(() => false);
    let ticks = 0, recorded = -1, lastBounceTime = -1;
    while (sim.phase !== "game_over" && ticks < 60 * 60 * 20) {
      const strikeBefore = sim.rallyStrikeCount;
      const zBefore = sim.ball.z;
      sim.step();
      ticks++;
      for (const b of sim.consumeBounceEvents()) lastBounceTime = b.time;
      for (const ev of sim.consumeContactEvents()) {
        if (ev.isServe) continue;
        strikes++;
        if (strikeBefore === 1 || strikeBefore === 2) {
          earlyN++;
          const same = Math.abs(ev.time - lastBounceTime) < 1e-6;
          if (same) sameFrame++;
          if (strikeBefore === 1) { retN++; if (same) retSame++; } else { thirdN++; if (same) thirdSame++; }
          postBounceSum += ev.time - lastBounceTime;
          contactZSum += zBefore;
        }
      }
      if (sim.phase === "rally") {
        rallyTicks++;
        if (sim.players.every((p) => Math.abs(p.y - (p.team === "near" ? COURT.NEAR_KITCHEN_Y : COURT.FAR_KITCHEN_Y)) < 4)) allNetTicks++;
        sim.players.forEach((p, i) => {
          playerTicks++;
          if (p.inKitchen) kitchenTicks++;
          if (p.inKitchen && !wasIn[i]) entries++;
          wasIn[i] = p.inKitchen;
        });
      }
      if (sim.phase === "point_over" && sim.stats.pointsPlayed !== recorded) { recorded = sim.stats.pointsPlayed; points++; }
    }
    if (sim.phase !== "game_over") stuck++;
    if (sim.winner === "far") oppWins++;
  }
  return {
    avgRally: strikes / points + 1,
    oppWinRate: oppWins / seeds.length,
    stuck,
    allNet: allNetTicks / Math.max(1, rallyTicks),
    kitchenTime: kitchenTicks / Math.max(1, playerTicks),
    entriesPerRally: entries / Math.max(1, points),
    sameFrame: sameFrame / Math.max(1, earlyN),
    retSameFrame: retSame / Math.max(1, retN),
    thirdSameFrame: thirdSame / Math.max(1, thirdN),
    retN, thirdN,
    avgPostBounce: postBounceSum / Math.max(1, earlyN),
    avgContactZ: contactZSum / Math.max(1, earlyN),
  };
}

if (process.argv[1]?.includes("b3Report")) {
  const n = Number(process.argv[2] ?? 30);
  const seeds = Array.from({ length: n }, (_, i) => 2000 + i);
  console.log(`=== B3 report (${n} seeded matches / tier) ===`);
  for (const d of ["ROOKIE", "CLUB", "PRO"] as Difficulty[]) {
    const r = b3Stats(d, seeds);
    console.log(
      `${d.padEnd(6)} rally=${r.avgRally.toFixed(2)} oppWin=${(r.oppWinRate * 100).toFixed(0)}% stuck=${r.stuck} | all4Net=${(r.allNet * 100).toFixed(1)}% | kitchenTime=${(r.kitchenTime * 100).toFixed(2)}% entries/rally=${r.entriesPerRally.toFixed(2)} | ret/3rd sameFrame=${(r.sameFrame * 100).toFixed(1)}% (ret ${(r.retSameFrame * 100).toFixed(1)}%) postBounce=${(r.avgPostBounce * 1000).toFixed(0)}ms z=${r.avgContactZ.toFixed(2)}`,
    );
  }
}
