// ECONOMY CONFIG (Phase 1A). Every number, name and ID the meta layer uses
// lives here. IDs are STABLE STRINGS (never array positions). Session A holds
// currencies, start values and the 12 Career match IDs; Sessions B/C extend it.

export const SCHEMA_VERSION = 1;
export const META_STORAGE_KEY = "pb.meta"; // one JSON document

export type Currency = "coins" | "gems" | "fans" | "growth" | "chemistry";
export const WALLET_CURRENCIES = ["coins", "gems", "fans"] as const;

export const HOME_CITY = "mumbai";
export const FIRST_SESSION_START = "not_started";
export const FORM_START = "normal"; // Form dropped from 1A: stored, never read

export const START_VALUES = {
  coins: 300,
  gems: 0,
  fans: 0,
} as const;

// Partners. Anli is the starter partner (signed, active, training partner).
// Every partner plays at the existing partner difficulty (Club, PARTNER_DIFFICULTY);
// "Rookie" is a tier LABEL only. Personality = their engine personality.
export const STARTER_PARTNER_ID = "anli";
export const PARTNER_IDS = [STARTER_PARTNER_ID, "upsi", "matz"] as const;
export type PartnerId = (typeof PARTNER_IDS)[number];
export interface PartnerDef {
  id: PartnerId;
  name: string;
  archetype: string;
  personality: "DEFENSIVE" | "KITCHEN" | "AGGRESSIVE";
  color: string; // monogram badge
  tier: string; // label only
  reserveName?: string; // name used if the recruit's slot must be filled by someone else
}
export const PARTNERS: Record<PartnerId, PartnerDef> = {
  anli: { id: "anli", name: "Anli", archetype: "Defender", personality: "DEFENSIVE", color: "#2E7D4F", tier: "Rookie" },
  upsi: { id: "upsi", name: "Upsi", archetype: "Dinker", personality: "KITCHEN", color: "#2F6FB8", tier: "Rookie", reserveName: "Kiran" },
  matz: { id: "matz", name: "Matz", archetype: "Banger", personality: "AGGRESSIVE", color: "#C77D2E", tier: "Rookie", reserveName: "Vikram" },
};
export const PLAYER_BADGE_COLOR = "#C9483B";

// Courts (config.court ids → display names).
export type CourtId = "bandra_garden" | "mumbai_local" | "nashik" | "mahabaleshwar" | "pune" | "maharashtra_night";
export const COURT_NAMES: Record<CourtId, string> = {
  bandra_garden: "Bandra Garden",
  mumbai_local: "Mumbai Local",
  nashik: "Nashik Vineyard Court",
  mahabaleshwar: "Mahabaleshwar Strawberry Court",
  pune: "Pune Fort Court",
  maharashtra_night: "Marine Drive Night Court",
};
export const QUICK_PLAY_COURT: CourtId = "bandra_garden";

// Quick Play pays Coins only (doubles and 1v1, every level), for the first
// dailyCap matches of each local day; after that it is free play (no Coins).
export const QUICK_PLAY_REWARDS = { winCoins: 40, lossCoins: 20, dailyCap: 7 } as const;

// Chemistry: 0–100, stored in HALF points (0.5 steps), displayed rounded down.
// Every 25 is a heart (hearts are never lost).
export const CHEMISTRY_MAX = 100;
export const HEART_STEP = 25;
export const heartsOf = (chemistry: number) => Math.min(4, Math.floor(chemistry / HEART_STEP));
// The AI partner's (slot 1) engine chemistry: Lv 1 + Chemistry 0–24 = 1.0 exactly.
export function partnerBoost(level: number, chemistryValue: number): number {
  return 1 + 0.06 * (level - 1) + 0.04 * Math.floor(chemistryValue / 25);
}

// Career (Mumbai): 12 stable IDs (Community 01–03 · Local 04–06 · Tour 07–09 · District 10–12).
export const CAREER_MATCH_IDS = [
  "mumbai.community.01",
  "mumbai.community.02",
  "mumbai.community.03",
  "mumbai.local.04",
  "mumbai.local.05",
  "mumbai.local.06",
  "mumbai.tour.07",
  "mumbai.tour.08",
  "mumbai.tour.09",
  "mumbai.district.10",
  "mumbai.district.11",
  "mumbai.district.12",
] as const;
export const FIRST_CAREER_MATCH_ID = CAREER_MATCH_IDS[0];

// Stage display names, keyed by the middle segment of a Career ID.
export const STAGE_NAMES: Record<string, string> = {
  community: "Community Cup",
  local: "Mumbai Local Series",
  tour: "Maharashtra Tour",
  district: "Maharashtra Championship",
};
export function stageNameOf(careerMatchId: string): string {
  return STAGE_NAMES[careerMatchId.split(".")[1]] ?? STAGE_NAMES.community;
}
export const CAREER_CITY_LABEL = "Mumbai Gully";

type AiDiff = "ROOKIE" | "CLUB" | "PRO";
type AiPers = "DEFENSIVE" | "AGGRESSIVE" | "KITCHEN" | "TACTICAL";
export interface CareerMatchDef {
  id: (typeof CAREER_MATCH_IDS)[number];
  number: number; // 1..12
  stageKey: "community" | "local" | "tour" | "district";
  round: "" | "FINAL" | "SEMIFINAL";
  rival: string;
  code: string; // scoreboard code
  color: string; // rival badge colour
  namedRival: boolean;
  ai: [AiDiff, AiDiff]; // per-slot difficulty (existing levels only)
  personalities: [AiPers, AiPers];
  court: CourtId | null; // null = no court yet
  enabled: boolean;
  recruit?: { slot: 0 | 1; partnerId: PartnerId }; // that AI slot IS the recruit
  looks: [string, string] | null; // RIVAL_SHEETS keys (far slot 0, slot 1); null → placeholder
  reserveLook?: string; // the recruit slot's look once that partner is signed (with reserveName)
  twist?: MatchTwist; // told before the match (chip, talk, cue pill); replays keep it
}
// Match twists: only existing config fields (startingScore / ruleModifiers).
export interface MatchTwist {
  name: string;
  line: string;
  short: string; // one short line under the court on the Next Match card
  startingScore?: { near: number; far: number; servingTeam: "near" | "far"; serverNumber?: 1 | 2 };
  ruleModifiers?: { pointsToWin?: number; winBy?: number };
}
export const CAREER_TWISTS: Partial<Record<number, MatchTwist>> = {
  2: { name: "Quick fire", line: "First to 7", short: "First to 7", ruleModifiers: { pointsToWin: 7, winBy: 2 } },
  5: { name: "Head start", line: "The rivals are late: you lead 3–0", short: "You lead 3–0", startingScore: { near: 3, far: 0, servingTeam: "far", serverNumber: 1 } },
  8: { name: "Comeback", line: "Rain stopped play at 3–4: you're behind", short: "You trail 3–4", startingScore: { near: 3, far: 4, servingTeam: "far", serverNumber: 1 } },
  10: { name: "Clutch", line: "The lights failed at 8–8: finish it", short: "From 8–8", startingScore: { near: 8, far: 8, servingTeam: "near", serverNumber: 1 } },
  12: { name: "Long final", line: "First to 15", short: "First to 15", ruleModifiers: { pointsToWin: 15, winBy: 2 } },
};
const M = (
  n: number, round: CareerMatchDef["round"], rival: string, code: string, color: string, namedRival: boolean,
  ai: [AiDiff, AiDiff], personalities: [AiPers, AiPers], court: CourtId | null, looks: CareerMatchDef["looks"],
  recruit?: CareerMatchDef["recruit"], reserveLook?: string,
): CareerMatchDef => {
  const id = CAREER_MATCH_IDS[n - 1];
  return { id, number: n, stageKey: id.split(".")[1] as CareerMatchDef["stageKey"], round, rival, code, color, namedRival, ai, personalities, court, enabled: true, recruit, looks, reserveLook, twist: CAREER_TWISTS[n] };
};
export const CAREER_MATCHES: CareerMatchDef[] = [
  M(1, "", "Bandra Bashers", "BAN", "#3E7CB1", false, ["ROOKIE", "ROOKIE"], ["DEFENSIVE", "TACTICAL"], "bandra_garden", ["rival_man1_ban", "rival_woman1_ban"]),
  M(2, "", "Dadar Dinkers", "DAD", "#8E5BA8", false, ["ROOKIE", "ROOKIE"], ["KITCHEN", "TACTICAL"], "bandra_garden", ["rival_upsi_front", "rival_man2_dad"], { slot: 0, partnerId: "upsi" }, "rival_woman1_dad"),
  M(3, "FINAL", "Colaba Kings", "COL", "#2F5DA8", true, ["ROOKIE", "CLUB"], ["AGGRESSIVE", "KITCHEN"], "bandra_garden", ["rival_man1_col", "rival_man2_col"]),
  M(4, "", "Andheri Locals", "AND", "#C77D2E", false, ["ROOKIE", "PRO"], ["KITCHEN", "DEFENSIVE"], "mumbai_local", ["rival_woman1_and", "rival_woman2_and"]),
  M(5, "", "Juhu Bouncers", "JUH", "#2A9D8F", false, ["ROOKIE", "PRO"], ["AGGRESSIVE", "TACTICAL"], "mumbai_local", ["rival_matz_front", "rival_woman2_juh"], { slot: 0, partnerId: "matz" }, "rival_man1_juh"),
  M(6, "FINAL", "Worli Strikers", "WOR", "#B23A48", true, ["CLUB", "CLUB"], ["AGGRESSIVE", "AGGRESSIVE"], "mumbai_local", ["rival_man2_wor", "rival_woman1_wor"]),
  M(7, "", "Nashik Vines", "NAS", "#7B2D5B", false, ["CLUB", "CLUB"], ["DEFENSIVE", "KITCHEN"], "nashik", ["rival_man1_nas", "rival_woman2_nas"]),
  M(8, "", "Trimbak Tigers", "TRI", "#D9822B", false, ["CLUB", "CLUB"], ["KITCHEN", "KITCHEN"], "nashik", ["rival_man2_tri", "rival_woman1_tri"]),
  M(9, "FINAL", "Satara Winds", "SAT", "#5B8C3A", true, ["CLUB", "CLUB"], ["AGGRESSIVE", "KITCHEN"], "mahabaleshwar", ["rival_man1_sat", "rival_man2_sat"]),
  M(10, "", "Panchgani Peaks", "PAN", "#4A6FA5", false, ["CLUB", "PRO"], ["DEFENSIVE", "KITCHEN"], "mahabaleshwar", ["rival_woman1_pan", "rival_woman2_pan"]),
  M(11, "SEMIFINAL", "Pune Pacers", "PUN", "#6C7A89", false, ["CLUB", "PRO"], ["AGGRESSIVE", "TACTICAL"], "pune", ["rival_man1_pun", "rival_woman1_pun"]),
  // Slot 0 is a stand-in: a later release makes it QT.
  M(12, "FINAL", "Gateway Champs", "GAT", "#B08D2F", true, ["PRO", "PRO"], ["AGGRESSIVE", "TACTICAL"], "maharashtra_night", ["rival_woman2_gat", "rival_man2_gat"]),
];
export function careerMatch(id: string | undefined): CareerMatchDef {
  return CAREER_MATCHES.find((m) => m.id === id) ?? CAREER_MATCHES[0];
}

// Career reward COMPONENTS (previews always sum these; never typed totals).
// First clear pays win/loss + the active partner's Growth/Chemistry; a named
// rival's first defeat and each milestone (by first-clear WIN count) pay once.
// Replays of a cleared match pay replay Coins only (+ normal partner progress).
export const CAREER_REWARDS = {
  win: { coins: 100, fans: 20 },
  loss: { coins: 35, fans: 0 },
  namedRival: { coins: 100, fans: 25 },
  replay: { winCoins: 40, lossCoins: 14 },
  milestones: [
    { id: "milestone.1", label: "Milestone I", at: 3, coins: 75 },
    { id: "milestone.2", label: "Milestone II", at: 6, coins: 150 },
    { id: "milestone.3", label: "Milestone III", at: 9, coins: 250 },
    { id: "milestone.4", label: "Milestone IV", at: 12, coins: 400 },
  ],
};
// Career is linear, so match N is always the N-th first-clear win.
export function milestoneFor(firstClearWins: number) {
  return CAREER_REWARDS.milestones.find((ms) => ms.at === firstClearWins);
}
// Discovery flags set by a first-clear WIN of a match number.
export const CAREER_UNLOCKS: Record<number, { partnerId: PartnerId; flag: "discovered" | "signable"; event: string }> = {
  2: { partnerId: "upsi", flag: "discovered", event: "You met Upsi" },
  3: { partnerId: "upsi", flag: "signable", event: "Upsi can now be signed" },
  5: { partnerId: "matz", flag: "discovered", event: "Matz is watching you" },
  6: { partnerId: "matz", flag: "signable", event: "Matz can now be signed" },
};
export function careerRewardPreview(m: CareerMatchDef, replay = false): { coins: number; fans: number; coinParts: string[]; fanParts: string[] } {
  if (replay) return { coins: CAREER_REWARDS.replay.winCoins, fans: 0, coinParts: ["Replay win"], fanParts: ["Replay"] };
  const coinParts = ["Win"];
  const fanParts = ["Win"];
  let coins = CAREER_REWARDS.win.coins;
  let fans = CAREER_REWARDS.win.fans;
  if (m.namedRival) {
    coins += CAREER_REWARDS.namedRival.coins;
    fans += CAREER_REWARDS.namedRival.fans;
    coinParts.push("Rival");
    fanParts.push("Rival");
  }
  const ms = milestoneFor(m.number);
  if (ms) {
    coins += ms.coins;
    coinParts.push(ms.label);
  }
  return { coins, fans, coinParts, fanParts };
}

// Partner progress per completed match (win / loss), by mode. A loss pays about
// a quarter of the win's Growth and the minimum Chemistry.
export const PARTNER_REWARDS = {
  career: { win: { growth: 12, chemistry: 2 }, loss: { growth: 3, chemistry: 0.5 } },
  training: { win: { growth: 15, chemistry: 2 }, loss: { growth: 4, chemistry: 0.5 } },
  scrimmage: { win: { growth: 10, chemistry: 1 }, loss: { growth: 2, chemistry: 0.5 } },
} as const;

// Growth is a running total: Level = 1 + floor(total / 100). The furthest
// unlocked Career stage caps it (Growth above the cap is not stored).
export const GROWTH_PER_LEVEL = 100;
export const GROWTH_CAP_BY_STAGE: Record<string, number> = { community: 300, local: 500, tour: 700, district: 1000 };

// Chemistry 0–100. Gains are halved (0.5 steps, min 0.5) once the pairing is at 50+.
export const CHEMISTRY_HALVE_AT = 50;
// Fade: every FADE_EVERY matches played with someone else → −1, never below the
// highest multiple of FADE_FLOOR_STEP ever reached; below the peak gains double.
export const CHEMISTRY_FADE_EVERY = 3;
export const CHEMISTRY_FLOOR_STEP = 25;

// Partner signing (spend wired in Session C).
export const SIGN_COST: Partial<Record<PartnerId, number>> = { upsi: 750, matz: 1000 };

// Training (progression wired in Session C). First to 7, win by 2.
export const TRAINING_MODES = {
  training: { dailyCap: 2, vs: "drill pair", code: "DRL", ai: ["ROOKIE", "ROOKIE"] as [AiDiff, AiDiff], personalities: ["DEFENSIVE", "KITCHEN"] as [AiPers, AiPers] },
  scrimmage: { dailyCap: 3, vs: "sparring pair", code: "SPR", ai: ["CLUB", "CLUB"] as [AiDiff, AiDiff], personalities: ["AGGRESSIVE", "TACTICAL"] as [AiPers, AiPers] },
} as const;
export const SHORT_FORMAT = { pointsToWin: 7, winBy: 2 } as const;

// MATCH TALK (before a Career match's first play). R = rival speaker, P = your
// partner, Y = you. Text exactly as written in the brief.
export type TalkSpeaker = "R" | "P" | "Y";
const T = (...l: [TalkSpeaker, string][]) => l.map(([speaker, text]) => ({ speaker, text }));
export const MATCH_TALK: Record<number, { speaker: TalkSpeaker; text: string }[]> = {
  1: T(["R", "Fresh faces at Bandra Garden. Do you even know what a kitchen is?"], ["Y", "Room with snacks. Also a zone I'm not allowed to volley from."], ["P", "Relax. We read the rulebook. You should try the chapter on losing."], ["R", "Big talk for a team with zero wins."], ["Y", "Zero so far. Give it eleven points."]),
  2: T(["R", "Bad news: the uncles' yoga class has this court at seven sharp."], ["Y", "So we play fast."], ["R", "First to 7. Blink and you're stretching with the uncles."], ["P", "Then don't blink. We've seen your backhand. We're not worried."], ["R", "You've seen my warm-up. Different thing."]),
  3: T(["R", "Colaba Kings. Three years, zero finals lost."], ["P", "Three years? Your streak is old enough to go to school."], ["R", "And it's not dropping out today."], ["Y", "Then today it graduates."]),
  4: T(["R", "Welcome to the Local Series. Mind the gap. Mostly the one in your backhand."], ["Y", "My backhand is a work in progress."], ["P", "So is your serve. We watched your warm-up. Twice. Out of pity."], ["R", "Fine. Let's see who's laughing at 11."]),
  5: T(["R", "Sorry, sorry! Western Express traffic. A wedding procession had right of way."], ["P", "Rules say late means 3–0. To us."], ["R", "Fine. Enjoy your three points. Frame them."], ["Y", "We were planning to."], ["R", "This is our turf. Juhu doesn't lose twice."], ["P", "Then today's your first. Congratulations in advance."]),
  6: T(["R", "Worli Strikers. We hit hard, we hit first, we hit the snacks after."], ["Y", "Can we skip to the snacks?"], ["P", "Save us a seat at the snacks. Losers buy."], ["R", "Bold of you to think you're getting either."]),
  7: T(["R", "Welcome to Nashik. Fresh air, sweet grapes, sour losers."], ["P", "Which one are we?"], ["Y", "Grapes. Definitely grapes."], ["R", "Then you know what happens to grapes here."], ["P", "They become something fancy and expensive. Thanks for the compliment."]),
  8: T(["R", "Rain stopped us yesterday at 4–3. To us, if you're keeping score."], ["Y", "We weren't."], ["P", "We are now. Enjoy the lead. It's on loan."], ["R", "Tigers don't do comebacks. We do finishes."], ["Y", "Good thing we're not tigers."]),
  9: T(["R", "Satara Winds. The mist is on our side. It told us."], ["P", "Did the mist also tell you about our kitchen game?"], ["R", "It said you'd get lost in the fog."], ["Y", "Can't lose what we can't see. Wait, that came out wrong."], ["P", "Tour final. Let's just win it."]),
  10: T(["R", "The lights failed at 8–8 last night. The electrician says sorry."], ["P", "Tell him thanks. You were about to lose in the dark."], ["R", "8–8, first to 11, win by two. No pressure."], ["Y", "Define 'no pressure'."], ["P", "That was a joke. It's all pressure. Let's go."]),
  11: T(["R", "Pune Pacers. We set the pace here. Also the parking rules."], ["Y", "We parked fine."], ["R", "Nobody parks fine in Pune."], ["P", "Then we'll be quick. Semifinal, eleven points, home before the ticket."]),
  12: T(["R", "Gateway Champs. Finals at Marine Drive go to 15. Hope you packed water."], ["Y", "Fifteen? I trained for eleven."], ["P", "Then train for four more on the job. I believe in you. Mostly."], ["R", "The whole promenade is watching. Smile for the losers' photo."], ["P", "Funny. We'll send you a copy of ours. Signed."]),
};

// Ledger history kept in the save (idempotency uses the full rewardId set).
export const LEDGER_KEEP = 200;
