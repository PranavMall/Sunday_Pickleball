// TROPHIES (display): which Mumbai stages are won + the share text.
import { CAREER_MATCHES } from "./economyConfig";
import type { SaveDoc } from "./metaStore";

export const STAGE_ORDER = ["community", "local", "tour", "district"] as const;
export const finalOf = (stageKey: string) => CAREER_MATCHES.find((m) => m.stageKey === stageKey && m.round === "FINAL")!;
// Shelf names (max two words), won and locked alike.
export const TROPHY_SHORT: Record<string, string> = { community: "Community Cup", local: "Mumbai Local", tour: "Maharashtra Tour", district: "Championship" };
// Locked pop-up line: how to win it.
export function lockedLine(stageKey: string): string {
  const fm = finalOf(stageKey);
  if (stageKey === "district") return `Win Match ${fm.number}, the Championship final at Marine Drive.`;
  return `Win Match ${fm.number}, the ${TROPHY_SHORT[stageKey]} final.`;
}

// Won = a trophy record, or (old saves) the stage final already cleared.
export function trophiesWon(d: Pick<SaveDoc, "career">): string[] {
  return STAGE_ORDER.filter((k) => !!d.career.trophies?.[k] || d.career.cleared.includes(finalOf(k).id));
}

export function shareText(won: string[]): string {
  if (!won.length) return "Starting my Mumbai journey in Pickle-Ballers 🥒";
  if (won.length >= 4) return "🏆 All 4 Mumbai trophies. Mumbai is done. South Cup, you're next. Pickle-Ballers 🥒";
  const next = STAGE_ORDER.find((k) => !won.includes(k))!;
  return `🏆 ${won.length} of 4 Mumbai trophies in Pickle-Ballers: ${won.map((k) => TROPHY_SHORT[k]).join(", ")}. Next stop: ${TROPHY_SHORT[next]}.`;
}
