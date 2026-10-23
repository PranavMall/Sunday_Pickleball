/* Phase 1A Session B headless checks (UI data, configs; no React).
 * Run: npx tsx src/game/__tests__/phase1b.ts
 */
import { PARTNER_DIFFICULTY } from "../config/ai";
import { PLAYER_NAME_POOL, TEAM_NAME_POOL, teamCode } from "../services/profile";
import { quickPlaySetup } from "../meta/matchSetup";

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

export function report() {
  console.log(`=== PHASE 1B RESULT: ${pass} passed, ${fail} failed ===`);
  if (fail) process.exitCode = 1;
}
if (require.main === module) report();
