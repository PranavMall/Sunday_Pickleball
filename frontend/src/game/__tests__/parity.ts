/* Behaviour-parity fingerprint for the DOUBLES simulation.
 * Run: npx tsx src/game/__tests__/parity.ts
 *
 * Plays a fixed battery of seeded AI-vs-AI doubles matches and prints a stable,
 * line-per-match fingerprint (final score, longest rally, totals, winner, ticks).
 * Capture this BEFORE and AFTER the Part A refactor and diff the two outputs:
 * the doubles game must be byte-for-byte identical (no scoring / rule / pace /
 * AI-tuning change). Uses the production MatchConfig path.
 */
import { GameSimulation } from "../sim/GameSimulation";
import { buildMatchConfig } from "../config/matchConfig";
import type { Difficulty, Team } from "../sim/types";

function playHeadless(seed: number, near: Difficulty, far: Difficulty) {
  const sim = new GameSimulation(
    buildMatchConfig({
      seed,
      format: "doubles",
      near: { controllers: ["AI", "AI"], difficulties: [near, near], personalities: ["TACTICAL", "DEFENSIVE"] },
      far: { controllers: ["AI", "AI"], difficulties: [far, far], personalities: ["AGGRESSIVE", "TACTICAL"] },
    }),
  );
  let ticks = 0;
  const max = 60 * 60 * 20;
  while (sim.phase !== "game_over" && ticks < max) {
    sim.step();
    ticks++;
  }
  return {
    seed,
    near: sim.score.nearScore,
    far: sim.score.farScore,
    winner: sim.winner as Team | null,
    longest: sim.stats.longestRally,
    rallies: sim.stats.totalRallies,
    dinks: sim.stats.dinks,
    kFaults: sim.stats.kitchenFaults,
    points: sim.stats.pointsPlayed,
    ticks,
  };
}

const matchups: [Difficulty, Difficulty][] = [
  ["ROOKIE", "ROOKIE"],
  ["CLUB", "CLUB"],
  ["PRO", "PRO"],
  ["CLUB", "ROOKIE"],
  ["PRO", "CLUB"],
];

console.log("=== Picklewood doubles parity fingerprint ===");
for (const [a, b] of matchups) {
  console.log(`\n[${a} vs ${b}]`);
  for (let i = 0; i < 20; i++) {
    const r = playHeadless(7000 + i, a, b);
    console.log(
      `  s${r.seed} ${r.near}-${r.far} w:${r.winner ?? "-"} lr:${r.longest} ral:${r.rallies} dk:${r.dinks} kf:${r.kFaults} pts:${r.points} t:${r.ticks}`,
    );
  }
}
console.log("\ndone");
