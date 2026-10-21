import { COURT, teamOfY } from "../config/court";
import { PLAYER, TACTIC } from "../config/tuning";
import { predictContact, predictIntercept, predictOverhead, clampToHalf, firstBouncePoint } from "./physics";
import type { BallState, PlayerState, Team } from "./types";

// Highest ball the strike-eligibility check accepts (keep in sync with
// GameSimulation.computeReach); intercepts aim a little below it.
export const STRIKE_MAX_Z = 4.6;
const HUMAN_MAX_Z = 4.0;

// PlayerController — automatic positioning for ALL players (human included; the
// human's skill is timing/shot choice, not steering). Predicts the interception
// point, moves naturally toward it, keeps doubles spacing, respects the kitchen
// and recovers to a sensible ready position. No teleporting.

export interface MovementInfo {
  rallyStrikeCount: number;
  serving: boolean;
  affinityFor: (slot: number) => number; // kitchen advance tendency 0..1 (AI / auto)
  // Explicit kitchen-button mode for a slot (near team), or null = automatic.
  // "hold" ALWAYS advances to the line (when allowed), "retreat" NEVER does —
  // decided here explicitly, not via the affinity threshold.
  kitchenModeFor?: (slot: number) => "hold" | "retreat" | null;
  posErrorFor: (slot: number) => number; // ft of positioning noise (AI)
  serverSlot: number | null;
  apexSinceHit?: number; // highest the live ball has flown since the last strike
}

function globalRight(team: Team, side: "L" | "R"): boolean {
  return (team === "near") === (side === "R");
}

function sideCenterX(team: Team, side: "L" | "R"): number {
  return globalRight(team, side) ? COURT.WIDTH * 0.72 : COURT.WIDTH * 0.28;
}

function readyDepth(team: Team, atKitchen: boolean, retreat = false): number {
  // Kitchen-button BACK uses its own deeper spot (just inside the baseline);
  // the AI / automatic ready depth is unchanged.
  const back = retreat ? PLAYER.RETREAT_DEPTH_BASELINE : PLAYER.RECOVER_DEPTH_BASELINE;
  if (team === "near") {
    return atKitchen ? COURT.NEAR_KITCHEN_Y + PLAYER.KITCHEN_LINE_STANDOFF : COURT.LENGTH - back;
  }
  return atKitchen ? COURT.FAR_KITCHEN_Y - PLAYER.KITCHEN_LINE_STANDOFF : back;
}

// A not-yet-bounced ball whose first bounce is DEEP in this team's backcourt
// (well behind the kitchen) — the human should position for the post-bounce
// intercept rather than step in toward a volley point it then can't recover from.
function deepUnbounced(ball: BallState, team: Team): boolean {
  if (ball.bouncesSinceHit > 0) return false;
  const fb = firstBouncePoint(ball);
  if (!fb || teamOfY(fb.y) !== team) return false;
  return team === "near" ? fb.y > COURT.NEAR_KITCHEN_Y + 7 : fb.y < COURT.FAR_KITCHEN_Y - 7;
}

export function updateMovement(
  players: PlayerState[],
  ball: BallState,
  info: MovementInfo,
  dt: number,
) {
  const servingTeam: Team | null =
    info.serving && info.serverSlot != null ? players[info.serverSlot].team : null;
  for (const team of ["near", "far"] as Team[]) {
    const mates = players.filter((p) => p.team === team);
    const ballComingHere = ball.inPlay && teamOfY(ball.y) === team && isApproaching(ball, team);
    const requireBounce = info.rallyStrikeCount < 3; // two-bounce phase
    const pred = predictContact(ball, team, requireBounce);

    // Decide the retriever (responsible player) when the ball is coming here.
    let retriever: PlayerState | null = null;
    if (ballComingHere && pred.reachable) {
      const targetHalfRight = pred.x > COURT.CENTER_X;
      const byside = mates.find((m) => globalRight(m.team, m.courtSide) === targetHalfRight);
      const nearest = mates
        .slice()
        .sort((a, b) => dist2(a, pred) - dist2(b, pred))[0];
      // Prefer the player whose side matches, unless the other is much closer.
      if (byside && nearest && byside !== nearest) {
        retriever = dist2(nearest, pred) < dist2(byside, pred) * 0.55 ? nearest : byside;
      } else {
        retriever = byside ?? nearest;
      }
    }

    // A high lob / pop-up dropping into our FRONT/MID court: the retriever
    // steps under it to take it as an overhead (smash height) instead of
    // waiting for it to fall to the low contact point.
    const overhead = retriever && info.apexSinceHit !== undefined
      ? predictOverhead(ball, team, info.apexSinceHit, TACTIC.SMASH_MIN_APEX, 4.2)
      : null;
    const overheadOk = !!overhead && Math.abs(overhead.y - COURT.NET_Y) <= TACTIC.SMASH_MAX_NET_DIST - 0.5;
    for (const p of mates) {
      const isServer = info.serverSlot === p.slot;
      const humanRetriever = p === retriever && p.controller === "LOCAL_HUMAN";
      if (p === retriever && overheadOk) {
        p.targetX = overhead!.x;
        p.targetY = overhead!.y;
        // never step into the kitchen for an unbounced ball
        const kl = team === "near" ? COURT.NEAR_KITCHEN_Y : COURT.FAR_KITCHEN_Y;
        const standoff = PLAYER.KITCHEN_LINE_STANDOFF * 0.6;
        if (team === "near") p.targetY = Math.max(p.targetY, kl + standoff);
        else p.targetY = Math.min(p.targetY, kl - standoff);
      } else if (humanRetriever && !pred.bounced && deepUnbounced(ball, team)) {
        // DEEP drive/drop: commit to the earliest reachable post-bounce point
        // (may be a step behind the baseline) instead of the volley point.
        const reach = PLAYER.REACH * PLAYER.REACH_MULT * p.stats.reach;
        const ic = predictIntercept(ball, team, p.x, p.y, PLAYER.SPEED, reach * 0.6, HUMAN_MAX_Z);
        p.targetX = ic ? ic.x : pred.x;
        p.targetY = ic ? ic.y : pred.y;
      } else if (humanRetriever && pred.bounced && ball.bouncesSinceHit >= 1) {
        // HUMAN post-bounce retrieval: INTERCEPT, DON'T CHASE. If the bounced
        // ball is already within comfortable reach, PLANT (hold position) so
        // the ball comes to the paddle; otherwise commit to the earliest
        // reachable low point before its second bounce. (AI keeps its own
        // behaviour — it strikes after its reaction delay.)
        const reach = PLAYER.REACH * PLAYER.REACH_MULT * p.stats.reach;
        const dNow = Math.hypot(ball.x - p.x, ball.y - p.y);
        if (dNow <= reach * 0.8 && ball.z <= HUMAN_MAX_Z) {
          p.targetX = p.x;
          p.targetY = p.y;
        } else {
          const ic = predictIntercept(ball, team, p.x, p.y, PLAYER.SPEED, reach * 0.6, HUMAN_MAX_Z);
          p.targetX = ic ? ic.x : pred.x;
          p.targetY = ic ? ic.y : pred.y;
        }
      } else if (p === retriever) {
        // Go to the predicted contact point.
        const noise = info.posErrorFor(p.slot);
        p.targetX = pred.x + (noise ? rand(p.slot, ball.totalBounces) * noise : 0);
        p.targetY = pred.y;
        // A very FAST incoming ball (a smash): don't charge forward into it —
        // hold depth (move laterally / back) so it can be blocked after it
        // bounces and slows. Normal drives (< FAST_BALL_SPEED) are unaffected.
        if (Math.hypot(ball.vx, ball.vy) > TACTIC.FAST_BALL_SPEED) {
          p.targetY = team === "near" ? Math.max(p.targetY, p.y) : Math.min(p.targetY, p.y);
        }
        // Don't step INTO the kitchen to volley an un-bounced ball — hold
        // behind the line (legal net play). We only enter the NVZ for a ball
        // that has already bounced there (a dink).
        if (!pred.bounced) {
          const kl = team === "near" ? COURT.NEAR_KITCHEN_Y : COURT.FAR_KITCHEN_Y;
          const standoff = PLAYER.KITCHEN_LINE_STANDOFF * 0.6;
          if (team === "near") p.targetY = Math.max(p.targetY, kl + standoff);
          else p.targetY = Math.min(p.targetY, kl - standoff);
        }
      } else {
        // Ready / covering position.
        const mode = info.kitchenModeFor?.(p.slot) ?? null;
        const wantsLine = mode === "hold" ? true : mode === "retreat" ? false : info.affinityFor(p.slot) > 0.3;
        const advance = !ballComingHere && info.rallyStrikeCount >= 2 && wantsLine;
        const atKitchen = advance;
        // Singles (one player per team) covers the MIDDLE of the half; doubles
        // each cover their own service-court lane (unchanged behaviour).
        const singles = mates.length === 1;
        const coverX = singles ? COURT.CENTER_X : sideCenterX(p.team, p.courtSide);
        p.targetX = coverX;
        p.targetY = readyDepth(team, atKitchen, mode === "retreat");
        if (isServer && info.serving) {
          // Server walks BEHIND their baseline to serve (exempt from the clamp),
          // standing on their current service-court side.
          p.targetX = sideCenterX(p.team, p.courtSide);
          p.targetY =
            team === "near"
              ? COURT.LENGTH + PLAYER.SERVE_STANDOFF
              : -PLAYER.SERVE_STANDOFF;
        } else if (info.serving && servingTeam && team !== servingTeam) {
          // Receiving the serve: stand DEEP near the baseline to field a deep
          // serve and move forward into the bounce (reachable returns).
          p.targetX = coverX;
          p.targetY =
            team === "near" ? COURT.LENGTH - PLAYER.RECEIVE_DEPTH : PLAYER.RECEIVE_DEPTH;
        }
      }
      moveToward(p, dt);
    }

    // Keep doubles spacing — never overlap or pass through a teammate.
    enforceSpacing(mates[0], mates[1]);
    for (const p of mates) {
      // The serving player may legally stand behind the baseline while waiting.
      if (info.serving && info.serverSlot === p.slot) continue;
      // During a rally a player may step a little behind their own baseline
      // to retrieve a deep ball (ready spots are all inside the court).
      const c = clampToHalf(team, p.x, p.y, info.serving ? 0 : PLAYER.RALLY_BEHIND_BASELINE);
      p.x = c.x;
      p.y = c.y;
    }
  }
}

function isApproaching(ball: BallState, team: Team): boolean {
  return team === "near" ? ball.vy > -0.5 : ball.vy < 0.5;
}

function moveToward(p: PlayerState, dt: number) {
  const dx = p.targetX - p.x;
  const dy = p.targetY - p.y;
  const d = Math.hypot(dx, dy);
  const step = PLAYER.SPEED * dt;
  if (d <= step || d < 1e-4) {
    p.x = p.targetX;
    p.y = p.targetY;
  } else {
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
  }
}

function enforceSpacing(a?: PlayerState, b?: PlayerState) {
  if (!a || !b) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1e-4;
  if (d < PLAYER.MIN_SEPARATION) {
    const push = (PLAYER.MIN_SEPARATION - d) / 2;
    const ux = dx / d;
    const uy = dy / d;
    a.x -= ux * push;
    a.y -= uy * push;
    b.x += ux * push;
    b.y += uy * push;
  }
}

function dist2(p: PlayerState, t: { x: number; y: number }): number {
  return (p.x - t.x) ** 2 + (p.y - t.y) ** 2;
}

// tiny deterministic jitter (not gameplay-critical randomness; positioning only)
function rand(a: number, b: number): number {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}
