/* Headless simulation step-time benchmark (not pass/fail).
 * Run: npx tsx src/game/__tests__/stepBench.ts [runs]
 * 30 seeded CLUB matches (same seeds every time, default doubles config, all AI).
 * Reports the average step() time in µs (best of N runs, to reduce noise).
 */
import { GameSimulation } from "../sim/GameSimulation";

function once(): number {
  let steps = 0;
  let total = 0;
  for (let i = 0; i < 30; i++) {
    const sim = new GameSimulation({
      seed: 5000 + i, difficulty: "CLUB", controllers: ["AI", "AI", "AI", "AI"],
      difficulties: ["CLUB", undefined as any, undefined as any, undefined as any],
    });
    const t0 = performance.now();
    let n = 0;
    while (sim.phase !== "game_over" && n < 60 * 60 * 20) {
      sim.step();
      sim.consumeContactEvents();
      sim.consumeBounceEvents();
      n++;
    }
    total += performance.now() - t0;
    steps += n;
  }
  return (total * 1000) / steps;
}

const runs = Number(process.argv[2] ?? 5);
once(); // warm-up (JIT)
const results: number[] = [];
for (let r = 0; r < runs; r++) results.push(once());
results.sort((a, b) => a - b);
console.log(`stepBench: best=${results[0].toFixed(2)}µs median=${results[Math.floor(runs / 2)].toFixed(2)}µs (runs=${runs}, 30 CLUB matches)`);
