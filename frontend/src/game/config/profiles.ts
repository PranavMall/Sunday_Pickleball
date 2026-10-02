// Parametric AI profiles + per-player stat multipliers + chemistry hook.
//
// Section 11 of the roadmap asks for behaviour driven by PARAMETERS rather than
// a single difficulty value, shared by partners, rivals and (later) roster
// opponents. This file formalises that:
//
//   AIProfile  = descriptive behavioural parameters (aggression, dinkPreference,
//                poachRate, lobTendency, reactionSpeed, courtCoverage, errorRate)
//                PLUS the authoritative engine params the simulation already
//                reads (AIParams). The engine keeps reading AIParams so the
//                ROOKIE/CLUB/PRO presets reproduce TODAY's behaviour EXACTLY;
//                the descriptive fields are for UI/tuning and future Part B/C
//                shot logic (poach/lob) that is NOT active yet.
//
//   StatMultipliers = power/control/spin/reach, neutral (1.0) by default. Gear
//                and partner-stat bonuses become data changes. Forced neutral
//                when a ranked match sets statNormalization.
//
//   chemistry   = a neutral hook (1.0 = no change) that can later nudge a
//                partner's parameters. At the default it is the identity, so it
//                never makes a partner deliberately worse.

import { DIFFICULTY_TABLE, PERSONALITY_BIAS, type AIParams, type PersonalityBias } from "./ai";
import type { Difficulty, Personality } from "../sim/types";

export interface StatMultipliers {
  power: number; // ball pace off the paddle
  control: number; // placement tightness (less spread)
  spin: number; // reserved hook (no spin model yet)
  reach: number; // how far the player can stretch to a ball
}

export const NEUTRAL_STATS: StatMultipliers = { power: 1, control: 1, spin: 1, reach: 1 };

export function normaliseStats(s: StatMultipliers | undefined, normalize: boolean): StatMultipliers {
  if (normalize || !s) return { ...NEUTRAL_STATS };
  return { ...s };
}

// Descriptive, designer-facing behavioural parameters. These describe a profile
// in plain terms; the engine-authoritative numbers live in `params`.
export interface AIProfile {
  id: string;
  // Behavioural description (0..1 unless noted).
  aggression: number; // attack / speed-up tendency
  dinkPreference: number; // soft kitchen play tendency
  poachRate: number; // doubles poaching (consumed in Part B)
  lobTendency: number; // lob usage (consumed in Part C)
  reactionSpeed: number; // 0 slow .. 1 fast (inverse of reaction delay)
  courtCoverage: number; // ground the player tries to cover
  errorRate: number; // unforced error propensity
  // Authoritative engine parameters (what the simulation actually reads).
  params: AIParams;
}

// Build the descriptive fields from the existing engine params so a preset is a
// single source of truth AND reproduces today's behaviour exactly.
function describe(id: string, p: AIParams): AIProfile {
  return {
    id,
    aggression: p.aggressiveness,
    dinkPreference: p.kitchenAffinity,
    poachRate: p.aggressiveness * 0.5, // forward-looking default (unused in Part A)
    lobTendency: 0.1, // forward-looking default (unused in Part A)
    reactionSpeed: 1 - Math.min(1, p.reactionDelay / 0.3),
    courtCoverage: 1 - Math.min(1, p.positionError / 3),
    errorRate: p.unforcedError,
    params: p,
  };
}

// Difficulty presets. params come straight from DIFFICULTY_TABLE (unchanged),
// so ROOKIE/CLUB/PRO play identically to Milestone 1.
export const AI_PROFILES: Record<Difficulty, AIProfile> = Object.fromEntries(
  (Object.keys(DIFFICULTY_TABLE) as Difficulty[]).map((d) => [d, describe(d, DIFFICULTY_TABLE[d])]),
) as Record<Difficulty, AIProfile>;

// Personalities are presets too (bias shot selection on top of a profile).
export const PERSONALITY_PRESETS: Record<Personality, PersonalityBias> = PERSONALITY_BIAS;

// Chemistry hook. `chemistry` is neutral at 1.0 (identity). A value != 1 may
// later nudge a partner's params; at the default it returns the params
// unchanged so parity is preserved and a partner is never made worse by default.
export function applyChemistry(params: AIParams, chemistry: number): AIParams {
  if (chemistry === 1) return params;
  // Forward-looking: positive chemistry sharpens accuracy & reaction a touch,
  // never degrades. (Inactive at the neutral default used everywhere in Part A.)
  const k = Math.max(0, chemistry - 1);
  return {
    ...params,
    shotAccuracy: Math.min(1, params.shotAccuracy + k * 0.05),
    reactionDelay: Math.max(0.05, params.reactionDelay * (1 - k * 0.1)),
    unforcedError: Math.max(0, params.unforcedError * (1 - k * 0.15)),
  };
}
