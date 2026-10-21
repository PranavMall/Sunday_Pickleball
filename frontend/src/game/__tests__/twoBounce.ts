/* B3 §1 — visible + enforceable two-bounce rule (focused scenarios).
 * Run alone: npx tsx src/game/__tests__/twoBounce.ts
 */
import { COURT } from "../config/court";
import { PHYS, PLAYER, TACTIC, TWO_BOUNCE } from "../config/tuning";
import { GameSimulation, type SwipeInput } from "../sim/GameSimulation";
import { b3Stats } from "./b3Report";

const SWIPE: SwipeInput = { dx: 0, dy: -120, power: 0.6, tap: false, speed: 700 };
const sw = (): SwipeInput => ({ ...SWIPE });

// Rally state where the FAR team just struck strike #strikes and the ball is
// coming to me (slot 0) unbounced.
function incoming(strikes: number, seed = 31) {
  const sim = new GameSimulation({ seed, difficulty: "CLUB" });
  sim.phase = "rally";
  sim.rallyStrikeCount = strikes;
  sim.serveCtx.active = false;
  sim.crossedNetSinceHit = true;
  for (const p of sim.players) p.isServing = false;
  const h = sim.players[0];
  h.x = h.targetX = 10; h.y = h.targetY = 34;
  sim.players[1].x = sim.players[1].targetX = 4; sim.players[1].y = sim.players[1].targetY = 40;
  return sim;
}
function setBall(sim: GameSimulation, b: { x: number; y: number; z: number; vx?: number; vy: number; vz: number }) {
  Object.assign(sim.ball, { vx: 0, ...b, inPlay: true, lastHitTeam: "far", lastHitBy: 2, bouncesSinceHit: 0, bounceSideCount: 0, crossedNetSinceHit: true });
  sim.apexSinceHit = Math.max(b.z, 6);
}
const tBounce = (z: number, vz: number) => (vz + Math.sqrt(vz * vz + 2 * PHYS.GRAVITY * z)) / PHYS.GRAVITY;

// Step until my strike / a fault; returns the contact (time since bounce) or the fault.
function runToContact(sim: GameSimulation, maxTicks = 120) {
  let bounceAt = -1;
  for (let i = 0; i < maxTicks && sim.phase === "rally"; i++) {
    sim.step();
    for (const b of sim.consumeBounceEvents()) if (bounceAt < 0) bounceAt = b.time;
    for (const c of sim.consumeContactEvents()) {
      if (c.slot === 0) return { fault: null as string | null, sinceBounce: bounceAt < 0 ? -1 : c.time - bounceAt, bounced: bounceAt >= 0 };
    }
  }
  return { fault: sim.lastFault?.reason ?? "none", sinceBounce: -1, bounced: bounceAt >= 0 };
}

export function twoBounceTests(): { name: string; ok: boolean; info?: string }[] {
  const out: { name: string; ok: boolean; info?: string }[] = [];

  // 1/2: serve returns + third shots (AI, real matches) never struck on the bounce frame.
  const st = b3Stats("CLUB", [2000, 2001, 2002, 2003, 2004, 2005]);
  out.push({ name: "1: serve return is NOT struck on the bounce frame (seeded matches)", ok: st.retN > 50 && st.retSameFrame === 0, info: `${st.retN} returns` });
  out.push({ name: "1: third shot is NOT struck on the bounce frame (seeded matches)", ok: st.thirdN > 30 && st.thirdSameFrame === 0, info: `${st.thirdN} thirds` });

  // 3: clear pre-bounce volley within reach → TWO_BOUNCE (return and third shot).
  for (const strikes of [1, 2]) {
    const sim = incoming(strikes);
    setBall(sim, { x: 10, y: 33, z: 3.0, vy: 10, vz: -2 }); // in reach, ~0.37 s from its bounce
    sim.submitSwipe(sw());
    sim.step();
    out.push({ name: `1: clear human pre-bounce volley within reach → TWO_BOUNCE (strike ${strikes + 1})`, ok: sim.lastFault?.reason === "TWO_BOUNCE" && sim.lastFault.faultingTeam === "near" });
  }
  // Same via the finger-down (armed / resting-thumb) path.
  {
    const sim = incoming(1);
    setBall(sim, { x: 10, y: 33, z: 3.0, vy: 10, vz: -2 });
    sim.armSwipe(sw());
    sim.step();
    out.push({ name: "1: armed (finger-down) clear pre-bounce volley within reach → TWO_BOUNCE", ok: sim.lastFault?.reason === "TWO_BOUNCE" });
  }

  // 4: swipe inside the grace window (ball within reach, about to land) → legal post-bounce return.
  for (const strikes of [1, 2]) {
    const sim = incoming(strikes);
    setBall(sim, { x: 10, y: 31, z: 0.8, vy: 8, vz: -5 }); // in reach, ~0.12 s from its bounce
    const tb = tBounce(0.8, -5);
    sim.submitSwipe(sw());
    const r = runToContact(sim);
    out.push({ name: `1: swipe inside grace window → legal post-bounce return (strike ${strikes + 1})`, ok: tb < TWO_BOUNCE.GRACE && r.fault === null && r.bounced && r.sinceBounce >= TWO_BOUNCE.VISIBLE_DELAY - 1e-6, info: JSON.stringify(r) });
  }

  // 5: early out-of-reach swipe stays buffered → legal return (finger-down held, and a tap-up swipe).
  {
    const sim = incoming(1);
    setBall(sim, { x: 10, y: 25, z: 3.5, vy: 12, vz: 2 }); // far out of reach, unbounced
    sim.armSwipe(sw()); // resting thumb: held until consumed
    const r = runToContact(sim);
    out.push({ name: "1: early out-of-reach (held) swipe stays buffered → legal post-bounce return", ok: r.fault === null && r.bounced && r.sinceBounce >= TWO_BOUNCE.VISIBLE_DELAY - 1e-6, info: JSON.stringify(r) });
  }
  {
    const sim = incoming(1);
    setBall(sim, { x: 10, y: 29.5, z: 1.4, vy: 12, vz: -2 }); // just out of reach, lands in front of me
    const reach = PLAYER.REACH * PLAYER.REACH_MULT;
    const outOfReach = Math.hypot(sim.ball.x - sim.players[0].x, sim.ball.y - sim.players[0].y) > reach;
    sim.submitSwipe(sw());
    const r = runToContact(sim);
    out.push({ name: "1: early out-of-reach swipe (released) stays buffered → legal return", ok: outOfReach && r.fault === null && r.bounced, info: JSON.stringify(r) });
  }

  // 6: later-rally groundstrokes keep their timing (no visibility delay), and
  // the later-rally high-ball zero-reaction read is preserved for the AI.
  {
    const ticks: number[] = [];
    for (const strikes of [6, 1]) {
      const sim = incoming(strikes);
      // a ball that has JUST bounced in front of me
      Object.assign(sim.ball, { x: 10.5, y: 33.6, z: 0, vx: 4.5, vy: 0, vz: 4, inPlay: true, lastHitTeam: "far", lastHitBy: 2, bouncesSinceHit: 1, bounceSideCount: 1, crossedNetSinceHit: true });
      (sim as any).lastBounceAt = sim.time;
      sim.submitSwipe(sw());
      let n = 0;
      while (n < 60 && sim.ball.lastHitTeam === "far" && sim.phase === "rally") { sim.step(); n++; }
      ticks.push(sim.ball.lastHitTeam === "near" ? n : -1);
    }
    out.push({ name: "1: later-rally groundstroke timing unchanged (no two-bounce-phase delay)", ok: ticks[0] > 0 && ticks[0] < 6 && ticks[1] >= 6, info: JSON.stringify(ticks) });
  }
  {
    const sim = incoming(6);
    const far = sim.players[2];
    sim.ball.lastHitTeam = "near"; sim.ball.lastHitBy = 0;
    Object.assign(sim.ball, { x: far.x, y: far.y + 0.5, z: 3.5, vx: 0, vy: 0, vz: -6, bouncesSinceHit: 0, inPlay: true });
    sim.apexSinceHit = TACTIC.SMASH_MIN_APEX + 2;
    far.lastHitTime = -10;
    (sim as any).computeReach();
    (sim as any).resolveStrikes();
    out.push({ name: "1: later-rally high ball keeps the AI zero-reaction read (smash timing unchanged)", ok: far.reactionUntil === sim.time });
  }

  // 7: scripted NORMAL human timing → ~0% false TWO_BOUNCE.
  const ff = falseFaultScript();
  out.push({ name: "1: scripted normal human return/third timing → 0 false TWO_BOUNCE faults", ok: ff.attempts > 100 && ff.twoBounce === 0, info: JSON.stringify(ff) });
  return out;
}

// Plays full matches with the local human using several NORMAL swipe habits
// in the two-bounce phase: resting thumb armed at the opponent's contact,
// a swipe shortly before the ball lands (inside grace), a swipe once the ball
// becomes hittable. Counts TWO_BOUNCE faults against my team.
export function falseFaultScript(seeds = [41, 42, 43, 44, 45, 46]) {
  let attempts = 0, twoBounce = 0, legal = 0;
  seeds.forEach((seed, si) => {
    const sim = new GameSimulation({ seed, difficulty: "CLUB" });
    let ticks = 0, armedFor = -1, recorded = -1;
    while (sim.phase !== "game_over" && ticks < 60 * 60 * 8) {
      const b = sim.ball;
      const twoPhase = sim.phase === "rally" && sim.rallyStrikeCount < 3 && b.lastHitTeam === "far";
      const policy = (si + sim.stats.pointsPlayed) % 3;
      if (sim.humanIsServer() && !sim.hasBufferedSwipe()) sim.submitSwipe(sw());
      if (twoPhase && armedFor !== sim.rallyStrikeCount && !sim.hasBufferedSwipe()) {
        const tb = b.bouncesSinceHit === 0 ? tBounce(b.z, b.vz) : 0;
        if (policy === 0) { sim.armSwipe(sw()); armedFor = sim.rallyStrikeCount; attempts++; }
        else if (policy === 1 && b.bouncesSinceHit === 0 && b.y > COURT.NET_Y && tb <= 0.05 + ((ticks % 5) * 0.04)) { sim.submitSwipe(sw()); armedFor = sim.rallyStrikeCount; attempts++; }
        else if (policy === 2 && sim.humanCanHit()) { sim.submitSwipe(sw()); armedFor = sim.rallyStrikeCount; attempts++; }
      } else if (sim.phase === "rally" && sim.rallyStrikeCount >= 3 && sim.humanCanHit() && !sim.hasBufferedSwipe()) {
        sim.submitSwipe(sw());
      }
      const before = sim.rallyStrikeCount;
      sim.step();
      ticks++;
      for (const c of sim.consumeContactEvents()) if (c.slot === 0 && (before === 1 || before === 2)) legal++;
      if (sim.phase !== "rally" && armedFor >= 0) {
        sim.releaseSwipe(sw());
        armedFor = -1;
      }
      if (sim.phase === "point_over" && sim.stats.pointsPlayed !== recorded) {
        recorded = sim.stats.pointsPlayed;
        if (sim.lastFault?.reason === "TWO_BOUNCE" && sim.lastFault.faultingTeam === "near") twoBounce++;
      }
    }
  });
  return { attempts, legalHumanReturnsOrThirds: legal, twoBounce };
}

if (process.argv[1]?.includes("twoBounce")) {
  for (const r of twoBounceTests()) console.log(r.ok ? "PASS" : "FAIL", r.name, r.info ?? "");
}
