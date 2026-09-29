import { MATCH } from "../config/tuning";
import type { ScoreState, Team } from "./types";

// Doubles side-out scoring. Score is called serving–receiving–server (e.g.
// "4-2-1"). Game opens 0-0-2: the first service turn of the game gets only ONE
// server before side-out. Points are scored only by the serving team; after
// scoring, the server switches sides and serves again. Game to 11, win by 2.

export interface PointOutcome {
  score: ScoreState;
  event: "point" | "second_server" | "side_out" | "game_over";
  gameOver: boolean;
  winner: Team | null;
  // true when the serving team keeps the serve and must swap serve side
  serverSwitchSides: boolean;
}

export const ScoreManager = {
  initial(firstServer: Team): ScoreState {
    return {
      nearScore: 0,
      farScore: 0,
      servingTeam: firstServer,
      serverNumber: 2, // 0-0-2 opening convention
      isFirstServiceTurn: true,
    };
  },

  // Reference helper: the TEAM-RELATIVE side the FIRST server of a service turn
  // stands on for a given team score — RIGHT when the score is EVEN, LEFT when
  // ODD (this is why the game opens 0-0-2 serving from the right). The live sim
  // drives the actual serving side from player POSITIONS (players swap sides on
  // a point win), so this is used for reference/tests, not to place the server.
  serveSide(score: ScoreState): "L" | "R" {
    const teamScore = score.servingTeam === "near" ? score.nearScore : score.farScore;
    return teamScore % 2 === 0 ? "R" : "L";
  },

  resolve(prev: ScoreState, rallyWinner: Team): PointOutcome {
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

  isGameOver(score: ScoreState): boolean {
    const hi = Math.max(score.nearScore, score.farScore);
    const diff = Math.abs(score.nearScore - score.farScore);
    return hi >= MATCH.POINTS_TO_WIN && diff >= MATCH.WIN_BY;
  },
};

function other(t: Team): Team {
  return t === "near" ? "far" : "near";
}
