// HOME (display): the Career card and the Training tile, derived from the save.
import { CAREER_MATCH_IDS, TRAINING_MODES, careerMatch, type CareerMatchDef } from "./economyConfig";
import type { SaveDoc } from "./metaStore";

export function homeCareerView(d: Pick<SaveDoc, "career">): { allCleared: boolean; match: CareerMatchDef; title: string; button: string } {
  const match = careerMatch(d.career.nextMatchId);
  if (CAREER_MATCH_IDS.every((id) => d.career.cleared.includes(id))) return { allCleared: true, match, title: "Mumbai champions!", button: "REPLAY A MATCH" };
  const round = match.round === "FINAL" ? " · Final" : match.round === "SEMIFINAL" ? " · Semifinal" : "";
  return { allCleared: false, match, title: `Match ${match.number}${round}`, button: d.career.cleared.length === 0 ? "START CAREER" : `PLAY MATCH ${match.number}` };
}

// Training sessions left today (the Home tile's second line).
export function trainingTileText(trainingUsedToday: number): string {
  const left = Math.max(0, TRAINING_MODES.training.dailyCap - trainingUsedToday);
  return left > 0 ? `${left} left` : "Done today";
}
