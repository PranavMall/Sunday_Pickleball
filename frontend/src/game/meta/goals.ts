// NEXT GOAL: one line for the result screen, derived from the save.
import { CAREER_MATCH_IDS, PARTNER_IDS, PARTNERS, SIGN_COST, STAGE_NAMES, careerMatch, type CareerMatchDef } from "./economyConfig";
import type { SaveDoc } from "./metaStore";

export function careerMatchLabel(m: CareerMatchDef): string {
  const stage = STAGE_NAMES[m.stageKey];
  if (m.round === "FINAL") return `${stage} Final`;
  if (m.round === "SEMIFINAL") return `${stage} Semifinal`;
  return `${stage} · Match ${m.number}`;
}

export function nextGoal(d: Pick<SaveDoc, "partners" | "coins" | "career">): string {
  // Newest signable partner first (Matz after Match 6 even if Upsi is still unsigned).
  const sign = [...PARTNER_IDS].reverse().find((id) => d.partners[id]?.signable && !d.partners[id].signed && d.coins >= (SIGN_COST[id] ?? 0));
  if (sign) return `Sign ${PARTNERS[sign].name} in Team`;
  if (CAREER_MATCH_IDS.every((id) => d.career.cleared.includes(id))) return "Mumbai Journey complete!";
  const m = careerMatch(d.career.nextMatchId);
  return m.enabled ? `Next: ${careerMatchLabel(m)}` : `Next: ${careerMatchLabel(m)} — coming soon`;
}
