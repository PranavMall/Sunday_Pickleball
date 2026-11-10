// MATCH SETUP: turns a UI launch request (route params) into a MatchConfig.
// Lives outside src/game/sim; the engine only ever sees the plain config.
// Partners always play at PARTNER_DIFFICULTY (Club) with their own
// personality; the AI partner's (slot 1) engine chemistry = partnerBoost(level,
// chemistry) — exactly 1.0 (unset) at Lv 1 with Chemistry < 25. The human and
// rivals always stay 1.0.
import { PARTNER_DIFFICULTY } from "../config/ai";
import { buildMatchConfig, devSinglesConfig, type MatchConfig } from "../config/matchConfig";
import type { Difficulty } from "../sim/types";
import { levelView } from "./levels";
import { CAREER_MATCHES, careerMatch, partnerBoost, PARTNERS, QUICK_PLAY_COURT, SHORT_FORMAT, STARTER_PARTNER_ID, TRAINING_MODES, type CareerMatchDef, type CourtId, type MatchTwist, type PartnerId } from "./economyConfig";

export type MatchMode = "quick" | "career" | "training" | "scrimmage" | "tutorial";

export interface LaunchParams {
  mode?: string;
  difficulty?: string;
  singles?: string;
  careerId?: string;
  court?: string; // dev-only override
  from?: string; // tutorial entry (welcome | match1 | home | settings)
}

export interface MatchSetup {
  mode: MatchMode;
  config: MatchConfig;
  rivalCode: string; // scoreboard code of the far team
  rivalName: string;
  label: string; // analytics / share label
  partnerId: string; // the near-side partner (rewards go to them)
  careerId?: string;
  rivalLooks: string[]; // RIVAL_SHEETS key per far player ("" → placeholder)
  twist?: MatchTwist;
}

// Looks only (names, codes, difficulties unchanged): a Career match's pair,
// with the recruit's slot switching to reserveLook once that partner is signed.
function careerLooks(m: CareerMatchDef, signed: (id: string) => boolean): string[] {
  if (!m.looks) return ["", ""];
  return m.looks.map((l, i) => (m.recruit?.slot === i && m.reserveLook && signed(m.recruit.partnerId) ? m.reserveLook : l));
}
// Quick Play: Career match ((seed mod 12) + 1), the recruit slot always on its
// reserveLook (Upsi / Matz never appear as Quick Play rivals); singles uses
// that team's slot-1 look.
export function quickPlayLooks(seed: number, singles: boolean): string[] {
  const n = CAREER_MATCHES.length;
  const looks = careerLooks(CAREER_MATCHES[((seed % n) + n) % n], () => true);
  return singles ? [looks[1]] : looks;
}

const DIFFS: Difficulty[] = ["ROOKIE", "CLUB", "PRO"];

export function partnerOf(id: string | undefined) {
  return PARTNERS[(id as PartnerId) in PARTNERS ? (id as PartnerId) : STARTER_PARTNER_ID];
}

export function quickPlaySetup(difficulty: Difficulty, singles: boolean, partnerId: string, seed: number, court: CourtId = QUICK_PLAY_COURT, boost = 1): MatchSetup {
  const partner = partnerOf(partnerId);
  const config = singles
    ? { ...devSinglesConfig(difficulty, seed), matchType: "quick" as const, court }
    : buildMatchConfig({
        seed,
        format: "doubles",
        matchType: "quick",
        court,
        near: nearTeam(partner.id, boost),
        far: {
          controllers: ["AI", "AI"],
          difficulties: [difficulty, difficulty],
          personalities: ["AGGRESSIVE", "TACTICAL"],
          names: ["Rival", "Rival"],
        },
      });
  return { mode: "quick", config, rivalCode: "RIV", rivalName: "Rivals", label: difficulty, partnerId: partner.id, rivalLooks: quickPlayLooks(seed, singles) };
}

export function parseDifficulty(d: string | undefined): Difficulty {
  return DIFFS.includes(d as Difficulty) ? (d as Difficulty) : "CLUB";
}

// Route params → setup. Partners come from the save (read once at match build).
type SetupSave = { activePartnerId: string; trainingPartnerId: string; quickPartnerId?: string; partners?: Record<string, { signed: boolean; growth?: number }>; chemistryHalves?: Record<string, number>; career?: { nextMatchId: string } };
// The partner's engine boost from the save (Level from Growth, Chemistry rounded down).
export function boostFor(save: SetupSave | null, partnerId: string): number {
  if (!save?.career) return 1;
  const level = levelView(save.partners?.[partnerId]?.growth ?? 0, save.career.nextMatchId).level;
  const chem = Math.floor((save.chemistryHalves?.[`player+${partnerId}`] ?? 0) / 2);
  return partnerBoost(level, chem);
}
export function buildSetup(p: LaunchParams, seed: number, save: SetupSave | null): MatchSetup {
  if (p.mode === "career") {
    const id = save?.activePartnerId ?? STARTER_PARTNER_ID;
    return careerSetup(careerMatch(p.careerId), id, seed, (x) => !!save?.partners?.[x]?.signed, boostFor(save, id));
  }
  if (p.mode === "tutorial") return tutorialSetup(save?.activePartnerId ?? STARTER_PARTNER_ID, seed);
  if (p.mode === "training" || p.mode === "scrimmage") {
    const id = save?.trainingPartnerId ?? STARTER_PARTNER_ID;
    return trainingSetup(p.mode, id, seed, boostFor(save, id));
  }
  const devCourt = __DEV__ && p.court === "mumbai_local" ? ("mumbai_local" as CourtId) : undefined;
  // Quick Play partner: its own saved choice, defaulting to the Career partner.
  const qp = save?.quickPartnerId && save.partners?.[save.quickPartnerId]?.signed ? save.quickPartnerId : save?.activePartnerId;
  const qid = qp ?? STARTER_PARTNER_ID;
  return quickPlaySetup(parseDifficulty(p.difficulty), p.singles === "1", qid, seed, devCourt, boostFor(save, partnerOf(qid).id));
}

export function nearTeam(partnerId: string, boost = 1) {
  const partner = partnerOf(partnerId);
  return {
    controllers: ["LOCAL_HUMAN", "AI"] as ("LOCAL_HUMAN" | "AI")[],
    difficulties: [undefined, PARTNER_DIFFICULTY],
    personalities: [undefined, partner.personality],
    names: ["You", partner.name],
    ...(boost !== 1 ? { chemistry: [undefined, boost] } : {}),
  };
}

// Career: per-slot difficulty + existing personalities; the recruit's slot is
// named after the recruit — unless that recruit is already signed (active or
// benched), when the reserve plays the slot (same difficulty / personality),
// so a signed partner never appears on both teams. One game to 11, win by 2.
export function careerSetup(m: CareerMatchDef, partnerId: string, seed: number, signed: (id: string) => boolean = () => false, boost = 1): MatchSetup {
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
    near: nearTeam(partnerId, boost),
    far: { controllers: ["AI", "AI"], difficulties: [...m.ai], personalities: [...m.personalities], names },
    ...(m.twist?.startingScore ? { startingScore: { ...m.twist.startingScore } } : {}),
    ...(m.twist?.ruleModifiers ? { ruleModifiers: { ...m.twist.ruleModifiers } } : {}),
  });
  return { mode: "career", config, rivalCode: m.code, rivalName: m.rival, label: m.id, partnerId: partnerOf(partnerId).id, careerId: m.id, rivalLooks: careerLooks(m, signed), twist: m.twist };
}

// Match talk: first play only (never on a replay of a cleared match, never once seen).
export function showTalk(career: { cleared: string[]; talkSeen?: string[] }, careerMatchId: string): boolean {
  return !career.cleared.includes(careerMatchId) && !(career.talkSeen ?? []).includes(careerMatchId);
}

// NEW court tag: not on a replay, and no cleared Career match uses that court.
export function showNewCourt(cleared: string[], m: CareerMatchDef, replay: boolean): boolean {
  return !!m.court && !replay && !cleared.some((id) => careerMatch(id).court === m.court);
}


// The rival speaker of the talk: the unsigned recruit (portrait) or the slot-0 rival's look.
export function talkRival(m: CareerMatchDef, signed: (id: string) => boolean): { partnerId?: PartnerId; look?: string } {
  if (m.recruit && !signed(m.recruit.partnerId)) return { partnerId: m.recruit.partnerId };
  return { look: careerLooks(m, signed)[0] };
}

// Training / Scrimmage: training partner vs drill / sparring pair, first to 7 win by 2.
export function trainingSetup(mode: "training" | "scrimmage", partnerId: string, seed: number, boost = 1): MatchSetup {
  const t = TRAINING_MODES[mode];
  const config = buildMatchConfig({
    seed,
    format: "doubles",
    matchType: mode,
    court: QUICK_PLAY_COURT,
    near: nearTeam(partnerId, boost),
    far: { controllers: ["AI", "AI"], difficulties: [...t.ai], personalities: [...t.personalities], names: ["Drill", "Drill"] },
    ruleModifiers: { ...SHORT_FORMAT },
  });
  return { mode, config, rivalCode: t.code, rivalName: mode === "training" ? "Drill pair" : "Sparring pair", label: mode, partnerId: partnerOf(partnerId).id, rivalLooks: [...CAREER_MATCHES[mode === "training" ? 0 : 3].looks!] };
}

// Tutorial: you + the active Career partner (boost 1) vs two ROOKIE TUTORs at
// Bandra Garden; the score never ends it (the tutorial does).
export function tutorialSetup(partnerId: string, seed: number): MatchSetup {
  const config = buildMatchConfig({
    seed,
    format: "doubles",
    matchType: "tutorial",
    court: "bandra_garden",
    near: nearTeam(partnerId, 1),
    far: { controllers: ["AI", "AI"], difficulties: ["ROOKIE", "ROOKIE"], personalities: ["TUTOR", "TUTOR"], names: ["Tutor", "Tutor"] },
    ruleModifiers: { pointsToWin: 99, winBy: 1 },
  });
  return { mode: "tutorial", config, rivalCode: "DRL", rivalName: "Practice pair", label: "tutorial", partnerId: partnerOf(partnerId).id, rivalLooks: [...CAREER_MATCHES[0].looks!] };
}
