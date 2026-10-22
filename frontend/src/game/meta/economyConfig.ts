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
export const STARTER_PARTNER_ID = "anli";
export const PARTNER_IDS = [STARTER_PARTNER_ID] as const;

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

// Ledger history kept in the save (idempotency uses the full rewardId set).
export const LEDGER_KEEP = 200;
