// ECONOMY CONFIG (Phase 1A). Every number, name and ID the meta layer uses
// lives here. IDs are STABLE STRINGS (never array positions). Session A holds
// currencies, start values and the 10 Career match IDs; Sessions B/C extend it.

export const SCHEMA_VERSION = 1;
export const META_STORAGE_KEY = "pb.meta"; // one JSON document

export type Currency = "coins" | "gems" | "fans" | "growth" | "chemistry";
export const WALLET_CURRENCIES = ["coins", "gems", "fans"] as const;

export const HOME_CITY = "mumbai";
export const FIRST_SESSION_START = "not_started";
export const FORM_START = "normal";

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

// Quick Play pays Coins only (wired in Session C).
export const QUICK_PLAY_REWARDS = { winCoins: 40, lossCoins: 20 } as const;

// Chemistry: 0–100, stored in HALF points (0.5 steps), displayed rounded down.
// Meta-only: it never reaches MatchConfig (engine chemistry stays 1.0).
export const CHEMISTRY_MAX = 100;

// Career (Mumbai). Assumption: 01–05 Community, 06–10 District.
export const CAREER_MATCH_IDS = [
  "mumbai.community.01",
  "mumbai.community.02",
  "mumbai.community.03",
  "mumbai.community.04",
  "mumbai.community.05",
  "mumbai.district.06",
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

// Ledger history kept in the save (idempotency uses the full rewardId set).
export const LEDGER_KEEP = 200;
