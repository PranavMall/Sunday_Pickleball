/* B3 §3 — real kitchen footwork (focused scenarios).
 * Run alone: npx tsx src/game/__tests__/kitchenFootwork.ts
 */
import { COURT } from "../config/court";
import { KITCHEN, PLAYER } from "../config/tuning";
import { GameSimulation } from "../sim/GameSimulation";

const LINE = COURT.NEAR_KITCHEN_Y + PLAYER.KITCHEN_LINE_STANDOFF;

// Near pair at the line, far player at its line hits a dink to (x, landY).
function dinkScenario(landY: number, human = false, seed = 61) {
  const sim = new GameSimulation({ seed, difficulty: "CLUB", controllers: [human ? "LOCAL_HUMAN" : "AI", "AI", "AI", "AI"] });
  sim.phase = "rally";
  sim.rallyStrikeCount = 7;
  sim.serveCtx.active = false;
  for (const p of sim.players) {
    p.isServing = false;
    p.netIntent = true;
    p.netDecidedFor = 7;
    p.x = p.targetX = p.slot % 2 === 0 ? 15 : 5;
    p.y = p.targetY = p.team === "near" ? LINE : COURT.FAR_KITCHEN_Y - PLAYER.KITCHEN_LINE_STANDOFF;
  }
  const far = sim.players[2];
  far.x = 15;
  Object.assign(sim.ball, { x: 15, y: far.y + 0.4, z: 1.0, vx: 0, vy: 0, vz: 0, inPlay: true, lastHitTeam: "near", lastHitBy: 0, bouncesSinceHit: 1, crossedNetSinceHit: true });
  (sim as any).executeShot(far, "dink", 15, landY, { accuracy: 1, unforcedError: 0 });
  return sim;
}

// Follow the near retriever (slot 0) until the far team strikes back.
function follow(sim: GameSimulation, humanSwipe = false) {
  const me = sim.players[0];
  let entered = false, contactInside = false, contactBounced = false, contact = false, exited = false, reEstablished = false;
  for (let i = 0; i < 240 && sim.phase === "rally"; i++) {
    if (humanSwipe && sim.humanCanHit() && !sim.hasBufferedSwipe() && !contact) sim.submitSwipe({ dx: 0, dy: -50, power: 0.25, tap: false, speed: 400 });
    const bouncedBefore = sim.ball.bouncesSinceHit > 0;
    sim.step();
    if (me.inKitchen) entered = true;
    for (const c of sim.consumeContactEvents()) {
      if (c.slot === 0) { contact = true; contactInside = me.inKitchen; contactBounced = bouncedBefore; }
    }
    if (contact && entered && !me.inKitchen && !me.touchingKitchenLine) exited = true;
    if (contact && exited && me.feetEstablished && !me.wasInKitchen) { reEstablished = true; break; }
  }
  return { entered, contact, contactInside, contactBounced, exited, reEstablished, fault: sim.lastFault?.reason ?? null };
}

export function kitchenFootworkTests(): { name: string; ok: boolean; info?: string }[] {
  const out: { name: string; ok: boolean; info?: string }[] = [];
  const tol = KITCHEN.LINE_TOLERANCE;
  out.push({ name: `3: net ready spot ${PLAYER.KITCHEN_LINE_STANDOFF} ft behind the line (0.4–0.6, clear of the ${tol} ft line tolerance)`, ok: PLAYER.KITCHEN_LINE_STANDOFF >= 0.4 && PLAYER.KITCHEN_LINE_STANDOFF <= 0.6 && PLAYER.KITCHEN_LINE_STANDOFF > tol + 0.1 && PLAYER.VOLLEY_LINE_STANDOFF > tol + 0.1 });

  // Short bounced dink (lands ~2 ft from the net): step in → legal bounced
  // contact from inside → exit → re-establish. AI and human.
  for (const human of [false, true]) {
    const r = follow(dinkScenario(COURT.NET_Y + 2.2, human), human);
    const who = human ? "human" : "AI";
    out.push({ name: `3: short bounced dink (${who}) → steps into the kitchen and plays the BOUNCED ball legally`, ok: r.entered && r.contact && r.contactBounced && r.fault === null, info: JSON.stringify(r) });
    out.push({ name: `3: after the kitchen retrieval (${who}) → exits and re-establishes outside`, ok: r.exited && r.reEstablished });
  }
  // A dink landing near the line is naturally playable from outside → no forced entry.
  {
    const r = follow(dinkScenario(COURT.NEAR_KITCHEN_Y - 0.6));
    out.push({ name: "3: dink landing near the line is played from outside (no forced kitchen entry)", ok: r.contact && !r.contactInside && !r.entered && r.fault === null, info: JSON.stringify(r) });
  }

  // Seeded matches: no kitchen faults manufactured by movement, no stuck states.
  let kf = 0, stuck = 0;
  for (let i = 0; i < 12; i++) {
    for (const d of ["ROOKIE", "CLUB", "PRO"] as const) {
      const m = new GameSimulation({ seed: 5200 + i, difficulty: d, controllers: ["AI", "AI", "AI", "AI"] });
      let t = 0;
      while (m.phase !== "game_over" && t < 60 * 60 * 20) { m.step(); t++; }
      if (m.phase !== "game_over") stuck++;
      kf += m.stats.kitchenFaults;
    }
  }
  out.push({ name: "3: seeded AI matches — 0 kitchen faults, 0 stuck states", ok: kf === 0 && stuck === 0, info: `kitchenFaults=${kf} stuck=${stuck}` });
  return out;
}

if (process.argv[1]?.includes("kitchenFootwork")) {
  for (const t of kitchenFootworkTests()) console.log(t.ok ? "PASS" : "FAIL", t.name, t.info ?? "");
}
