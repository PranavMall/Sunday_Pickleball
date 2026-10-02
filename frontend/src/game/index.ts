// Public API barrel for the game engine. Rendering/UI import from here.
export { GameSimulation } from "./sim/GameSimulation";
export type { SimOptions, SwipeInput, FloatingMessage } from "./sim/GameSimulation";
export { ScoreManager } from "./sim/score";
export { RuleManager } from "./sim/rules";
export { RNG } from "./core/rng";
export { COURT, netHeightAt, teamOfY } from "./config/court";
export { DIFFICULTY_TABLE, PERSONALITY_BIAS } from "./config/ai";
export { AI_PROFILES, PERSONALITY_PRESETS, NEUTRAL_STATS, applyChemistry } from "./config/profiles";
export type { AIProfile, StatMultipliers } from "./config/profiles";
export {
  buildMatchConfig,
  quickMatchConfig,
  devSinglesConfig,
} from "./config/matchConfig";
export type {
  MatchConfig,
  MatchFormat,
  MatchType,
  PlayerConfig,
  TeamConfig,
} from "./config/matchConfig";
export { MATCH, PHYS, PLAYER } from "./config/tuning";
export { makeProjector } from "./render/perspective";
export type { Projector } from "./render/perspective";
export * from "./sim/types";
export { analytics, crashReporting } from "./services/analytics";
