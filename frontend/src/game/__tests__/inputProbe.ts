/* Input investigation harness (dev evidence for the lag / "double shot" report).
 * Run: npx tsx src/game/__tests__/inputProbe.ts
 */
import { GameSimulation } from "../sim/GameSimulation";
import { quickMatchConfig } from "../config/matchConfig";

const DT = 1000 / 60;

// --- A) Does a single gesture ever produce more than one contact? ----------
// Simulate the worst case: the UI double-fires (two submitSwipe in one tick),
// plus a second flick arriving a few ticks later while the ball is still near.
function doubleFireProbe() {
  const sim = new GameSimulation(quickMatchConfig("CLUB", 4242));
  let contacts = 0;
  let humanContacts = 0;
  let ticks = 0;
  let firedOnce = false;
  while (sim.phase !== "game_over" && ticks < 60 * 90) {
    if (sim.humanIsServer()) sim.submitSwipe({ dx: 0, dy: -140, power: 0.6, tap: false });
    if (sim.humanCanHit() && !firedOnce) {
      // Double-fire the SAME gesture twice in one frame, then again next frame.
      sim.submitSwipe({ dx: 10, dy: -120, power: 0.6, tap: false });
      sim.submitSwipe({ dx: 10, dy: -120, power: 0.6, tap: false });
      firedOnce = true;
    }
    sim.step();
    const evs = sim.consumeContactEvents();
    for (const e of evs) {
      contacts++;
      if (e.slot === 0) humanContacts++;
    }
    if (sim.humanCanHit() === false && firedOnce) firedOnce = false; // allow next rally
    ticks++;
    if (humanContacts >= 5) break;
  }
  console.log(`[A double-fire] human contacts recorded: ${humanContacts} (each swipe burst must yield ONE)`);
}

// --- B) Gap between consecutive near-team contacts (your hit vs partner's) --
// If two near-team contacts land within a few frames they can PERCEIVE as a
// "double shot" even though they are two legitimate, distinct hits.
function nearGapProbe() {
  const sim = new GameSimulation(quickMatchConfig("CLUB", 99));
  // Make slot 0 an AI too so the rally plays itself (pure timing measurement).
  const auto = sim; // human slot still 0 but we never swipe → it just can't return; use AI config instead
  void auto;
  const aiSim = new GameSimulation(
    (() => {
      const c = quickMatchConfig("CLUB", 99);
      c.near.players[0].controller = "AI";
      c.near.players[0].profileId = "CLUB";
      return c;
    })(),
  );
  let lastNear = -1;
  const gaps: number[] = [];
  let ticks = 0;
  while (aiSim.phase !== "game_over" && ticks < 60 * 120 && gaps.length < 200) {
    aiSim.step();
    for (const e of aiSim.consumeContactEvents()) {
      if (e.team === "near") {
        if (lastNear >= 0) gaps.push(e.time - lastNear);
        lastNear = e.time;
      } else {
        lastNear = -1; // reset when the far team hits in between
      }
    }
    ticks++;
  }
  const close = gaps.filter((g) => g < 0.25).length;
  console.log(
    `[B near-pair gap] consecutive near contacts with NO far hit between: ${gaps.length}; within 0.25s: ${close}` +
      (gaps.length ? ` (min ${Math.min(...gaps).toFixed(3)}s)` : ""),
  );
}

// --- C) Swipe → contact latency (the "lag"): ticks spent waiting -----------
function latencyProbe() {
  const samples: number[] = [];
  for (let s = 0; s < 40 && samples.length < 300; s++) {
    const sim = new GameSimulation(quickMatchConfig("CLUB", 9000 + s));
    let ticks = 0;
    let armedAt = -1;
    while (sim.phase !== "game_over" && ticks < 60 * 120 && samples.length < 300) {
      if (sim.humanIsServer()) sim.submitSwipe({ dx: 0, dy: -140, power: 0.6, tap: false });
      if (sim.humanCanHit() && armedAt < 0) {
        armedAt = ticks;
        sim.submitSwipe({ dx: 10, dy: -120, power: 0.6, tap: false });
      }
      const before = sim.ball.lastHitBy === 0;
      sim.step();
      if (armedAt >= 0 && sim.ball.lastHitBy === 0 && !before) {
        samples.push(ticks - armedAt);
        armedAt = -1;
      }
      if (!sim.humanCanHit() && armedAt >= 0 && ticks - armedAt > 30) armedAt = -1;
      ticks++;
    }
  }
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const sorted = samples.slice().sort((a, b) => a - b);
  console.log(
    `[C swipe→contact] ${samples.length} contacts: avg ${avg.toFixed(1)} ticks (${(avg * DT).toFixed(0)}ms), ` +
      `p90 ${sorted[Math.floor(sorted.length * 0.9)]} ticks, min ${sorted[0]} ticks (${(sorted[0] * DT).toFixed(0)}ms). ` +
      `Min tick ≈ pure pipeline cost; the rest is the intentional wait for the ball to arrive.`,
  );
}

console.log("=== Picklewood input investigation ===");
doubleFireProbe();
nearGapProbe();
latencyProbe();
console.log("done");
