/* Phase 1A Session B headless checks (UI data, configs; no React).
 * Run: npx tsx src/game/__tests__/phase1b.ts
 */
import { PARTNER_DIFFICULTY } from "../config/ai";
import { PLAYER_NAME_POOL, TEAM_NAME_POOL, teamCode } from "../services/profile";
import { quickPlaySetup, careerSetup, showNewCourt, showTalk, talkRival, trainingSetup, tutorialSetup } from "../meta/matchSetup";
import { GameSimulation } from "../sim/GameSimulation";
import { TROPHY_SHORT } from "../meta/trophies";
import { homeCareerView, trainingTileText } from "../meta/home";
declare const __dirname: string;
import { CAREER_MATCH_IDS, CAREER_MATCHES, CAREER_REWARDS, MATCH_TALK, PARTNERS, careerMatch, careerRewardPreview } from "../meta/economyConfig";
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
declare const require: any;
declare const process: any;

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
ok(CAREER_MATCH_IDS.join() === "mumbai.community.01,mumbai.community.02,mumbai.community.03,mumbai.local.04,mumbai.local.05,mumbai.local.06,mumbai.tour.07,mumbai.tour.08,mumbai.tour.09,mumbai.district.10,mumbai.district.11,mumbai.district.12", "12 Career IDs per the brief");
ok(CAREER_MATCHES.length === 12 && CAREER_MATCHES.every((m, i) => m.id === CAREER_MATCH_IDS[i] && m.number === i + 1 && m.stageKey === m.id.split(".")[1]), "career table aligned to IDs");
ok(CAREER_MATCHES.every((m) => m.enabled), "all 12 matches enabled");
ok(CAREER_MATCHES.filter((m) => m.round === "FINAL").map((m) => m.number).join() === "3,6,9,12" && CAREER_MATCHES.filter((m) => m.round === "SEMIFINAL").map((m) => m.number).join() === "11", "★ finals on 3, 6, 9, 12; 11 semifinal");
ok(CAREER_MATCHES.filter((m) => m.namedRival).map((m) => m.code).join() === "COL,WOR,SAT,GAT", "named rivals COL / WOR / SAT / GAT");
ok(CAREER_REWARDS.milestones.map((ms) => `${ms.at}:${ms.coins}`).join() === "3:75,6:150,9:250,12:400" && CAREER_REWARDS.milestones[3].label === "Milestone IV", "milestones at 3 / 6 / 9 / 12");
const m2 = careerMatch("mumbai.community.02");
ok(m2.recruit?.partnerId === "upsi" && m2.personalities[m2.recruit.slot] === "KITCHEN", "Match 2 KITCHEN slot = Upsi");
const m5 = careerMatch("mumbai.local.05");
ok(m5.recruit?.partnerId === "matz" && m5.personalities[m5.recruit.slot] === "AGGRESSIVE", "Match 5 AGGRESSIVE slot = Matz");
ok(PARTNERS.upsi.reserveName === "Kiran" && PARTNERS.matz.reserveName === "Vikram", "reserve names Kiran / Vikram");
ok(CAREER_MATCHES.slice(0, 3).every((m) => m.court === "bandra_garden") && CAREER_MATCHES.slice(3, 6).every((m) => m.court === "mumbai_local") && CAREER_MATCHES.slice(6).map((m) => m.court).join() === "nashik,nashik,mahabaleshwar,mahabaleshwar,pune,maharashtra_night", "courts per match");
const r3 = careerRewardPreview(careerMatch("mumbai.community.03"));
ok(r3.coins === 275 && r3.fans === 45, `Match 3 preview computes 275 Coins / 45 Fans (got ${r3.coins}/${r3.fans})`);
ok(r3.coins === CAREER_REWARDS.win.coins + CAREER_REWARDS.namedRival.coins + CAREER_REWARDS.milestones[0].coins && r3.coinParts.join("+") === "Win+Rival+Milestone I" && r3.fanParts.join("+") === "Win+Rival", "Match 3 preview built from components");
const r1 = careerRewardPreview(careerMatch("mumbai.community.01"));
ok(r1.coins === CAREER_REWARDS.win.coins && r1.fans === CAREER_REWARDS.win.fans, "Match 1 preview = win components only");

const cs = careerSetup(careerMatch("mumbai.community.02"), "anli", 3).config;
ok(cs.matchType === "career" && cs.court === "bandra_garden" && cs.far.players.map((p) => p.profileId).join() === "ROOKIE,ROOKIE" && cs.far.players.map((p) => p.personality).join() === "KITCHEN,TACTICAL" && cs.far.players[0].name === "Upsi" && cs.ruleModifiers?.pointsToWin === 7, "career setup: per-slot AI, recruit name, Match 2 twist first to 7");
const c4 = careerSetup(careerMatch("mumbai.local.04"), "anli", 3).config;
ok(c4.court === "mumbai_local" && c4.far.players.map((p) => p.profileId).join() === "ROOKIE,PRO" && c4.far.players.map((p) => p.personality).join() === "KITCHEN,DEFENSIVE", "career 4: Mumbai Local court, ROOKIE + PRO, KITCHEN / DEFENSIVE (Release 10)");
for (const mode of ["training", "scrimmage"] as const) {
  const t = trainingSetup(mode, "upsi", 3).config;
  ok(t.ruleModifiers?.pointsToWin === 7 && t.ruleModifiers?.winBy === 2 && t.court === "bandra_garden" && t.near.players[1].personality === "KITCHEN" && t.near.players[1].profileId === PARTNER_DIFFICULTY, `${mode}: first to 7 win by 2 with the training partner`);
}

const base = freshSave(0, () => 0.5);
ok(inboxMessages(base).map((m) => m.id).join() === "inbox.welcome" && hasUnread(base), "fresh save: Welcome message + dot (Session D 7.9)");
const s2 = { ...base, career: { ...base.career, cleared: ["mumbai.community.01", "mumbai.community.02"] } };
ok(inboxMessages(s2).map((m) => m.id).join() === "inbox.met_upsi" && hasUnread(s2), "after Match 2: Met Upsi + dot (Welcome done after Match 1)");
const s5 = { ...base, career: { ...base.career, cleared: CAREER_MATCH_IDS.slice(0, 5) as unknown as string[] }, inboxRead: ["inbox.welcome", "inbox.met_upsi", "inbox.upsi_signable", "inbox.new_court_local", "inbox.matz_watching"] };
ok(inboxMessages(s5).map((m) => m.id).join() === "inbox.met_upsi,inbox.upsi_signable,inbox.matz_watching,inbox.local_final_soon" && hasUnread(s5) && inboxMessages(s5).every((m) => m.cta.label && m.cta.path), "after Match 5 (Upsi / Matz flags unset): four not-done messages each with a CTA, Match 6 unread");
ok(!hasUnread({ ...s5, inboxRead: [...s5.inboxRead, "inbox.local_final_soon"] }), "all read → no dot");

ok(discoveredPartners(base).join() === "anli" && rosterStatus(base, "anli").kind === "active", "fresh roster: Anli only, ACTIVE");
const team = (coins: number, upsi: object) => ({ ...base, coins, partners: { ...base.partners, upsi: { discovered: true, signable: false, signed: false, growth: 0, ...upsi } } });
ok(JSON.stringify(rosterStatus(team(300, {}), "upsi")) === JSON.stringify({ kind: "locked", text: "UNLOCKS AFTER COMMUNITY CUP FINAL" }), "Upsi discovered not signable → locked");
ok(JSON.stringify(rosterStatus(team(800, { signable: true }), "upsi")) === JSON.stringify({ kind: "sign", cost: 750 }), "Upsi signable + 800 coins → SIGN 750");
ok(JSON.stringify(rosterStatus(team(300, { signable: true }), "upsi")) === JSON.stringify({ kind: "need", more: 450 }), "Upsi signable + 300 coins → NEED 450 MORE");
ok(rosterStatus(team(300, { signable: true, signed: true }), "upsi").kind === "set_active", "signed, not active → SET ACTIVE");
const matz = (coins: number, st: object) => ({ ...base, coins, partners: { ...base.partners, matz: { discovered: true, signable: false, signed: false, growth: 0, ...st } } });
ok(JSON.stringify(rosterStatus(matz(300, {}), "matz")) === JSON.stringify({ kind: "locked", text: "UNLOCKS AFTER MUMBAI LOCAL SERIES FINAL" }), "Matz discovered not signable → UNLOCKS AFTER MUMBAI LOCAL SERIES FINAL");
ok(JSON.stringify(rosterStatus(matz(1200, { signable: true }), "matz")) === JSON.stringify({ kind: "sign", cost: 1000 }), "Matz signable + 1200 coins → SIGN 1000");

// ---- Release 10.1: twists, match talk, faces ----
{
  const TABLE: Record<number, { s?: object; r?: object }> = {
    2: { r: { pointsToWin: 7, winBy: 2 } },
    5: { s: { near: 3, far: 0, servingTeam: "far", serverNumber: 1 } },
    8: { s: { near: 3, far: 4, servingTeam: "far", serverNumber: 1 } },
    10: { s: { near: 8, far: 8, servingTeam: "near", serverNumber: 1 } },
    12: { r: { pointsToWin: 15, winBy: 2 } },
  };
  for (const m of CAREER_MATCHES) {
    const c = careerSetup(m, "anli", 1).config;
    const t = TABLE[m.number];
    if (t) ok(JSON.stringify(c.startingScore) === JSON.stringify(t.s) && JSON.stringify(c.ruleModifiers) === JSON.stringify(t.r) && !!m.twist?.name && !!m.twist.line, `Match ${m.number}: twist config matches the table`);
    else ok(c.startingScore === undefined && c.ruleModifiers === undefined && !m.twist, `Match ${m.number}: no twist → no startingScore / ruleModifiers`);
  }
  ok(CAREER_MATCHES.filter((m) => m.twist).map((m) => m.twist!.name).join() === "Quick fire,Head start,Comeback,Clutch,Long final", "twist names");
  ok(quickPlaySetup("CLUB", false, "anli", 1).config.startingScore === undefined && trainingSetup("training", "anli", 1).config.startingScore === undefined, "Quick Play / Training have no twist");
  ok(CAREER_MATCHES.every((m) => { const l = MATCH_TALK[m.number]; return !!l && l.length >= 4 && l.length <= 6 && l.every((x) => ["R", "P", "Y"].includes(x.speaker) && x.text.length > 0); }), "every Career match has 4–6 MATCH_TALK lines with speaker R / P / Y");
  ok(MATCH_TALK[5][0].text === "Sorry, sorry! Western Express traffic. A wedding procession had right of way." && MATCH_TALK[12].length === 5, "talk text as written");
  const fs = require("fs");
  const path = require("path");
  const root = path.join(process.cwd());
  const spr = fs.readFileSync(path.join(root, "src/game/render/sprites.ts"), "utf8");
  const looks = new Set<string>();
  for (const m of CAREER_MATCHES) for (const sg of [() => false, () => true]) { const r = talkRival(m, sg); if (r.look) looks.add(r.look); for (const l of careerSetup(m, "anli", 1, sg).rivalLooks) if (!/_(upsi|matz)_front$/.test(l)) looks.add(l); }
  const missing = [...looks].filter((l) => { const k = l.replace(/^rival_/, "face_"); return !spr.includes(`  ${k}: require("@/assets/images/${k}.png")`) || !fs.existsSync(path.join(root, `assets/images/${k}.png`)); });
  ok(looks.size === 24 && missing.length === 0, `every look used by Career has a face_ asset (${looks.size} looks; missing ${missing.join(",") || "none"})`);
  ok(talkRival(careerMatch("mumbai.local.05"), () => false).partnerId === "matz" && talkRival(careerMatch("mumbai.local.05"), () => true).look === "rival_man1_juh", "Match 5 talk: Matz portrait unless signed (then the reserve's face)");
  ok(showTalk({ cleared: [], talkSeen: [] }, "mumbai.local.05") && !showTalk({ cleared: ["mumbai.local.05"], talkSeen: [] }, "mumbai.local.05") && !showTalk({ cleared: [], talkSeen: ["mumbai.local.05"] }, "mumbai.local.05"), "talk shows on first play only (skipped on a replay / once seen)");
}

{
  // ---- Release 10.2 Part C: TUTOR smoke test (scripted human at the net, swipes on every chance) ----
  let hits = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const sim = new GameSimulation(tutorialSetup("anli", seed).config);
    let smashed = false, ticks = 0;
    while (!smashed && sim.stats.pointsPlayed < 15 && ticks < 60 * 60 * 30) {
      if (sim.kitchenMode !== "hold" && sim.kitchenCooldownLeft() === 0) sim.toggleKitchenMode();
      if (sim.humanIsServer() && !sim.hasBufferedSwipe()) sim.submitSwipe({ dx: 0, dy: -140, power: 0.6, tap: false });
      if (sim.humanCanHit() && !sim.hasBufferedSwipe()) {
        if (sim.humanSmashWindow()) sim.submitSwipe({ dx: 20, dy: -150, power: 0.7, tap: false, speed: 1600 });
        else sim.submitSwipe({ dx: 10, dy: -60, power: 0.3, tap: false, speed: 500 });
      }
      sim.step();
      ticks++;
      for (const ev of sim.consumeContactEvents()) if (ev.slot === 0 && ev.shotType === "smash" && !ev.isServe) smashed = true;
      sim.consumeBounceEvents();
    }
    if (smashed) hits++;
  }
  console.log(`  TUTOR smoke: human smash within 15 points in ${hits}/40`);
  ok(hits >= 36, `TUTOR: human smash within 15 points in ≥ 36 of 40 (got ${hits})`);
}

{
  // ---- Release 10.2 Part B ----
  const fs3 = require("fs");
  const path3 = require("path");
  const barSrc = fs3.readFileSync(path3.join(__dirname, "../../../src/ui/DestinationBar.tsx"), "utf8");
  const items = barSrc.slice(barSrc.indexOf("const ITEMS"), barSrc.indexOf("];", barSrc.indexOf("const ITEMS")));
  const labels = [...items.matchAll(/label: "(\w+)"/g)].map((m: any) => m[1]);
  ok(labels.join() === "Team,Passport,Home,Locker,Records" && labels[2] === "Home" && !labels.includes("Training") && !labels.includes("Career"), "DestinationBar: Team · Passport · Home · Locker · Records, Home in the middle");
  const cv = (n: number) => homeCareerView({ career: { cleared: CAREER_MATCH_IDS.slice(0, n) as any, nextMatchId: CAREER_MATCH_IDS[Math.min(n, 11)], firstClearWins: n, firstClearLosses: 0, trophies: {}, talkSeen: [] } });
  ok(cv(0).button === "START CAREER", "Home card: START CAREER with nothing cleared");
  ok(cv(8).button === "PLAY MATCH 9" && cv(8).title === "Match 9 · Final", "Home card: PLAY MATCH 9 with Matches 1–8 cleared");
  ok(cv(12).allCleared && cv(12).title === "Maharashtra champions!" && cv(12).button === "REPLAY A MATCH", "Home card: all 12 cleared → Maharashtra champions! + REPLAY A MATCH");
  ok(trainingTileText(0) === "2 left" && trainingTileText(2) === "Done today", "Training tile: 2 left / Done today");
}

{
  // ---- Release 10.2 Part A ----
  const SHORTS: Record<number, string> = { 2: "First to 7", 5: "You lead 3–0", 8: "You trail 3–4", 10: "From 8–8", 12: "First to 15" };
  const tw = CAREER_MATCHES.filter((m) => m.twist);
  ok(tw.length === 5 && tw.every((m) => m.twist!.short === SHORTS[m.number] && m.twist!.short.split(" ").length <= 4), "every twist has a short (≤ 4 words) matching the table");
  const m9 = CAREER_MATCHES[8];
  ok(!showNewCourt([], m9, true), "NEW: false on a replay");
  ok(!showNewCourt([CAREER_MATCH_IDS[9]], m9, false), "NEW: false when a cleared match used the court");
  ok(showNewCourt(CAREER_MATCH_IDS.slice(0, 8) as any, m9, false), "NEW: true for Match 9 with Matches 1–8 cleared");
  ok(Object.keys(TROPHY_SHORT).length === 4 && Object.values(TROPHY_SHORT).every((n) => n.split(" ").length <= 2), "TROPHY_SHORT: 4 entries, ≤ 2 words");
  const fs2 = require("fs");
  const path2 = require("path");
  const root2 = path2.join(__dirname, "../../..");
  const courtsSrc = fs2.readFileSync(path2.join(root2, "src/game/render/courts.ts"), "utf8");
  const thumbSrc = fs2.readFileSync(path2.join(root2, "src/ui/CourtThumb.tsx"), "utf8");
  const pick = (src: string, key: string) => (src.slice(src.indexOf(`${key}:`)).match(/require\("([^"]+)"\)/) ?? [])[1];
  ok(pick(courtsSrc, "mahabaleshwar") === "@/assets/images/court_strawberry.webp" && pick(thumbSrc, "mahabaleshwar") === "@/assets/images/court_strawberry.webp", "COURT_VISUALS / COURT_IMG mahabaleshwar → court_strawberry.webp");
  const old = "court_" + "mahabaleshwar.webp";
  const walk = (dir: string): string[] => fs2.readdirSync(dir, { withFileTypes: true }).flatMap((e: any) => (e.isDirectory() ? walk(path2.join(dir, e.name)) : /\.(ts|tsx|js|json)$/.test(e.name) ? [path2.join(dir, e.name)] : []));
  const files = [...walk(path2.join(root2, "src")), ...walk(path2.join(root2, "app")), path2.join(root2, "app.json")];
  ok(files.every((f) => !fs2.readFileSync(f, "utf8").includes(old)) && !fs2.existsSync(path2.join(root2, "assets/images", old)), "no file references the old Mahabaleshwar court image");
}

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

// Release 11 Part A: identity + circuit names.
{
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const root = path.resolve(__dirname, "../../..");
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e: any) => (e.isDirectory() ? (e.name === "__tests__" ? [] : walk(path.join(d, e.name))) : /\.(tsx?|json)$/.test(e.name) ? [path.join(d, e.name)] : []));
  const files = [...walk(path.join(root, "src")), ...walk(path.join(root, "app"))];
  const banned = ["Mumbai Journey", "Mumbai champions", "Mumbai trophies", "SOUTH CUP"];
  const hits = files.filter((f) => banned.some((b) => fs.readFileSync(f, "utf8").includes(b)));
  ok(hits.length === 0, "R11: no user-facing Mumbai Journey / champions / trophies / SOUTH CUP strings");
  const cab = fs.readFileSync(path.join(root, "src/ui/CabinetBody.tsx"), "utf8");
  ok(cab.includes("CIRCUIT_NAME.toUpperCase()") && cab.includes("NEXT_CIRCUIT_NAME.toUpperCase()") && cab.includes("of 4 won") && cab.includes("Coming soon"), "R11: CabinetBody shows the circuit names");
  const econ = require("../meta/economyConfig");
  ok(econ.CIRCUIT_NAME === "Maharashtra Circuit" && econ.NEXT_CIRCUIT_NAME === "South Circuit", "R11: circuit name constants");
  const app = JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8")).expo;
  const splash = app.plugins.find((p: unknown) => Array.isArray(p) && p[0] === "expo-splash-screen")[1];
  ok(app.ios.bundleIdentifier === "com.pickleballers.game" && app.android.package === "com.pickleballers.game", "R11: com.pickleballers.game on both platforms");
  ok(app.owner === "pranavmall15" && app.extra.eas.projectId === "663164d9-df03-4a00-af86-0cf062f1b4ac" && app.slug === "pickle-ballers" && app.scheme === "pickleballers", "R11: owner, project ID, slug, scheme");
  ok(app.android.adaptiveIcon.backgroundColor === "#2150AC" && splash.backgroundColor === "#2150AC" && splash.image === "./assets/images/splash-icon.png", "R11: #2150AC adaptive + splash");
  ok(!app.updates && !app.runtimeVersion && app.userInterfaceStyle === "light" && app.ios.supportsTablet === false, "R11: no OTA, light, no tablet");
  const scan = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e: any) => (["node_modules", ".git", ".expo", "__tests__", "test_reports"].includes(e.name) ? [] : e.isDirectory() ? scan(path.join(d, e.name)) : /\.(tsx?|jsx?|json|plist|md)$/.test(e.name) ? [path.join(d, e.name)] : []));
  const emergent = scan(root).filter((f) => fs.readFileSync(f, "utf8").includes("com" + ".emergent"));
  ok(emergent.length === 0, "R11: no file contains com.emergent " + emergent.join());
  ok(!fs.existsSync(path.resolve(root, "../backend")), "R11: backend/ is gone");
}

// Release 11 Part B: events + build config.
{
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const root = path.resolve(__dirname, "../../..");
  const { analytics } = require("../services/analytics");
  const { gameEvents } = require("../meta/events");
  const { tutorialEvents } = require("../meta/tutorial");
  const got: { n: string; p: Record<string, unknown> }[] = [];
  analytics.setForwarder({ logEvent: (n: string, p: Record<string, unknown>) => void got.push({ n, p }), setEnabled: () => {}, setUserProperty: () => {}, logScreenView: () => {} });
  gameEvents.matchStart({ mode: "career", careerId: "mumbai.local.04", court: "mumbai_local", twist: null, partner: "anli" });
  gameEvents.matchEnd({ mode: "quick", won: true, quit: false, near: 11, far: 4, seconds: 93.4, smashes: 2, smashTaps: 1 });
  gameEvents.careerCleared("mumbai.community.02", 3);
  gameEvents.perfSample({ frames: 600, slowFrames: 12, dtSum: 10 });
  gameEvents.share("cabinet");
  gameEvents.dailyView("Clutch");
  gameEvents.dailyStart("Clutch");
  gameEvents.dailyWin("Clutch", 2, true);
  gameEvents.privacyOpen();
  gameEvents.contactOpen();
  gameEvents.feedbackOpen();
  analytics.setEnabled(false);
  analytics.setEnabled(true);
  tutorialEvents.started("settings", true);
  const want: Record<string, Record<string, unknown>> = {
    match_start: { mode: "career", career_n: 4, court: "mumbai_local", twist: "none", partner: "anli" },
    match_end: { mode: "quick", career_n: 0, won: 1, quit: 0, near: 11, far: 4, seconds: 93, smashes: 2, smash_taps: 1 },
    career_cleared: { career_n: 2, tries: 3 },
    perf_sample: { fps_avg: 60, slow_pct: 2, frames: 600 },
    share: { from: "cabinet" },
    daily_view: { twist: "Clutch" },
    daily_start: { twist: "Clutch" },
    daily_win: { twist: "Clutch", tries: 2, first_today: 1 },
    privacy_open: {},
    contact_open: {},
    feedback_open: {},
    tutorial_started: { from: "settings", replay: 1 },
  };
  for (const [n, p] of Object.entries(want)) {
    const e = got.find((x) => x.n === n);
    ok(!!e && JSON.stringify(e.p) === JSON.stringify(p), `R11 event ${n} params ${JSON.stringify(e?.p)}`);
  }
  const ud = got.filter((x) => x.n === "usage_data").map((x) => x.p.on);
  ok(ud.join() === "0,1", "R11 event usage_data { on } on toggle");
  analytics.setForwarder(null);
  const eas = JSON.parse(fs.readFileSync(path.join(root, "eas.json"), "utf8"));
  ok(["development", "preview", "production"].every((k) => eas.build[k]) && eas.build.development.developmentClient && eas.build.preview.android.buildType === "apk" && eas.build.production.autoIncrement && eas.cli.appVersionSource === "remote", "R11: eas.json has the three profiles");
  ok(eas.build.development.env.EXPO_PUBLIC_BUILD_TYPE === "internal" && eas.build.preview.env.EXPO_PUBLIC_BUILD_TYPE === "internal" && eas.build.production.env.EXPO_PUBLIC_BUILD_TYPE === "store", "R11: build_type per profile");
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const rnfb = Object.entries(pkg.dependencies).filter(([k]) => k.startsWith("@react-native-firebase/"));
  ok(rnfb.length === 3 && new Set(rnfb.map(([, v]) => v)).size === 1 && /^\d+\.\d+\.\d+$/.test(String(rnfb[0][1])) && String(rnfb[0][1]).startsWith("27."), "R11: @react-native-firebase/* on one exact v27 version");
  ok(!!pkg.dependencies["expo-dev-client"] && !!pkg.dependencies["react-native-purchases"] && pkg.dependencies.expo.startsWith("57."), "R11: dev client + RevenueCat, still SDK 57");
}

// Release 11 Part C: rally pressure (Matches 10–12) + "It's to 15" pill.
{
  const { HUMAN_PRESSURE_MATCHES } = require("../meta/economyConfig");
  const { To15Pill } = require("../meta/to15");
  function play(sim: GameSimulation, style: string, n: number) {
    if (sim.humanSmashWindow()) return sim.submitSwipe({ dx: 20, dy: -150, power: 0.7, tap: false, speed: 1600 });
    const k = n % 5;
    if (style === "drive") return k === 4 ? sim.submitSwipe({ dx: 10, dy: -60, power: 0.3, tap: false, speed: 500 }) : sim.submitSwipe({ dx: k % 2 ? 40 : -40, dy: -160, power: 0.75, tap: false, speed: 1500 });
    if (k === 0) sim.submitSwipe({ dx: 30, dy: -50, power: 0.22, tap: false, speed: 450 });
    else if (k === 1) sim.submitSwipe({ dx: -40, dy: -90, power: 0.4, tap: false, speed: 1400 });
    else if (k === 2) sim.submitSwipe({ dx: 10, dy: -160, power: 0.7, tap: false, speed: 800 });
    else if (k === 3) { if (!sim.lobArmed) sim.toggleLob(); sim.submitSwipe({ dx: 0, dy: -150, power: 0.65, tap: false, speed: 700 }); }
    else sim.submitSwipe({ dx: -20, dy: -60, power: 0.3, tap: false, speed: 500 });
  }
  const LIMIT: Record<number, number> = { 10: 0.65, 11: 0.7, 12: 0.62 };
  for (const num of [10, 11, 12]) {
    const m = CAREER_MATCHES.find((x) => x.number === num)!;
    const rates: string[] = [];
    let okAll = true;
    for (const style of ["drive", "mix"]) {
      let wins = 0;
      for (let i = 0; i < 40; i++) {
        const cfg = careerSetup(m, "anli", 7000 + i, () => false, 1.4).config;
        cfg.near.players[1] = { ...cfg.near.players[1], profileId: "CLUB", personality: "KITCHEN", chemistry: 1.4 };
        const sim = new GameSimulation(cfg);
        let n = 0;
        for (let t = 0; t < 60 * 60 * 60 && sim.phase !== "game_over"; t++) {
          if (sim.humanIsServer() && !sim.hasBufferedSwipe()) sim.submitSwipe({ dx: 0, dy: -140, power: 0.6, tap: false });
          else if (sim.humanCanHit() && !sim.hasBufferedSwipe()) play(sim, style, n++);
          sim.step();
          sim.consumeContactEvents();
          sim.consumeBounceEvents();
        }
        if (sim.winner === "near") wins++;
      }
      rates.push(`${style} ${Math.round((wins / 40) * 100)}%`);
      if (wins / 40 > LIMIT[num]) okAll = false;
    }
    console.log(`  R11 rally pressure Match ${num}: human wins ${rates.join(" · ")}`);
    ok(okAll, `R11: Match ${num} human win rate ≤ ${LIMIT[num] * 100}% with rally pressure (${rates.join(", ")})`);
  }
  ok(CAREER_MATCHES.every((m) => !!careerSetup(m, "anli", 1).config.humanRallyPressure === HUMAN_PRESSURE_MATCHES.includes(m.id)) && HUMAN_PRESSURE_MATCHES.length === 3, "R11: humanRallyPressure only in Matches 10–12");
  ok(!quickPlaySetup("PRO", false, "anli", 1).config.humanRallyPressure && !quickPlaySetup("PRO", true, "anli", 1).config.humanRallyPressure && !trainingSetup("training", "anli", 1).config.humanRallyPressure && !trainingSetup("scrimmage", "anli", 1).config.humanRallyPressure && !tutorialSetup("anli", 1).config.humanRallyPressure, "R11: no rally pressure in Quick Play, Training, Tutorial");
  const run = (ptw: number) => {
    const pill = new To15Pill();
    const sim = { pointsToWin: ptw, winBy: 2, phase: "waiting_serve", time: 0, score: { nearScore: 10, farScore: 9 } };
    const seen: string[] = [];
    const tick = (secs: number) => { for (let k = 0; k < secs * 60; k++) { sim.time += 1 / 60; const x = pill.update(sim); if (x && seen[seen.length - 1] !== `${sim.score.nearScore}-${sim.score.farScore}`) seen.push(`${sim.score.nearScore}-${sim.score.farScore}`); } };
    tick(1); sim.phase = "rally"; tick(1);
    sim.score.nearScore = 11; sim.phase = "waiting_serve"; tick(1);
    const text = pill.update(sim);
    sim.phase = "rally"; tick(1);
    sim.score.farScore = 11; sim.phase = "waiting_serve"; tick(1);
    sim.score.nearScore = 12; tick(2);
    return { seen, text };
  };
  const r15 = run(15), r11 = run(11);
  ok(r15.seen.join() === "11-9" && r15.text === "IT'S TO 15 · WIN BY 2", `R11: "It's to 15" pill once at 11–x in a first-to-15 match (${r15.seen.join()})`);
  ok(r11.seen.length === 0 && r11.text === null, "R11: no pill in a first-to-11 match");
}

// Release 11 Part D: week strip states for a fixture week.
{
  const { weekStrip, timeLeftText } = require("../meta/daily");
  const now = new Date(2026, 10, 20, 17, 48).getTime(); // Friday 20 Nov
  const w = weekStrip(now, ["2026-11-16", "2026-11-17", "2026-11-19"]);
  ok(w.map((x: any) => `${x.label}:${x.state}`).join() === "MON:won,TUE:won,WED:missed,THU:won,FRI:today,SAT:future,SUN:future" && w[4].date === 20, "R11: week strip won / missed / today / future");
  ok(weekStrip(now, ["2026-11-20"])[4].state === "won", "R11: today won → ✓");
  ok(timeLeftText(now) === "6h 12m left", "R11: time left until local midnight");
}

export function report() {
  console.log(`=== PHASE 1B RESULT: ${pass} passed, ${fail} failed ===`);
  if (fail) process.exitCode = 1;
}
