import { COURT, teamOfY } from "../config/court";
import { PHYS } from "../config/tuning";
import type { BallState, Team } from "./types";

// Deterministic forward simulation of the ball (matches the real integrator) to
// predict where it can next be contacted on a given team's side. Used by both
// automatic player movement and the AI. No randomness.

export interface ContactPrediction {
  x: number;
  y: number;
  t: number; // seconds from now
  bounced: boolean;
  reachable: boolean;
}

export function predictContact(
  ball: BallState,
  team: Team,
  requireBounce: boolean,
  dt = 1 / 60,
  horizon = 2.6,
): ContactPrediction {
  let x = ball.x;
  let y = ball.y;
  let z = ball.z;
  let vx = ball.vx;
  let vy = ball.vy;
  let vz = ball.vz;
  const g = PHYS.GRAVITY;
  // SEED the local bounce count from the LIVE ball's current state. The ball may
  // have ALREADY bounced since the last strike (e.g. a dink that landed in the
  // kitchen, or the required serve/return bounce in the two-bounce phase). If we
  // started from zero we would (a) report `bounced:false` for a ball that has in
  // fact bounced — making movement hold the player behind the kitchen line and
  // never pursue a legal post-bounce ball — and (b) wait for an UNNECESSARY
  // second bounce before treating a two-bounce-phase contact as legal. Seeding
  // from `ball.bouncesSinceHit` makes an already-completed bounce count as done.
  let bounces = ball.bouncesSinceHit;
  let firstBounce: { x: number; y: number; t: number } | null = null;

  const steps = Math.floor(horizon / dt);
  for (let i = 1; i <= steps; i++) {
    x += vx * dt;
    y += vy * dt;
    z += vz * dt;
    vz -= g * dt;
    if (z <= 0 && vz < 0) {
      z = 0;
      vz = -vz * PHYS.BOUNCE_RESTITUTION;
      vx *= PHYS.BOUNCE_FRICTION;
      vy *= PHYS.BOUNCE_FRICTION;
      bounces++;
      if (!firstBounce) firstBounce = { x, y, t: i * dt };
    }
    const onOurSide = teamOfY(y) === team;
    const low = z <= PHYS.CONTACT_HEIGHT_VOLLEY;
    const bounceOk = !requireBounce || bounces >= 1;
    if (onOurSide && low && bounceOk && (z <= 0.1 || vz < 0)) {
      return { x, y, t: i * dt, bounced: bounces > 0, reachable: true };
    }
  }
  // Fall back to the first bounce (or last known position).
  if (firstBounce) return { ...firstBounce, bounced: true, reachable: false };
  return { x, y, t: horizon, bounced: bounces > 0, reachable: false };
}

// Clamp a position to a team's legal movement region (their half + kitchen).
export function clampToHalf(team: Team, x: number, y: number): { x: number; y: number } {
  const cx = Math.max(COURT.RADIUS_MARGIN, Math.min(x, COURT.WIDTH - COURT.RADIUS_MARGIN));
  let cy: number;
  if (team === "near") cy = Math.max(COURT.NET_Y + 0.4, Math.min(y, COURT.LENGTH - 0.6));
  else cy = Math.max(0.6, Math.min(y, COURT.NET_Y - 0.4));
  return { x: cx, y: cy };
}
