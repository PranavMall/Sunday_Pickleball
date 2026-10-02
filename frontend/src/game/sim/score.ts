import { MATCH } from "../config/tuning";
import type { MatchFormat } from "../config/matchConfig";
import type { ScoreState, Team } from "./types";

// Scoring. DOUBLES uses side-out scoring called serving–receiving–server (e.g.
// "4-2-1"): game opens 0-0-2 (first service turn gets ONE server), only the
// serving team scores, server switches sides after scoring, side-out after the
// second server loses. SINGLES is a two-number score: only the server scores,
// a lost rally side-outs immediately (no server number), and the server stands
// RIGHT on an even score, LEFT on odd. Game to 11, win by 2 (configurable).

export interface PointOutcome {
  score: ScoreState;
  event: "point" | "second_server" | "side_out" | "game_over";
  gameOver: boolean;
  winner: Team | null;
  // true when the serving team keeps the serve and must swap serve side
  serverSwitchSides: boolean;
}

export const ScoreManager = {
  initial(firstServer: Team, format: MatchFormat = "doubles"): ScoreState {
    return {
      nearScore: 0,
      farScore: 0,
      servingTeam: firstServer,
      // Doubles opens 0-0-2; singles has no server number (fixed 1).
      serverNumber: format === "doubles" ? 2 : 1,
      isFirstServiceTurn: format === "doubles",
    };
  },

  // The TEAM-RELATIVE side the server stands on: RIGHT when the serving team's
  // score is EVEN, LEFT when ODD. Used for the singles serve rule, and as a
  // reference for doubles (whose live side is position-driven).
  serveSide(score: ScoreState): "L" | "R" {
    const teamScore = score.servingTeam === "near" ? score.nearScore : score.farScore;
    return teamScore % 2 === 0 ? "R" : "L";
  },

  resolve(prev: ScoreState, rallyWinner: Team, format: MatchFormat = "doubles"): PointOutcome {
    const score: ScoreState = { ...prev };
    const servingWon = rallyWinner === score.servingTeam;

    if (servingWon) {
      if (rallyWinner === "near") score.nearScore++;
      else score.farScore++;
      const gameOver = this.isGameOver(score);
      return {
        score,
        event: gameOver ? "game_over" : "point",
        gameOver,
        winner: gameOver ? rallyWinner : null,
        serverSwitchSides: !gameOver,
      };
    }

    // Serving team lost the rally.
    if (format === "singles") {
      // No server number: a lost rally passes serve straight to the opponent.
      score.servingTeam = other(score.servingTeam);
      return { score, event: "side_out", gameOver: false, winner: null, serverSwitchSides: false };
    }
    if (score.isFirstServiceTurn) {
      score.isFirstServiceTurn = false;
      score.servingTeam = other(score.servingTeam);
      score.serverNumber = 1;
      return { score, event: "side_out", gameOver: false, winner: null, serverSwitchSides: false };
    }
    if (score.serverNumber === 1) {
      score.serverNumber = 2;
      return { score, event: "second_server", gameOver: false, winner: null, serverSwitchSides: false };
    }
    // serverNumber === 2 → side out
    score.servingTeam = other(score.servingTeam);
    score.serverNumber = 1;
    return { score, event: "side_out", gameOver: false, winner: null, serverSwitchSides: false };
  },

  isGameOver(score: ScoreState, pointsToWin = MATCH.POINTS_TO_WIN, winBy = MATCH.WIN_BY): boolean {
    const hi = Math.max(score.nearScore, score.farScore);
    const diff = Math.abs(score.nearScore - score.farScore);
    return hi >= pointsToWin && diff >= winBy;
  },
};

function other(t: Team): Team {
  return t === "near" ? "far" : "near";
}
