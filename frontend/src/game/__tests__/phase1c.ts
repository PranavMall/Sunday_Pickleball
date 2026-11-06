/* Phase 1A Session C headless checks (MetaStore economy; no React).
 * Run: npx tsx src/game/__tests__/phase1c.ts
 */
(globalThis as any).__DEV__ = false;
import { CAREER_MATCH_IDS, STAGE_NAMES, careerMatch } from "../meta/economyConfig";
import { nextGoal } from "../meta/goals";
import { MetaStore } from "../meta/metaStore";
import { shareText, trophiesWon } from "../meta/trophies";
import { SheetCache } from "../render/sheetCache";
import { buildSetup, careerSetup, quickPlaySetup } from "../meta/matchSetup";

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
  ok(s.doc.partners.matz?.discovered && !s.doc.partners.matz.signable && s.doc.career.nextMatchId === CAREER_MATCH_IDS[5], "after Match 5: Matz discovered (not signable), Match 6 next");
  {
    // Release 10: clean path through Match 6 → Matz signable at 1000 Coins.
    const { s: m } = await fresh();
    for (let n = 1; n <= 5; n++) career(m, n, true);
    const o6 = career(m, 6, true);
    eq(o6.moments.map((x) => (x.kind === "court" ? `court:${x.court}` : x.kind === "stage" ? `stage:${x.stageKey}` : x.kind === "partner" ? `partner:${x.partnerId}:${x.flag}` : x.kind)), ["stage:local", "court:nashik", "partner:matz:signable"], "Match 6 win: Mumbai Local Series won → Nashik court → Matz signable");
    ok(m.doc.coins === 1325 && m.doc.partners.matz.signable && !m.doc.partners.matz.signed, `clean path after Match 6: 1325 Coins, Matz signable (got ${m.doc.coins})`);
    eq(nextGoal(m.doc), "Sign Matz in Team", "next goal: Sign Matz");
    ok(m.signPartner("matz", T0) && m.doc.coins === 325 && m.doc.partners.matz.signed, "sign Matz for 1000 Coins: 1325 → 325");
    const s5 = buildSetup({ mode: "career", careerId: CAREER_MATCH_IDS[4] }, 1, m.doc);
    ok(s5.config.far.players[0].name === "Vikram" && s5.rivalLooks[0] === "rival_man1_juh", "Matz signed → Match 5 uses Vikram / rival_man1_juh");
    ok(m.setActivePartner("matz") && buildSetup({ mode: "career", careerId: CAREER_MATCH_IDS[6] }, 1, m.doc).config.near.players[1].name === "Matz", "Matz plays as the Career partner");
  }

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
  {
    // Release 10: first 7 Quick Play matches a day pay Coins; the 8th pays 0; a new day resets.
    const { s: q, mem: qm } = await fresh();
    const c0 = q.doc.coins;
    let paid = 0;
    for (let i = 0; i < 7; i++) paid += q.completeMatch({ matchId: `qc${i}`, kind: "quick", won: i % 2 === 0 }, T0).coins ? 1 : 0;
    ok(paid === 7 && q.doc.coins === c0 + 4 * 40 + 3 * 20 && q.quickPaidLeft(T0) === 0, "Quick Play: first 7 matches of the day pay Coins");
    const eighth = q.completeMatch({ matchId: "qc8", kind: "quick", won: true }, T0);
    ok(eighth.capped === true && !eighth.coins && eighth.lines.join() === "Coins used today — play for fun" && q.doc.coins === c0 + 220, "8th Quick Play pays 0 with \"Coins used today\"");
    ok(q.quickPaidLeft(T0 - DAY) === 0, "clock moved back: Quick Play cap holds");
    eq(q.completeMatch({ matchId: "qd1", kind: "quick", won: true }, T0 + DAY).lines, ["+40 Coins"], "new day resets the Quick Play cap");
    ok(q.quickPaidLeft(T0 + DAY) === 6 && q.doc.daily.quick === 1, "6 paid matches left on the new day");
    // Old save without daily.quick loads as 0.
    await q.flush();
    const old = JSON.parse(qm.get("pb.meta")!);
    delete old.daily.quick;
    qm.set("pb.meta", JSON.stringify(old));
    const reload = new MetaStore({ getItem: async (k) => qm.get(k) ?? null, setItem: async (k, v) => void qm.set(k, v) });
    await reload.load(T0 + DAY);
    ok(reload.doc.daily.quick === 0 && reload.quickPaidLeft(T0 + DAY) === 7, "old save without daily.quick loads as 0");
  }

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
  ok(levelView(300, "mumbai.community.03").max === "Win the Community Cup final to keep growing" && levelView(300, "mumbai.community.03").level === 3, "300 → Lv 3 at the Community Cup cap");
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

// Commit 9: rival looks (config only). RIVAL_SHEETS keys are read from
// sprites.ts (its require()s of .png can't load under node) and each must
// have its sheet file.
function commit9() {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const root = path.resolve(__dirname, "../../..");
  const src = fs.readFileSync(path.join(root, "src/game/render/sprites.ts"), "utf8");
  const block = src.slice(src.indexOf("export const RIVAL_SHEETS"), src.indexOf("};", src.indexOf("export const RIVAL_SHEETS")));
  const keys = new Set([...block.matchAll(/^\s+(rival_\w+):/gm)].map((m) => m[1]));
  ok(keys.size === 26 && [...keys].every((k) => fs.existsSync(path.join(root, `assets/images/${k}.png`))), "26 RIVAL_SHEETS keys, each with its sheet file");
  const yes = () => true, no = () => false;
  const looksOf = (n: number, signed: (id: string) => boolean = no) => careerSetup(careerMatch(CAREER_MATCH_IDS[n - 1]), "anli", 1, signed).rivalLooks;
  ok(CAREER_MATCH_IDS.map(careerMatch).filter((m) => m.enabled).every((m) => { const l = careerSetup(m, "anli", 1).rivalLooks; return l.length === 2 && l.every((k) => keys.has(k)); }), "every enabled Career match resolves both looks to a RIVAL_SHEETS key");
  eq(looksOf(1), ["rival_man1_ban", "rival_woman1_ban"], "Match 1 looks");
  eq(looksOf(2), ["rival_upsi_front", "rival_man2_dad"], "Match 2: Upsi unsigned plays her own look");
  const m2 = careerSetup(careerMatch(CAREER_MATCH_IDS[1]), "anli", 1, (id) => id === "upsi");
  ok(m2.rivalLooks[0] === "rival_woman1_dad" && m2.config.far.players[0].name === "Kiran", "Upsi signed → Match 2 slot 0 rival_woman1_dad (Kiran)");
  const m5 = careerSetup(careerMatch(CAREER_MATCH_IDS[4]), "anli", 1, (id) => id === "matz");
  ok(m5.rivalLooks[0] === "rival_man1_juh" && m5.config.far.players[0].name === "Vikram", "Matz signed → Match 5 slot 0 rival_man1_juh (Vikram)");
  ok(looksOf(5, yes)[1] === "rival_woman2_juh", "reserve rule touches only the recruit slot");
  // Quick Play: deterministic by seed (Career match (seed mod 12) + 1, recruit slot on its reserve look); singles = slot-1 look.
  let qpOk = true, singlesOk = true;
  for (let seed = 0; seed < 60; seed++) {
    const d = quickPlaySetup("CLUB", false, "anli", seed).rivalLooks;
    const cm = careerMatch(CAREER_MATCH_IDS[seed % 12]);
    const want = cm.looks!.map((l, i) => (cm.recruit?.slot === i ? cm.reserveLook! : l));
    qpOk = qpOk && d.join() === quickPlaySetup("CLUB", false, "anli", seed).rivalLooks.join() && d.join() === want.join();
    const sl = quickPlaySetup("CLUB", true, "anli", seed).rivalLooks;
    singlesOk = singlesOk && sl.length === 1 && sl[0] !== "rival_upsi_front" && sl[0] !== "rival_matz_front";
  }
  ok(qpOk, "Quick Play looks deterministic by seed (Matches 1–12, reserve looks)");
  ok(singlesOk, "Quick Play singles never uses Upsi or Matz");
  // Release 10: Quick Play never shows Upsi / Matz, whoever the partner is (600 seeds).
  let noRecruit = true;
  for (const partner of ["anli", "upsi", "matz"])
    for (let seed = 0; seed < 600; seed++)
      for (const singles of [false, true]) noRecruit = noRecruit && quickPlaySetup("CLUB", singles, partner, seed).rivalLooks.every((k) => k !== "rival_upsi_front" && k !== "rival_matz_front" && keys.has(k));
  ok(noRecruit, "Quick Play looks never include rival_upsi_front / rival_matz_front (600 seeds × Anli / Upsi / Matz)");
  // Every Career match: both looks → RIVAL_SHEETS, court → COURT_VISUALS (signed or not).
  const visuals = fs.readFileSync(path.join(root, "src/game/render/courts.ts"), "utf8");
  const vBlock = visuals.slice(visuals.indexOf("export const COURT_VISUALS"), visuals.indexOf("export function courtVisual"));
  const courtKeys = new Set([...vBlock.matchAll(/^  (\w+): \{/gm)].map((m) => m[1]));
  ok(CAREER_MATCH_IDS.map(careerMatch).every((m) => [no, yes].every((sg) => careerSetup(m, "anli", 1, sg).rivalLooks.every((k) => keys.has(k))) && !!m.court && courtKeys.has(m.court)), "every Career match: looks in RIVAL_SHEETS, court in COURT_VISUALS");
  const thumb = fs.readFileSync(path.join(root, "src/ui/CourtThumb.tsx"), "utf8");
  ok([...courtKeys].every((k) => thumb.includes(`  ${k}: require(`) && fs.existsSync(path.join(root, `assets/images/court_${k}.webp`))), "every court has a thumbnail + image file");
  // Stage keys: TROPHY_BY_STAGE and STAGE_NAMES cover all four.
  const tBlock = src.slice(src.indexOf("export const TROPHY_BY_STAGE"), src.indexOf("};", src.indexOf("export const TROPHY_BY_STAGE")));
  const trophyKeys = [...tBlock.matchAll(/^\s+(\w+): require\("@\/assets\/images\/(\w+)\.webp"\)/gm)];
  const stageKeys = [...new Set(CAREER_MATCH_IDS.map((id) => id.split(".")[1]))];
  ok(stageKeys.join() === "community,local,tour,district" && stageKeys.every((k) => !!STAGE_NAMES[k] && trophyKeys.some((t) => t[1] === k)) && trophyKeys.every((t) => fs.existsSync(path.join(root, `assets/images/${t[2]}.webp`))), "TROPHY_BY_STAGE + STAGE_NAMES cover community / local / tour / district");
  ok(src.includes('matz: require("@/assets/images/partner_matz_back.png")') && fs.existsSync(path.join(root, "assets/images/partner_matz_back.png")), "CHARACTER_SHEETS.matz = partner_matz_back.png");
  eq(buildSetup({ mode: "training" }, 1, null).rivalLooks, ["rival_man1_ban", "rival_woman1_ban"], "Training uses Match 1 looks");
  eq(buildSetup({ mode: "scrimmage" }, 1, null).rivalLooks, ["rival_woman1_and", "rival_woman2_and"], "Scrimmage uses Match 4 looks");
}

async function release101() {
  const kinds = (o: { moments: { kind: string }[] }) => o.moments.map((x) => x.kind);
  {
    // Lv 1 → Lv 2 on Match 3: stage → court → level → partner unlock.
    const { s } = await fresh();
    s.devJumpTo(3);
    (s.doc as any).partners.anli.growth = 95;
    const o = career(s, 3, true);
    eq(kinds(o), ["stage", "court", "level", "partner"], "level-up moment queued after stage / court, before the partner unlock");
    const lv = o.moments.find((x) => x.kind === "level") as any;
    ok(lv.partnerId === "anli" && lv.level === 2 && !lv.atCap && o.moments.filter((x) => x.kind === "level").length === 1, "one level moment: Anli Lv 2");
  }
  {
    // Level-up that hits the Community Cup cap carries atCap; at the cap → none.
    const { s } = await fresh();
    (s.doc as any).partners.anli.growth = 195;
    const o = career(s, 1, true);
    const lv = o.moments.find((x) => x.kind === "level") as any;
    ok(lv && lv.level === 3 && lv.atCap === "community", "Lv 3 at the Community Cup cap → atCap (\"Win the … final to keep growing\")");
    (s.doc as any).partners.anli.growth = 295;
    const o2 = career(s, 1, true);
    ok(!o2.moments.some((x) => x.kind === "level") && s.doc.partners.anli.growth === 300, "reaching the stage cap (300): no level moment");
  }
  {
    // Crossing Chemistry 25 → one heart moment.
    const { s } = await fresh();
    (s.doc as any).chemistryHalves["player+anli"] = 48;
    (s.doc as any).chemistryPeakHalves["player+anli"] = 48;
    const o = career(s, 1, true);
    const h = o.moments.filter((x) => x.kind === "heart") as any[];
    ok(h.length === 1 && h[0].chemistry === 25 && h[0].partnerId === "anli", "crossing Chemistry 25 emits one heart moment");
    const o2 = career(s, 2, true);
    ok(!o2.moments.some((x) => x.kind === "heart"), "no heart moment until the next 25");
  }
  {
    // A Training match that levels the partner emits the level moment too.
    const { s } = await fresh();
    (s.doc as any).partners.anli.growth = 95;
    const o = s.completeMatch({ matchId: "tr-lv", kind: "training", won: true, partnerId: "anli" }, T0);
    eq(kinds(o), ["level"], "Training win Lv 1 → Lv 2: level moment");
  }
  {
    // Stage-final first clear writes career.trophies[stageKey].
    const { s, mem } = await fresh();
    s.devJumpTo(3);
    s.completeMatch({ matchId: "tf3", kind: "career", won: true, careerMatchId: CAREER_MATCH_IDS[2], partnerId: "anli", court: "bandra_garden", score: "11–7" }, T0);
    eq(s.doc.career.trophies.community, { wonAt: T0, score: "11–7", rival: "Colaba Kings", partnerId: "anli", court: "Bandra Garden" }, "trophy record: date, score, rival, partner, court");
    s.completeMatch({ matchId: "tf3b", kind: "career", won: true, careerMatchId: CAREER_MATCH_IDS[2], partnerId: "anli", score: "11–0" }, T0 + 1);
    ok(s.doc.career.trophies.community.score === "11–7" && Object.keys(s.doc.career.trophies).join() === "community", "replay of a won final keeps the first record");
    await s.flush();
    ok(JSON.parse(mem.get("pb.meta")!).career.trophies.community.rival === "Colaba Kings", "trophies persisted");
    // Old save without trophies: already-won stages show as won.
    const old = new Map<string, string>([["pb.meta", JSON.stringify({ schemaVersion: 1, guestId: "g_old", career: { cleared: CAREER_MATCH_IDS.slice(0, 6), nextMatchId: CAREER_MATCH_IDS[6] } })]]);
    const so = new MetaStore({ getItem: async (k) => old.get(k) ?? null, setItem: async (k, v) => void old.set(k, v) }, () => 0.5);
    await so.load(T0);
    ok(JSON.stringify(so.doc.career.trophies) === "{}" && trophiesWon(so.doc).join() === "community,local", "old save loads; Community Cup + Local Series show as won");
    eq(shareText(["community", "local"]), "🏆 2 of 4 Mumbai trophies in Pickle-Ballers: Community Cup, Mumbai Local Series. Next: the Maharashtra Tour!", "share text");
  }
  {
    // DEV jump to Match 7.
    const { s } = await fresh();
    const coins = s.doc.coins, writes0 = s.writes;
    s.devJumpTo(7);
    await s.flush();
    ok(s.doc.career.cleared.length === 6 && s.doc.career.cleared.join() === CAREER_MATCH_IDS.slice(0, 6).join() && s.doc.career.nextMatchId === "mumbai.tour.07", "DEV jump 7: 6 cleared, next = mumbai.tour.07");
    ok(s.doc.partners.upsi.signable && s.doc.partners.matz.signable && !s.doc.partners.upsi.signed && !s.doc.partners.matz.signed, "DEV jump 7: Upsi and Matz signable, not signed");
    ok(s.doc.coins === coins && s.doc.fans === 0 && s.doc.partners.anli.growth === 0 && Object.keys(s.doc.milestones).length === 0 && s.writes === writes0 + 1, "DEV jump 7: Coins / Fans / Growth / milestones unchanged, one save");
    s.devJumpTo(5);
    ok(s.doc.partners.upsi.signable && !s.doc.partners.matz.discovered && s.doc.career.nextMatchId === "mumbai.local.05", "DEV jump 5: Upsi signable, Matz not yet met");
  }
  {
    // Sheet eviction: exactly the current set (+ the prefetched next set) stays decoded.
    const disposed: number[] = [];
    let failsLeft = 0;
    const c = new SheetCache<{ id: number; dispose: () => void }>(async (m) => {
      if (failsLeft > 0) { failsLeft--; throw new Error("net"); }
      return { id: m, dispose: () => disposed.push(m) };
    }, [1, 1]);
    const loadSet = async (mods: number[]) => { c.setCurrent(mods); await Promise.all(mods.map((m) => c.load(m))); };
    await loadSet([1, 2, 3, 4]);
    await loadSet([1, 2, 5, 6]);
    eq([...c.cache.keys()].sort(), [1, 2, 5, 6], "eviction: only the current set stays");
    ok(disposed.sort().join() === "3,4", "eviction: evicted sheets disposed");
    c.prefetch([7, 8]);
    await Promise.all([c.load(7), c.load(8)]);
    eq([...c.cache.keys()].sort(), [1, 2, 5, 6, 7, 8], "prefetched next set kept alongside the current set");
    await loadSet([1, 2, 7, 8]);
    eq([...c.cache.keys()].sort(), [1, 2, 7, 8], "next match: previous rivals evicted");
    failsLeft = 2;
    c.setCurrent([1, 2, 9]);
    ok((await c.load(9)).id === 9, "a sheet that fails twice loads on the third try");
    failsLeft = 3;
    c.setCurrent([1, 2, 10]);
    let failed = false;
    try { await c.load(10); } catch { failed = true; }
    ok(failed && !c.cache.has(10), "three failures → rejected (placeholder)");
  }
}

(async () => {
  await commit4();
  await release101();
  await commit5();
  await sessionD();
  commit9();
  console.log(`=== PHASE 1C RESULT: ${pass} passed, ${fail} failed ===`);
  if (fail) process.exitCode = 1;
})();
