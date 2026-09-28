import { COURT } from "../config/court";

// PerspectiveRenderer calibration.
//
// The painted court image is a plane seen in perspective, so a projective
// homography maps the logical court rectangle EXACTLY onto the painting. We fit
// the homography from the four painted baseline corners (measured from the
// 1024x1536 artwork), then apply a cover-fit image->screen transform.
//
// Measured painted court lines (pixel rows, verified from the artwork):
//   far baseline   y=527   far kitchen y=691   net y=755
//   near kitchen   y=906   near baseline y=1183
// Corners (px): FL(303,528) FR(731,528) NL(139,1186) NR(887,1186)
//
// IMPORTANT: in/out and kitchen decisions NEVER use these pixels. This file is
// visual-only. Where painted inner lines disagree with official proportions we
// draw thin code lines at the projected official positions (see GameCanvas).

export const IMAGE_W = 1024;
export const IMAGE_H = 1536;

// Painted outer court corners in image pixels.
// Logical unit-square corners map as: (u,v) with u=x/WIDTH, v=y/LENGTH.
//   (0,0) far-left, (1,0) far-right, (1,1) near-right, (0,1) near-left
const DST = [
  { x: 303, y: 528 }, // (0,0) FL far-left
  { x: 731, y: 528 }, // (1,0) FR far-right
  { x: 887, y: 1186 }, // (1,1) NR near-right
  { x: 139, y: 1186 }, // (0,1) NL near-left
];
const SRC = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

// Solve 3x3 homography H mapping SRC(unit square) -> DST(image px).
function solveHomography(
  src: { x: number; y: number }[],
  dst: { x: number; y: number }[],
): number[] {
  // Build 8x8 linear system for h = [h0..h7], h8 = 1.
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: X, y: Y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([X, Y, 1, 0, 0, 0, -u * X, -u * Y]);
    b.push(u);
    A.push([0, 0, 0, X, Y, 1, -v * X, -v * Y]);
    b.push(v);
  }
  const h = gaussianSolve(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function gaussianSolve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col] || 1e-9;
    for (let c = col; c <= n; c++) M[col][c] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row) => row[n]);
}

const H = solveHomography(SRC, DST);

// Project a logical court point (feet) to IMAGE pixel space.
function logicalToImage(x: number, y: number): { x: number; y: number } {
  const u = x / COURT.WIDTH;
  const v = y / COURT.LENGTH;
  const w = H[6] * u + H[7] * v + H[8];
  return {
    x: (H[0] * u + H[1] * v + H[2]) / w,
    y: (H[3] * u + H[4] * v + H[5]) / w,
  };
}

// Cover-fit transform from image space -> screen space for a given viewport.
export interface Projector {
  screenW: number;
  screenH: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  // ground projection (z ignored)
  ground(x: number, y: number): { x: number; y: number };
  // screen pixels per logical foot (horizontal) at depth y — used for height
  pxPerFootAt(y: number): number;
  // full projection with height z (ft)
  project(x: number, y: number, z: number): { x: number; y: number; groundY: number };
}

const ELEV_FACTOR = 0.82; // how much a foot of height reads as screen "up"

export function makeProjector(screenW: number, screenH: number): Projector {
  // Cover-fit: fill the whole screen, cropping outer scenery (never the court).
  const scale = Math.max(screenW / IMAGE_W, screenH / IMAGE_H);
  const offsetX = (screenW - IMAGE_W * scale) / 2;
  const offsetY = (screenH - IMAGE_H * scale) / 2;

  const ground = (x: number, y: number) => {
    const p = logicalToImage(x, y);
    return { x: p.x * scale + offsetX, y: p.y * scale + offsetY };
  };

  const pxPerFootAt = (y: number) => {
    const a = ground(0, y);
    const b = ground(COURT.WIDTH, y);
    return Math.abs(b.x - a.x) / COURT.WIDTH;
  };

  const project = (x: number, y: number, z: number) => {
    const g = ground(x, y);
    const elev = z * pxPerFootAt(y) * ELEV_FACTOR;
    return { x: g.x, y: g.y - elev, groundY: g.y };
  };

  return { screenW, screenH, scale, offsetX, offsetY, ground, pxPerFootAt, project };
}
