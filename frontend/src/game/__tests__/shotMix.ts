/* AI shot-mix + rally-length + win-rate measurement (not pass/fail).
 * Run: npx tsx src/game/__tests__/shotMix.ts [label]
 * Real default config (slot0 = CLUB stand-in for the human, CLUB partner,
 * opponents at difficulty). Counts every non-serve AI strike by shot type,
 * avg rally (strikes/point incl. serve), opponent win rate, stuck states, and
 * the share of drives/deep shots struck BEFORE both teams reach the kitchen.
 */
import { COURT } from "../config/court";
import { GameSimulation } from "../sim/GameSimulation";
import type { Difficulty, ShotType } from "../sim/types";

const TYPES: ShotType[] = ["dink", "drop", "drive", "lob", "smash"];

export function shotMix(opp: Difficulty, seeds: number[]) {
  const mix: Record<string, number> = { dink: 0, drop: 0, drive: 0, lob: 0, smash: 0 };
  const oppMix: Record<string, number> = { dink: 0, drop: 0, drive: 0, lob: 0, smash: 0 };
  let strikes = 0, points = 0, oppWins = 0, stuck = 0, earlyDrives = 0, earlyStrikes = 0;
  for (const seed of seeds) {
    const sim = new GameSimulation({
      seed, difficulty: opp, controllers: ["AI", "AI", "AI", "AI"],
      difficulties: ["CLUB", undefined as any, undefined as any, undefined as any],
    });
    let ticks = 0, recorded = -1;
    while (sim.phase !== "game_over" && ticks < 60 * 60 * 20) {
      sim.step();
      ticks++;
      for (const ev of sim.consumeContactEvents()) {
        if (ev.isServe) continue;
        strikes++;
        mix[ev.shotType] = (mix[ev.shotType] ?? 0) + 1;
        if (ev.team === "far") oppMix[ev.shotType] = (oppMix[ev.shotType] ?? 0) + 1;
        const atLine = sim.players.every((p) => Math.abs(p.y - (p.team === "near" ? COURT.NEAR_KITCHEN_Y : COURT.FAR_KITCHEN_Y)) < 4);
        if (!atLine) { earlyStrikes++; if (ev.shotType === "drive") earlyDrives++; }
      }
      if (sim.phase === "point_over" && sim.stats.pointsPlayed !== recorded) { recorded = sim.stats.pointsPlayed; points++; }
    }
    if (sim.phase !== "game_over") stuck++;
    if (sim.winner === "far") oppWins++;
  }
  const pct = (m: Record<string, number>) => {
    const tot = TYPES.reduce((a, t) => a + (m[t] ?? 0), 0) || 1;
    return Object.fromEntries(TYPES.map((t) => [t, Math.round(((m[t] ?? 0) / tot) * 1000) / 10]));
  };
  return {
    avgRally: strikes / points + 1,
    mix: pct(mix),
    oppMix: pct(oppMix),
    oppWinRate: oppWins / seeds.length,
    stuck,
    earlyDriveShare: earlyDrives / Math.max(1, earlyStrikes),
  };
}

if (process.argv[1]?.includes("shotMix")) {
  const label = process.argv[2] ?? "current";
  const seeds = Array.from({ length: 30 }, (_, i) => 2000 + i);
  console.log(`=== AI shot mix [${label}] (30 seeded matches / tier) ===`);
  for (const d of ["ROOKIE", "CLUB", "PRO"] as Difficulty[]) {
    const r = shotMix(d, seeds);
    const m = r.mix;
    console.log(
      `${d.padEnd(6)} avgRally=${r.avgRally.toFixed(2)} dink=${m.dink}% drop=${m.drop}% drive=${m.drive}% lob=${m.lob}% smash=${m.smash}% | pre-kitchen drive share=${(r.earlyDriveShare * 100).toFixed(0)}% | opp win=${(r.oppWinRate * 100).toFixed(0)}% stuck=${r.stuck}`,
    );
  }
}
