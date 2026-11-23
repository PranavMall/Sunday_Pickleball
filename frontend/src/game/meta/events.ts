// GAME EVENTS (Release 11, section 11): one function per event so every event
// is sent with exactly its listed params. tutorial_* events live in tutorial.ts.
import { analytics } from "../services/analytics";
import { CAREER_MATCH_IDS } from "./economyConfig";

export type EventMode = "career" | "quick" | "training" | "tutorial" | "daily" | "scrimmage";

export const careerN = (careerId?: string) => {
  const i = careerId ? (CAREER_MATCH_IDS as readonly string[]).indexOf(careerId) : -1;
  return i >= 0 ? i + 1 : 0;
};

export const gameEvents = {
  matchStart: (p: { mode: EventMode; careerId?: string; court: string; twist?: string | null; partner: string }) =>
    analytics.track("match_start", { mode: p.mode, career_n: p.mode === "career" ? careerN(p.careerId) : 0, court: p.court, twist: p.twist || "none", partner: p.partner }),
  matchEnd: (p: { mode: EventMode; careerId?: string; won: boolean; quit: boolean; near: number; far: number; seconds: number; smashes: number; smashTaps: number }) =>
    analytics.track("match_end", {
      mode: p.mode,
      career_n: p.mode === "career" ? careerN(p.careerId) : 0,
      won: p.won ? 1 : 0,
      quit: p.quit ? 1 : 0,
      near: p.near,
      far: p.far,
      seconds: Math.round(p.seconds),
      smashes: p.smashes,
      smash_taps: p.smashTaps,
    }),
  careerCleared: (careerId: string, tries: number) => analytics.track("career_cleared", { career_n: careerN(careerId), tries }),
  perfSample: (p: { frames: number; slowFrames: number; dtSum: number }) =>
    analytics.track("perf_sample", {
      fps_avg: p.dtSum > 0 ? Math.round(p.frames / p.dtSum) : 0,
      slow_pct: p.frames > 0 ? Math.round((p.slowFrames / p.frames) * 100) : 0,
      frames: p.frames,
    }),
  share: (from: "result" | "cabinet") => analytics.track("share", { from }),
  dailyView: (twist: string) => analytics.track("daily_view", { twist }),
  dailyStart: (twist: string) => analytics.track("daily_start", { twist }),
  dailyWin: (twist: string, tries: number, firstToday: boolean) => analytics.track("daily_win", { twist, tries, first_today: firstToday ? 1 : 0 }),
  privacyOpen: () => analytics.track("privacy_open"),
  contactOpen: () => analytics.track("contact_open"),
  feedbackOpen: () => analytics.track("feedback_open"),
};

// perf_sample counters: updated in the match loop (numbers only, no allocations).
export class PerfCounter {
  frames = 0;
  slowFrames = 0;
  dtSum = 0;
  add(dtSeconds: number) {
    this.frames++;
    this.dtSum += dtSeconds;
    if (dtSeconds > 0.033) this.slowFrames++;
  }
  reset() {
    this.frames = this.slowFrames = 0;
    this.dtSum = 0;
  }
}
