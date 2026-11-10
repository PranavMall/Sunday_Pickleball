// TUTORIAL: one short practice match that teaches six shots (taught by the
// partner between points). Pure logic: which lesson is in play, the lines to
// show between points, and when a lesson ticks. Reads existing sim state and
// contact events only; no allocations per frame, no storage writes.
import { analytics } from "../services/analytics";
import type { SaveDoc } from "./metaStore";

export const LESSON_IDS = ["bounce", "serve", "net", "smash", "lob", "back"] as const;
export type LessonId = (typeof LESSON_IDS)[number];
export const LESSON_CHIPS: Record<LessonId, string> = { bounce: "Bounce", serve: "Serve", net: "Net", smash: "Smash", lob: "Lob", back: "Back" };
export const TUTORIAL_REWARD_COINS = 100;
export const MAX_CHANCES = 3;

export const INTRO_LINES = ["Practice match. Nobody's watching. Except me. I'm always watching.", "Six shots and you're ready."];
export const LESSON_LINES: Record<LessonId, string[]> = {
  bounce: ["Rule one: the return of serve must bounce. Then our next shot must bounce too.", "After that, volley away. Swipe toward where you want the ball to go."],
  serve: ["Your serve. Swipe up, underhand. Hold your finger down to see where it lands.", "Into the box across from you. Nice and easy."],
  net: ["Tap NET to move up to the kitchen line.", "No volleys from inside the kitchen. Dink: soft and low, just over the net."],
  smash: ["They'll lob over us now. When the smash cue shows, swipe hard.", "High ball, big swing. That's the whole theory."],
  lob: ["Your turn. Tap LOB, then swipe.", "Over their heads while they crowd the net."],
  back: ["Tap BACK to drop to the baseline.", "That's the safe spot when they lob you."],
};
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
  private chances: Record<LessonId, number> = { bounce: 0, serve: 0, net: 0, smash: 0, lob: 0, back: 0 };
  private shown: Record<LessonId, boolean> = { bounce: false, serve: false, net: false, smash: false, lob: false, back: false };
  private introShown = false;
  private scoringShown = false;
  private closeEnough = false;
  private lastServing: string | null = null;
  // Per-point flags.
  private success = false;
  private cueSeen = false;
  private humanServed = false;
  private serveReturned = false;

  constructor(steps: readonly string[], private humanSlot: number) {
    this.steps = LESSON_IDS.filter((id) => steps.includes(id));
    this.finished = this.steps.length === LESSON_IDS.length;
  }

  isDone(id: LessonId): boolean {
    return this.steps.includes(id);
  }

  // Bounce and serve first (serve waits for the human's serve), then net → smash → lob → back.
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
      lines.push(...INTRO_LINES);
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
