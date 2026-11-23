// "IT'S TO 15 · WIN BY 2" pill (display only): in a first-to-15 match, the first
// time either score reaches 11, between points, until the next serve is struck
// or 3 s (sim time) pass. Once per match.
export interface To15Sim {
  pointsToWin: number;
  winBy: number;
  phase: string;
  time: number;
  score: { nearScore: number; farScore: number };
}

export const TO15_SECONDS = 3;

export class To15Pill {
  private at = -1;
  private done = false;
  // Call once per frame; returns the pill text or null.
  update(sim: To15Sim): string | null {
    if (sim.pointsToWin !== 15 || this.done) return null;
    if (this.at < 0) {
      if (sim.phase !== "waiting_serve" || Math.max(sim.score.nearScore, sim.score.farScore) < 11) return null;
      this.at = sim.time;
    }
    if (sim.phase !== "waiting_serve" || sim.time - this.at >= TO15_SECONDS) {
      this.done = true;
      return null;
    }
    return `IT'S TO 15 · WIN BY ${sim.winBy}`;
  }
}
