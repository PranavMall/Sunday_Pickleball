import React from "react";
import { Circle, Group, Oval, Path, Skia } from "@shopify/react-native-skia";

// LAYERED CHARACTER CONTRACT (roadmap §11, structure only — no art yet).
//
// A character is a stack of independent LAYERS on a shared rig, composited in
// Skia. Real sprite sheets will drop into exactly these slots later (see
// /app/SPRITE_BRIEF.md). For Part A every player is drawn with PLACEHOLDER
// shapes routed THROUGH this same layer system, so swapping in art is a pure
// asset change — no renderer rewrite.

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

// Near-court players are seen from BEHIND; far-court players from the FRONT.
export type CharacterView = "front" | "back";

export interface CharacterColors {
  primary: string; // top / shirt
  bottom: string; // shorts
  skin: string;
  hair: string;
  shoes: string;
  paddle: string;
}

// Rig anchor point = the player's FEET in screen space, plus a uniform scale
// (screen px per logical foot) so every layer sizes consistently.
export interface CharacterGeom {
  x: number; // feet x (screen px)
  feetY: number; // feet y (screen px)
  scale: number; // px per logical foot (already depth-scaled)
  globalRight: boolean; // which side the paddle hand is on
}

// Animation phases 0..1 (Part A supplies wind-up + follow-through only; full
// game-feel — squash/stretch, reactions, smooth walk — arrives in Part B).
export interface CharacterAnim {
  windUp: number; // anticipation (swipe accepted, pre-contact)
  swing: number; // follow-through (just after real contact)
}

interface Props {
  geom: CharacterGeom;
  colors: CharacterColors;
  view: CharacterView;
  anim: CharacterAnim;
}

// Placeholder character rendered through the layer contract. Each `case` is a
// stand-in for a future sprite layer at the same anchor.
export function Character({ geom, colors, view, anim }: Props) {
  const { x, feetY, scale, globalRight } = geom;
  const bodyH = scale * 2.6;
  const bodyW = scale * 1.05;
  const headR = scale * 0.62;
  const bodyTop = feetY - bodyH;
  const torsoTop = bodyTop + headR;
  const legsTop = feetY - bodyH * 0.42;

  // Paddle hand: raised on wind-up, swept across on follow-through.
  const handSide = globalRight ? 1 : -1;
  const paddleR = scale * 0.5;
  const reachUp = Math.max(anim.windUp, anim.swing);
  const px = x + handSide * bodyW * (0.7 + anim.swing * 0.5);
  const py = torsoTop + headR * 0.3 - reachUp * scale * 0.9;

  const layer = (id: CharacterLayerId): React.ReactNode => {
    switch (id) {
      case "shoes":
        return (
          <Group key={id}>
            <Oval rect={Skia.XYWHRect(x - bodyW * 0.55, feetY - scale * 0.18, bodyW * 0.5, scale * 0.3)} color={colors.shoes} />
            <Oval rect={Skia.XYWHRect(x + bodyW * 0.05, feetY - scale * 0.18, bodyW * 0.5, scale * 0.3)} color={colors.shoes} />
          </Group>
        );
      case "bottom": {
        const p = Skia.Path.Make();
        p.addRRect(Skia.RRectXY(Skia.XYWHRect(x - bodyW / 2, legsTop, bodyW, bodyH * 0.42), bodyW * 0.3, bodyW * 0.3));
        return <Path key={id} path={p} color={colors.bottom} />;
      }
      case "top": {
        const p = Skia.Path.Make();
        const h = legsTop - torsoTop + scale * 0.2;
        const r = Math.min(bodyW, h) * 0.49; // strictly < half of the smaller side
        p.addRRect(Skia.RRectXY(Skia.XYWHRect(x - bodyW / 2, torsoTop, bodyW, h), r, r));
        return <Path key={id} path={p} color={colors.primary} />;
      }
      case "wristAccessory":
        return <Circle key={id} cx={px} cy={py + scale * 0.12} r={scale * 0.14} color={colors.bottom} opacity={0.9} />;
      case "paddle":
        return (
          <Group key={id}>
            <Path
              key="shaft"
              path={(() => {
                const s = Skia.Path.Make();
                s.moveTo(x + handSide * bodyW * 0.4, torsoTop + headR * 0.6);
                s.lineTo(px, py);
                return s;
              })()}
              style="stroke"
              strokeWidth={scale * 0.14}
              color={colors.skin}
            />
            <Circle cx={px} cy={py} r={paddleR} color={colors.paddle} />
          </Group>
        );
      case "body":
        return <Circle key={id} cx={x} cy={bodyTop + headR * 0.6} r={headR} color={colors.skin} />;
      case "hair":
        return (
          <Path
            key={id}
            path={(() => {
              const h = Skia.Path.Make();
              h.addArc(Skia.XYWHRect(x - headR, bodyTop, headR * 2, headR * 1.3), 180, 180);
              return h;
            })()}
            color={colors.hair}
          />
        );
      case "headAccessory":
        // Front view shows a tiny visor line; back view shows a cap band.
        return (
          <Path
            key={id}
            path={(() => {
              const b = Skia.Path.Make();
              const y = bodyTop + headR * (view === "front" ? 0.45 : 0.35);
              b.moveTo(x - headR, y);
              b.lineTo(x + headR, y);
              return b;
            })()}
            style="stroke"
            strokeWidth={scale * 0.12}
            color={colors.primary}
            opacity={0.8}
          />
        );
    }
  };

  return <Group>{CHAR_LAYER_ORDER.map((id) => layer(id))}</Group>;
}
