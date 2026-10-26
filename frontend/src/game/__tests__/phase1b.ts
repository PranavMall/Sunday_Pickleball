/* Phase 1A Session B headless checks (UI data, configs; no React).
 * Run: npx tsx src/game/__tests__/phase1b.ts
 */
import { PARTNER_DIFFICULTY } from "../config/ai";
import { PLAYER_NAME_POOL, TEAM_NAME_POOL, teamCode } from "../services/profile";
import { quickPlaySetup, careerSetup, trainingSetup } from "../meta/matchSetup";
import { CAREER_MATCH_IDS, CAREER_MATCHES, CAREER_REWARDS, PARTNERS, careerMatch, careerRewardPreview } from "../meta/economyConfig";
import { hasUnread, inboxMessages } from "../meta/inbox";
import { discoveredPartners, rosterStatus } from "../meta/team";
import { MetaStore, freshSave } from "../meta/metaStore";

let pass = 0;
let fail = 0;
export function ok(c: boolean, msg: string) {
  if (c) pass++;
  else {
    fail++;
    console.log("FAIL:", msg);
  }
}
(globalThis as any).__DEV__ = true;

// ---- 3a: identity + team code ----
ok(PLAYER_NAME_POOL.length === 33 && TEAM_NAME_POOL.length === 30, "Appendix A pool sizes (33 players / 30 teams)");
ok(PLAYER_NAME_POOL.every((n) => n.length >= 2 && n.length <= 18) && TEAM_NAME_POOL.every((n) => n.length >= 2 && n.length <= 18), "pool names pass length validation");
ok(teamCode("Bandra Aces", "CCK") === "BAN", "team code: first 3 letters uppercase");
ok(teamCode("9-Lives!", "CCK") === "9LI", "team code keeps digits, drops punctuation");
ok(teamCode("A!", "CCK") === "YOU", "team code <2 chars → YOU");
ok(teamCode("Colaba Crew", "COL") === "YOU", "team code equal to rival code → YOU");
ok(teamCode("cck", "CCK") === "YOU", "team code equality is case-insensitive");

// ---- 3a: Quick Play configs ----
for (const d of ["ROOKIE", "CLUB", "PRO"] as const) {
  const dbl = quickPlaySetup(d, false, "anli", 7).config;
  ok(dbl.format === "doubles" && dbl.court === "bandra_garden" && dbl.matchType === "quick", `${d} doubles: format/court/type`);
  ok(dbl.far.players.every((p) => p.profileId === d) && dbl.far.players.map((p) => p.personality).join() === "AGGRESSIVE,TACTICAL", `${d} doubles: both opponents at ${d}, AGGRESSIVE/TACTICAL`);
  ok(dbl.near.players[1].profileId === PARTNER_DIFFICULTY && dbl.near.players[1].personality === "DEFENSIVE" && dbl.near.players[1].chemistry === undefined, `${d} doubles: Anli at Club, DEFENSIVE, engine chemistry untouched`);
  ok(dbl.ruleModifiers === undefined, `${d} doubles: one game to 11 (default rules)`);
  const sgl = quickPlaySetup(d, true, "anli", 7).config;
  ok(sgl.format === "singles" && sgl.near.players.length === 1 && sgl.far.players[0].profileId === d && sgl.court === "bandra_garden", `${d} 1v1: existing singles config at ${d}`);
}
ok(quickPlaySetup("CLUB", false, "upsi", 1).config.near.players[1].personality === "KITCHEN", "active partner Upsi plays KITCHEN");

// ---- 3b: Career table, rewards, inbox, team, training ----
ok(CAREER_MATCH_IDS.join() === "mumbai.community.01,mumbai.community.02,mumbai.community.03,mumbai.local.04,mumbai.local.05,mumbai.local.06,mumbai.district.07,mumbai.district.08,mumbai.district.09,mumbai.district.10", "10 Career IDs per the brief");
ok(CAREER_MATCHES.length === 10 && CAREER_MATCHES.every((m, i) => m.id === CAREER_MATCH_IDS[i] && m.number === i + 1), "career table aligned to IDs");
ok(CAREER_MATCHES.filter((m) => m.enabled).map((m) => m.number).join() === "1,2,3,4,5", "matches 1–5 enabled, 6–10 disabled");
ok(CAREER_MATCHES.filter((m) => m.round === "FINAL").map((m) => m.number).join() === "3,6,10" && careerMatch("mumbai.district.09").round === "SEMIFINAL", "★ finals on 3, 6, 10; 9 semifinal");
ok(CAREER_MATCHES.filter((m) => m.namedRival).map((m) => m.code).join() === "CCK,WSF,GWC", "named rivals CCK / WSF / GWC");
const m2 = careerMatch("mumbai.community.02");
ok(m2.recruit?.partnerId === "upsi" && m2.personalities[m2.recruit.slot] === "KITCHEN", "Match 2 KITCHEN slot = Upsi");
const m5 = careerMatch("mumbai.local.05");
ok(m5.recruit?.partnerId === "matz" && m5.personalities[m5.recruit.slot] === "AGGRESSIVE", "Match 5 AGGRESSIVE slot = Matz");
ok(PARTNERS.upsi.reserveName === "Kiran" && PARTNERS.matz.reserveName === "Vikram", "reserve names Kiran / Vikram");
ok(CAREER_MATCHES.slice(0, 3).every((m) => m.court === "bandra_garden") && CAREER_MATCHES.slice(3, 6).every((m) => m.court === "mumbai_local") && CAREER_MATCHES.slice(6).every((m) => m.court === null), "courts per match");
const r3 = careerRewardPreview(careerMatch("mumbai.community.03"));
ok(r3.coins === 275 && r3.fans === 45, `Match 3 preview computes 275 Coins / 45 Fans (got ${r3.coins}/${r3.fans})`);
ok(r3.coins === CAREER_REWARDS.win.coins + CAREER_REWARDS.namedRival.coins + CAREER_REWARDS.milestones[0].coins && r3.coinParts.join("+") === "Win+Rival+Milestone I" && r3.fanParts.join("+") === "Win+Rival", "Match 3 preview built from components");
const r1 = careerRewardPreview(careerMatch("mumbai.community.01"));
ok(r1.coins === CAREER_REWARDS.win.coins && r1.fans === CAREER_REWARDS.win.fans, "Match 1 preview = win components only");

const cs = careerSetup(careerMatch("mumbai.community.02"), "anli", 3).config;
ok(cs.matchType === "career" && cs.court === "bandra_garden" && cs.far.players.map((p) => p.profileId).join() === "ROOKIE,ROOKIE" && cs.far.players.map((p) => p.personality).join() === "KITCHEN,TACTICAL" && cs.far.players[0].name === "Upsi" && cs.ruleModifiers === undefined, "career setup: per-slot AI, recruit name, to 11");
const c4 = careerSetup(careerMatch("mumbai.local.04"), "anli", 3).config;
ok(c4.court === "mumbai_local" && c4.far.players.map((p) => p.profileId).join() === "CLUB,CLUB", "career 4: Mumbai Local court, CLUB + CLUB (Session D 7.8)");
for (const mode of ["training", "scrimmage"] as const) {
  const t = trainingSetup(mode, "upsi", 3).config;
  ok(t.ruleModifiers?.pointsToWin === 7 && t.ruleModifiers?.winBy === 2 && t.court === "bandra_garden" && t.near.players[1].personality === "KITCHEN" && t.near.players[1].profileId === PARTNER_DIFFICULTY, `${mode}: first to 7 win by 2 with the training partner`);
}

const base = freshSave(0, () => 0.5);
ok(inboxMessages(base).map((m) => m.id).join() === "inbox.welcome" && hasUnread(base), "fresh save: Welcome message + dot (Session D 7.9)");
const s2 = { ...base, career: { ...base.career, cleared: ["mumbai.community.01", "mumbai.community.02"] } };
ok(inboxMessages(s2).map((m) => m.id).join() === "inbox.welcome,inbox.met_upsi" && hasUnread(s2), "after Match 2: Welcome + Met Upsi + dot");
const s5 = { ...base, career: { ...base.career, cleared: CAREER_MATCH_IDS.slice(0, 5) as unknown as string[] }, inboxRead: ["inbox.welcome", "inbox.met_upsi", "inbox.upsi_signable", "inbox.new_court_local", "inbox.matz_watching"] };
ok(inboxMessages(s5).length === 6 && hasUnread(s5) && inboxMessages(s5).every((m) => m.cta.label && m.cta.path), "after Match 5: six messages each with a CTA, Match 6 unread");
ok(!hasUnread({ ...s5, inboxRead: [...s5.inboxRead, "inbox.local_final_soon"] }), "all read → no dot");

ok(discoveredPartners(base).join() === "anli" && rosterStatus(base, "anli").kind === "active", "fresh roster: Anli only, ACTIVE");
const team = (coins: number, upsi: object) => ({ ...base, coins, partners: { ...base.partners, upsi: { discovered: true, signable: false, signed: false, growth: 0, ...upsi } } });
ok(JSON.stringify(rosterStatus(team(300, {}), "upsi")) === JSON.stringify({ kind: "locked", text: "UNLOCKS AFTER COMMUNITY CUP FINAL" }), "Upsi discovered not signable → locked");
ok(JSON.stringify(rosterStatus(team(800, { signable: true }), "upsi")) === JSON.stringify({ kind: "sign", cost: 750 }), "Upsi signable + 800 coins → SIGN 750");
ok(JSON.stringify(rosterStatus(team(300, { signable: true }), "upsi")) === JSON.stringify({ kind: "need", more: 450 }), "Upsi signable + 300 coins → NEED 450 MORE");
ok(rosterStatus(team(300, { signable: true, signed: true }), "upsi").kind === "set_active", "signed, not active → SET ACTIVE");
ok(JSON.stringify(rosterStatus({ ...base, partners: { ...base.partners, matz: { discovered: true, signable: true, signed: false, growth: 0 } } }, "matz")) === JSON.stringify({ kind: "locked", text: "COMING SOON" }), "Matz → COMING SOON in 1A");

{
  const mem = new Map<string, string>();
  const store = new MetaStore({ getItem: async (k) => mem.get(k) ?? null, setItem: async (k, v) => void mem.set(k, v) }, () => 0.5);
  (async () => {
    await store.load(0);
    (store.doc as any).partners.upsi = { discovered: true, signable: true, signed: true, growth: 0 };
    ok(store.setTrainingPartner("upsi") && store.doc.trainingPartnerId === "upsi" && store.doc.activePartnerId === "anli", "training partner changes without touching the active partner");
    ok(!store.setTrainingPartner("matz"), "unsigned partner cannot be the training partner");
    ok(store.markInboxRead(["inbox.met_upsi"]) && !store.markInboxRead(["inbox.met_upsi"]) && store.doc.inboxRead.join() === "inbox.met_upsi", "inbox read ids stored once");
    await store.flush();
    ok(JSON.parse(mem.get("pb.meta")!).trainingPartnerId === "upsi", "training partner persisted");
    report();
  })();
}

export function report() {
  console.log(`=== PHASE 1B RESULT: ${pass} passed, ${fail} failed ===`);
  if (fail) process.exitCode = 1;
}
