// MATCH CONFIG AS DATA (roadmap §11).
//
// Every match launches from a plain data object. The engine is MODE-AGNOSTIC:
// it never inspects `matchType`. Career / training / challenge / event / etc.
// are all just configs. Today's "quick match" is produced by quickMatchConfig.
//
// Team size is DATA (1 = singles, 2 = doubles): no part of the engine assumes
// exactly four players.

import { PARTNER_DIFFICULTY } from "./ai";
import { NEUTRAL_STATS, type StatMultipliers } from "./profiles";
import type { ControllerType, Difficulty, Personality, Team } from "../sim/types";

export type MatchFormat = "singles" | "doubles";

// The engine must NOT branch on this. It exists for logging / meta only.
export type MatchType =
  | "quick"
  | "career"
  | "training"
  | "scrimmage"
  | "recruitment"
  | "challenge"
  | "event"
  | "friendly";

export interface PlayerConfig {
  controller: ControllerType;
  name: string;
  profileId?: Difficulty; // AI preset id (undefined for a human)
  personality?: Personality;
  stats?: StatMultipliers; // gear/partner bonuses; neutral by default
  chemistry?: number; // neutral 1.0; partner-parameter hook
}

export interface TeamConfig {
  players: PlayerConfig[]; // 1 (singles) or 2 (doubles)
}

export interface RuleModifiers {
  pointsToWin?: number;
  winBy?: number;
}

export interface StartingScore {
  near: number;
  far: number;
  servingTeam: Team;
  serverNumber?: 1 | 2;
}

export interface MatchConfig {
  seed: number;
  court: string; // visual environment id (e.g. "garden")
  format: MatchFormat;
  matchType: MatchType; // opaque to the engine
  near: TeamConfig; // the player's team (human + optional partner)
  far: TeamConfig; // the opponents
  startingScore?: StartingScore;
  ruleModifiers?: RuleModifiers;
  objectives?: unknown[]; // opaque to the engine (used by meta layer later)
  statNormalization: boolean; // true for ranked play (neutralise gear/partner stats)
}

// Ergonomic builder used by tests, the parity harness and quickMatchConfig.
export interface BuildTeam {
  controllers: ControllerType[];
  difficulties?: (Difficulty | undefined)[];
  personalities?: (Personality | undefined)[];
  names?: string[];
  stats?: (StatMultipliers | undefined)[];
  chemistry?: (number | undefined)[];
}

export interface BuildArgs {
  seed: number;
  format: MatchFormat;
  near: BuildTeam;
  far: BuildTeam;
  matchType?: MatchType;
  court?: string;
  statNormalization?: boolean;
  startingScore?: StartingScore;
  ruleModifiers?: RuleModifiers;
  objectives?: unknown[];
}

function team(bt: BuildTeam, fallbackNames: string[]): TeamConfig {
  const players: PlayerConfig[] = bt.controllers.map((controller, i) => ({
    controller,
    name: bt.names?.[i] ?? fallbackNames[i] ?? `P${i}`,
    profileId: controller === "AI" ? bt.difficulties?.[i] : undefined,
    personality: bt.personalities?.[i],
    stats: bt.stats?.[i],
    chemistry: bt.chemistry?.[i],
  }));
  return { players };
}

export function buildMatchConfig(a: BuildArgs): MatchConfig {
  return {
    seed: a.seed,
    court: a.court ?? "garden",
    format: a.format,
    matchType: a.matchType ?? "quick",
    near: team(a.near, ["You", "Partner"]),
    far: team(a.far, ["Rival", "Rival"]),
    startingScore: a.startingScore,
    ruleModifiers: a.ruleModifiers,
    objectives: a.objectives,
    statNormalization: a.statNormalization ?? false,
  };
}

// Today's QUICK MATCH, expressed as a config: human + CLUB partner (DEFENSIVE)
// vs two opponents at the chosen difficulty (AGGRESSIVE, TACTICAL). This
// reproduces the Milestone 1 default slot setup exactly.
export function quickMatchConfig(difficulty: Difficulty, seed?: number): MatchConfig {
  return buildMatchConfig({
    seed: seed ?? ((Math.random() * 1e9) | 0),
    format: "doubles",
    matchType: "quick",
    near: {
      controllers: ["LOCAL_HUMAN", "AI"],
      difficulties: [undefined, PARTNER_DIFFICULTY],
      personalities: [undefined, "DEFENSIVE"],
      names: ["You", "Partner"],
    },
    far: {
      controllers: ["AI", "AI"],
      difficulties: [difficulty, difficulty],
      personalities: ["AGGRESSIVE", "TACTICAL"],
      names: ["Rival", "Rival"],
    },
  });
}

// Dev-only 1v1 config (no singles menu in Part A). Human vs one opponent.
export function devSinglesConfig(difficulty: Difficulty, seed?: number): MatchConfig {
  return buildMatchConfig({
    seed: seed ?? ((Math.random() * 1e9) | 0),
    format: "singles",
    matchType: "friendly",
    near: { controllers: ["LOCAL_HUMAN"], names: ["You"] },
    far: { controllers: ["AI"], difficulties: [difficulty], personalities: ["TACTICAL"], names: ["Rival"] },
  });
}

export { NEUTRAL_STATS };
