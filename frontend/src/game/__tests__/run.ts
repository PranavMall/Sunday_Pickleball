/* Headless test suite for the pickleball simulation.
 * Run: npx --yes tsx src/game/__tests__/run.ts   (from /app/frontend)
 *
 * Covers Milestone 1 §21.1 rules tests + §21.2 seeded AI-vs-AI smoke matches.
 * Pure TypeScript, no RN/Skia dependency.
 */
import { COURT, serviceBoxFor } from "../config/court";
import { RuleManager } from "../sim/rules";
import { ScoreManager } from "../sim/score";
import { GameSimulation } from "../sim/GameSimulation";
import type { BallState, PlayerState, Team } from "../sim/types";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(cond: boolean, name: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(name);
    console.log("  ✗ FAIL:", name);
  }
}
function eq(a: unknown, b: unknown, name: string) {
  ok(a === b, `${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
}

function ball(partial: Partial<BallState>): BallState {
  return {
    x: 10, y: 22, z: 0, vx: 0, vy: 0, vz: 0,
    inPlay: true, lastHitBy: 0, lastHitTeam: "near",
    bouncesSinceHit: 0, bounceSideCount: 0, currentSide: "near",
    totalBounces: 0, crossedNetSinceHit: true, lastBounce: null, trail: [],
    ...partial,
  };
}
function player(partial: Partial<PlayerState>): PlayerState {
  return {
    slot: 0, team: "near", controller: "AI", name: "T", colorKey: "x",
    x: 10, y: 30, targetX: 10, targetY: 30, courtSide: "R", isServing: false,
    inKitchen: false, touchingKitchenLine: false, feetEstablished: true,
    wasInKitchen: false, momentumTimer: 0, reestablishTimer: 0,
    lastHitTime: -10, reactionUntil: 0, committedToBall: false, swingCue: -10,
    ...partial,
  };
}

// ============================ RULES TESTS ============================
function rulesTests() {
  console.log("\n[Rules]");

  // --- 0-0-2 opening ---
  const init = ScoreManager.initial("near");
  eq(init.nearScore, 0, "opening near score 0");
  eq(init.farScore, 0, "opening far score 0");
  eq(init.serverNumber, 2, "opening server number 2 (0-0-2)");
  eq(ScoreManager.serveSide(init), "R", "first serve from the right");

  // --- correct service court + service faults ---
  const box = serviceBoxFor("near", "R"); // near serving from right -> far-left box
  const good = RuleManager.classifyBounce(
    ball({ x: 5, y: 8, lastHitTeam: "near" }),
    { active: true, servingTeam: "near", box },
    1, true,
  );
  ok(good.serveGood && !good.fault, "serve into correct diagonal box is good");

  const wrongBox = RuleManager.classifyBounce(
    ball({ x: 15, y: 8 }), { active: true, servingTeam: "near", box }, 1, true,
  );
  eq(wrongBox.fault?.reason, "SERVE_WRONG_BOX", "serve to wrong box is a fault");

  const serveKitchen = RuleManager.classifyBounce(
    ball({ x: 5, y: 16 }), { active: true, servingTeam: "near", box }, 1, true,
  );
  eq(serveKitchen.fault?.reason, "SERVE_KITCHEN", "serve landing in kitchen is a fault");

  const serveOnKitchenLine = RuleManager.classifyBounce(
    ball({ x: 5, y: COURT.FAR_KITCHEN_Y }), { active: true, servingTeam: "near", box }, 1, true,
  );
  eq(serveOnKitchenLine.fault?.reason, "SERVE_KITCHEN", "serve on the kitchen line is a fault");

  const serveOut = RuleManager.classifyBounce(
    ball({ x: 5, y: -1 }), { active: true, servingTeam: "near", box }, 1, true,
  );
  eq(serveOut.fault?.reason, "SERVE_OUT", "serve out of bounds is a fault");

  // --- in / out / boundary lines are IN ---
  const noServe = { active: false, servingTeam: "near" as Team, box };
  const onBaseline = RuleManager.classifyBounce(ball({ x: 5, y: 0, lastHitTeam: "near" }), noServe, 1, true);
  ok(!onBaseline.fault, "ball on the baseline is IN");
  const onSideline = RuleManager.classifyBounce(ball({ x: 0, y: 8, lastHitTeam: "near" }), noServe, 1, true);
  ok(!onSideline.fault, "ball on the sideline is IN");
  const outBall = RuleManager.classifyBounce(ball({ x: 5, y: 45, lastHitTeam: "near" }), noServe, 1, true);
  eq(outBall.fault?.reason, "OUT", "ball past the baseline is OUT (fault on hitter)");
  eq(outBall.fault?.faultingTeam, "near", "out fault is charged to the hitter");
  // kitchen line counts as kitchen for serves, but a RALLY ball landing there is just in
  const rallyOnKitchenLine = RuleManager.classifyBounce(
    ball({ x: 5, y: COURT.FAR_KITCHEN_Y, lastHitTeam: "near" }), noServe, 1, true,
  );
  ok(!rallyOnKitchenLine.fault, "rally ball on the kitchen line is IN");

  // --- double bounce ---
  const dbl = RuleManager.classifyBounce(ball({ x: 5, y: 8, lastHitTeam: "near" }), noServe, 2, true);
  eq(dbl.fault?.reason, "DOUBLE_BOUNCE", "second bounce on a side is a double-bounce fault");

  // --- net rules ---
  const netFault = RuleManager.checkNetCrossing(10, 2.0, "near", false);
  eq(netFault?.reason, "NET", "ball below net height fails to cross = fault");
  const clips = RuleManager.checkNetCrossing(10, 2.95, "near", false); // center net ~2.83
  ok(!clips, "ball clipping the net but clearing stays LIVE");
  const serveNet = RuleManager.checkNetCrossing(0, 2.9, "near", true); // sideline net 3.0
  eq(serveNet?.reason, "SERVE_NET", "serve into the net is a fault");

  // --- two-bounce rule ---
  const returnVolley = RuleManager.validateStrike(ball({ bouncesSinceHit: 0, z: 2 }), player({}), 2, false);
  eq(returnVolley?.reason, "TWO_BOUNCE", "volleying the return (strike 2) breaks two-bounce");
  const thirdVolley = RuleManager.validateStrike(ball({ bouncesSinceHit: 0, z: 2 }), player({}), 3, false);
  eq(thirdVolley?.reason, "TWO_BOUNCE", "volleying the third shot breaks two-bounce");
  const legalReturn = RuleManager.validateStrike(ball({ bouncesSinceHit: 1, z: 1 }), player({}), 2, false);
  ok(!legalReturn, "returning after the bounce is legal");
  const fourthVolley = RuleManager.validateStrike(ball({ bouncesSinceHit: 0, z: 2 }), player({}), 4, false);
  ok(!fourthVolley, "volley allowed from the 4th shot onward");

  // --- kitchen rules ---
  const volleyInKitchen = RuleManager.validateStrike(
    ball({ bouncesSinceHit: 0, z: 2 }), player({ inKitchen: true }), 6, false,
  );
  eq(volleyInKitchen?.reason, "KITCHEN_VOLLEY", "volleying in the kitchen is a fault");
  const standingLegal = RuleManager.validateStrike(
    ball({ bouncesSinceHit: 1, z: 0.5 }), player({ inKitchen: true }), 6, false,
  );
  ok(!standingLegal, "standing in the kitchen and hitting off the bounce is legal");
  const notEstablished = RuleManager.validateStrike(
    ball({ bouncesSinceHit: 0, z: 2 }),
    player({ inKitchen: false, wasInKitchen: true, feetEstablished: false }), 6, false,
  );
  eq(notEstablished?.reason, "KITCHEN_NOT_ESTABLISHED", "volley before re-establishing feet is a fault");
  const lineVolley = RuleManager.validateStrike(
    ball({ bouncesSinceHit: 0, z: 2 }), player({ touchingKitchenLine: true }), 6, false,
  );
  eq(lineVolley?.reason, "KITCHEN_VOLLEY", "volleying while touching the kitchen line is a fault");

  // --- side-out + server rotation + switching sides ---
  let s = ScoreManager.initial("near");
  let o = ScoreManager.resolve(s, "far"); // serving near loses first turn (0-0-2)
  eq(o.event, "side_out", "first-turn loss = immediate side out");
  eq(o.score.servingTeam, "far", "serve passes to the other team");
  eq(o.score.serverNumber, 1, "new team starts at server 1");
  s = o.score;
  o = ScoreManager.resolve(s, "far"); // far serving wins
  eq(o.event, "point", "serving team winning scores a point");
  eq(o.score.farScore, 1, "far score increments");
  ok(o.serverSwitchSides, "server switches sides after scoring");
  s = o.score;
  o = ScoreManager.resolve(s, "near"); // far loses, server 1 -> 2
  eq(o.event, "second_server", "loss on server 1 goes to server 2");
  eq(o.score.serverNumber, 2, "server number becomes 2");
  s = o.score;
  o = ScoreManager.resolve(s, "near"); // far loses again -> side out
  eq(o.event, "side_out", "loss on server 2 = side out");
  eq(o.score.servingTeam, "near", "serve returns to near team");

  // --- win at 11 by 2 ---
  ok(!ScoreManager.isGameOver({ ...init, nearScore: 11, farScore: 10 }), "11-10 is not game over");
  ok(ScoreManager.isGameOver({ ...init, nearScore: 11, farScore: 9 }), "11-9 wins the game");
  ok(!ScoreManager.isGameOver({ ...init, nearScore: 10, farScore: 9 }), "10-9 is not game over");
  ok(ScoreManager.isGameOver({ ...init, nearScore: 13, farScore: 11 }), "13-11 wins (deuce extended)");
}

// ==================== SIMULATION SMOKE TESTS ====================
function playHeadless(seed: number, diffs: [any, any]): {
  winner: Team | null; strikes: number; rallies: number; ticks: number; stuck: boolean;
} {
  // near team both diffs[0], far team both diffs[1]. All AI.
  const sim = new GameSimulation({
    seed,
    difficulty: diffs[0],
    difficulties: [diffs[0], diffs[0], diffs[1], diffs[1]],
    controllers: ["AI", "AI", "AI", "AI"],
    personalities: ["TACTICAL", "DEFENSIVE", "AGGRESSIVE", "TACTICAL"],
  });
  let ticks = 0;
  const maxTicks = 60 * 60 * 12; // 12 minutes of sim time hard cap
  let lastPoints = 0;
  let stallTicks = 0;
  while (sim.phase !== "game_over" && ticks < maxTicks) {
    sim.step();
    ticks++;
    if (sim.stats.pointsPlayed !== lastPoints) {
      lastPoints = sim.stats.pointsPlayed;
      stallTicks = 0;
    } else {
      stallTicks++;
    }
  }
  const stuck = ticks >= maxTicks || stallTicks > 60 * 60; // a single point > 60s = stuck
  return {
    winner: sim.winner,
    strikes: sim.stats.longestRally,
    rallies: sim.stats.totalRallies,
    ticks,
    stuck,
  };
}

function simTests() {
  console.log("\n[Simulation smoke matches]");
  const diffLevels = ["ROOKIE", "CLUB", "PRO"] as const;
  for (const d of diffLevels) {
    let completed = 0;
    let stuck = 0;
    let totalRallyLen = 0;
    let rallyPts = 0;
    for (let i = 0; i < 12; i++) {
      const r = playHeadless(1000 + i, [d, d]);
      if (r.stuck) stuck++;
      else completed++;
      totalRallyLen += r.strikes;
      rallyPts += r.rallies;
    }
    ok(stuck === 0, `${d}: 12/12 matches complete without stuck states`);
    const avgLongest = (totalRallyLen / 12).toFixed(1);
    console.log(`  ${d}: completed=${completed} stuck=${stuck} avgLongestRally=${avgLongest} points=${rallyPts}`);
  }

  // Cross-difficulty: better AI should win more often.
  const matchup = (a: any, b: any) => {
    let aWins = 0;
    const N = 16;
    for (let i = 0; i < N; i++) {
      const r = playHeadless(5000 + i, [a, b]);
      if (r.winner === "near") aWins++;
    }
    return aWins / N;
  };
  const clubVsRookie = matchup("CLUB", "ROOKIE");
  const proVsClub = matchup("PRO", "CLUB");
  console.log(`  CLUB vs ROOKIE win rate: ${(clubVsRookie * 100).toFixed(0)}%`);
  console.log(`  PRO vs CLUB win rate:   ${(proVsClub * 100).toFixed(0)}%`);
  ok(clubVsRookie > 0.55, "CLUB beats ROOKIE more often than not");
  ok(proVsClub > 0.55, "PRO beats CLUB more often than not");
}

console.log("=== Picklewood M1 test suite ===");
rulesTests();
simTests();
console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  console.log("Failures:\n - " + failures.join("\n - "));
  process.exit(1);
}
