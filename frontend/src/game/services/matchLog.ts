// MATCH RESULT LOGGING (roadmap §11). At match end we persist a compact local
// record. No backend, no accounts — this is the on-device history the meta
// layer (career / ratings) will read later. The engine stays pure; the UI calls
// logMatchResult once when a match ends.
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { MatchConfig } from "../config/matchConfig";
import type { GameSimulation } from "../sim/GameSimulation";

const KEY = "pw.matchResults";
const MAX = 50;

export interface MatchResultRecord {
  timestamp: number;
  matchType: string;
  format: string;
  court: string;
  statNormalized: boolean;
  teams: {
    near: { name: string; controller: string; profileId?: string; personality?: string }[];
    far: { name: string; controller: string; profileId?: string; personality?: string }[];
  };
  finalScore: { near: number; far: number };
  winner: "near" | "far" | null;
  rallyStats: {
    longestRally: number;
    totalRallies: number;
    dinks: number;
    kitchenFaults: number;
    pointsPlayed: number;
  };
}

function summariseTeam(players: MatchConfig["near"]["players"]) {
  return players.map((p) => ({
    name: p.name,
    controller: p.controller,
    profileId: p.profileId,
    personality: p.personality,
  }));
}

export function buildMatchResult(config: MatchConfig, sim: GameSimulation): MatchResultRecord {
  return {
    timestamp: Date.now(),
    matchType: config.matchType,
    format: config.format,
    court: config.court,
    statNormalized: config.statNormalization,
    teams: { near: summariseTeam(config.near.players), far: summariseTeam(config.far.players) },
    finalScore: { near: sim.score.nearScore, far: sim.score.farScore },
    winner: sim.winner,
    rallyStats: {
      longestRally: sim.stats.longestRally,
      totalRallies: sim.stats.totalRallies,
      dinks: sim.stats.dinks,
      kitchenFaults: sim.stats.kitchenFaults,
      pointsPlayed: sim.stats.pointsPlayed,
    },
  };
}

export async function logMatchResult(config: MatchConfig, sim: GameSimulation): Promise<void> {
  try {
    const rec = buildMatchResult(config, sim);
    const raw = await AsyncStorage.getItem(KEY);
    const list: MatchResultRecord[] = raw ? JSON.parse(raw) : [];
    list.push(rec);
    while (list.length > MAX) list.shift();
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch (e) {
    console.warn("[matchLog] failed to save result", e);
  }
}

export async function getMatchResults(): Promise<MatchResultRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
