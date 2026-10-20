/* Human post-bounce retrieval scenarios (shared by run.ts tests + repro).
 * Builds a real GameSimulation mid-rally, launches an opponent shot onto the
 * near side, lets it bounce, then swipes and reports whether the human made
 * contact before the second bounce.
 */
import { COURT } from "../config/court";
import { PLAYER } from "../config/tuning";
import { GameSimulation } from "../sim/GameSimulation";
import { solveShot } from "../sim/shots";
import type { ShotType } from "../sim/types";

export interface RetrievalResult {
  contact: boolean; // human struck the ball
  doubleBounce: boolean; // point ended on a near double bounce
  expired: boolean; // the buffered swipe expired unused
  minGap: number; // closest player-to-ball distance after the bounce
  humanStartY: number;
  humanContactY: number | null;
}

export function retrievalScenario(opts: {
  humanX: number;
  humanY: number;
  fromX: number;
  fromY: number;
  targetX: number;
  targetY: number;
  shot: ShotType;
  swipeDelayAfterBounce: number; // s after the first bounce to swipe
  release?: boolean; // true = finger-up swipe (submitSwipe), false = held armed swipe
  singles?: boolean;
}): RetrievalResult {
  const sim = new GameSimulation({ seed: 77, difficulty: "CLUB" });
  // Put everyone in a mid-rally state (past the two-bounce phase).
  sim.phase = "rally";
  sim.rallyStrikeCount = 6;
  sim.serveCtx.active = false;
  for (const p of sim.players) p.isServing = false;
  const human = sim.players[0];
  human.x = human.targetX = opts.humanX;
  human.y = human.targetY = opts.humanY;
  // Partner far away on the other lane so it doesn't take the ball.
  const partner = sim.players[1];
  partner.x = partner.targetX = opts.humanX < COURT.CENTER_X ? 17 : 3;
  partner.y = partner.targetY = COURT.LENGTH - 2;
  if (opts.singles) partner.y = partner.targetY = COURT.LENGTH - 0.6;
  const far = sim.players[2];
  far.x = opts.fromX;
  far.y = opts.fromY;
  const shot = solveShot(opts.fromX, opts.fromY, opts.targetX, opts.targetY, opts.shot);
  const b = sim.ball;
  Object.assign(b, {
    x: opts.fromX, y: opts.fromY + 0.4, z: shot.contactZ, vx: shot.vx, vy: shot.vy, vz: shot.vz,
    inPlay: true, lastHitBy: far.slot, lastHitTeam: "far", bouncesSinceHit: 0, bounceSideCount: 0,
    currentSide: "far", totalBounces: 0, crossedNetSinceHit: false, lastBounce: null, trail: [],
  });
  far.lastHitTime = sim.time;

  const startY = human.y;
  let bounceAt = -1;
  let swiped = false;
  let minGap = Infinity;
  let expired = false;
  let contact = false;
  let contactY: number | null = null;
  for (let i = 0; i < 60 * 4; i++) {
    const hadBuffer = sim.hasBufferedSwipe();
    sim.step();
    if (sim.ball.bouncesSinceHit >= 1 && bounceAt < 0 && sim.ball.lastHitTeam === "far") bounceAt = sim.time;
    if (bounceAt >= 0 && !swiped && sim.time - bounceAt >= opts.swipeDelayAfterBounce) {
      swiped = true;
      const input = { dx: 0, dy: -60, power: 0.25, tap: false };
      if (opts.release === false) sim.armSwipe(input);
      else sim.submitSwipe(input);
    }
    if (bounceAt >= 0 && sim.ball.lastHitTeam === "far") {
      minGap = Math.min(minGap, Math.hypot(sim.ball.x - human.x, sim.ball.y - human.y));
    }
    if (sim.ball.lastHitBy === human.slot && sim.ball.lastHitTeam === "near") {
      contact = true;
      contactY = human.y;
      break;
    }
    if (swiped && hadBuffer && !sim.hasBufferedSwipe() && !contact) expired = true;
    if (sim.phase !== "rally") break;
  }
  return {
    contact,
    doubleBounce: sim.lastFault?.reason === "DOUBLE_BOUNCE",
    expired,
    minGap,
    humanStartY: startY,
    humanContactY: contactY,
  };
}

// Kitchen-line standing position (just behind the near NVZ line).
export const NEAR_LINE_Y = COURT.NEAR_KITCHEN_Y + PLAYER.KITCHEN_LINE_STANDOFF;

if (require.main === module) {
  const cases = [
    { name: "dink→kitchen, human at line, swipe 0.05s after bounce", o: { humanX: 13, humanY: NEAR_LINE_Y, fromX: 13, fromY: 16, targetX: 13, targetY: 25.8, shot: "dink" as ShotType, swipeDelayAfterBounce: 0.05 } },
    { name: "dink→kitchen, human at line, swipe 0.2s after bounce", o: { humanX: 13, humanY: NEAR_LINE_Y, fromX: 13, fromY: 16, targetX: 13, targetY: 25.8, shot: "dink" as ShotType, swipeDelayAfterBounce: 0.2 } },
    { name: "dink→kitchen, held (armed) swipe", o: { humanX: 13, humanY: NEAR_LINE_Y, fromX: 13, fromY: 16, targetX: 13, targetY: 25.8, shot: "dink" as ShotType, swipeDelayAfterBounce: 0.05, release: false } },
    { name: "deep drive bounces near my baseline, human at baseline", o: { humanX: 13, humanY: 41.5, fromX: 10, fromY: 8, targetX: 13, targetY: 38, shot: "drive" as ShotType, swipeDelayAfterBounce: 0.05 } },
    { name: "deep drop bounces near my baseline, human at baseline", o: { humanX: 13, humanY: 42, fromX: 10, fromY: 10, targetX: 13, targetY: 39, shot: "drop" as ShotType, swipeDelayAfterBounce: 0.05 } },
    { name: "deep drop, human mid-court (backs up)", o: { humanX: 13, humanY: 35, fromX: 10, fromY: 10, targetX: 13, targetY: 39, shot: "drop" as ShotType, swipeDelayAfterBounce: 0.1 } },
  ];
  for (const c of cases) console.log(c.name, JSON.stringify(retrievalScenario(c.o)));
}
