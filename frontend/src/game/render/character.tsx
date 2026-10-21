import React from "react";
import { Circle, Group, Oval } from "@shopify/react-native-skia";

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
  follow?: number; // 0..1 late follow-through (paddle finishes across the body)
  hop?: number; // px the whole figure lifts (celebration hop)
  slump?: number; // 0..1 frustration (head drops, shoulders sag)
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
  const { x: x0, scale, globalRight } = geom;
  const feetY = geom.feetY - (anim.hop ?? 0);
  const slump = anim.slump ?? 0;
  const follow = anim.follow ?? 0;
  const handSide = globalRight ? 1 : -1;
  // Body leans into the swing, then back through the follow-through.
  const x = x0 + handSide * scale * 0.18 * (anim.swing - follow * 0.8);
  const bodyH = scale * 2.4 * (1 - slump * 0.08);
  const bodyW = scale * 1.05;
  const headR = scale * 0.6;
  const bodyCy = feetY - bodyH * 0.45;
  const headCy = feetY - bodyH + headR * 0.6 + slump * scale * 0.35;

  // Paddle hand: raised on wind-up, swept across on swing (approved), then
  // finishes ACROSS the body on the follow-through.
  const reachUp = Math.max(anim.windUp, anim.swing);
  const px = x + handSide * bodyW * (0.6 + anim.swing * 0.5 - follow * 1.3);
  const py = bodyCy - scale * 0.2 - reachUp * scale * 0.9 - follow * scale * 0.5 + slump * scale * 0.4;

  return (
    <Group>
      {/* body capsule (tall ellipse) — x/y/size props, no per-frame rect object */}
      <Oval x={x - bodyW / 2} y={feetY - bodyH * 0.82} width={bodyW} height={bodyH * 0.82} color={colors.primary} />
      {/* head */}
      <Circle cx={x} cy={headCy} r={headR} color={colors.skin} />
      {/* paddle */}
      <Circle cx={px} cy={py} r={scale * 0.5} color={colors.paddle} />
    </Group>
  );
}
