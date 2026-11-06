// PARTNER LEVELS (display + cap). Growth is a running total; the furthest
// unlocked Career stage caps it.
import { GROWTH_CAP_BY_STAGE, GROWTH_PER_LEVEL, STAGE_NAMES } from "./economyConfig";

export function stageKeyOf(careerMatchId: string): string {
  return careerMatchId.split(".")[1] ?? "community";
}

export function growthCap(nextMatchId: string): number {
  return GROWTH_CAP_BY_STAGE[stageKeyOf(nextMatchId)] ?? GROWTH_CAP_BY_STAGE.community;
}

export interface LevelView {
  level: number;
  frac: number; // bar fill 0..1
  text: string; // "40 / 100"
  max?: string; // "Win the Community Cup final to keep growing" at the cap
}

export function levelView(total: number, nextMatchId: string): LevelView {
  const cap = growthCap(nextMatchId);
  const t = Math.floor(total);
  if (t >= cap) return { level: Math.max(cap / GROWTH_PER_LEVEL, 1 + Math.floor(t / GROWTH_PER_LEVEL) - 1), frac: 1, text: "100 / 100", max: capText(nextMatchId) };
  const into = t % GROWTH_PER_LEVEL;
  return { level: 1 + Math.floor(t / GROWTH_PER_LEVEL), frac: into / GROWTH_PER_LEVEL, text: `${into} / ${GROWTH_PER_LEVEL}` };
}

export function capText(nextMatchId: string): string {
  return `Win the ${STAGE_NAMES[stageKeyOf(nextMatchId)] ?? ""} final to keep growing`;
}
// The level at which this stage's cap is reached.
export function capLevel(nextMatchId: string): number {
  return growthCap(nextMatchId) / GROWTH_PER_LEVEL;
}
