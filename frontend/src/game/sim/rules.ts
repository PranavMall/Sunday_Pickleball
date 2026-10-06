import {
  COURT,
  isInsideCourt,
  isInKitchenZone,
  netHeightAt,
  teamOfY,
} from "../config/court";
import { KITCHEN } from "../config/tuning";
import type { BallState, FaultEvent, PlayerState, Team } from "./types";

// ALL rule decisions live here, in LOGICAL court coordinates. No rendering,
// perspective or UI concerns. Lines are IN; the kitchen line is part of the
// kitchen; a serve on the kitchen line is a fault.

export interface ServeContext {
  active: boolean;
  servingTeam: Team;
  box: { xLo: number; xHi: number; yLo: number; yHi: number };
}

export const RuleManager = {
  // --- Contact-time legality (called the instant a player strikes) ----------
  // strikeNumber = the ordinal of THIS strike within the rally (serve = 1).
  validateStrike(
    ball: BallState,
    hitter: PlayerState,
    strikeNumber: number,
    isServe: boolean,
  ): FaultEvent | null {
    if (isServe) return null;

    // A "volley" = struck out of the air before it bounced since the last hit.
    const isVolley = ball.bouncesSinceHit === 0 && ball.z > 0.05;

    // Two-bounce rule: the return (strike 2) and the third shot (strike 3) may
    // NOT be volleyed — the ball must have bounced first.
    if (strikeNumber <= 3 && isVolley) {
      return {
        reason: "TWO_BOUNCE",
        faultingTeam: hitter.team,
        x: hitter.x,
        y: hitter.y,
        message: "Two-bounce rule — must let it bounce",
      };
    }

    // Kitchen (non-volley zone): you may not VOLLEY while touching the kitchen
    // or its line, and you must have re-established both feet outside first.
    if (isVolley) {
      if (hitter.inKitchen || hitter.touchingKitchenLine) {
        return {
          reason: "KITCHEN_VOLLEY",
          faultingTeam: hitter.team,
          x: hitter.x,
          y: hitter.y,
          message: "Kitchen fault — volleyed in the NVZ",
        };
      }
      if (hitter.wasInKitchen && !hitter.feetEstablished) {
        return {
          reason: "KITCHEN_NOT_ESTABLISHED",
          faultingTeam: hitter.team,
          x: hitter.x,
          y: hitter.y,
          message: "Kitchen fault — feet not re-established",
        };
      }
    }
    // Groundstrokes/dinks off a bounce while standing in the kitchen are LEGAL.
    return null;
  },

  // --- Net crossing (called when the ball passes the net plane) -------------
  // Returns a fault if the ball fails to clear the net. A ball that clips the
  // net but still clears stays LIVE (we never fault merely for touching it).
  checkNetCrossing(
    xAtNet: number,
    zAtNet: number,
    hitterTeam: Team,
    isServe: boolean,
  ): FaultEvent | null {
    const need = netHeightAt(Math.max(0, Math.min(COURT.WIDTH, xAtNet)));
    if (zAtNet < need) {
      return {
        reason: isServe ? "SERVE_NET" : "NET",
        faultingTeam: hitterTeam,
        x: xAtNet,
        y: COURT.NET_Y,
        message: isServe ? "Serve into the net" : "Into the net",
      };
    }
    return null;
  },

  // --- Bounce classification (called when the ball hits the ground) ---------
  // Mutates nothing; returns a fault (or null) plus whether the serve is now
  // validated. The sim owns the counters.
  classifyBounce(
    ball: BallState,
    serve: ServeContext,
    bounceSideCountAfter: number,
    crossedNetSinceHit: boolean,
  ): { fault: FaultEvent | null; serveGood: boolean } {
    const { x, y } = ball;
    const side = teamOfY(y);

    if (serve.active) {
      // Service faults, in order.
      if (!isInsideCourt(x, y)) {
        return {
          fault: fault("SERVE_OUT", serve.servingTeam, x, y, "Serve out"),
          serveGood: false,
        };
      }
      if (isInKitchenZone(x, y)) {
        // Landing in the kitchen OR on the kitchen line is a service fault.
        return {
          fault: fault("SERVE_KITCHEN", serve.servingTeam, x, y, "Serve in the kitchen"),
          serveGood: false,
        };
      }
      if (
        x < serve.box.xLo ||
        x > serve.box.xHi ||
        y < serve.box.yLo ||
        y > serve.box.yHi
      ) {
        return {
          fault: fault("SERVE_WRONG_BOX", serve.servingTeam, x, y, "Wrong service box"),
          serveGood: false,
        };
      }
      // Good serve — the required serve bounce is done.
      return { fault: null, serveGood: true };
    }

    // Rally bounce.
    // A SECOND bounce on a side means the receiving side failed to return it —
    // this is decided BEFORE any out-of-bounds check, because out only matters
    // on the FIRST bounce. (A deep winner the opponent whiffs must not be
    // mis-called "out" against the hitter when its 2nd bounce sails long.)
    if (bounceSideCountAfter >= 2) {
      return {
        fault: fault("DOUBLE_BOUNCE", side, x, y, "Double bounce"),
        serveGood: false,
      };
    }
    // First bounce since the hit: judge in/out and net-clearance.
    if (!isInsideCourt(x, y)) {
      return {
        fault: fault("OUT", ball.lastHitTeam ?? side, x, y, "Out"),
        serveGood: false,
      };
    }
    if (ball.lastHitTeam && side === ball.lastHitTeam && !crossedNetSinceHit) {
      return {
        fault: fault("OWN_COURT", ball.lastHitTeam, x, y, "Didn't clear the net"),
        serveGood: false,
      };
    }
    return { fault: null, serveGood: false };
  },

  // Update a player's kitchen flags from their logical position.
  updateKitchenFlags(p: PlayerState) {
    const inZone = isInKitchenZone(p.x, p.y);
    const ownLineY = p.team === "near" ? COURT.NEAR_KITCHEN_Y : COURT.FAR_KITCHEN_Y;
    p.inKitchen = inZone;
    p.touchingKitchenLine = Math.abs(p.y - ownLineY) <= KITCHEN.LINE_TOLERANCE;
    // Touching the kitchen LINE legally counts as being in the kitchen: mark the
    // player as having been in and drop the re-established flag + reset the timer,
    // exactly as a full NVZ entry would.
    if (inZone || p.touchingKitchenLine) {
      p.wasInKitchen = true;
      p.feetEstablished = false;
      p.reestablishTimer = 0;
    }
  },

  // True when the player is inside the NVZ OR touching its line — line contact
  // counts as kitchen contact for every rule that cares (volley, momentum,
  // re-establishment, striker eligibility).
  isKitchenContact(p: PlayerState): boolean {
    return p.inKitchen || p.touchingKitchenLine;
  },

  // Advance a player's kitchen recovery one frame. The re-establish timer ONLY
  // runs when BOTH feet are completely outside the NVZ AND not touching the
  // line; once the player has stayed fully out long enough they re-establish.
  tickKitchenRecovery(p: PlayerState, dt: number) {
    if (!p.inKitchen && !p.touchingKitchenLine && p.wasInKitchen) {
      p.reestablishTimer += dt;
      if (p.reestablishTimer >= KITCHEN.REESTABLISH_TIME) {
        p.feetEstablished = true;
        p.wasInKitchen = false;
      }
    }
  },

  // A player who has been in the kitchen and NOT yet re-established BOTH feet may
  // not be auto-designated to VOLLEY an airborne ball. This stops automatic
  // movement / striker selection from manufacturing an unavoidable kitchen fault
  // after a legal bounced-ball retrieval. A BOUNCED ball is always allowed (it
  // is legal to play from inside the kitchen). RuleManager.validateStrike remains
  // authoritative for any volley actually executed.
  eligibleForAirborneVolley(p: PlayerState, ball: BallState): boolean {
    const airborne = ball.bouncesSinceHit === 0 && ball.z > 0.05;
    if (!airborne) return true;
    return !(p.wasInKitchen && !p.feetEstablished);
  },
};

function fault(
  reason: FaultEvent["reason"],
  team: Team,
  x: number,
  y: number,
  message: string,
): FaultEvent {
  return { reason, faultingTeam: team, x, y, message };
}
