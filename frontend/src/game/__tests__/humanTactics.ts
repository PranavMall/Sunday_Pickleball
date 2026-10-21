/* Human tactical scenarios for the B2 §3 tests (lob arm, smash, scripted mix).
 * Run alone: npx tsx src/game/__tests__/humanTactics.ts
 */
import { COURT, isInsideCourt } from "../config/court";
import { PLAYER } from "../config/tuning";
import { GameSimulation } from "../sim/GameSimulation";
import { NEAR_LINE_Y } from "./retrieval";

function rallySim(seed = 77) {
  const sim = new GameSimulation({ seed, difficulty: "CLUB" });
  sim.phase = "rally";
  sim.rallyStrikeCount = 6;
  sim.serveCtx.active = false;
  for (const p of sim.players) p.isServing = false;
  return sim;
}

function legalBallAt(sim: GameSimulation, x: number, y: number) {
  Object.assign(sim.ball, { x, y, z: 1.2, vx: 0, vy: 0, vz: 0, bouncesSinceHit: 1, inPlay: true, lastHitTeam: "far", lastHitBy: 2, crossedNetSinceHit: true });
}

export function lobClearTests(): { name: string; ok: boolean }[] {
  const out: { name: string; ok: boolean }[] = [];
  // Partner's strike clears my armed lob.
  {
    const sim = rallySim();
    sim.toggleLob();
    const partner = sim.players[1];
    partner.x = 6; partner.y = 36;
    legalBallAt(sim, 6, 35.6);
    (sim as any).executeShot(partner, "drive", 10, 8, { accuracy: 1, unforcedError: 0 });
    out.push({ name: "3: an armed LOB clears when my PARTNER strikes", ok: !sim.lobArmed && sim.lastShotType === "drive" });
  }
  // Point end clears it.
  {
    const sim = rallySim();
    sim.toggleLob();
    sim.debugPlayPoint("far");
    out.push({ name: "3: an armed LOB clears at point end", ok: !sim.lobArmed });
  }
  // Second tap clears it.
  {
    const sim = rallySim();
    const on = sim.toggleLob();
    const off = sim.toggleLob();
    out.push({ name: "3: a second LOB tap clears it", ok: on && !off && !sim.lobArmed });
  }
  // It never times out while I wait (opponents serve, ball still coming).
  {
    const sim = new GameSimulation({ seed: 21, difficulty: "CLUB" });
    sim.score = { ...sim.score, servingTeam: "far" };
    sim.serverSlot = 2;
    sim.setupServe();
    sim.toggleLob();
    let t = 0;
    while (sim.rallyStrikeCount < 1 && t < 600) { sim.step(); t++; }
    for (let i = 0; i < 20; i++) sim.step();
    out.push({ name: "3: an armed LOB survives the opponents' strike + waiting (no timeout)", ok: sim.lobArmed });
  }
  // My next strike is the lob and clears the arm.
  {
    const sim = rallySim();
    sim.toggleLob();
    const h = sim.players[0];
    h.x = 10; h.y = NEAR_LINE_Y;
    legalBallAt(sim, 10, NEAR_LINE_Y - 0.4);
    (sim as any).executeHumanHit(h, { dx: 0, dy: -150, power: 0.65, tap: false, speed: 600 }, 0);
    out.push({ name: "3: my armed strike is a LOB and the arm clears", ok: sim.lastHumanShot?.type === "lob" && !sim.lobArmed });
  }
  return out;
}

// Human smash from the kitchen line on a ball dropping from a high arc.
export function humanSmashScenario() {
  let goodIn = 0, goodN = 0, badOut = 0, badN = 0;
  const one = (dx: number, lateness: number) => {
    const sim = rallySim(300 + Math.round(dx) + Math.round(lateness * 10));
    const h = sim.players[0];
    h.x = 10; h.y = NEAR_LINE_Y + 1;
    for (const o of sim.players) if (o.team === "far") { o.x = o.targetX = o.slot === 2 ? 5 : 15; o.y = o.targetY = COURT.FAR_KITCHEN_Y - 1.2; }
    Object.assign(sim.ball, { x: 10, y: h.y - 0.5, z: 3.9, vx: 0, vy: 0, vz: -12, bouncesSinceHit: 0, inPlay: true, lastHitTeam: "far", lastHitBy: 2, crossedNetSinceHit: true });
    sim.apexSinceHit = 10;
    (sim as any).executeHumanHit(h, { dx, dy: -140, power: 0.6, tap: false, speed: 1500 }, lateness);
    if (sim.lastHumanShot?.type !== "smash") return null;
    let landed: { x: number; y: number } | null = null;
    for (let i = 0; i < 120 && sim.phase === "rally" && !landed; i++) {
      sim.step();
      for (const b of sim.consumeBounceEvents()) if (!landed) landed = { x: b.x, y: b.y };
    }
    const inCourt = !!landed && landed.y < COURT.NET_Y && isInsideCourt(landed.x, landed.y);
    return inCourt;
  };
  for (const dx of [-90, -45, 0, 45, 90]) for (const late of [0, 0.2, 0.4]) {
    const r = one(dx, late);
    if (r === null) continue;
    goodN++; if (r) goodIn++;
  }
  for (const dx of [-420, 420, 0, -300, 300]) for (const late of [2.0, 2.4]) {
    const r = one(dx, late);
    if (r === null) continue;
    badN++; if (!r) badOut++;
  }
  // Cue: a short far lob dropping onto me at the line.
  const sim = rallySim(5);
  const h = sim.players[0];
  // (I cover the right lane; partner parked deep on the left.)
  h.x = h.targetX = 14; h.y = h.targetY = NEAR_LINE_Y;
  sim.players[1].x = 5; sim.players[1].y = 40;
  const far = sim.players[2];
  far.x = 13; far.y = 13.8;
  Object.assign(sim.ball, { x: 13, y: 13.4, z: 1.5, vx: 0, vy: 0, vz: 0, inPlay: true, lastHitTeam: "near", lastHitBy: 0, bouncesSinceHit: 1, crossedNetSinceHit: true });
  (sim as any).executeShot(far, "lob", 14, COURT.LENGTH - 13, { accuracy: 1, unforcedError: 0 });
  let cueSeen = false;
  for (let i = 0; i < 150 && sim.phase === "rally" && sim.ball.lastHitTeam === "far"; i++) {
    sim.step();
    if (sim.humanSmashCue()) cueSeen = true;
  }
  return { goodIn, goodN, badOut, badN, cueSeen };
}

// Scripted human: plays whole points with a fixed cycle of gestures.
export function humanShotMixScript(seeds = [11, 12, 13]) {
  const mix: Record<string, number> = {};
  let lobDeep = 0, lobSits = 0, lobShort = 0;
  for (const seed of seeds) {
    const sim = new GameSimulation({ seed, difficulty: "CLUB" });
    let n = 0, ticks = 0, lastShotTime = -1, pendingLob = false;
    while (sim.phase !== "game_over" && ticks < 60 * 60 * 6) {
      if (sim.humanIsServer() && !sim.hasBufferedSwipe()) sim.submitSwipe({ dx: 0, dy: -140, power: 0.6, tap: false });
      if (sim.humanCanHit() && !sim.hasBufferedSwipe()) {
        const k = n++ % 5;
        if (sim.humanSmashWindow()) sim.submitSwipe({ dx: 20, dy: -150, power: 0.6, tap: false, speed: 1600 });
        else if (k === 0) sim.submitSwipe({ dx: 30, dy: -50, power: 0.22, tap: false, speed: 450 });
        else if (k === 1) sim.submitSwipe({ dx: -40, dy: -90, power: 0.4, tap: false, speed: 1400 });
        else if (k === 2) sim.submitSwipe({ dx: 10, dy: -160, power: 0.7, tap: false, speed: 800 });
        else if (k === 3) { if (!sim.lobArmed) sim.toggleLob(); sim.submitSwipe({ dx: 0, dy: -150, power: 0.65, tap: false, speed: 700 }); }
        else sim.submitSwipe({ dx: -20, dy: -60, power: 0.3, tap: false, speed: 500 });
      }
      sim.step();
      ticks++;
      if (sim.lastHumanShot && sim.lastHumanShot.time !== lastShotTime) {
        lastShotTime = sim.lastHumanShot.time;
        mix[sim.lastHumanShot.type] = (mix[sim.lastHumanShot.type] ?? 0) + 1;
        pendingLob = sim.lastHumanShot.type === "lob";
      }
      for (const b of sim.consumeBounceEvents()) {
        if (pendingLob && b.y < COURT.NET_Y) {
          const depth = b.y;
          if (depth <= 8) lobDeep++; else if (depth <= 14) lobSits++; else lobShort++;
          pendingLob = false;
        }
      }
      if (pendingLob && sim.ball.lastHitTeam === "far" && sim.ball.bouncesSinceHit === 0) {
        // volleyed before landing: classify by where it was taken
        const depth = sim.ball.y;
        if (depth <= 8) lobDeep++; else if (depth <= 14) lobSits++; else lobShort++;
        pendingLob = false;
      }
    }
  }
  void PLAYER;
  return { mix, lobDeep, lobSits, lobShort };
}

if (process.argv[1]?.includes("humanTactics")) {
  for (const r of lobClearTests()) console.log(r.ok ? "PASS" : "FAIL", r.name);
  console.log(humanSmashScenario());
  console.log(humanShotMixScript());
}

// Controlled human lob outcomes from the kitchen line: good (full + on time),
// mediocre, and bad (weak / mistimed) swipes → first-bounce depth class.
export function humanLobOutcomes() {
  const res: Record<string, { deep: number; sits: number; short: number }> = {};
  const cases: [string, number, number][] = [["good", 0.65, 0], ["good", 0.8, 0.2], ["mediocre", 0.45, 0.8], ["mediocre", 0.55, 1.0], ["bad", 0.25, 1.6], ["bad", 0.2, 2.2]];
  for (const [label, power, late] of cases) {
    for (const dx of [-60, 0, 60]) {
      const sim = rallySim(400 + dx);
      const h = sim.players[0];
      h.x = 10; h.y = NEAR_LINE_Y;
      for (const o of sim.players) if (o.team === "far") { o.x = o.targetX = 10; o.y = o.targetY = 1; }
      legalBallAt(sim, 10, NEAR_LINE_Y - 0.4);
      sim.toggleLob();
      (sim as any).executeHumanHit(h, { dx, dy: -150, power, tap: false, speed: 700 }, late);
      let depth: number | null = null;
      for (let i = 0; i < 200 && depth === null && sim.phase === "rally"; i++) {
        for (const o of sim.players) if (o.team === "far") { o.x = o.targetX = 10; o.y = o.targetY = -2.5; }
        sim.step();
        for (const b of sim.consumeBounceEvents()) if (depth === null) depth = b.y;
      }
      const r = (res[label] ??= { deep: 0, sits: 0, short: 0 });
      if (depth === null) r.short++; else if (depth <= 8) r.deep++; else if (depth <= 14) r.sits++; else r.short++;
    }
  }
  return res;
}
if (process.argv[1]?.includes("humanTactics")) console.log("human lob outcomes", JSON.stringify(humanLobOutcomes()));
