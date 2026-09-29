import { COURT, teamOfY } from "../config/court";
import { PLAYER } from "../config/tuning";
import { predictContact, clampToHalf } from "./physics";
import type { BallState, PlayerState, Team } from "./types";

// PlayerController — automatic positioning for ALL players (human included; the
// human's skill is timing/shot choice, not steering). Predicts the interception
// point, moves naturally toward it, keeps doubles spacing, respects the kitchen
// and recovers to a sensible ready position. No teleporting.

export interface MovementInfo {
  rallyStrikeCount: number;
  serving: boolean;
  affinityFor: (slot: number) => number; // kitchen advance tendency 0..1
  posErrorFor: (slot: number) => number; // ft of positioning noise (AI)
  serverSlot: number | null;
}

function globalRight(team: Team, side: "L" | "R"): boolean {
  return (team === "near") === (side === "R");
}

function sideCenterX(team: Team, side: "L" | "R"): number {
  return globalRight(team, side) ? COURT.WIDTH * 0.72 : COURT.WIDTH * 0.28;
}

function readyDepth(team: Team, atKitchen: boolean): number {
  if (team === "near") {
    return atKitchen
      ? COURT.NEAR_KITCHEN_Y + PLAYER.KITCHEN_LINE_STANDOFF
      : COURT.LENGTH - PLAYER.RECOVER_DEPTH_BASELINE;
  }
  return atKitchen
    ? COURT.FAR_KITCHEN_Y - PLAYER.KITCHEN_LINE_STANDOFF
    : PLAYER.RECOVER_DEPTH_BASELINE;
}

export function updateMovement(
  players: PlayerState[],
  ball: BallState,
  info: MovementInfo,
  dt: number,
) {
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

    for (const p of mates) {
      const isServer = info.serverSlot === p.slot;
      if (p === retriever) {
        // Go to the predicted contact point.
        const noise = info.posErrorFor(p.slot);
        p.targetX = pred.x + (noise ? rand(p.slot, ball.totalBounces) * noise : 0);
        p.targetY = pred.y;
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
        const advance =
          !ballComingHere &&
          info.rallyStrikeCount >= 2 &&
          info.affinityFor(p.slot) > 0.3;
        const atKitchen = advance;
        p.targetX = sideCenterX(p.team, p.courtSide);
        p.targetY = readyDepth(team, atKitchen);
        if (isServer && info.serving) {
          // Server stays at the baseline until the serve is struck.
          p.targetY = team === "near" ? COURT.LENGTH - 1.2 : 1.2;
        }
      }
      moveToward(p, dt);
    }

    // Keep doubles spacing — never overlap or pass through a teammate.
    enforceSpacing(mates[0], mates[1]);
    for (const p of mates) {
      const c = clampToHalf(team, p.x, p.y);
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
