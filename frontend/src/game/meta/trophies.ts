// TROPHIES (display): which Mumbai stages are won + the share text.
import { CAREER_MATCHES, STAGE_NAMES } from "./economyConfig";
import type { SaveDoc } from "./metaStore";

export const STAGE_ORDER = ["community", "local", "tour", "district"] as const;
export const finalOf = (stageKey: string) => CAREER_MATCHES.find((m) => m.stageKey === stageKey && m.round === "FINAL")!;

// Won = a trophy record, or (old saves) the stage final already cleared.
export function trophiesWon(d: Pick<SaveDoc, "career">): string[] {
  return STAGE_ORDER.filter((k) => !!d.career.trophies?.[k] || d.career.cleared.includes(finalOf(k).id));
}

export function shareText(won: string[]): string {
  if (!won.length) return "Starting my Mumbai journey in Pickle-Ballers 🥒";
  const next = STAGE_ORDER.find((k) => !won.includes(k));
  return `🏆 ${won.length} of 4 Mumbai trophies in Pickle-Ballers: ${won.map((k) => STAGE_NAMES[k]).join(", ")}.${next ? ` Next: the ${STAGE_NAMES[next]}!` : ""}`;
}
