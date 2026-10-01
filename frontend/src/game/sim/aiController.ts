import { COURT } from "../config/court";
import type { AIParams, PersonalityBias } from "../config/ai";
import type { RNG } from "../core/rng";
import type { BallState, PlayerState, ShotType, Team } from "./types";

// AIController — ONE configurable brain. Difficulty scales the intelligence
// params (reaction, prediction, accuracy, error, kitchen sense); personality
// biases shot SELECTION. Higher tiers choose better shots, they do not cheat
// with speed. M1 shot palette: serve, drive, dink, drop (lob/smash are M2).

export interface ShotIntent {
  shotType: ShotType;
  targetX: number;
  targetY: number;
  accuracy: number;
  unforcedError: number;
}

interface Ctx {
  params: AIParams;
  bias: PersonalityBias;
  opponents: PlayerState[];
  rng: RNG;
  strikeNumber: number; // ordinal of THIS strike in the rally (serve = 1)
}

function oppRegion(team: Team) {
  // The region we are aiming INTO (the other team's court).
  if (team === "near") {
    return {
      baselineY: COURT.BASELINE_FAR_Y,
      kitchenLineY: COURT.FAR_KITCHEN_Y,
      deepY: 5.5,
      kitchenY: (COURT.FAR_KITCHEN_Y + COURT.NET_Y) / 2 - 1.5,
    };
  }
  return {
    baselineY: COURT.BASELINE_NEAR_Y,
    kitchenLineY: COURT.NEAR_KITCHEN_Y,
    deepY: COURT.LENGTH - 5.5,
    kitchenY: (COURT.NEAR_KITCHEN_Y + COURT.NET_Y) / 2 + 1.5,
  };
}

// Pick the x that opens up the biggest gap away from the opponents — but stay
// safely inbounds (aim at inset lanes, never at the very sideline).
function gapX(ctx: Ctx): number {
  const xs = ctx.opponents.map((o) => o.x).sort((a, b) => a - b);
  const candidates = [
    COURT.WIDTH * 0.25,
    COURT.WIDTH * 0.5,
    COURT.WIDTH * 0.75,
  ];
  let best = candidates[0];
  let bestGap = -1;
  for (const c of candidates) {
    const gap = Math.min(...xs.map((x) => Math.abs(x - c)));
    if (gap > bestGap) {
      bestGap = gap;
      best = c;
    }
  }
  return best;
}

export function decideShot(p: PlayerState, ball: BallState, ctx: Ctx): ShotIntent {
  const reg = oppRegion(p.team);
  const nearKitchen =
    Math.abs(p.y - (p.team === "near" ? COURT.NEAR_KITCHEN_Y : COURT.FAR_KITCHEN_Y)) < 3;
  const ballLow = ball.z < 2.2;
  const attackable = ball.z > 2.4; // a ball sitting up invites an attack
  const clampX = (x: number) => Math.max(COURT.RADIUS_MARGIN, Math.min(COURT.WIDTH - COURT.RADIUS_MARGIN, x));

  // SERVE RETURN (strike 2) and THIRD SHOT (strike 3): deliberately soft,
  // central and MID-COURT so the other team can comfortably field it — never a
  // deep/fast winner. This is what keeps rallies alive off the serve.
  if (ctx.strikeNumber <= 3) {
    const returnY = p.team === "near" ? 12 : COURT.LENGTH - 12; // ~12 ft from opp baseline
    const targetX = clampX(COURT.CENTER_X + ctx.rng.noise(3.0));
    const targetY = returnY + ctx.rng.noise(1.5);
    return {
      shotType: "drop", // soft, loopy, reachable
      targetX,
      targetY,
      accuracy: ctx.params.shotAccuracy,
      unforcedError: ctx.params.unforcedError * 0.4, // keep the rally alive
    };
  }

  // Weighted shot selection.
  let wDrive = 0.3 + ctx.bias.driveBias + ctx.params.aggressiveness * 0.35;
  let wDink = 0.25 + ctx.bias.dinkBias + ctx.params.kitchenAffinity * 0.3;
  let wDrop = 0.2 + ctx.bias.dinkBias * 0.5;

  if (attackable) {
    // Put away / speed up a high ball.
    wDrive += 1.1;
    wDink = 0;
    wDrop *= 0.3;
  } else if (nearKitchen && ballLow) {
    wDink += 0.5;
    wDrive -= 0.1;
  } else if (!nearKitchen) {
    wDrive += 0.15;
    wDrop += 0.25;
    wDink -= 0.2;
  }
  wDrive += ctx.rng.noise(ctx.params.tacticalVariety * 0.2 + ctx.bias.paceVariety * 0.2);
  wDink += ctx.rng.noise(ctx.params.tacticalVariety * 0.2);

  wDrive = Math.max(0, wDrive);
  wDink = Math.max(0, wDink);
  wDrop = Math.max(0, wDrop);
  const total = wDrive + wDink + wDrop || 1;
  const roll = ctx.rng.next() * total;

  let shotType: ShotType;
  if (roll < wDink) shotType = "dink";
  else if (roll < wDink + wDrop) shotType = "drop";
  else shotType = "drive";

  // Speed-up: occasionally accelerate out of a dink exchange to force an error
  // or a pop-up. Frequency scales with aggressiveness so rallies always resolve
  // (no infinite dinking) while staying believable.
  if (shotType === "dink") {
    const speedUp = 0.06 + ctx.params.aggressiveness * 0.14 + Math.max(0, ctx.bias.driveBias) * 0.2;
    if (ctx.rng.chance(speedUp)) shotType = "drive";
  }

  // Targets.
  let targetX: number;
  let targetY: number;
  if (shotType === "drive") {
    const opponentsAtKitchen = ctx.opponents.every(
      (o) => Math.abs(o.y - reg.kitchenLineY) < 4,
    );
    // VARIETY (scales with tacticalVariety, i.e. Club/Pro): mix attacking the
    // opponents' feet at the kitchen, pushing them back deep, and side-to-side
    // placement. Rookie (low variety) just drives at the obvious target.
    const pushDeep = ctx.rng.chance(ctx.params.tacticalVariety * 0.55);
    if (opponentsAtKitchen && !pushDeep) {
      targetY = reg.kitchenLineY + (p.team === "near" ? -1.5 : 1.5); // at their feet
    } else {
      targetY = reg.deepY; // push them back to the baseline
    }
    targetY += ctx.rng.noise(1.5);
    // Side-to-side: sometimes jam the open sideline lane instead of the gap.
    if (ctx.rng.chance(ctx.params.tacticalVariety * 0.4)) {
      targetX = ctx.rng.chance(0.5) ? COURT.WIDTH * 0.2 : COURT.WIDTH * 0.8;
    } else {
      targetX = gapX(ctx);
    }
  } else if (shotType === "drop") {
    targetX = gapX(ctx);
    targetY = reg.kitchenY + ctx.rng.noise(1.5);
  } else {
    targetX = gapX(ctx);
    targetY = reg.kitchenY + ctx.rng.noise(1.2);
  }
  targetX = clampX(targetX);

  return {
    shotType,
    targetX,
    targetY,
    accuracy: ctx.params.shotAccuracy,
    unforcedError: ctx.params.unforcedError,
  };
}

// Serve target: legal diagonal box, mostly safe, depth varied by difficulty.
export function decideServe(
  p: PlayerState,
  box: { xLo: number; xHi: number; yLo: number; yHi: number },
  params: AIParams,
  rng: RNG,
): ShotIntent {
  const midX = (box.xLo + box.xHi) / 2 + rng.noise((box.xHi - box.xLo) * 0.28);
  // Aim to the deeper part of the box (better serve), tighter for higher tiers.
  const depthBias = 0.55 + params.shotAccuracy * 0.25;
  const yTarget = box.yLo + (box.yHi - box.yLo) * (p.team === "near" ? 1 - depthBias : depthBias);
  return {
    shotType: "serve",
    targetX: Math.max(box.xLo + 0.5, Math.min(box.xHi - 0.5, midX)),
    targetY: yTarget,
    accuracy: params.shotAccuracy,
    unforcedError: params.unforcedError * 0.4, // fewer double-faults
  };
}
