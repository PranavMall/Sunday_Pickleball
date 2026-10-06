import React from "react";
import { Circle, Group, Oval, Skia } from "@shopify/react-native-skia";

// LAYERED CHARACTER CONTRACT (roadmap §11, structure only — no art yet).
//
// A character is a stack of independent LAYERS on a shared rig (see
// CHAR_LAYER_ORDER below). Real sprites drop into these slots later (see
// /app/SPRITE_BRIEF.md). The layer DEFINITIONS/CONTRACT are kept intact for that
// future work. The PLACEHOLDER implementation below is intentionally MINIMAL —
// roughly the M1.2 render complexity: a body capsule, a head and a paddle only
// (the depth-scaled court shadow is drawn by GameCanvas). It uses only cheap
// Skia primitives (Circle / Oval) and allocates NO Skia Paths per frame, so it
// is cheap to redraw at 60fps. The per-garment/accessory layers are NOT each
// drawn as separate placeholder geometry during development.

export type CharacterLayerId =
  | "shoes"
  | "bottom"
  | "top"
  | "wristAccessory"
  | "paddle"
  | "body"
  | "hair"
  | "headAccessory";

// Draw order, far (feet) to near (head). Sprite frames must honour this.
export const CHAR_LAYER_ORDER: CharacterLayerId[] = [
  "shoes",
  "bottom",
  "top",
  "wristAccessory",
  "paddle",
  "body",
  "hair",
  "headAccessory",
];

export type CharacterView = "front" | "back";

export interface CharacterColors {
  primary: string;
  bottom: string;
  skin: string;
  hair: string;
  shoes: string;
  paddle: string;
}

// Rig anchor = the player's FEET in screen space + a uniform depth-scaled size.
export interface CharacterGeom {
  x: number;
  feetY: number;
  scale: number; // px per logical foot (depth-scaled)
  globalRight: boolean;
}

export interface CharacterAnim {
  windUp: number; // 0..1 anticipation (swipe accepted)
  swing: number; // 0..1 follow-through (just after contact)
}

interface Props {
  geom: CharacterGeom;
  colors: CharacterColors;
  view: CharacterView;
  anim: CharacterAnim;
}

// Placeholder rendered through the layer contract but intentionally LIGHTWEIGHT
// (~M1.2 complexity): body capsule + head + paddle. The court shadow is drawn by
// GameCanvas. The approved wind-up / swing paddle motion is preserved.
export function Character({ geom, colors, anim }: Props) {
  const { x, feetY, scale, globalRight } = geom;
  const bodyH = scale * 2.4;
  const bodyW = scale * 1.05;
  const headR = scale * 0.6;
  const bodyCy = feetY - bodyH * 0.45;
  const headCy = feetY - bodyH + headR * 0.6;

  // Paddle hand: raised on wind-up, swept across on follow-through (approved).
  const handSide = globalRight ? 1 : -1;
  const reachUp = Math.max(anim.windUp, anim.swing);
  const px = x + handSide * bodyW * (0.6 + anim.swing * 0.5);
  const py = bodyCy - scale * 0.2 - reachUp * scale * 0.9;

  return (
    <Group>
      {/* body capsule (tall ellipse) */}
      <Oval rect={Skia.XYWHRect(x - bodyW / 2, feetY - bodyH * 0.82, bodyW, bodyH * 0.82)} color={colors.primary} />
      {/* head */}
      <Circle cx={x} cy={headCy} r={headR} color={colors.skin} />
      {/* paddle */}
      <Circle cx={px} cy={py} r={scale * 0.5} color={colors.paddle} />
    </Group>
  );
}
