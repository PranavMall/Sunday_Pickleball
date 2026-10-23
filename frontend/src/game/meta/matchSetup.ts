// MATCH SETUP: turns a UI launch request (route params) into a MatchConfig.
// Lives outside src/game/sim; the engine only ever sees the plain config.
// Partners always play at PARTNER_DIFFICULTY (Club) with their own
// personality; engine chemistry stays 1.0 (never set here).
import { PARTNER_DIFFICULTY } from "../config/ai";
import { buildMatchConfig, devSinglesConfig, type MatchConfig } from "../config/matchConfig";
import type { Difficulty } from "../sim/types";
import { PARTNERS, QUICK_PLAY_COURT, STARTER_PARTNER_ID, type CourtId, type PartnerId } from "./economyConfig";

export type MatchMode = "quick" | "career" | "training" | "scrimmage";

export interface LaunchParams {
  mode?: string;
  difficulty?: string;
  singles?: string;
  careerId?: string;
  court?: string; // dev-only override
}

export interface MatchSetup {
  mode: MatchMode;
  config: MatchConfig;
  rivalCode: string; // scoreboard code of the far team
  rivalName: string;
  label: string; // analytics / share label
}

const DIFFS: Difficulty[] = ["ROOKIE", "CLUB", "PRO"];

export function partnerOf(id: string | undefined) {
  return PARTNERS[(id as PartnerId) in PARTNERS ? (id as PartnerId) : STARTER_PARTNER_ID];
}

export function quickPlaySetup(difficulty: Difficulty, singles: boolean, partnerId: string, seed: number, court: CourtId = QUICK_PLAY_COURT): MatchSetup {
  const partner = partnerOf(partnerId);
  const config = singles
    ? { ...devSinglesConfig(difficulty, seed), matchType: "quick" as const, court }
    : buildMatchConfig({
        seed,
        format: "doubles",
        matchType: "quick",
        court,
        near: {
          controllers: ["LOCAL_HUMAN", "AI"],
          difficulties: [undefined, PARTNER_DIFFICULTY],
          personalities: [undefined, partner.personality],
          names: ["You", partner.name],
        },
        far: {
          controllers: ["AI", "AI"],
          difficulties: [difficulty, difficulty],
          personalities: ["AGGRESSIVE", "TACTICAL"],
          names: ["Rival", "Rival"],
        },
      });
  return { mode: "quick", config, rivalCode: "RIV", rivalName: "Rivals", label: difficulty };
}

export function parseDifficulty(d: string | undefined): Difficulty {
  return DIFFS.includes(d as Difficulty) ? (d as Difficulty) : "CLUB";
}

// Route params → setup. activePartnerId comes from the save (read once at match build).
export function buildSetup(p: LaunchParams, seed: number, save: { activePartnerId: string; trainingPartnerId: string } | null): MatchSetup {
  const devCourt = __DEV__ && p.court === "mumbai_local" ? ("mumbai_local" as CourtId) : undefined;
  return quickPlaySetup(parseDifficulty(p.difficulty), p.singles === "1", save?.activePartnerId ?? STARTER_PARTNER_ID, seed, devCourt);
}
