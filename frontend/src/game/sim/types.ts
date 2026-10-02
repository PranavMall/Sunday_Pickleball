import type { StatMultipliers } from "../config/profiles";

export type Team = "near" | "far";
export type ControllerType = "LOCAL_HUMAN" | "AI" | "REMOTE_HUMAN";
export type CourtSide = "L" | "R"; // GLOBAL: R = right half (x>10), L = left half (x<10)
export type ShotType = "serve" | "drive" | "dink" | "drop" | "lob" | "smash";

export type Difficulty = "ROOKIE" | "CLUB" | "PRO" | "CASUAL" | "ADVANCED" | "LEGEND";
export type Personality = "DEFENSIVE" | "AGGRESSIVE" | "KITCHEN" | "TACTICAL";

export interface PlayerState {
  slot: number; // 0..3
  team: Team;
  controller: ControllerType;
  name: string;
  colorKey: string; // theme color key for rendering

  x: number;
  y: number;
  targetX: number;
  targetY: number;

  courtSide: CourtSide;
  isServing: boolean;

  // Kitchen (non-volley zone) tracking
  inKitchen: boolean;
  touchingKitchenLine: boolean;
  feetEstablished: boolean;
  wasInKitchen: boolean;
  momentumTimer: number; // >0 => a volley just happened; entering NVZ now = fault
  reestablishTimer: number; // counting down time-with-both-feet-out

  lastHitTime: number; // sim time of last strike
  reactionUntil: number; // AI: cannot commit to strike before this sim time
  committedToBall: boolean; // AI has decided to play this ball

  // AI config (undefined for humans)
  difficulty?: Difficulty;
  personality?: Personality;

  // Per-player stat multipliers (gear/partner bonuses). Neutral 1.0 by default,
  // forced neutral under stat normalization (ranked play).
  stats: StatMultipliers;
  // Neutral chemistry hook (1.0 = no change); may later nudge partner params.
  chemistry: number;

  // animation cues (transient, for renderer)
  swingCue: number; // sim time of last CONTACT (follow-through / "pop" pose)
  windUpCue: number; // sim time a valid human swipe was ACCEPTED (anticipation)
}

// A real ball contact, emitted EXACTLY ONCE per strike. The renderer/UI consume
// new events to fire the contact flash, sound, haptic and ball squash a single
// time, on the contact frame — never faked, never doubled.
export interface ContactEvent {
  id: number;
  time: number;
  slot: number;
  team: Team;
  shotType: ShotType;
  isServe: boolean;
  isVolley: boolean;
  miss: boolean;
  power: number; // 0..1 contact strength (for sound/haptic intensity)
  x: number;
  y: number;
}

// Dev-only circular input/contact trace entry (hidden in production).
export interface InputTraceEntry {
  time: number;
  kind: "received" | "buffered" | "consumed" | "expired";
  dx: number;
  dy: number;
  power: number;
  strikerSlot: number | null;
  contactTime?: number;
  lastHitBy?: number | null;
}

export interface BallState {
  x: number;
  y: number;
  z: number; // height (ft)
  vx: number;
  vy: number;
  vz: number;

  inPlay: boolean;
  lastHitBy: number | null; // slot
  lastHitTeam: Team | null;

  bouncesSinceHit: number; // bounces since the last time a player struck it
  bounceSideCount: number; // consecutive bounces on the current side
  currentSide: Team; // which side the ball is currently over
  totalBounces: number;
  crossedNetSinceHit: boolean;
  lastBounce: { x: number; y: number; side: Team } | null;

  trail: { x: number; y: number; z: number }[];
}

export type FaultReason =
  | "NET"
  | "OUT"
  | "OWN_COURT"
  | "DOUBLE_BOUNCE"
  | "TWO_BOUNCE"
  | "KITCHEN_VOLLEY"
  | "KITCHEN_MOMENTUM"
  | "KITCHEN_NOT_ESTABLISHED"
  | "SERVE_OUT"
  | "SERVE_KITCHEN"
  | "SERVE_WRONG_BOX"
  | "SERVE_NET"
  | "DEAD_BALL";

export interface FaultEvent {
  reason: FaultReason;
  faultingTeam: Team;
  x: number;
  y: number;
  message: string;
}

export type MatchPhase = "waiting_serve" | "serving" | "rally" | "point_over" | "game_over";

export interface ScoreState {
  nearScore: number;
  farScore: number;
  servingTeam: Team;
  serverNumber: 1 | 2;
  isFirstServiceTurn: boolean; // 0-0-2 opening: serving team only gets 1 server
}

export interface MatchStats {
  rallyCount: number; // strikes in current rally
  longestRally: number;
  totalRallies: number;
  dinks: number;
  kitchenFaults: number;
  pointsPlayed: number;
}
