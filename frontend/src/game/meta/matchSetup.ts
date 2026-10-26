// MATCH SETUP: turns a UI launch request (route params) into a MatchConfig.
// Lives outside src/game/sim; the engine only ever sees the plain config.
// Partners always play at PARTNER_DIFFICULTY (Club) with their own
// personality; engine chemistry stays 1.0 (never set here).
import { PARTNER_DIFFICULTY } from "../config/ai";
import { buildMatchConfig, devSinglesConfig, type MatchConfig } from "../config/matchConfig";
import type { Difficulty } from "../sim/types";
import { careerMatch, PARTNERS, QUICK_PLAY_COURT, SHORT_FORMAT, STARTER_PARTNER_ID, TRAINING_MODES, type CareerMatchDef, type CourtId, type PartnerId } from "./economyConfig";

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
  partnerId: string; // the near-side partner (rewards go to them)
  careerId?: string;
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
  return { mode: "quick", config, rivalCode: "RIV", rivalName: "Rivals", label: difficulty, partnerId: partner.id };
}

export function parseDifficulty(d: string | undefined): Difficulty {
  return DIFFS.includes(d as Difficulty) ? (d as Difficulty) : "CLUB";
}

// Route params → setup. Partners come from the save (read once at match build).
export function buildSetup(p: LaunchParams, seed: number, save: { activePartnerId: string; trainingPartnerId: string; quickPartnerId?: string; partners?: Record<string, { signed: boolean }> } | null): MatchSetup {
  if (p.mode === "career") return careerSetup(careerMatch(p.careerId), save?.activePartnerId ?? STARTER_PARTNER_ID, seed, (id) => !!save?.partners?.[id]?.signed);
  if (p.mode === "training" || p.mode === "scrimmage") return trainingSetup(p.mode, save?.trainingPartnerId ?? STARTER_PARTNER_ID, seed);
  const devCourt = __DEV__ && p.court === "mumbai_local" ? ("mumbai_local" as CourtId) : undefined;
  // Quick Play partner: its own saved choice, defaulting to the Career partner.
  const qp = save?.quickPartnerId && save.partners?.[save.quickPartnerId]?.signed ? save.quickPartnerId : save?.activePartnerId;
  return quickPlaySetup(parseDifficulty(p.difficulty), p.singles === "1", qp ?? STARTER_PARTNER_ID, seed, devCourt);
}

function nearTeam(partnerId: string) {
  const partner = partnerOf(partnerId);
  return {
    controllers: ["LOCAL_HUMAN", "AI"] as ("LOCAL_HUMAN" | "AI")[],
    difficulties: [undefined, PARTNER_DIFFICULTY],
    personalities: [undefined, partner.personality],
    names: ["You", partner.name],
  };
}

// Career: per-slot difficulty + existing personalities; the recruit's slot is
// named after the recruit — unless that recruit is already signed (active or
// benched), when the reserve plays the slot (same difficulty / personality),
// so a signed partner never appears on both teams. One game to 11, win by 2.
export function careerSetup(m: CareerMatchDef, partnerId: string, seed: number, signed: (id: string) => boolean = () => false): MatchSetup {
  const names = [0, 1].map((i) => {
    if (m.recruit?.slot !== i) return `${m.rival} ${i + 1}`;
    const r = PARTNERS[m.recruit.partnerId];
    return signed(r.id) ? r.reserveName ?? r.name : r.name;
  });
  const config = buildMatchConfig({
    seed,
    format: "doubles",
    matchType: "career",
    court: m.court ?? QUICK_PLAY_COURT,
    near: nearTeam(partnerId),
    far: { controllers: ["AI", "AI"], difficulties: [...m.ai], personalities: [...m.personalities], names },
  });
  return { mode: "career", config, rivalCode: m.code, rivalName: m.rival, label: m.id, partnerId: partnerOf(partnerId).id, careerId: m.id };
}

// Training / Scrimmage: training partner vs drill / sparring pair, first to 7 win by 2.
export function trainingSetup(mode: "training" | "scrimmage", partnerId: string, seed: number): MatchSetup {
  const t = TRAINING_MODES[mode];
  const config = buildMatchConfig({
    seed,
    format: "doubles",
    matchType: mode,
    court: QUICK_PLAY_COURT,
    near: nearTeam(partnerId),
    far: { controllers: ["AI", "AI"], difficulties: [...t.ai], personalities: [...t.personalities], names: ["Drill", "Drill"] },
    ruleModifiers: { ...SHORT_FORMAT },
  });
  return { mode, config, rivalCode: t.code, rivalName: mode === "training" ? "Drill pair" : "Sparring pair", label: mode, partnerId: partnerOf(partnerId).id };
}
