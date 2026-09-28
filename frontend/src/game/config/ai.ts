import type { Difficulty, Personality } from "../sim/types";

// ONE configurable AI. Difficulty scales INTELLIGENCE parameters, not ball or
// foot speed (higher tiers play better pickleball, they do not cheat with
// physics). Personality is INDEPENDENT of difficulty and biases shot choice.

export interface AIParams {
  reactionDelay: number; // s before the AI commits to a struck ball
  positionError: number; // ft of noise added to target positioning
  predictError: number; // 0..1 error in landing-point prediction (lower=better)
  shotAccuracy: number; // 0..1 how tightly the shot matches intent (higher=better)
  unforcedError: number; // 0..1 chance a shot is badly mishit
  kitchenAffinity: number; // 0..1 tendency to advance to the kitchen line
  anticipation: number; // 0..1 how early it reads the ball (split-step timing)
  aggressiveness: number; // 0..1 base drive/attack tendency
  tacticalVariety: number; // 0..1 how much it mixes pace & placement
}

// DIFFICULTY TABLE (shown to the user in the CHANGELOG / hand-off).
export const DIFFICULTY_TABLE: Record<Difficulty, AIParams> = {
  // Milestone 1 tiers
  ROOKIE: {
    reactionDelay: 0.28, positionError: 2.6, predictError: 0.45, shotAccuracy: 0.6,
    unforcedError: 0.17, kitchenAffinity: 0.22, anticipation: 0.28, aggressiveness: 0.35, tacticalVariety: 0.2,
  },
  CLUB: {
    reactionDelay: 0.2, positionError: 1.8, predictError: 0.28, shotAccuracy: 0.74,
    unforcedError: 0.14, kitchenAffinity: 0.5, anticipation: 0.5, aggressiveness: 0.5, tacticalVariety: 0.45,
  },
  PRO: {
    reactionDelay: 0.11, positionError: 0.9, predictError: 0.14, shotAccuracy: 0.88,
    unforcedError: 0.06, kitchenAffinity: 0.78, anticipation: 0.75, aggressiveness: 0.62, tacticalVariety: 0.7,
  },
  // Milestone 2 tiers (architecture in place; tuned in M2)
  CASUAL: {
    reactionDelay: 0.26, positionError: 2.5, predictError: 0.38, shotAccuracy: 0.64,
    unforcedError: 0.2, kitchenAffinity: 0.35, anticipation: 0.38, aggressiveness: 0.42, tacticalVariety: 0.32,
  },
  ADVANCED: {
    reactionDelay: 0.14, positionError: 1.3, predictError: 0.2, shotAccuracy: 0.82,
    unforcedError: 0.09, kitchenAffinity: 0.66, anticipation: 0.64, aggressiveness: 0.58, tacticalVariety: 0.6,
  },
  LEGEND: {
    reactionDelay: 0.08, positionError: 0.5, predictError: 0.08, shotAccuracy: 0.94,
    unforcedError: 0.03, kitchenAffinity: 0.9, anticipation: 0.9, aggressiveness: 0.68, tacticalVariety: 0.85,
  },
};

// Personality biases (multipliers / offsets applied on top of difficulty).
export interface PersonalityBias {
  driveBias: number; // + favours drives / attacks
  dinkBias: number; // + favours dinks / resets
  lobBias: number;
  kitchenRush: number; // + advances to kitchen faster
  paceVariety: number; // + mixes speeds
}

export const PERSONALITY_BIAS: Record<Personality, PersonalityBias> = {
  DEFENSIVE: { driveBias: -0.15, dinkBias: 0.2, lobBias: 0.05, kitchenRush: -0.05, paceVariety: 0.0 },
  AGGRESSIVE: { driveBias: 0.3, dinkBias: -0.1, lobBias: -0.05, kitchenRush: 0.15, paceVariety: 0.05 },
  KITCHEN: { driveBias: -0.1, dinkBias: 0.35, lobBias: 0.05, kitchenRush: 0.3, paceVariety: 0.05 },
  TACTICAL: { driveBias: 0.05, dinkBias: 0.1, lobBias: 0.15, kitchenRush: 0.05, paceVariety: 0.35 },
};
