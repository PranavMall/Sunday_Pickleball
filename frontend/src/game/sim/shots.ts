import { COURT, netHeightAt } from "../config/court";
import { PHYS, SHOTS } from "../config/tuning";
import type { RNG } from "../core/rng";
import type { ShotType } from "./types";

export interface ShotResult {
  vx: number;
  vy: number;
  vz: number;
  contactZ: number;
  netClears: boolean;
}

// Solve a target-aimed shot: given a contact point and a landing target, find
// velocities so the ball lands at (targetX, targetY) after the shot's flight
// time, guaranteeing net clearance by lengthening the arc if needed. This makes
// shots predictable and learnable (a gesture always produces the same result).
export function solveShot(
  fromX: number,
  fromY: number,
  targetX: number,
  targetY: number,
  shotType: ShotType,
  opts?: { accuracy?: number; rng?: RNG; unforcedError?: number; clampInBounds?: boolean },
): ShotResult {
  const tune = SHOTS[shotType];
  const g = PHYS.GRAVITY;
  const contactZ = tune.contactH;

  let tx = targetX;
  let ty = targetY;
  const clampInBounds = opts?.clampInBounds ?? true;

  // Apply AI/human error: jitter the target and occasionally a bad mishit.
  if (opts?.rng) {
    const acc = opts.accuracy ?? 1;
    const spread = (1 - acc) * 3.5; // ft
    tx += opts.rng.noise(spread);
    ty += opts.rng.noise(spread);
    if (clampInBounds) {
      // Normal shots stay in bounds — a competent player keeps the ball in.
      tx = Math.max(1, Math.min(COURT.WIDTH - 1, tx));
      ty = Math.max(1, Math.min(COURT.LENGTH - 1, ty));
    }
    // Genuine UNFORCED errors (bad AI does this more) can sail out or net.
    if (opts.unforcedError && opts.rng.chance(opts.unforcedError)) {
      if (opts.rng.chance(0.5)) ty += opts.rng.range(-6, -2) * Math.sign(ty - fromY || 1);
      else {
        tx += opts.rng.noise(6);
        ty += opts.rng.range(2, 6) * Math.sign(ty - fromY || 1);
      }
    }
  }

  const dx = tx - fromX;
  const dy = ty - fromY;

  // Fraction of the path where the net sits (for clearance checks).
  const fNet = dy !== 0 ? (COURT.NET_Y - fromY) / dy : 0;
  const xAtNet = fromX + dx * fNet;
  const required = netHeightAt(Math.max(0, Math.min(COURT.WIDTH, xAtNet))) + tune.netClear;

  let T = tune.flight;
  // Increase arc until the ball clears the net (keeps the landing on target).
  for (let i = 0; i < 8; i++) {
    const vz = (0.5 * g * T * T - contactZ) / T;
    if (fNet > 0 && fNet < 1) {
      const tNet = fNet * T;
      const zNet = contactZ + vz * tNet - 0.5 * g * tNet * tNet;
      if (zNet >= required) break;
      T += 0.09;
    } else break;
  }

  const vz = (0.5 * g * T * T - contactZ) / T;
  const vx = dx / T;
  const vy = dy / T;

  // Final clearance flag (for diagnostics / net faults happen in sim).
  let netClears = true;
  if (fNet > 0 && fNet < 1) {
    const tNet = fNet * T;
    const zNet = contactZ + vz * tNet - 0.5 * g * tNet * tNet;
    netClears = zNet >= netHeightAt(Math.max(0, Math.min(COURT.WIDTH, xAtNet)));
  }

  return { vx, vy, vz, contactZ, netClears };
}
