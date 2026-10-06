import React from "react";
import { Circle, Group, Oval, Skia } from "@shopify/react-native-skia";

// LAYERED CHARACTER CONTRACT (roadmap §11, structure only — no art yet).
//
// A character is a stack of independent LAYERS on a shared rig. Real sprites
// drop into these slots later (see /app/SPRITE_BRIEF.md). The PLACEHOLDER
// implementation below is deliberately lightweight: it draws ONLY cheap Skia
// primitives (Circle / Oval) and allocates NO Skia Paths per frame, so it is
// cheap to redraw at 60fps on a real device. Visual complexity is not the point
// — the layer contract is.

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

// Placeholder rendered THROUGH the layer contract using only Circle/Oval.
export function Character({ geom, colors, view, anim }: Props) {
  const { x, feetY, scale, globalRight } = geom;
  const bodyH = scale * 2.4;
  const bodyW = scale * 1.05;
  const headR = scale * 0.6;
  const torsoCy = feetY - bodyH * 0.62;
  const legsCy = feetY - bodyH * 0.22;
  const headCy = feetY - bodyH + headR * 0.6;

  // Paddle hand: raised on wind-up, swept across on follow-through.
  const handSide = globalRight ? 1 : -1;
  const reachUp = Math.max(anim.windUp, anim.swing);
  const px = x + handSide * bodyW * (0.6 + anim.swing * 0.5);
  const py = torsoCy - scale * 0.2 - reachUp * scale * 0.9;

  const layer = (id: CharacterLayerId): React.ReactNode => {
    switch (id) {
      case "shoes":
        return (
          <Group key={id}>
            <Oval rect={Skia.XYWHRect(x - bodyW * 0.5, feetY - scale * 0.16, bodyW * 0.45, scale * 0.28)} color={colors.shoes} />
            <Oval rect={Skia.XYWHRect(x + bodyW * 0.05, feetY - scale * 0.16, bodyW * 0.45, scale * 0.28)} color={colors.shoes} />
          </Group>
        );
      case "bottom":
        return <Oval key={id} rect={Skia.XYWHRect(x - bodyW / 2, legsCy - bodyH * 0.18, bodyW, bodyH * 0.4)} color={colors.bottom} />;
      case "top":
        return <Oval key={id} rect={Skia.XYWHRect(x - bodyW / 2, torsoCy - bodyH * 0.22, bodyW, bodyH * 0.5)} color={colors.primary} />;
      case "wristAccessory":
        return <Circle key={id} cx={px} cy={py + scale * 0.12} r={scale * 0.13} color={colors.bottom} />;
      case "paddle":
        return <Circle key={id} cx={px} cy={py} r={scale * 0.5} color={colors.paddle} />;
      case "body":
        return <Circle key={id} cx={x} cy={headCy} r={headR} color={colors.skin} />;
      case "hair":
        return <Circle key={id} cx={x} cy={headCy - headR * 0.35} r={headR * 0.82} color={colors.hair} />;
      case "headAccessory":
        // Front view = small visor dot; back view = cap band (one Oval).
        return (
          <Oval
            key={id}
            rect={Skia.XYWHRect(x - headR * 0.8, headCy - headR * (view === "front" ? 0.1 : 0.5), headR * 1.6, headR * 0.3)}
            color={colors.primary}
            opacity={0.85}
          />
        );
    }
  };

  return <Group>{CHAR_LAYER_ORDER.map((id) => layer(id))}</Group>;
}
