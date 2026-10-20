/* Singles vs doubles diagnostic (B1 §4b). Not pass/fail.
 * Run: npx tsx src/game/__tests__/singlesDiag.ts
 * Same build, same CLUB AI, AI-vs-AI. Measures:
 *   - simulation step cost (µs/step)
 *   - PACE: avg ball flight time between hits, avg rally duration (s),
 *     avg strikes per rally, avg distance a near player travels per own shot
 * Rendered fps cannot be measured headlessly — see hand-off.
 */
import { buildMatchConfig } from "../config/matchConfig";
import { GameSimulation } from "../sim/GameSimulation";

function run(format: "singles" | "doubles", seeds: number[]) {
  let steps = 0, ns = 0n;
  let gaps = 0, gapSum = 0, rallies = 0, rallySec = 0, strikes = 0;
  let travel = 0, nearShots = 0;
  for (const seed of seeds) {
    const n = format === "singles" ? 1 : 2;
    const sim = new GameSimulation(
      buildMatchConfig({
        seed,
        format,
        near: { controllers: Array(n).fill("AI"), difficulties: Array(n).fill("CLUB") },
        far: { controllers: Array(n).fill("AI"), difficulties: Array(n).fill("CLUB") },
      }),
    );
    let lastHit = -1, rallyStart = -1, ticks = 0;
    const prev = sim.players.map((p) => ({ x: p.x, y: p.y }));
    while (sim.phase !== "game_over" && ticks < 60 * 60 * 20) {
      const before = sim.phase;
      const t0 = process.hrtime.bigint();
      sim.step();
      ns += process.hrtime.bigint() - t0;
      steps++;
      ticks++;
      if (sim.phase === "rally") {
        sim.players.forEach((p, i) => {
          if (p.team === "near") travel += Math.hypot(p.x - prev[i].x, p.y - prev[i].y);
        });
      }
      sim.players.forEach((p, i) => { prev[i].x = p.x; prev[i].y = p.y; });
      for (const ev of sim.consumeContactEvents()) {
        strikes++;
        if (ev.team === "near") nearShots++;
        if (ev.isServe) { rallyStart = ev.time; lastHit = ev.time; continue; }
        if (lastHit >= 0) { gapSum += ev.time - lastHit; gaps++; }
        lastHit = ev.time;
      }
      if (before === "rally" && sim.phase !== "rally" && rallyStart >= 0) {
        rallies++;
        rallySec += sim.time - rallyStart;
        rallyStart = -1;
        lastHit = -1;
      }
    }
  }
  return {
    usPerStep: Number(ns / BigInt(steps)) / 1000,
    flight: gapSum / gaps,
    rallySec: rallySec / rallies,
    strikesPerRally: strikes / rallies,
    travelPerShot: travel / nearShots,
  };
}

const seeds = Array.from({ length: 20 }, (_, i) => 6100 + i);
for (const f of ["doubles", "singles"] as const) {
  const r = run(f, seeds);
  console.log(
    `${f.padEnd(8)} step=${r.usPerStep.toFixed(1)}µs  flightBetweenHits=${r.flight.toFixed(2)}s  rally=${r.rallySec.toFixed(2)}s  strikes/rally=${r.strikesPerRally.toFixed(1)}  nearTravel/ownShot=${r.travelPerShot.toFixed(1)}ft`,
  );
}
