// TUTORIAL: one short practice match that teaches six shots (taught by the
// partner between points). Pure logic: which lesson is in play, the lines to
// show between points, and when a lesson ticks. Reads existing sim state and
// contact events only; no allocations per frame, no storage writes.
import { analytics } from "../services/analytics";
import type { SaveDoc } from "./metaStore";

export const LESSON_IDS = ["serve", "bounce", "net", "back", "smash", "lob"] as const;
export type LessonId = (typeof LESSON_IDS)[number];
export const LESSON_CHIPS: Record<LessonId, string> = { serve: "Serve", bounce: "Bounce", net: "Net", back: "Back", smash: "Smash", lob: "Lob" };
export const TUTORIAL_REWARD_COINS = 100;
export const MAX_CHANCES = 3;

export const INTRO_LINES = ["Practice match. Six shots and you're ready."];
export const RESUME_LINES = ["Welcome back. Let's pick up where we left off."];
export const LESSON_LINES: Record<LessonId, string[]> = {
  serve: ["Your serve. Swipe up, underhand, into the box across from you."],
  bounce: ["Their return must bounce, and so must our next shot. After that, volley away."],
  net: ["Tap NET to move up to the kitchen line. Never volley from inside the kitchen."],
  back: ["Tap BACK to drop to the baseline. It's the safe spot when they lob you."],
  smash: ["See this button? Grey means nothing to smash.", "When it turns red, a high ball is coming. Tap it, then swipe."],
  lob: ["Your turn. Tap LOB, then swipe over their heads."],
};
// Smash lesson freeze (match screen): the bubble while frozen / after the tap.
export const SMASH_FREEZE_LINE = "Red! A high ball is coming. Tap SMASH.";
export const SMASH_ARMED_LINE = "Gold ring: now swipe!";
export const SCORING_LINE = "Only the serving team scores. Lose the rally and the serve moves on.";
export const CLOSE_ENOUGH_LINE = "Close enough. You'll see it again in Career.";

export type TutorialFrom = "welcome" | "match1" | "home" | "settings";

type TutorialSave = Pick<SaveDoc, "tutorial">;
export const showTutorialCard = (d: TutorialSave | null | undefined) => !!d && !d.tutorial.done && !d.tutorial.hidden;
// The Match 1 pop-up: once, only while the tutorial card is offered.
export const showMatch1Prompt = (d: TutorialSave | null | undefined, careerId: string) => !!d && careerId === "mumbai.community.01" && showTutorialCard(d) && !d.tutorial.careerPrompted;

// Analytics (buffer today; PostHog in Release 11).
let tileOffered = false;
export const tutorialEvents = {
  offered: (from: TutorialFrom) => {
    if (from === "home") {
      if (tileOffered) return;
      tileOffered = true;
    }
    analytics.track("tutorial_offered", { from });
  },
  started: (from: TutorialFrom, replay: boolean) => analytics.track("tutorial_started", { from, replay }),
  lesson: (id: LessonId, chances: number, auto: boolean) => analytics.track("tutorial_lesson", { id, chances, auto }),
  left: (lessonsDone: number) => analytics.track("tutorial_left", { lessonsDone }),
  completed: (seconds: number, replay: boolean) => analytics.track("tutorial_completed", { seconds, replay }),
  hidden: (from: TutorialFrom) => analytics.track("tutorial_hidden", { from }),
};

// Structural views of the sim (GameSimulation satisfies both).
export interface TutorSim {
  phase: string;
  kitchenMode: string | null;
  score: { servingTeam: string };
  lastFault: { faultingTeam: string } | null;
  humanIsServer(): boolean;
  humanSmashCuePhase(): string | null;
}
export interface TutorContact {
  slot: number;
  team: string;
  shotType: string;
  isServe: boolean;
  isVolley: boolean;
  miss: boolean;
}
export interface LessonTick {
  id: LessonId;
  chances: number;
  auto: boolean;
}

export class TutorialRun {
  steps: LessonId[];
  current: LessonId | null = null;
  finished = false;
  private chances: Record<LessonId, number> = { serve: 0, bounce: 0, net: 0, back: 0, smash: 0, lob: 0 };
  private shown: Record<LessonId, boolean> = { serve: false, bounce: false, net: false, back: false, smash: false, lob: false };
  private introShown = false;
  private scoringShown = false;
  private closeEnough = false;
  private lastServing: string | null = null;
  // Per-point flags.
  private success = false;
  private cueSeen = false;
  private humanServed = false;
  private serveReturned = false;

  private resumed: boolean;
  constructor(steps: readonly string[], private humanSlot: number) {
    this.steps = LESSON_IDS.filter((id) => steps.includes(id));
    this.resumed = this.steps.length > 0;
    this.finished = this.steps.length === LESSON_IDS.length;
  }

  isDone(id: LessonId): boolean {
    return this.steps.includes(id);
  }

  // Serve when the human serves, otherwise bounce first; then net → back → smash → lob.
  private pick(sim: TutorSim): LessonId | null {
    const left = LESSON_IDS.filter((id) => !this.steps.includes(id));
    if (!left.length) return null;
    if (left.includes("serve") && sim.humanIsServer()) return "serve";
    if (left.includes("bounce")) return "bounce";
    if (left.includes("serve")) return null;
    return left[0];
  }

  // Between points (waiting to serve): choose the lesson; the lines to show now (or null).
  cardFor(sim: TutorSim): string[] | null {
    const lines: string[] = [];
    if (!this.introShown) {
      this.introShown = true;
      lines.push(...(this.resumed ? RESUME_LINES : INTRO_LINES));
    }
    if (this.closeEnough) {
      this.closeEnough = false;
      lines.push(CLOSE_ENOUGH_LINE);
    }
    if (!this.scoringShown && this.lastServing !== null && sim.score.servingTeam !== this.lastServing) {
      this.scoringShown = true;
      lines.push(SCORING_LINE);
    }
    this.lastServing = sim.score.servingTeam;
    this.current = this.pick(sim);
    if (this.current && !this.shown[this.current]) {
      this.shown[this.current] = true;
      lines.push(...LESSON_LINES[this.current]);
    }
    return lines.length ? lines : null;
  }

  // Smash lesson freeze: due the first time per point the SMASH cue shows (at
  // most once per point; only while the smash lesson is in play).
  private freezePoint = -1;
  freezeDue(sim: { phase: string; stats: { pointsPlayed: number }; smashButtonCue(): string | null }): boolean {
    if (this.current !== "smash" || sim.phase !== "rally" || this.freezePoint === sim.stats.pointsPlayed || sim.smashButtonCue() === null) return false;
    this.freezePoint = sim.stats.pointsPlayed;
    return true;
  }

  // Every frame during play (reads only).
  onFrame(sim: TutorSim) {
    if (this.current === "back" && sim.kitchenMode === "retreat") this.success = true;
    if (this.current === "smash" && sim.humanSmashCuePhase() !== null) this.cueSeen = true;
  }

  onContact(ev: TutorContact, sim: TutorSim) {
    if (ev.slot !== this.humanSlot) {
      if (this.humanServed && ev.team !== "near") this.serveReturned = true;
      return;
    }
    if (ev.miss) return;
    switch (this.current) {
      case "bounce":
        if (!ev.isServe && !ev.isVolley) this.success = true;
        break;
      case "serve":
        if (ev.isServe) this.humanServed = true;
        break;
      case "net":
        if (!ev.isServe && sim.kitchenMode === "hold") this.success = true;
        break;
      case "smash":
        if (ev.shotType === "smash") this.success = this.cueSeen = true;
        break;
      case "lob":
        if (ev.shotType === "lob") this.success = true;
        break;
      default:
        break;
    }
  }

  // At the end of each point: the lesson that ticked (or null).
  onPointEnd(sim: TutorSim): LessonTick | null {
    const id = this.current;
    let tick: LessonTick | null = null;
    if (id && !this.steps.includes(id)) {
      let ok = this.success;
      let chance = true;
      if (id === "serve") {
        chance = this.humanServed;
        ok = this.humanServed && (this.serveReturned || !(sim.lastFault && sim.lastFault.faultingTeam === "near"));
      }
      if (id === "smash") chance = this.cueSeen || this.success;
      if (chance) this.chances[id]++;
      if (ok) tick = { id, chances: this.chances[id], auto: false };
      else if (this.chances[id] >= MAX_CHANCES) {
        tick = { id, chances: this.chances[id], auto: true };
        this.closeEnough = true;
      }
      if (tick) {
        this.steps.push(id);
        this.steps.sort((a, b) => LESSON_IDS.indexOf(a) - LESSON_IDS.indexOf(b));
        this.current = null;
      }
    }
    this.success = this.cueSeen = this.humanServed = this.serveReturned = false;
    if (this.steps.length === LESSON_IDS.length) this.finished = true;
    return tick;
  }
}
