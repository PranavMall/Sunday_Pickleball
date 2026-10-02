// FORWARD-LOOKING SERVICE INTERFACES (roadmap §11) — contracts ONLY. No SDKs,
// no backend, no implementations. They exist so the meta layer (profiles,
// ratings, analytics, ads, purchases) can be added later without touching the
// simulation, rendering or input code.

import type { MatchType } from "../config/matchConfig";

// ---------------------------------------------------------------------------
// Save model (persisted player/team state). Captures the §11 fields PLUS the
// amendments the user specified:
//   • Fans are CUMULATIVE and never decrease.
//   • "form" (hot / normal / cold) is a separate value that can rise and fall.
//   • Ratings exist per PLAYER and per PAIRING (not hard-coded to pairings).
// ---------------------------------------------------------------------------
export type Form = "hot" | "normal" | "cold";

export interface RosterMemberStats {
  power: number;
  control: number;
  spin: number;
  reach: number;
}

export interface RosterMember {
  id: string;
  name: string;
  tier: number;
  stats: RosterMemberStats;
}

export interface Ratings {
  // Skill rating keyed by player id (e.g. { you: 1400, maya: 1380 }).
  perPlayer: Record<string, number>;
  // Skill rating keyed by a pairing key (e.g. "you+maya": 1420). A stable key
  // is produced by pairingKey() so "a+b" and "b+a" collapse to one entry.
  perPairing: Record<string, number>;
}

export function pairingKey(a: string, b: string): string {
  return [a, b].sort().join("+");
}

export interface SaveModel {
  guestId: string;
  playerName: string;
  teamName: string;
  // Cumulative career progression (never decreases).
  fans: number;
  // Volatile recent-form indicator (separate from fans).
  form: Form;
  roster: RosterMember[];
  ratings: Ratings;
  // Opaque meta buckets reserved for later (not used in Part A).
  inventory: Record<string, number>;
  unlocks: string[];
  careerPosition: number;
  tourPoints: number;
}

// ---------------------------------------------------------------------------
export interface ProfileService {
  getGuestId(): Promise<string>;
  getPlayerName(): Promise<string | null>;
  setPlayerName(name: string): Promise<void>;
  getTeamName(): Promise<string | null>;
  setTeamName(name: string): Promise<void>;
  load(): Promise<SaveModel | null>;
  save(model: SaveModel): Promise<void>;
  // Accounts/cloud sign-in are OUT OF SCOPE for the current milestones.
  signIn?(provider: "apple" | "google" | "email"): Promise<void>;
}

// ---------------------------------------------------------------------------
export interface AnalyticsService {
  track(event: string, props?: Record<string, string | number | boolean | null>): void;
  setDeepTelemetry(on: boolean): void;
}

// ---------------------------------------------------------------------------
// Ads use NAMED PLACEMENTS so frequency/rules can be remote-configured later.
export type AdPlacement = "interstitial_post_match" | "rewarded_retry" | "rewarded_double_coins" | "banner_menu";

export interface AdService {
  isReady(placement: AdPlacement): boolean;
  show(placement: AdPlacement): Promise<{ shown: boolean; rewarded?: boolean }>;
}

// ---------------------------------------------------------------------------
export interface PurchaseService {
  getOwned(): string[];
  purchase(sku: string): Promise<boolean>;
  restore(): Promise<void>;
}

// A match-launch surface (any meta mode produces a config the engine runs).
export interface MatchLaunchContext {
  matchType: MatchType;
}
