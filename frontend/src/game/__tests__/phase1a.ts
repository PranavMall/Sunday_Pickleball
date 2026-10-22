/* Phase 1A tests (Session A). Run: npx tsx src/game/__tests__/phase1a.ts */
import { faultLabelFor } from "../faultLabel";
import { COURT } from "../config/court";
import { INPUT, TACTIC } from "../config/tuning";
import { GameSimulation } from "../sim/GameSimulation";
import { NEAR_LINE_Y } from "./retrieval";
import { cueProbe } from "./smashCueProbe";
import type { FaultEvent, FaultReason, Team } from "../sim/types";

let passed = 0;
let failed = 0;
export function ok(cond: boolean, name: string) {
  if (cond) passed++;
  else {
    failed++;
    console.log("  ✗ FAIL:", name);
  }
}
export function eq(a: unknown, b: unknown, name: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
}

const f = (reason: FaultReason, faultingTeam: Team): FaultEvent => ({ reason, faultingTeam, x: 0, y: 0, message: "" });

function faultLabelTests() {
  console.log("\n[Commit 0: fault label]");
  eq(faultLabelFor(f("TWO_BOUNCE", "near"))?.text, "TWO-BOUNCE FAULT", "TWO_BOUNCE mine");
  eq(faultLabelFor(f("TWO_BOUNCE", "far"))?.text, "TWO-BOUNCE FAULT · Rivals", "TWO_BOUNCE rivals");
  for (const r of ["KITCHEN_VOLLEY", "KITCHEN_MOMENTUM", "KITCHEN_NOT_ESTABLISHED"] as FaultReason[])
    eq(faultLabelFor(f(r, "near"))?.text, "KITCHEN FAULT", r);
  eq(faultLabelFor(f("NET", "far"))?.text, "NET · Rivals", "NET rivals");
  eq(faultLabelFor(f("SERVE_NET", "near"))?.text, "NET", "SERVE_NET");
  eq(faultLabelFor(f("OUT", "near"))?.text, "OUT", "OUT");
  eq(faultLabelFor(f("SERVE_OUT", "far"))?.text, "OUT · Rivals", "SERVE_OUT rivals");
  eq(faultLabelFor(f("SERVE_WRONG_BOX", "near"))?.text, "SERVE FAULT", "SERVE_WRONG_BOX");
  eq(faultLabelFor(f("SERVE_KITCHEN", "far"))?.text, "SERVE FAULT · Rivals", "SERVE_KITCHEN rivals");
  eq(faultLabelFor(f("DOUBLE_BOUNCE", "far"))?.text, "WINNER", "DOUBLE_BOUNCE rivals → WINNER");
  eq(faultLabelFor(f("DOUBLE_BOUNCE", "near"))?.text, "MISSED", "DOUBLE_BOUNCE mine → MISSED");
  eq(faultLabelFor(f("OWN_COURT", "near"))?.text, "DIDN'T CROSS", "OWN_COURT");
  eq(faultLabelFor(f("DEAD_BALL", "near")), null, "DEAD_BALL → no label");
  eq(faultLabelFor(null), null, "no fault → no label");
  eq(faultLabelFor(f("OUT", "near"))?.mine, true, "my fault → red (mine)");
  eq(faultLabelFor(f("OUT", "far"))?.mine, false, "rival fault → gold");
}

export const suites: { name: string; run: () => void | Promise<void> }[] = [
  { name: "faultLabel", run: faultLabelTests },
  { name: "smashLatch", run: smashLatchTests },
];

// A far lob dropping onto the human at the kitchen line (rally strike 7+).
function lobOntoHuman(seed: number) {
  const sim = new GameSimulation({ seed, difficulty: "CLUB" });
  sim.phase = "rally";
  sim.rallyStrikeCount = 6;
  sim.serveCtx.active = false;
  for (const p of sim.players) p.isServing = false;
  const h = sim.players[0];
  h.x = h.targetX = 14; h.y = h.targetY = NEAR_LINE_Y;
  sim.players[1].x = 5; sim.players[1].y = 40;
  const far = sim.players[2];
  far.x = 13; far.y = 13.8;
  Object.assign(sim.ball, { x: 13, y: 13.4, z: 1.5, vx: 0, vy: 0, vz: 0, inPlay: true, lastHitTeam: "near", lastHitBy: 0, bouncesSinceHit: 1, crossedNetSinceHit: true });
  (sim as any).executeShot(far, "lob", 14, COURT.LENGTH - 13, { accuracy: 1, unforcedError: 0 });
  return sim;
}

// Step until the first frame the cue is in `phase`; returns frames waited.
function stepUntilPhase(sim: GameSimulation, phase: "ready" | "smash", max = 200) {
  for (let i = 0; i < max; i++) {
    if (sim.humanSmashCuePhase() === phase) return i;
    if (sim.phase !== "rally" || sim.ball.lastHitTeam !== "far") return -1;
    sim.step();
  }
  return -1;
}

function runToHumanContact(sim: GameSimulation, max = 240): string | null {
  for (let i = 0; i < max && sim.phase === "rally"; i++) {
    sim.step();
    for (const ev of sim.consumeContactEvents()) if (ev.slot === 0) return ev.shotType;
    if (sim.ball.lastHitTeam === "near") return "partner";
  }
  return null;
}

function smashLatchTests() {
  console.log("\n[Commit 1: smash cue + latch]");
  // Cue phases: READY first (well ahead of contact), then SMASH.
  {
    const sim = lobOntoHuman(5);
    sim.consumeContactEvents();
    const r = stepUntilPhase(sim, "ready");
    ok(r >= 0, "cue: HIGH BALL — GET READY shows for a lob dropping to me");
    let readyFrames = 0, steps = 0;
    while (sim.humanSmashCuePhase() !== "smash" && steps < 300 && sim.phase === "rally") {
      if (sim.humanSmashCuePhase() === "ready") readyFrames++;
      sim.step(); steps++;
    }
    ok(readyFrames / 60 >= 0.35, `cue: READY phase lasts ≥ 350 ms before SMASH (${Math.round((readyFrames / 60) * 1000)} ms)`);
    ok(sim.humanSmashCuePhase() === "smash", `cue: READY turns into SMASH when the window opens (got ${sim.humanSmashCuePhase()} after ${readyFrames}f)`);
  }
  // A firm swipe under READY (long before contact) is latched, survives
  // SWIPE_BUFFER_TIME, and produces a smash.
  {
    const sim = lobOntoHuman(5);
    sim.consumeContactEvents();
    stepUntilPhase(sim, "ready");
    sim.submitSwipe({ dx: 0, dy: -150, power: 0.6, tap: false, speed: 1600 });
    ok(sim.smashLatched, "latch: firm swipe under the cue sets smashLatched");
    for (let i = 0; i < Math.ceil((INPUT.SWIPE_BUFFER_TIME + 0.1) * 60) && !sim.humanCanHit(); i++) sim.step();
    ok(sim.hasBufferedSwipe(), "latch: a latched swipe is not expired by SWIPE_BUFFER_TIME");
    const shot = runToHumanContact(sim);
    eq(shot, "smash", "latch: the latched firm swipe produces a SMASH");
    ok(!sim.smashLatched && sim.humanSmashCuePhase() === null, "latch + cue clear on my contact");
  }
  // A gentle swipe under the cue does not latch and is not a smash.
  {
    const sim = lobOntoHuman(5);
    stepUntilPhase(sim, "ready");
    sim.submitSwipe({ dx: 0, dy: -40, power: 0.2, tap: false, speed: 300 });
    ok(!sim.smashLatched, "latch: a gentle swipe under the cue does NOT latch");
    for (let i = 0; i < Math.ceil((INPUT.SWIPE_BUFFER_TIME + 0.05) * 60) && !sim.humanCanHit(); i++) sim.step();
    ok(!sim.hasBufferedSwipe() || sim.humanCanHit(), "latch: an unlatched early swipe still expires normally");
  }
  {
    const sim = lobOntoHuman(5);
    stepUntilPhase(sim, "smash");
    sim.consumeContactEvents();
    sim.submitSwipe({ dx: 0, dy: -40, power: 0.2, tap: false, speed: 300 });
    const shot = runToHumanContact(sim);
    ok(shot !== "smash", `latch: a gentle swipe under SMASH is not a smash (got ${shot})`);
  }
  // A latched swipe clears on bounce (no stale shot afterwards).
  {
    const sim = lobOntoHuman(5);
    stepUntilPhase(sim, "ready");
    sim.submitSwipe({ dx: 0, dy: -150, power: 0.6, tap: false, speed: 1600 });
    // Move me away so I can't reach it: the ball bounces.
    const h = sim.players[0];
    let bounced = false;
    for (let i = 0; i < 240 && sim.phase === "rally" && !bounced; i++) {
      h.x = h.targetX = 2; h.y = h.targetY = 43;
      sim.step();
      if (sim.consumeBounceEvents().length) bounced = true;
    }
    ok(bounced && !sim.smashLatched && !sim.hasBufferedSwipe(), "latch: a bounce clears the latch and its swipe");
  }
  // Point end clears it.
  {
    const sim = lobOntoHuman(5);
    stepUntilPhase(sim, "ready");
    sim.submitSwipe({ dx: 0, dy: -150, power: 0.6, tap: false, speed: 1600 });
    sim.debugPlayPoint("far");
    ok(!sim.smashLatched && !sim.hasBufferedSwipe(), "latch: point end clears the latch and its swipe");
  }
  // Classification tolerance (human only, latched): ball 0.5 ft below
  // SMASH_MIN_Z is still a smash; unlatched it is not; 0.7 ft below is not.
  {
    const mk = (z: number, latched: boolean) => {
      const sim = lobOntoHuman(5);
      const h = sim.players[0];
      Object.assign(sim.ball, { x: h.x, y: h.y - 0.5, z, vx: 0, vy: 0, vz: -10, bouncesSinceHit: 0, lastHitTeam: "far", lastHitBy: 2 });
      sim.apexSinceHit = 10;
      sim.smashLatched = latched;
      (sim as any).executeHumanHit(h, { dx: 0, dy: -150, power: 0.6, tap: false, speed: 1600 }, 0);
      return sim.lastHumanShot?.type;
    };
    eq(mk(TACTIC.SMASH_MIN_Z - 0.5, true), "smash", "tolerance: latched, 0.5 ft below SMASH_MIN_Z → smash");
    ok(mk(TACTIC.SMASH_MIN_Z - 0.5, false) !== "smash", "tolerance: NOT latched, 0.5 ft below → not a smash");
    ok(mk(TACTIC.SMASH_MIN_Z - 0.7, true) !== "smash", "tolerance: latched, 0.7 ft below → not a smash");
  }
  // All-AI matches never predict or latch (AI untouched).
  {
    const sim = new GameSimulation({ seed: 3, difficulty: "PRO", controllers: ["AI", "AI", "AI", "AI"] });
    let any = false;
    for (let i = 0; i < 60 * 60 * 3 && sim.phase !== "game_over"; i++) {
      sim.step();
      if ((sim as any).smashPredicted || sim.smashLatched) any = true;
    }
    ok(!any, "AI-only match: smash prediction/latch never set");
  }
  // Duration probe (human, 40 seeds, CLUB + PRO): median on-screen ≥ 350 ms.
  const pr = cueProbe();
  console.log(`  cue probe: old median ${pr.oldMedianMs.toFixed(0)} ms (n=${pr.oldN}) → new median ${pr.newMedianMs.toFixed(0)} ms (n=${pr.newN})`);
  ok(pr.newMedianMs >= 350, "cue: median on-screen duration ≥ 350 ms");
}

if (process.argv[1]?.includes("phase1a")) {
  (async () => {
    for (const s of suites) await s.run();
    console.log(`\n=== PHASE 1A RESULT: ${passed} passed, ${failed} failed ===`);
    if (failed) process.exit(1);
  })();
}
