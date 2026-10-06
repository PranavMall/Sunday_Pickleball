/* Headless test suite for the pickleball simulation.
 * Run: npx --yes tsx src/game/__tests__/run.ts   (from /app/frontend)
 *
 * Covers Milestone 1 §21.1 rules tests + §21.2 seeded AI-vs-AI smoke matches.
 * Pure TypeScript, no RN/Skia dependency.
 */
import { COURT, serviceBoxFor } from "../config/court";
import { INPUT, PLAYER } from "../config/tuning";
import { buildMatchConfig, devSinglesConfig } from "../config/matchConfig";
import { RuleManager } from "../sim/rules";
import { ScoreManager } from "../sim/score";
import { predictContact } from "../sim/physics";
import { updateMovement, type MovementInfo } from "../sim/movement";
import { GameSimulation, humanShotQuality, humanServeQuality } from "../sim/GameSimulation";
import type { BallState, Difficulty, PlayerState, Team } from "../sim/types";

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

// ==================== SERVE ROTATION TESTS ====================
// Tests the actual serving PLAYER (slot) and SIDE, per real doubles rules.
function serveRotationTests() {
  console.log("\n[Serve rotation]");
  const mk = () => new GameSimulation({ seed: 42, difficulty: "CLUB" });

  // --- 0-0-2 start: near team, Server (number 2 convention), right court ---
  let sim = mk();
  eq(sim.score.servingTeam, "near", "0-0-2: near team serves first");
  eq(sim.score.serverNumber, 2, "0-0-2: opening server number is 2");
  eq(sim.serverSlot, 0, "0-0-2: server is the near right-court player (slot 0)");
  eq(sim.players[sim.serverSlot!].courtSide, "R", "0-0-2: server stands in the right court");

  // --- first-turn loss = side-out; far serves from its RIGHT court, diagonal ---
  sim.debugPlayPoint("far");
  eq(sim.score.servingTeam, "far", "first-turn loss → side-out to far team");
  eq(sim.score.serverNumber, 1, "incoming team starts at server 1");
  const farServer = sim.players[sim.serverSlot!];
  eq(farServer.team, "far", "new server is on the far team");
  eq(farServer.courtSide, "R", "far Server 1 stands in the far team's right court");
  // far's right court is the LEFT of the screen (low global x)
  const farGlobalRight = (farServer.team === "near") === (farServer.courtSide === "R");
  ok(!farGlobalRight, "far team's right court is on the LEFT of the screen (global x<10)");
  const farBox = serviceBoxFor("far", farServer.courtSide);
  eq(farBox.xLo, COURT.CENTER_X, "far R serve targets the diagonally-opposite (global right) box");
  ok(farBox.yLo >= COURT.NEAR_KITCHEN_Y, "far serve targets the near receiving box (past the kitchen)");

  // --- Server 1 scores twice: server keeps serving, alternates sides ---
  const keptSlot = sim.serverSlot;
  sim.debugPlayPoint("far"); // far scores → far 1, swap sides
  eq(sim.serverSlot, keptSlot, "same server keeps serving after scoring");
  eq(sim.players[sim.serverSlot!].courtSide, "L", "after 1 point (odd score) server is in the left court");
  eq(sim.score.farScore, 1, "far score is 1");
  sim.debugPlayPoint("far"); // far scores → far 2, swap back
  eq(sim.serverSlot, keptSlot, "still the same server after a second point");
  eq(sim.players[sim.serverSlot!].courtSide, "R", "after 2 points (even score) server is back in the right court");

  // --- Server 1 loses → PARTNER becomes Server 2 (serves from where they stand) ---
  sim = mk();
  sim.debugPlayPoint("far"); // near loses first turn → side out to far (server 1)
  const far1 = sim.serverSlot!;
  const far1Side = sim.players[far1].courtSide;
  sim.debugPlayPoint("near"); // far server 1 loses (not first turn) → second server
  eq(sim.score.serverNumber, 2, "loss on server 1 advances to server 2");
  eq(sim.serverSlot, sim.players.find((p) => p.team === "far" && p.slot !== far1)!.slot,
    "Server 2 is the PARTNER of Server 1");
  const far2Side = sim.players[sim.serverSlot!].courtSide;
  ok(far2Side !== far1Side, "Server 2 serves from the other court (where they already stand)");

  // --- side-out at an ODD score still starts from the RIGHT court ---
  sim = mk();
  // Force far to be serving on its 2nd server with near holding an odd score.
  sim.score = { nearScore: 1, farScore: 5, servingTeam: "far", serverNumber: 2, isFirstServiceTurn: false };
  sim.debugPlayPoint("near"); // far (server 2) loses → side-out to near
  eq(sim.score.servingTeam, "near", "side-out passes serve to near");
  eq(sim.players[sim.serverSlot!].courtSide, "R",
    "side-out at an odd score still starts Server 1 from the right court");

  // --- receivers keep their positions (setupServe never resets them) ---
  sim = mk(); // near serving, server slot 0; far are receivers
  sim.players[2].x = 3.3; sim.players[2].y = 4.4;
  sim.players[1].x = 7.7; sim.players[1].y = 33.3; // server's partner
  sim.setupServe();
  ok(sim.players[2].x === 3.3 && sim.players[2].y === 4.4, "a receiver's position is NOT reset on serve setup");
  ok(sim.players[1].x === 7.7 && sim.players[1].y === 33.3, "the server's partner is NOT repositioned on serve setup");
}

// ==================== INPUT (STALE SWIPE) TESTS ====================
function inputTests() {
  console.log("\n[Input buffering]");
  const sim = new GameSimulation({ seed: 7, difficulty: "CLUB" });
  // Make the FAR team serve so the human (slot 0) cannot act on the swipe.
  sim.score = { ...sim.score, servingTeam: "far" };
  sim.serverSlot = 2;
  sim.setupServe();

  sim.submitSwipe({ dx: 0, dy: -100, power: 0.5, tap: false });
  ok(sim.hasBufferedSwipe(), "a swipe is buffered immediately");

  const stepsWithin = Math.floor(0.2 / (1 / 60)); // < SWIPE_BUFFER_TIME
  for (let i = 0; i < stepsWithin; i++) sim.step();
  ok(sim.hasBufferedSwipe(), "swipe is still buffered inside the valid window");

  const stepsPast = Math.ceil((INPUT.SWIPE_BUFFER_TIME + 0.25) / (1 / 60));
  for (let i = 0; i < stepsPast; i++) sim.step();
  ok(!sim.hasBufferedSwipe(), "an old swipe EXPIRES and can never fire later");
}

// ==================== SERVER POSITION TESTS ====================
function serverPositionTests() {
  console.log("\n[Server position]");
  // Near human server: walks BEHIND the near baseline (y > 44) while waiting.
  const near = new GameSimulation({ seed: 11, difficulty: "CLUB" });
  for (let i = 0; i < 60; i++) near.step(); // ~1s to walk into position (human won't auto-serve)
  const ns = near.players[near.serverSlot!];
  ok(ns.team === "near" && near.phase === "waiting_serve", "near human is still the waiting server");
  ok(ns.y > COURT.LENGTH, `near server stands BEHIND the baseline (y=${ns.y.toFixed(1)} > ${COURT.LENGTH})`);

  // Far server: walks BEHIND the far baseline (y < 0) while waiting.
  const far = new GameSimulation({ seed: 12, difficulty: "CLUB" });
  far.score = { ...far.score, servingTeam: "far" };
  far.serverSlot = 2;
  far.setupServe();
  for (let i = 0; i < 40; i++) far.step(); // <1.1s SERVE_DELAY, so still waiting
  const fs = far.players[far.serverSlot!];
  ok(fs.team === "far", "far team is serving");
  ok(fs.y < 0, `far server stands BEHIND the baseline (y=${fs.y.toFixed(1)} < 0)`);
}

// ==================== CONTROLS / QUALITY TESTS ====================
function controlsTests() {
  console.log("\n[Controls & shot quality]");

  // --- swipe-direction mapping ---
  const good = humanShotQuality(1.3, 0, { dx: 0, dy: -120 }); // forward, on-time
  ok(good.unforcedError === 0 && good.accuracy > 0.95, "a good forward on-time swipe never randomly misses");
  const down = humanShotQuality(1.3, 0, { dx: 0, dy: 120 }); // downward/backward swipe
  ok(down.errLevel > good.errLevel && down.accuracy < good.accuracy, "a downward/backward swipe is a mishit (lower quality)");
  ok(down.unforcedError > 0, "a downward swipe can go out/net");
  const wideAim = humanShotQuality(1.3, 0, { dx: 260, dy: -120 }); // extreme lateral aim
  ok(wideAim.errLevel > good.errLevel, "an extreme aim lowers quality");

  // --- timing: early (buffered then fired at closest approach, lateness~0) vs late ---
  const early = humanShotQuality(1.3, 0.0, { dx: 10, dy: -120 });
  const late = humanShotQuality(1.3, 2.4, { dx: 10, dy: -120 });
  ok(early.accuracy > 0.95 && early.unforcedError === 0, "a swipe timed at closest approach (0.1-0.2s early buffered) is high quality");
  ok(late.errLevel > early.errLevel, "a clearly mistimed (late) swipe is lower quality");

  // --- human serve faults ---
  const goodServe = humanServeQuality({ dx: 0, dy: -120, power: 0.6 });
  ok(goodServe.unforcedError === 0 && goodServe.accuracy > 0.9, "a normal serve stays safe");
  const shortServe = humanServeQuality({ dx: 0, dy: -20, power: 0.08 }); // very short swipe
  ok(shortServe.unforcedError > 0, "a very short serve swipe can fault");
  const angleServe = humanServeQuality({ dx: 240, dy: -40, power: 0.5 }); // extreme angle
  ok(angleServe.accuracy < goodServe.accuracy, "an extreme-angle serve is lower quality");
}

// ==================== AI PARTNER TESTS ====================
function partnerTests() {
  console.log("\n[AI partner]");
  for (const d of ["ROOKIE", "CLUB", "PRO"] as Difficulty[]) {
    const sim = new GameSimulation({ seed: 5, difficulty: d });
    eq(sim.players[1].difficulty, "CLUB", `partner stays CLUB when match difficulty is ${d}`);
    eq(sim.players[2].difficulty, d, `opponent uses match difficulty ${d}`);
    eq(sim.players[3].difficulty, d, `second opponent uses match difficulty ${d}`);
  }
}

// ==================== REAL-CONFIG SIMULATION TESTS ====================
// Slot 0 = CLUB "human", slot 1 = default partner (CLUB), slots 2-3 = opponents.
function realConfigTests() {
  console.log("\n[Real default-config matches]");
  for (const opp of ["ROOKIE", "CLUB", "PRO"] as Difficulty[]) {
    let stuck = 0, rallySum = 0, points = 0, returns = 0, returnable = 0, farScoreSum = 0, games = 0;
    for (let i = 0; i < 20; i++) {
      const sim = new GameSimulation({
        seed: 3000 + i,
        difficulty: opp,
        controllers: ["AI", "AI", "AI", "AI"],
        difficulties: ["CLUB", undefined as any, undefined as any, undefined as any],
      });
      let ticks = 0, last = 0, stall = 0, maxStall = 0;
      const max = 60 * 60 * 20;
      let servingThisPoint: Team = sim.score.servingTeam;
      let recorded = -1;
      while (sim.phase !== "game_over" && ticks < max) {
        const before = sim.phase;
        sim.step();
        ticks++;
        if (before === "waiting_serve" && sim.phase === "rally") servingThisPoint = sim.score.servingTeam;
        if (sim.phase === "point_over" && sim.stats.pointsPlayed !== recorded) {
          recorded = sim.stats.pointsPlayed;
          const strikes = sim.rallyStrikeCount;
          rallySum += strikes; points++;
          if (!(sim.lastFault?.reason ?? "").startsWith("SERVE")) {
            returns++;
            if (strikes >= 2) returnable++;
          }
        }
        if (sim.stats.pointsPlayed !== last) { last = sim.stats.pointsPlayed; stall = 0; }
        else { stall++; if (stall > maxStall) maxStall = stall; }
      }
      if (ticks >= max || maxStall > 60 * 45) stuck++;
      farScoreSum += sim.score.farScore; games++;
    }
    const avgRally = (rallySum / points).toFixed(1);
    const retPct = ((returnable / returns) * 100).toFixed(0);
    ok(stuck === 0, `${opp} real-config: 20/20 matches complete, no stuck states`);
    ok(returnable / returns > 0.3, `${opp} real-config: serves are returned (>30%), got ${retPct}%`);
    console.log(`  ${opp}: avgRally=${avgRally} returnRate=${retPct}% avgFarScore=${(farScoreSum / games).toFixed(1)}`);
  }
}

// ==================== SINGLES (team-size config) TESTS ====================
function singlesTests() {
  console.log("\n[Singles]");
  // --- scoring: two-number, only the server scores, lost rally = side-out ---
  let s = ScoreManager.initial("near", "singles");
  eq(s.serverNumber, 1, "singles opening has no 2nd server (serverNumber 1)");
  eq(s.isFirstServiceTurn, false, "singles has no 0-0-2 first-turn rule");
  let o = ScoreManager.resolve(s, "near", "singles"); // server wins
  eq(o.event, "point", "singles: serving team winning scores a point");
  eq(o.score.nearScore, 1, "singles near score increments");
  ok(o.serverSwitchSides, "singles: server switches sides after scoring");
  s = o.score;
  o = ScoreManager.resolve(s, "far", "singles"); // server loses → side-out
  eq(o.event, "side_out", "singles: a lost rally side-outs immediately (no 2nd server)");
  eq(o.score.servingTeam, "far", "singles: serve passes straight to the opponent");

  // --- serve side: RIGHT on even score, LEFT on odd ---
  eq(ScoreManager.serveSide({ nearScore: 0, farScore: 0, servingTeam: "near", serverNumber: 1, isFirstServiceTurn: false }), "R", "singles even score serves from the right");
  eq(ScoreManager.serveSide({ nearScore: 1, farScore: 0, servingTeam: "near", serverNumber: 1, isFirstServiceTurn: false }), "L", "singles odd score serves from the left");

  // --- service boxes: diagonal, past the kitchen (same geometry as doubles) ---
  const boxEven = serviceBoxFor("near", "R"); // near, even score → right court → far-left box
  eq(boxEven.xLo, 0, "singles even-score serve targets the left (global) box");
  eq(boxEven.xHi, COURT.CENTER_X, "singles serve box is one service court wide");
  ok(boxEven.yLo >= COURT.BASELINE_FAR_Y && boxEven.yHi <= COURT.FAR_KITCHEN_Y, "singles serve box lies past the kitchen");

  // --- a real 1v1 engine match: 2 players, server behind baseline, completes ---
  const sim = new GameSimulation(devSinglesConfig("CLUB", 123));
  eq(sim.players.length, 2, "singles builds exactly two players");
  eq(sim.players[0].team, "near", "singles slot 0 is the near player");
  eq(sim.players[1].team, "far", "singles slot 1 is the far player");
  // make it AI-vs-AI so it plays itself out
  const auto = new GameSimulation(
    buildMatchConfig({
      seed: 321,
      format: "singles",
      near: { controllers: ["AI"], difficulties: ["CLUB"], personalities: ["TACTICAL"] },
      far: { controllers: ["AI"], difficulties: ["CLUB"], personalities: ["AGGRESSIVE"] },
    }),
  );
  let ticks = 0;
  const max = 60 * 60 * 20;
  while (auto.phase !== "game_over" && ticks < max) { auto.step(); ticks++; }
  ok(auto.phase === "game_over", "singles AI-vs-AI match reaches game over");
  ok(auto.winner !== null, "singles match produces a winner");
  const hi = Math.max(auto.score.nearScore, auto.score.farScore);
  ok(hi >= 11 && Math.abs(auto.score.nearScore - auto.score.farScore) >= 2, `singles won 11+ by 2 (final ${auto.score.nearScore}-${auto.score.farScore})`);

  // --- near AI singles server stands BEHIND the near baseline while waiting ---
  const near = new GameSimulation(
    buildMatchConfig({ seed: 55, format: "singles", near: { controllers: ["AI"], difficulties: ["CLUB"] }, far: { controllers: ["AI"], difficulties: ["CLUB"] } }),
  );
  for (let i = 0; i < 30; i++) near.step(); // < SERVE_DELAY, still settling/waiting
  const srv = near.players[near.serverSlot!];
  ok(srv.team === "near", "singles near player is the server at 0-0");
  ok(srv.y > COURT.LENGTH, `singles server stands behind the baseline (y=${srv.y.toFixed(1)})`);
}


const MATCHES_PER_DIFF = 50; // 50+ seeded AI-vs-AI matches per difficulty

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
  // 20-minute sim safety net (guards against a truly frozen build). The real
  // "stuck" signal is a SINGLE point that never resolves — a legitimate PRO-vs-
  // PRO deuce to 11 with side-out scoring can genuinely run long but keeps
  // scoring points (worst observed single point ~26s, longest match ~13min).
  const maxTicks = 60 * 60 * 20;
  let lastPoints = 0;
  let stallTicks = 0;
  let maxStallTicks = 0;
  while (sim.phase !== "game_over" && ticks < maxTicks) {
    sim.step();
    ticks++;
    if (sim.stats.pointsPlayed !== lastPoints) {
      lastPoints = sim.stats.pointsPlayed;
      stallTicks = 0;
    } else {
      stallTicks++;
      if (stallTicks > maxStallTicks) maxStallTicks = stallTicks;
    }
  }
  // Stuck = a single point that froze (> 45s) or the safety cap was hit.
  const stuck = ticks >= maxTicks || maxStallTicks > 60 * 45;
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
    for (let i = 0; i < MATCHES_PER_DIFF; i++) {
      const r = playHeadless(1000 + i, [d, d]);
      if (r.stuck) stuck++;
      else completed++;
      totalRallyLen += r.strikes;
      rallyPts += r.rallies;
    }
    ok(stuck === 0, `${d}: ${MATCHES_PER_DIFF}/${MATCHES_PER_DIFF} matches complete without stuck states`);
    const avgLongest = (totalRallyLen / MATCHES_PER_DIFF).toFixed(1);
    console.log(`  ${d}: completed=${completed} stuck=${stuck} avgLongestRally=${avgLongest} points=${rallyPts}`);
  }

  // Cross-difficulty: better AI should win more often.
  const matchup = (a: any, b: any) => {
    let aWins = 0;
    const N = 24;
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

// ===================== KITCHEN / TWO-BOUNCE PREDICTION =====================
// Regression tests for the bounced-kitchen-ball retrieval fix. predictContact()
// must seed its bounce count from the LIVE ball's bouncesSinceHit so that:
//  A) a ball that has ALREADY bounced in the near kitchen is pursued INTO the
//     kitchen (legal post-bounce play), not held behind the line;
//  B) during the opening two-bounce phase an already-completed required bounce
//     is recognised immediately (no waiting for an unnecessary second bounce);
//  C) an UNBOUNCED ball floating into the kitchen is still HELD behind the NVZ
//     line (no illegal kitchen volley is introduced by the fix).
function moveInfo(rallyStrikeCount: number): MovementInfo {
  return {
    rallyStrikeCount,
    serving: false,
    serverSlot: null,
    affinityFor: () => 0.6,
    posErrorFor: () => 0,
  };
}

function kitchenTests() {
  console.log("\n[Kitchen retrieval & two-bounce prediction]");

  // --- A) opponent dink has ALREADY bounced in the near kitchen ---
  const bA = ball({ x: 10, y: 25, z: 1.4, vx: 0, vy: 0.2, vz: -2, bouncesSinceHit: 1, lastHitTeam: "far", lastHitBy: 2 });
  const predA = predictContact(bA, "near", false);
  ok(predA.reachable, "A: already-bounced kitchen ball is reachable");
  ok(predA.bounced, "A: prediction respects live ball.bouncesSinceHit (bounced=true)");
  ok(predA.y < COURT.NEAR_KITCHEN_Y, "A: predicted contact is INSIDE the kitchen");
  const nearA = player({ slot: 0, team: "near", controller: "LOCAL_HUMAN", x: 10, y: 31, courtSide: "R" });
  const farA = player({ slot: 2, team: "far", controller: "AI", x: 10, y: 10, courtSide: "L", difficulty: "CLUB" });
  updateMovement([nearA, farA], bA, moveInfo(5), 1 / 60);
  ok(nearA.targetY < COURT.NEAR_KITCHEN_Y, "A: near player moves INTO the kitchen to retrieve the bounced ball");

  // --- B) two-bounce phase, the required bounce has already happened ---
  const bB = ball({ x: 10, y: 8, z: 1.2, vx: 0, vy: -0.5, vz: -2, bouncesSinceHit: 1, lastHitTeam: "near", lastHitBy: 0 });
  const predB = predictContact(bB, "far", true); // requireBounce = strike < 3
  ok(predB.reachable, "B: already-bounced ball is reachable during the two-bounce phase");
  ok(predB.bounced, "B: prediction recognises the already-completed required bounce");
  ok(predB.t < 0.1, "B: contact is immediate — does NOT wait for a second bounce");
  // Gating still works: an otherwise-identical UNBOUNCED ball must wait for its
  // bounce before it is reachable in the two-bounce phase.
  const bB0 = ball({ x: 10, y: 8, z: 1.2, vx: 0, vy: -0.5, vz: -2, bouncesSinceHit: 0, lastHitTeam: "near", lastHitBy: 0 });
  const predB0 = predictContact(bB0, "far", true);
  ok(predB0.t > predB.t, "B: unbounced two-bounce-phase ball still waits for its bounce (gating preserved)");

  // --- C) UNBOUNCED ball floating into the near kitchen: hold behind the line ---
  const bC = ball({ x: 10, y: 25, z: 2.5, vx: 0, vy: 0.1, vz: -2, bouncesSinceHit: 0, lastHitTeam: "far", lastHitBy: 2 });
  const predC = predictContact(bC, "near", false);
  ok(!predC.bounced, "C: unbounced kitchen ball is NOT flagged bounced");
  const nearC = player({ slot: 0, team: "near", controller: "LOCAL_HUMAN", x: 10, y: 27, courtSide: "R" });
  const farC = player({ slot: 2, team: "far", controller: "AI", x: 10, y: 10, courtSide: "L", difficulty: "CLUB" });
  updateMovement([nearC, farC], bC, moveInfo(5), 1 / 60);
  ok(nearC.targetY >= COURT.NEAR_KITCHEN_Y, "C: near player HOLDS behind the kitchen line (no illegal NVZ volley)");
}

console.log("=== Picklewood M1 test suite ===");
rulesTests();
serveRotationTests();
serverPositionTests();
inputTests();
controlsTests();
partnerTests();
realConfigTests();
singlesTests();
kitchenTests();
simTests();
console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
if (failed > 0) {
  console.log("Failures:\n - " + failures.join("\n - "));
  process.exit(1);
}
