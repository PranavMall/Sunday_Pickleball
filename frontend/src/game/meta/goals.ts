// NEXT GOAL: one line for the result screen, derived from the save.
import { SIGN_COST, STAGE_NAMES, careerMatch, type CareerMatchDef } from "./economyConfig";
import type { SaveDoc } from "./metaStore";

export function careerMatchLabel(m: CareerMatchDef): string {
  const stage = STAGE_NAMES[m.stageKey];
  if (m.round === "FINAL") return `${stage} Final`;
  if (m.round === "SEMIFINAL") return `${stage} Semifinal`;
  return `${stage} · Match ${m.number}`;
}

export function nextGoal(d: Pick<SaveDoc, "partners" | "coins" | "career">): string {
  const upsi = d.partners.upsi;
  if (upsi?.signable && !upsi.signed && d.coins >= (SIGN_COST.upsi ?? 0)) return "Sign Upsi in Team";
  const m = careerMatch(d.career.nextMatchId);
  return m.enabled ? `Next: ${careerMatchLabel(m)}` : `Next: ${careerMatchLabel(m)} — coming soon`;
}
