/* Phase 1A tests (Session A). Run: npx tsx src/game/__tests__/phase1a.ts */
(globalThis as any).__DEV__ = false;
declare const require: any;
declare const __dirname: string;
const fs = require("fs");
const path = require("path");
import { faultLabelFor } from "../faultLabel";
import { COURT } from "../config/court";
import { INPUT, TACTIC } from "../config/tuning";
import { buildMatchConfig, devSinglesConfig, quickMatchConfig, type MatchConfig } from "../config/matchConfig";
import { ScoreManager } from "../sim/score";
import { GameSimulation } from "../sim/GameSimulation";
import { analytics } from "../services/analytics";
import { CAREER_MATCH_IDS, META_STORAGE_KEY, SCHEMA_VERSION } from "../meta/economyConfig";
import { MetaStore, dayKeyOf, newMatchId, pairingKey, type StorageAdapter } from "../meta/metaStore";
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
  { name: "scoring", run: scoringTests },
  { name: "meta", run: metaTests },
  { name: "chemistryIsolation", run: chemistryIsolationTests },
];

function scoringTests() {
  console.log("\n[Commit 2a: first-to-7 scoring]");
  // ScoreManager directly.
  let s = ScoreManager.initial("near");
  s.isFirstServiceTurn = false;
  let out = ScoreManager.resolve(s, "near", "doubles", 7, 2);
  for (let i = 1; i < 7; i++) out = ScoreManager.resolve(out.score, "near", "doubles", 7, 2);
  ok(out.gameOver && out.winner === "near" && out.score.nearScore === 7, "first-to-7: winner set at 7–0");
  // Default first-to-11 unchanged: 7–0 is NOT game over by default.
  let d = ScoreManager.resolve(s, "near");
  for (let i = 1; i < 7; i++) d = ScoreManager.resolve(d.score, "near");
  ok(!d.gameOver && d.winner === null, "default: 7–0 is not game over (first to 11)");
  for (let i = 7; i < 11; i++) d = ScoreManager.resolve(d.score, "near");
  ok(d.gameOver && d.winner === "near" && d.score.nearScore === 11, "default: winner at 11");
  // Through the engine with ruleModifiers.
  const cfg = buildMatchConfig({
    seed: 1, format: "doubles", ruleModifiers: { pointsToWin: 7 },
    near: { controllers: ["LOCAL_HUMAN", "AI"], difficulties: [undefined, "CLUB"] },
    far: { controllers: ["AI", "AI"], difficulties: ["CLUB", "CLUB"] },
  });
  const sim = new GameSimulation(cfg);
  for (let i = 0; i < 40 && sim.winner === null; i++) sim.debugPlayPoint(sim.score.servingTeam);
  ok(sim.winner !== null && Math.max(sim.score.nearScore, sim.score.farScore) === 7, `engine first-to-7: winner at 7 (${sim.score.nearScore}-${sim.score.farScore})`);
}

class MemStorage implements StorageAdapter {
  data = new Map<string, string>();
  sets = 0;
  inFlight = 0;
  maxInFlight = 0;
  async getItem(k: string) { return this.data.get(k) ?? null; }
  async setItem(k: string, v: string) {
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    await new Promise((r) => setTimeout(r, 1));
    this.data.set(k, v);
    this.sets++;
    this.inFlight--;
  }
}

const DAY = 24 * 3600 * 1000;
const T0 = new Date(2026, 5, 14, 12, 0, 0).getTime();

async function metaTests() {
  console.log("\n[Commit 2b/2c: MetaStore + ledger]");
  const mem = new MemStorage();
  const m = new MetaStore(mem);
  await m.load(T0);
  const d = m.doc;
  ok(d.schemaVersion === SCHEMA_VERSION, "fresh: schemaVersion");
  ok(d.coins === 300 && d.gems === 0 && d.fans === 0, "fresh: 300 Coins, 0 Gems, 0 Fans");
  ok(d.form === "normal" && d.formStreak === 0, "fresh: Form Normal");
  ok(d.homeCity === "mumbai" && d.firstSession === "not_started", "fresh: homeCity mumbai, firstSession not_started");
  ok(d.activePartnerId === "anli" && d.trainingPartnerId === "anli" && d.partners.anli.signed, "fresh: Anli signed, active, training partner");
  ok(d.career.nextMatchId === "mumbai.community.01" && CAREER_MATCH_IDS.length === 10 && CAREER_MATCH_IDS[9] === "mumbai.district.10", "fresh: career IDs + next match");
  ok(typeof d.guestId === "string" && d.guestId.length > 6, "fresh: guestId created");
  ok(mem.data.has(META_STORAGE_KEY), "fresh save written at app start");
  const doc = JSON.parse(mem.data.get(META_STORAGE_KEY)!);
  for (const k of ["schemaVersion", "guestId", "homeCity", "firstSession", "coins", "gems", "fans", "form", "formStreak", "activePartnerId", "trainingPartnerId", "partners", "chemistryHalves", "career", "namedRivals", "milestones", "daily", "inboxRead"])
    ok(k in doc, `persisted field: ${k}`);
  ok(!("playerName" in doc) && !("teamName" in doc), "identity is NOT duplicated in the meta save");

  // guestId persists across reloads.
  const m2 = new MetaStore(mem);
  await m2.load(T0 + 1000);
  eq(m2.doc.guestId, d.guestId, "guestId persists across app restarts");

  // Ledger: idempotent grant.
  const src = { sourceType: "career", sourceId: "mumbai.community.01" };
  const g1 = m2.grant("career:M1:coins", "coins", 50, src, T0);
  const g2 = m2.grant("career:M1:coins", "coins", 50, src, T0);
  ok(g1.ok && g1.applied && g2.ok && !g2.applied && m2.doc.coins === 350, "repeated rewardId grants once");
  const e = m2.doc.ledger[m2.doc.ledger.length - 1];
  ok(e.rewardId === "career:M1:coins" && e.valueBefore === 300 && e.delta === 50 && e.valueAfter === 350 && e.sourceType === "career" && e.sourceId === "mumbai.community.01" && e.timestamp === T0, "ledger entry has before/delta/after/source/timestamp");

  // Spend refuses when short; never negative.
  const sp = m2.spend("shop:x", "coins", 1000, { sourceType: "shop", sourceId: "x" }, T0);
  ok(!sp.ok && m2.doc.coins === 350, "spend refuses when short (no change)");
  const sp2 = m2.spend("shop:y", "coins", 100, { sourceType: "shop", sourceId: "y" }, T0);
  ok(sp2.ok && m2.doc.coins === 250, "spend succeeds when affordable");
  ok(!m2.spend("shop:g", "gems", 1, { sourceType: "shop", sourceId: "g" }, T0).ok && m2.doc.gems === 0, "gems never negative");
  // Fans never decrease.
  m2.grant("q:1:fans", "fans", 10, src, T0);
  const fd = (m2 as any).applyLedger("q:2:fans", "fans", -5, src, T0);
  ok(!fd.ok && m2.doc.fans === 10, "Fans never decrease");

  // Chemistry halves, displayed rounded down.
  m2.grant("t:1:chem", "chemistry", 0.5, src, T0, pairingKey("anli"));
  m2.grant("t:2:chem", "chemistry", 1, src, T0, pairingKey("anli"));
  ok(m2.doc.chemistryHalves[pairingKey("anli")] === 3 && m2.chemistry("anli") === 1, "chemistry stored in halves (1.5 → 3), displayed rounded down (1)");
  m2.grant("t:3:growth", "growth", 2, src, T0, "anli");
  ok(m2.doc.partners.anli.growth === 2, "growth goes through the ledger");

  // completeMatch: idempotent by matchId; career progress.
  const cm = { matchId: "MX", kind: "career" as const, won: true, careerMatchId: "mumbai.community.01", rewards: [{ currency: "coins" as const, amount: 40 }, { currency: "fans" as const, amount: 5 }] };
  const before = m2.doc.coins;
  const r1 = m2.completeMatch(cm, T0);
  const r2 = m2.completeMatch(cm, T0);
  ok(r1.applied && !r2.applied && m2.doc.coins === before + 40, "completeMatch twice grants once");
  ok(m2.doc.rewardIds.includes("career:MX:coins") && m2.doc.rewardIds.includes("career:MX:fans"), "rewardIds derive from the matchId");
  ok(m2.doc.career.cleared.includes("mumbai.community.01") && m2.doc.career.nextMatchId === "mumbai.community.02" && m2.doc.career.firstClearWins === 1, "career clear + next match id + first-clear wins");
  m2.completeMatch({ matchId: "MY", kind: "career", won: false, careerMatchId: "mumbai.community.02" }, T0);
  ok(m2.doc.career.firstClearLosses === 1, "first-clear losses recorded");
  // Quitting mid-match: nothing granted (a match id that never completes leaves no trace).
  const coinsNow = m2.doc.coins;
  newMatchId(T0); // match started, then app killed
  ok(m2.doc.coins === coinsNow && !m2.doc.rewardIds.some((id) => id.includes("quitMatch")), "a match that never completes grants nothing");
  ok(newMatchId(T0, () => 0.1) !== newMatchId(T0, () => 0.2), "matchIds are unique per match");

  // Daily caps + clock moved back.
  m2.completeMatch({ matchId: "TR1", kind: "training", won: true }, T0);
  m2.completeMatch({ matchId: "SC1", kind: "scrimmage", won: true }, T0);
  eq(m2.dailyUsage(T0), { training: 1, scrimmage: 1 }, "daily usage counts");
  eq(m2.dailyUsage(T0 - 3 * DAY), { training: 1, scrimmage: 1 }, "clock moved BACK does not reset daily caps");
  eq(m2.doc.daily.dayKey, dayKeyOf(T0), "clock moved back keeps the last day key");
  eq(m2.dailyUsage(T0 + DAY), { training: 0, scrimmage: 0 }, "next local day resets daily caps");

  // Writes are strictly sequential and the last write wins with the latest state.
  await m2.flush();
  ok(mem.maxInFlight === 1, `writes are sequential (max in flight ${mem.maxInFlight})`);
  const m3 = new MetaStore(mem);
  await m3.load(T0 + DAY);
  ok(m3.doc.coins === m2.doc.coins && m3.doc.rewardIds.includes("career:MX:coins"), "save round-trips (latest state persisted)");
  ok(!(m3.grant("career:M1:coins", "coins", 50, src, T0) as any).applied, "idempotency survives a reload");

  // Corrupt / missing saves recover.
  for (const bad of ["{not json", "null", "[]", '"str"', JSON.stringify({ schemaVersion: "x" })]) {
    const cs = new MemStorage();
    cs.data.set(META_STORAGE_KEY, bad);
    const mc = new MetaStore(cs);
    let threw = false;
    try { await mc.load(T0); } catch { threw = true; }
    ok(!threw && mc.doc.coins === 300 && mc.doc.partners.anli.signed, `corrupt save ${bad.slice(0, 12)} → fresh starter save`);
  }
  {
    const cs = new MemStorage();
    cs.data.set(META_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, guestId: "g_keep", coins: -5, fans: "lots", career: { nextMatchId: "bogus" } }));
    const mc = new MetaStore(cs);
    await mc.load(T0);
    ok(mc.doc.guestId === "g_keep" && mc.doc.coins === 300 && mc.doc.fans === 0 && mc.doc.career.nextMatchId === "mumbai.community.01", "partially corrupt fields fall back, valid ones kept");
  }
  {
    const throwing: StorageAdapter = { getItem: async () => { throw new Error("io"); }, setItem: async () => {} };
    const mc = new MetaStore(throwing);
    let threw = false;
    try { await mc.load(T0); } catch { threw = true; }
    ok(!threw && mc.doc.coins === 300, "storage read error → fresh save, no crash");
  }
  // Analytics emitted at the ledger.
  const evs = analytics.recent().map((x) => x.event);
  for (const ev of ["economy_reward_granted", "economy_spend", "career_match_completed", "partner_progress_changed", "training_completed", "scrimmage_completed"])
    ok(evs.includes(ev), `analytics: ${ev}`);
  m3.completeMatch({ matchId: "Q1", kind: "quick", won: true }, T0);
  m3.milestoneProgress("first_win", 1, 1);
  ok(analytics.recent().some((x) => x.event === "quick_play_completed") && analytics.recent().some((x) => x.event === "milestone_completed"), "analytics: quick_play_completed + milestone_completed");
}

function chemistryIsolationTests() {
  console.log("\n[Commit 2d: engine chemistry isolation]");
  const configs: [string, MatchConfig][] = [
    ["quickMatchConfig", quickMatchConfig("CLUB", 1)],
    ["devSinglesConfig", devSinglesConfig("PRO", 1)],
    ["buildMatchConfig", buildMatchConfig({ seed: 1, format: "doubles", near: { controllers: ["LOCAL_HUMAN", "AI"] }, far: { controllers: ["AI", "AI"] } })],
  ];
  for (const [name, cfg] of configs) {
    const ps = [...cfg.near.players, ...cfg.far.players];
    ok(ps.every((p) => (p.chemistry ?? 1) === 1 && p.stats === undefined), `${name}: chemistry 1.0 and stats unset`);
    const sim = new GameSimulation(cfg);
    ok(sim.players.every((p) => p.chemistry === 1), `${name}: engine players chemistry exactly 1.0`);
  }
  const legacy = new GameSimulation({ seed: 1, difficulty: "CLUB" });
  ok(legacy.players.every((p) => p.chemistry === 1) && legacy.config.near.players.concat(legacy.config.far.players).every((p) => p.stats === undefined), "SimOptions path: chemistry 1.0, stats unset");
  // No engine/config file imports the meta layer.
  const dir = path.join(__dirname, "..");
  const offenders: string[] = [];
  for (const sub of ["sim", "config"]) {
    for (const f of fs.readdirSync(path.join(dir, sub))) {
      const src = fs.readFileSync(path.join(dir, sub, f), "utf8");
      if (/from\s+["'][^"']*meta/.test(src)) offenders.push(`${sub}/${f}`);
    }
  }
  ok(offenders.length === 0, `sim/ and config/ never import meta (${offenders.join(",") || "none"})`);
}

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
