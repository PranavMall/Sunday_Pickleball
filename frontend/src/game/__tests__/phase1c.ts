/* Phase 1A Session C headless checks (MetaStore economy; no React).
 * Run: npx tsx src/game/__tests__/phase1c.ts
 */
(globalThis as any).__DEV__ = false;
import { CAREER_MATCH_IDS, careerMatch } from "../meta/economyConfig";
import { nextGoal } from "../meta/goals";
import { MetaStore } from "../meta/metaStore";
import { buildSetup } from "../meta/matchSetup";

let pass = 0;
let fail = 0;
function ok(c: boolean, msg: string) {
  if (c) pass++;
  else {
    fail++;
    console.log("FAIL:", msg);
  }
}
const eq = (a: unknown, b: unknown, msg: string) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const T0 = new Date(2026, 5, 14, 12, 0, 0).getTime();
const DAY = 86400000;
let seq = 0;
async function fresh() {
  const mem = new Map<string, string>();
  const s = new MetaStore({ getItem: async (k) => mem.get(k) ?? null, setItem: async (k, v) => void mem.set(k, v) }, () => 0.5);
  await s.load(T0);
  return { s, mem };
}
const career = (s: MetaStore, n: number, won: boolean, id = `m${++seq}`) =>
  s.completeMatch({ matchId: id, kind: "career", won, careerMatchId: CAREER_MATCH_IDS[n - 1], partnerId: s.doc.activePartnerId, court: careerMatch(CAREER_MATCH_IDS[n - 1]).court ?? undefined }, T0);

async function commit4() {
  // Clean path to Match 3: 775 Coins / 85 Fans; Anli 36 Growth / 6 Chemistry (Session D 7.2).
  const { s, mem } = await fresh();
  ok(s.doc.coins === 300 && s.doc.fans === 0, "fresh: 300 Coins, 0 Fans");
  const o1 = career(s, 1, true);
  eq(o1.lines, ["+100 Coins", "+20 Fans", "Anli +12 Growth · +2 Chemistry"], "Match 1 first-clear win lines");
  ok(s.doc.career.nextMatchId === CAREER_MATCH_IDS[1], "win unlocks Match 2");
  const o2 = career(s, 2, true);
  eq(o2.events, ["You met Upsi"], "Match 2 win: You met Upsi");
  ok(s.doc.partners.upsi?.discovered && !s.doc.partners.upsi.signable, "Upsi discovered, not signable");
  eq(nextGoal(s.doc), "Next: Community Cup Final", "next goal after Match 2");
  const o3 = career(s, 3, true);
  eq(o3.lines, ["+100 Coins", "+20 Fans", "+100 Coins · Rival defeated", "+25 Fans · Rival defeated", "+75 Coins · Milestone I", "Anli +12 Growth · +2 Chemistry"], "Match 3 lines");
  eq(o3.events, ["Milestone I reached", "Upsi can now be signed"], "Match 3 events");
  ok(s.doc.coins === 775 && s.doc.fans === 85, `clean path: 775 Coins / 85 Fans (got ${s.doc.coins}/${s.doc.fans})`);
  ok(s.doc.partners.anli.growth === 36 && s.chemistry("anli") === 6, "Anli 36 Growth / 6 Chemistry");
  ok(s.doc.partners.upsi.signable, "Upsi signable after Match 3");
  eq(nextGoal(s.doc), "Sign Upsi in Team", "next goal: Sign Upsi");

  // Replay of a cleared match: replay rates only, no rival / milestone / fans.
  const c0 = s.doc.coins, f0 = s.doc.fans;
  const r3 = career(s, 3, true);
  eq(r3.lines, ["+40 Coins", "Anli +12 Growth · +2 Chemistry"], "Match 3 replay win lines");
  ok(s.doc.coins === c0 + 40 && s.doc.fans === f0 && r3.events.length === 0, "replay win: +40 Coins, 0 Fans, no events");
  const r2 = career(s, 2, false);
  eq(r2.lines, ["+14 Coins", "Anli +3 Growth · +0.5 Chemistry"], "replay loss lines");
  ok(s.doc.career.nextMatchId === CAREER_MATCH_IDS[3], "replays do not move the next match");

  // First-clear loss: +35 Coins, no Fans, retry the same match.
  const f1 = s.doc.fans;
  const l4 = career(s, 4, false);
  eq(l4.lines, ["+35 Coins", "Anli +3 Growth · +0.5 Chemistry"], "Match 4 first-clear loss lines");
  ok(s.doc.fans === f1 && s.doc.career.nextMatchId === CAREER_MATCH_IDS[3], "loss: no Fan change, same match stays open");
  career(s, 4, true);
  const o5 = career(s, 5, true);
  eq(o5.events, ["Matz is watching you"], "Match 5: Matz discovered");
  ok(s.doc.partners.matz?.discovered && !careerMatch(s.doc.career.nextMatchId).enabled && s.doc.career.nextMatchId === CAREER_MATCH_IDS[5], "after Match 5: Match 6 next and locked");

  // Same matchId twice → nothing twice; quitting (no completeMatch) → nothing.
  const c1 = s.doc.coins;
  career(s, 1, true, "dup");
  const again = career(s, 1, true, "dup");
  ok(!again.applied && again.lines.length === 0 && s.doc.coins === c1 + 40, "repeated matchId grants once");
  await s.flush();
  const reload = new MetaStore({ getItem: async (k) => mem.get(k) ?? null, setItem: async (k, v) => void mem.set(k, v) });
  await reload.load(T0);
  ok(!reload.completeMatch({ matchId: "dup", kind: "career", won: true, careerMatchId: CAREER_MATCH_IDS[0] }, T0).applied && reload.doc.coins === s.doc.coins, "idempotent across app restart (result screen kill)");

  // Quick Play: 40 / 20 Coins only.
  const qc = s.doc.coins, qf = s.doc.fans, qg = s.doc.partners.anli.growth;
  eq(s.completeMatch({ matchId: "q1", kind: "quick", won: true }, T0).lines, ["+40 Coins"], "Quick Play win");
  eq(s.completeMatch({ matchId: "q2", kind: "quick", won: false }, T0).lines, ["+20 Coins"], "Quick Play loss");
  ok(s.doc.coins === qc + 60 && s.doc.fans === qf && s.doc.partners.anli.growth === qg, "Quick Play pays Coins only");

  // Every match config keeps engine chemistry unset (1.0) and stats unset.
  for (const p of [{ mode: "career", careerId: CAREER_MATCH_IDS[4] }, { mode: "quick", difficulty: "PRO" }, { mode: "quick", difficulty: "ROOKIE", singles: "1" }, { mode: "training" }, { mode: "scrimmage" }]) {
    const cfg = buildSetup(p, 1, s.doc).config;
    ok([...cfg.near.players, ...cfg.far.players].every((pl: any) => pl.chemistry === undefined && pl.stats === undefined), `${p.mode}: engine chemistry / stats unset`);
  }
  // Growth (7.1, replaces the 100 cap): running total, capped 300 in the
  // Community Cup; Chemistry gains halved at 50+.
  const { s: c } = await fresh();
  (c.doc as any).partners.anli.growth = 296;
  (c.doc as any).chemistryHalves["player+anli"] = 100; // 50.0
  (c.doc as any).chemistryPeakHalves["player+anli"] = 100;
  c.completeMatch({ matchId: "cap", kind: "career", won: true, careerMatchId: CAREER_MATCH_IDS[0], partnerId: "anli" }, T0);
  ok(c.doc.partners.anli.growth === 300 && c.doc.chemistryHalves["player+anli"] === 102 && c.chemistry("anli") === 51, "growth stops at 300 (Community Cup); chemistry +2 halved to +1 at 50+");
}

async function commit5() {
  const { s } = await fresh();
  // Upsi not signable before Match 3.
  for (let n = 1; n <= 2; n++) career(s, n, true);
  (s.doc as any).coins = 5000;
  ok(!s.signPartner("upsi", T0) && !s.doc.partners.upsi.signed, "Upsi not signable before winning Match 3");
  (s.doc as any).coins = 500;
  career(s, 3, true); // 500 + 275 = 775
  ok(s.doc.coins === 775, "775 before signing");
  ok(s.signPartner("upsi", T0) && s.doc.coins === 25 && s.doc.partners.upsi.signed, "sign Upsi: 775 → 25");
  ok(!s.signPartner("upsi", T0) && s.doc.coins === 25 && s.doc.ledger.filter((e) => e.rewardId === "sign:upsi").length === 1, "750 spent exactly once");
  ok(s.doc.activePartnerId === "anli", "signing does not change the active partner by itself");
  ok(!s.signPartner("matz", T0), "Matz not signable in 1A");
  {
    const { s: poor } = await fresh();
    for (let n = 1; n <= 3; n++) career(poor, n, true);
    (poor.doc as any).coins = 749;
    ok(!poor.signPartner("upsi", T0) && poor.doc.coins === 749 && !poor.doc.partners.upsi.signed, "short of 750 → no change");
  }

  // Substitution with Upsi benched, then active.
  const far = (p: object) => buildSetup({ mode: "career", careerId: CAREER_MATCH_IDS[1], ...p }, 1, s.doc).config.far.players;
  ok(far({})[0].name === "Kiran" && far({})[0].personality === "KITCHEN" && far({})[0].profileId === "ROOKIE", "Upsi benched: Kiran plays her slot (same level / personality)");
  ok(s.setActivePartner("upsi") && s.doc.activePartnerId === "upsi", "SET ACTIVE → Upsi");
  const cfg2 = buildSetup({ mode: "career", careerId: CAREER_MATCH_IDS[1] }, 1, s.doc).config;
  ok(cfg2.far.players[0].name === "Kiran" && cfg2.near.players[1].name === "Upsi" && cfg2.near.players[1].personality === "KITCHEN", "Upsi active: on my side, Kiran on theirs");
  ok(!s.setActivePartner("upsi") && s.setActivePartner("anli") && s.doc.activePartnerId === "anli", "exactly one active partner");
  {
    const { s: f } = await fresh();
    ok(buildSetup({ mode: "career", careerId: CAREER_MATCH_IDS[1] }, 1, f.doc).config.far.players[0].name === "Upsi", "unsigned: Upsi plays her own slot");
  }

  // Training / Scrimmage with Upsi while Anli stays active.
  ok(s.setTrainingPartner("upsi") && s.doc.activePartnerId === "anli", "training partner Upsi, Anli still active");
  const tr = (kind: "training" | "scrimmage", at = T0, won = true) => s.completeMatch({ matchId: `${kind}${++seq}`, kind, won, partnerId: s.doc.trainingPartnerId }, at);
  const c0 = s.doc.coins, f0 = s.doc.fans, ag = s.doc.partners.anli.growth;
  eq(tr("training").lines, ["Upsi +15 Growth · +2 Chemistry"], "Training win grants +15 / +2 to the training partner");
  ok(s.doc.partners.upsi.growth === 15 && s.chemistry("upsi") === 2, "Upsi 15 / 2");
  eq(tr("scrimmage").lines, ["Upsi +10 Growth · +1 Chemistry"], "Scrimmage +10 / +1");
  eq(tr("training", T0, false).lines, ["Upsi +4 Growth · +0.5 Chemistry"], "Training loss +4 / +0.5");
  eq(s.dailyUsage(T0), { training: 2, scrimmage: 1 }, "counts used");
  const capped = tr("training");
  ok(capped.capped === true && capped.lines.join() === "Progress used today — play for fun" && s.doc.partners.upsi.growth === 29, "after cap: plays, grants nothing");
  eq(tr("scrimmage", T0, false).lines, ["Upsi +2 Growth · +0.5 Chemistry"], "Scrimmage loss +2 / +0.5");
  tr("scrimmage");
  ok(tr("scrimmage").capped === true && s.doc.partners.upsi.growth === 41, "scrimmage cap 3");
  ok(s.doc.coins === c0 && s.doc.fans === f0 && s.doc.partners.anli.growth === ag, "Training/Scrimmage never pay Coins / Fans, active partner untouched");
  ok(tr("training", T0 - 2 * DAY).capped === true, "clock moved back: cap still holds");
}

// Session D Commit 6/7: result-screen data, levels, chemistry fade / floor / catch-up.
async function sessionD() {
  const { s } = await fresh();
  career(s, 1, true);
  career(s, 2, true);
  const o3 = career(s, 3, true);
  eq(o3.moments.map((m) => m.kind), ["stage", "court", "partner"], "Match 3: three moments in order");
  eq(o3.coins, { before: 500, after: 775, parts: ["Win +100", "Rival +100", "Milestone I +75"] }, "Coins tile 500 → 775 with parts");
  eq(o3.fans, { before: 40, after: 85, parts: ["Win +20", "Rival +25"] }, "Fans tile 40 → 85");
  ok(o3.partner?.growthBefore === 24 && o3.partner.growthAfter === 36 && o3.partner.chemAfter === 6, "partner row 24 → 36 Growth, 6 Chemistry");
  ok(career(s, 4, false).moments.length === 0, "ordinary match: no pop-ups");
  ok(s.doc.courtsPlayed.join() === "bandra_garden,mumbai_local", "courts played tracked (NEW tag)");
  const q = s.completeMatch({ matchId: "qd", kind: "quick", won: true, partnerId: "anli" }, T0);
  ok(!q.fans && q.coins?.parts.join() === "Win +40", "Quick Play: Coins tile only");
  // Levels / stage cap: Mumbai Local unlocked → cap 500.
  const { levelView, growthCap } = await import("../meta/levels");
  ok(growthCap("mumbai.community.02") === 300 && growthCap("mumbai.local.04") === 500, "cap 300 Community Cup / 500 Mumbai Local");
  eq(levelView(140, "mumbai.community.02"), { level: 2, frac: 0.4, text: "40 / 100" }, "140 → Lv 2, 40/100");
  ok(levelView(300, "mumbai.community.03").max === "MAX for Community Cup" && levelView(300, "mumbai.community.03").level === 3, "300 → Lv 3 MAX for Community Cup");
  // Fade: sign Upsi, play 3 with her → Anli −1, Rusty; then catch-up.
  (s.doc as any).coins = 5000;
  ok(s.signPartner("upsi", T0) && s.setTrainingPartner("upsi"), "Upsi signed, training partner");
  const a0 = s.doc.chemistryHalves["player+anli"];
  for (let i = 0; i < 3; i++) s.completeMatch({ matchId: `fu${i}`, kind: "scrimmage", won: true, partnerId: "upsi" }, T0);
  ok(s.doc.chemistryHalves["player+anli"] === a0 - 2 && s.doc.ledger.some((e) => e.sourceType === "chemistry_fade"), "3 apart → Anli −1 via chemistry_fade ledger");
  ok(s.doc.chemistryHalves["player+anli"] < s.doc.chemistryPeakHalves["player+anli"], "below peak → Rusty");
  const back = career(s, 1, true);
  ok(back.partner!.chemAfter - back.partner!.chemBefore === 3 && s.doc.chemistryHalves["player+anli"] === a0 - 2 + 6, "catch-up: +2 doubled up to the peak (+3)");
  ok(s.doc.apart["player+anli"] === 0 && s.doc.apart["player+upsi"] === 1, "played together resets; other partner counts apart");
  // Floor: never below the highest multiple of 25 reached.
  (s.doc as any).chemistryHalves["player+anli"] = 52; // 26
  (s.doc as any).chemistryPeakHalves["player+anli"] = 60; // 30 → floor 25
  for (let i = 0; i < 6; i++) s.completeMatch({ matchId: `fl${i}`, kind: "scrimmage", won: true, partnerId: "upsi" }, T0 + 2 * DAY);
  ok(s.chemistry("anli") === 25, "fade floor 25");
  // 8.2: "play for fun" (capped Training / Scrimmage with Upsi) never fades Anli.
  {
    const day = T0 + 5 * DAY;
    for (let i = 0; i < 3; i++) s.completeMatch({ matchId: `cu${i}`, kind: "scrimmage", won: true, partnerId: "upsi" }, day); // uses today's 3
    for (let i = 0; i < 2; i++) s.completeMatch({ matchId: `ct${i}`, kind: "training", won: false, partnerId: "upsi" }, day); // uses today's 2
    const ch = s.doc.chemistryHalves["player+anli"], apart = s.doc.apart["player+anli"], fades = s.doc.ledger.filter((e) => e.sourceType === "chemistry_fade").length;
    let allCapped = true;
    for (let i = 0; i < 6; i++) allCapped = s.completeMatch({ matchId: `cc${i}`, kind: i % 2 ? "training" : "scrimmage", won: true, partnerId: "upsi" }, day).capped === true && allCapped;
    ok(allCapped && s.doc.chemistryHalves["player+anli"] === ch && s.doc.apart["player+anli"] === apart && s.doc.ledger.filter((e) => e.sourceType === "chemistry_fade").length === fades, "capped sessions with Upsi leave Anli's Chemistry (and apart count) unchanged");
  }
  // 1v1: no fade.
  const h = s.doc.chemistryHalves["player+anli"], ap = s.doc.apart["player+anli"];
  s.completeMatch({ matchId: "solo", kind: "quick", won: true, singles: true }, T0);
  ok(s.doc.chemistryHalves["player+anli"] === h && s.doc.apart["player+anli"] === ap, "1v1 never fades");
  // Quick Play partner never changes Career / training partner.
  ok(s.setQuickPartner("upsi") && s.doc.activePartnerId === "anli" && s.doc.trainingPartnerId === "upsi" && buildSetup({ mode: "quick", difficulty: "CLUB" }, 1, s.doc).config.near.players[1].name === "Upsi", "Quick Play partner Upsi; Career partner stays Anli");
}

(async () => {
  await commit4();
  await commit5();
  await sessionD();
  console.log(`=== PHASE 1C RESULT: ${pass} passed, ${fail} failed ===`);
  if (fail) process.exitCode = 1;
})();
