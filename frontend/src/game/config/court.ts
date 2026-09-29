// Court geometry — LOGICAL COORDINATES in FEET.
// Official USA Pickleball doubles court: 20 ft wide x 44 ft long.
// Origin (0,0) = FAR-LEFT baseline corner. x grows to the right, y grows toward
// the NEAR (bottom-of-screen) baseline. The near team (human + partner) defends
// the large-y half; the far team (two AI) defends the small-y half.
//
// NOTHING in here knows about pixels or perspective. Rendering projects these
// numbers through PerspectiveRenderer. All rule decisions use these numbers.

export const COURT = {
  WIDTH: 20, // ft, x in [0, 20]
  LENGTH: 44, // ft, y in [0, 44]
  NET_Y: 22, // net runs across the middle
  KITCHEN_DEPTH: 7, // non-volley zone is 7 ft from the net on each side
  // Kitchen (NVZ) lines:
  FAR_KITCHEN_Y: 22 - 7, // 15
  NEAR_KITCHEN_Y: 22 + 7, // 29
  BASELINE_FAR_Y: 0,
  BASELINE_NEAR_Y: 44,
  CENTER_X: 10,
  // Net height (ft): 36 in at the sidelines, 34 in at the centre.
  NET_H_CENTER: 34 / 12, // ~2.833 ft
  NET_H_SIDE: 36 / 12, // 3.0 ft
  RADIUS_MARGIN: 0.7, // ft players keep off the sidelines
} as const;

// Net height at a given x (linear from centre to each sideline).
export function netHeightAt(x: number): number {
  const t = Math.abs(x - COURT.CENTER_X) / COURT.CENTER_X; // 0 centre, 1 sideline
  return COURT.NET_H_CENTER + (COURT.NET_H_SIDE - COURT.NET_H_CENTER) * t;
}

export function teamOfY(y: number): "near" | "far" {
  return y > COURT.NET_Y ? "near" : "far";
}

// Is a point inside the full singles/doubles court rectangle (lines are IN)?
export function isInsideCourt(x: number, y: number): boolean {
  return x >= 0 && x <= COURT.WIDTH && y >= 0 && y <= COURT.LENGTH;
}

// Is a point inside the kitchen (non-volley zone)? The kitchen LINE is part of
// the kitchen, so bounds are inclusive.
export function isInKitchenZone(x: number, y: number): boolean {
  return x >= 0 && x <= COURT.WIDTH && y >= COURT.FAR_KITCHEN_Y && y <= COURT.NEAR_KITCHEN_Y;
}

// Distance from a y to the nearest kitchen line for a given team's side.
export function distToOwnKitchenLine(team: "near" | "far", y: number): number {
  return team === "near" ? Math.abs(y - COURT.NEAR_KITCHEN_Y) : Math.abs(y - COURT.FAR_KITCHEN_Y);
}

// courtSide is TEAM-RELATIVE: "R" = the player's own right-hand service court,
// "L" = their own left. Because the far team faces the camera, its right court
// is on the LEFT of the screen (low global x). Convert to a GLOBAL side here so
// the rest of the sim/render can reason in shared global x.
//   near "R" -> global right (x>10)   near "L" -> global left (x<10)
//   far  "R" -> global left  (x<10)   far  "L" -> global right (x>10)
export function isGlobalRight(team: "near" | "far", side: CourtSideT): boolean {
  return (team === "near") === (side === "R");
}

// The diagonal service box a serve must land in.
// serverSide = the serving player's TEAM-RELATIVE court side (L/R). Serves go
// cross-court, so the ball lands in the receiver's diagonally-opposite box.
// Returns the rectangle (in GLOBAL logical coords) of the target service box on
// the RECEIVING side, EXCLUDING the kitchen (serve must clear the kitchen line).
export function serviceBoxFor(servingTeam: "near" | "far", serverSide: CourtSideT) {
  const receivingIsFar = servingTeam === "near";
  // y-range: from the receiving baseline to the receiving kitchen line
  // (kitchen line itself is a fault on the serve → exclude it).
  const yLo = receivingIsFar ? COURT.BASELINE_FAR_Y : COURT.NEAR_KITCHEN_Y;
  const yHi = receivingIsFar ? COURT.FAR_KITCHEN_Y : COURT.BASELINE_NEAR_Y;
  // x-range: cross-court. The serve leaves the server's global half and lands in
  // the diagonally-opposite (mirrored) global half on the receiving side.
  const serverGlobalRight = isGlobalRight(servingTeam, serverSide);
  const targetGlobalRight = !serverGlobalRight;
  let xLo: number, xHi: number;
  if (targetGlobalRight) {
    xLo = COURT.CENTER_X;
    xHi = COURT.WIDTH;
  } else {
    xLo = 0;
    xHi = COURT.CENTER_X;
  }
  return { xLo, xHi, yLo, yHi };
}

export type CourtSideT = "L" | "R";
