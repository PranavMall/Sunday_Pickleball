// ECONOMY CONFIG (Phase 1A). Every number, name and ID the meta layer uses
// lives here. IDs are STABLE STRINGS (never array positions). Session A holds
// currencies, start values and the 10 Career match IDs; Sessions B/C extend it.

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
export type CourtId = "bandra_garden" | "mumbai_local";
export const COURT_NAMES: Record<CourtId, string> = {
  bandra_garden: "Bandra Garden",
  mumbai_local: "Mumbai Local",
};
export const QUICK_PLAY_COURT: CourtId = "bandra_garden";

// Quick Play pays Coins only (doubles and 1v1, every level).
export const QUICK_PLAY_REWARDS = { winCoins: 40, lossCoins: 20 } as const;

// Chemistry: 0–100, stored in HALF points (0.5 steps), displayed rounded down.
// Meta-only: it never reaches MatchConfig (engine chemistry stays 1.0).
export const CHEMISTRY_MAX = 100;

// Career (Mumbai): 10 stable IDs (Community 01–03 · Local 04–06 · District 07–10).
export const CAREER_MATCH_IDS = [
  "mumbai.community.01",
  "mumbai.community.02",
  "mumbai.community.03",
  "mumbai.local.04",
  "mumbai.local.05",
  "mumbai.local.06",
  "mumbai.district.07",
  "mumbai.district.08",
  "mumbai.district.09",
  "mumbai.district.10",
] as const;
export const FIRST_CAREER_MATCH_ID = CAREER_MATCH_IDS[0];

// Stage display names, keyed by the middle segment of a Career ID.
export const STAGE_NAMES: Record<string, string> = {
  community: "Community Cup",
  local: "Mumbai Local Series",
  district: "District Championship",
};
export function stageNameOf(careerMatchId: string): string {
  return STAGE_NAMES[careerMatchId.split(".")[1]] ?? STAGE_NAMES.community;
}
export const CAREER_CITY_LABEL = "Mumbai Gully";

type AiDiff = "ROOKIE" | "CLUB" | "PRO";
type AiPers = "DEFENSIVE" | "AGGRESSIVE" | "KITCHEN" | "TACTICAL";
export interface CareerMatchDef {
  id: (typeof CAREER_MATCH_IDS)[number];
  number: number; // 1..10
  stageKey: "community" | "local" | "district";
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
}
const M = (
  n: number, round: CareerMatchDef["round"], rival: string, code: string, color: string, namedRival: boolean,
  ai: [AiDiff, AiDiff], personalities: [AiPers, AiPers], court: CourtId | null, recruit?: CareerMatchDef["recruit"],
): CareerMatchDef => {
  const id = CAREER_MATCH_IDS[n - 1];
  return { id, number: n, stageKey: id.split(".")[1] as CareerMatchDef["stageKey"], round, rival, code, color, namedRival, ai, personalities, court, enabled: n <= 5, recruit };
};
export const CAREER_MATCHES: CareerMatchDef[] = [
  M(1, "", "Bandra Gully Smashers", "BGS", "#3E7CB1", false, ["ROOKIE", "ROOKIE"], ["DEFENSIVE", "TACTICAL"], "bandra_garden"),
  M(2, "", "Dadar Dinkers", "DAD", "#8E5BA8", false, ["ROOKIE", "ROOKIE"], ["KITCHEN", "TACTICAL"], "bandra_garden", { slot: 0, partnerId: "upsi" }),
  M(3, "FINAL", "Colaba Causeway Kings", "CCK", "#2F5DA8", true, ["ROOKIE", "CLUB"], ["AGGRESSIVE", "KITCHEN"], "bandra_garden"),
  M(4, "", "Andheri Local Express", "ALX", "#C77D2E", false, ["CLUB", "CLUB"], ["DEFENSIVE", "TACTICAL"], "mumbai_local"),
  M(5, "", "Juhu Beach Bouncers", "JBB", "#2A9D8F", false, ["CLUB", "CLUB"], ["AGGRESSIVE", "AGGRESSIVE"], "mumbai_local", { slot: 0, partnerId: "matz" }),
  M(6, "FINAL", "Worli Sea Face Strikers", "WSF", "#B23A48", true, ["CLUB", "CLUB"], ["AGGRESSIVE", "AGGRESSIVE"], "mumbai_local"),
  M(7, "", "Powai Lake Lobbers", "PLL", "#5B8C3A", false, ["CLUB", "CLUB"], ["AGGRESSIVE", "TACTICAL"], null),
  M(8, "", "Marine Drive Volleyers", "MDV", "#4A6FA5", false, ["CLUB", "CLUB"], ["TACTICAL", "KITCHEN"], null),
  M(9, "SEMIFINAL", "Malabar Hill Masters", "MHM", "#7A5230", false, ["CLUB", "PRO"], ["DEFENSIVE", "TACTICAL"], null),
  M(10, "FINAL", "Gateway Champions", "GWC", "#B08D2F", true, ["PRO", "PRO"], ["AGGRESSIVE", "TACTICAL"], null),
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
    { id: "milestone.3", label: "Milestone III", at: 10, coins: 250 },
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
export const GROWTH_CAP_BY_STAGE: Record<string, number> = { community: 300, local: 500, district: 500 };

// Chemistry 0–100. Gains are halved (0.5 steps, min 0.5) once the pairing is at 50+.
export const CHEMISTRY_HALVE_AT = 50;
// Fade: every FADE_EVERY matches played with someone else → −1, never below the
// highest multiple of FADE_FLOOR_STEP ever reached; below the peak gains double.
export const CHEMISTRY_FADE_EVERY = 3;
export const CHEMISTRY_FLOOR_STEP = 25;

// Partner signing (spend wired in Session C).
export const SIGN_COST: Partial<Record<PartnerId, number>> = { upsi: 750 };

// Training (progression wired in Session C). First to 7, win by 2.
export const TRAINING_MODES = {
  training: { dailyCap: 2, vs: "drill pair", code: "DRL", ai: ["ROOKIE", "ROOKIE"] as [AiDiff, AiDiff], personalities: ["DEFENSIVE", "KITCHEN"] as [AiPers, AiPers] },
  scrimmage: { dailyCap: 3, vs: "sparring pair", code: "SPR", ai: ["CLUB", "CLUB"] as [AiDiff, AiDiff], personalities: ["AGGRESSIVE", "TACTICAL"] as [AiPers, AiPers] },
} as const;
export const SHORT_FORMAT = { pointsToWin: 7, winBy: 2 } as const;

// Ledger history kept in the save (idempotency uses the full rewardId set).
export const LEDGER_KEEP = 200;
