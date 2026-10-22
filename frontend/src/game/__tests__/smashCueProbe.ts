/* Smash-cue on-screen duration probe (not pass/fail).
 * Run: npx tsx src/game/__tests__/smashCueProbe.ts
 * Human (scripted) + CLUB partner vs CLUB and PRO, 40 seeds each. Measures every
 * contiguous episode the cue is on screen (sim time):
 *   old = humanSmashCue() (B3 "SMASH!" cue)
 *   new = humanSmashCuePhase() !== null (Phase 1A two-phase cue), when present
 * The scripted human swipes only when it can hit (firm on an open smash window).
 */
import { GameSimulation } from "../sim/GameSimulation";
import type { Difficulty } from "../sim/types";

function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

export function cueProbe(tiers: Difficulty[] = ["CLUB", "PRO"], seeds = 40) {
  const oldEp: number[] = [];
  const newEp: number[] = [];
  let humanSmashes = 0;
  for (const d of tiers) {
    for (let s = 0; s < seeds; s++) {
      const sim = new GameSimulation({ seed: 9000 + s, difficulty: d });
      const phaseFn = (sim as any).humanSmashCuePhase?.bind(sim) as (() => string | null) | undefined;
      let oldOn = 0, newOn = 0, n = 0, ticks = 0;
      while (sim.phase !== "game_over" && ticks < 60 * 60 * 8) {
        if (sim.humanIsServer() && !sim.hasBufferedSwipe()) sim.submitSwipe({ dx: 0, dy: -140, power: 0.6, tap: false });
        if (sim.humanCanHit() && !sim.hasBufferedSwipe()) {
          const k = n++ % 3;
          if (sim.humanSmashWindow()) sim.submitSwipe({ dx: 10, dy: -150, power: 0.6, tap: false, speed: 1600 });
          else if (k === 0) sim.submitSwipe({ dx: 30, dy: -50, power: 0.22, tap: false, speed: 450 });
          else sim.submitSwipe({ dx: -30, dy: -110, power: 0.5, tap: false, speed: 1300 });
        }
        sim.step();
        ticks++;
        for (const ev of sim.consumeContactEvents()) if (ev.slot === 0 && ev.shotType === "smash") humanSmashes++;
        const o = sim.humanSmashCue();
        const nw = phaseFn ? phaseFn() !== null : false;
        if (o) oldOn++; else if (oldOn) { oldEp.push(oldOn / 60); oldOn = 0; }
        if (nw) newOn++; else if (newOn) { newEp.push(newOn / 60); newOn = 0; }
      }
    }
  }
  return { oldN: oldEp.length, oldMedianMs: median(oldEp) * 1000, newN: newEp.length, newMedianMs: median(newEp) * 1000, humanSmashes };
}

if (process.argv[1]?.includes("smashCueProbe")) {
  const r = cueProbe();
  console.log(
    `smash cue (40 seeds × CLUB+PRO): old SMASH! cue episodes=${r.oldN} median=${r.oldMedianMs.toFixed(0)}ms | new two-phase cue episodes=${r.newN} median=${r.newMedianMs.toFixed(0)}ms | human smashes=${r.humanSmashes}`,
  );
}
