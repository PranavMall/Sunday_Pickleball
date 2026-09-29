import React, { useMemo } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { Canvas, Path, Circle, Oval, Group, Skia } from "@shopify/react-native-skia";

import { COURT, netHeightAt } from "../config/court";
import type { GameSimulation } from "../sim/GameSimulation";
import { IMAGE_H, IMAGE_W, type Projector } from "../render/perspective";
import { useTheme } from "@/src/theme";

const courtImg = require("@/assets/images/court_background.webp");

interface Props {
  sim: GameSimulation;
  projector: Projector;
  width: number;
  height: number;
  frame: number; // bump to force re-render each simulation tick
}

// PerspectiveRenderer: projects logical court coordinates onto the painted
// court. Code-drawn lines/kitchen/net sit at the OFFICIAL projected positions
// so what the player sees always matches RuleManager. z (height) reads as a
// depth-scaled screen offset so the ball and its shadow separate as it rises.
export function GameCanvas({ sim, projector, width, height }: Props) {
  const { colors } = useTheme();

  const seg = (
    pts: [number, number][],
  ) => {
    const p = Skia.Path.Make();
    const a = projector.ground(pts[0][0], pts[0][1]);
    p.moveTo(a.x, a.y);
    for (let i = 1; i < pts.length; i++) {
      const b = projector.ground(pts[i][0], pts[i][1]);
      p.lineTo(b.x, b.y);
    }
    return p;
  };

  // Court line paths (official positions).
  const lines = useMemo(() => {
    const W = COURT.WIDTH;
    const boundary = Skia.Path.Make();
    const c0 = projector.ground(0, 0);
    boundary.moveTo(c0.x, c0.y);
    [[W, 0], [W, COURT.LENGTH], [0, COURT.LENGTH], [0, 0]].forEach(([x, y]) => {
      const q = projector.ground(x, y);
      boundary.lineTo(q.x, q.y);
    });
    const kitchen = Skia.Path.Make();
    const kf = seg([[0, COURT.FAR_KITCHEN_Y], [W, COURT.FAR_KITCHEN_Y]]);
    const kn = seg([[0, COURT.NEAR_KITCHEN_Y], [W, COURT.NEAR_KITCHEN_Y]]);
    kitchen.addPath(kf);
    kitchen.addPath(kn);
    // Centre line: only from each kitchen line to the baseline.
    const center = Skia.Path.Make();
    center.addPath(seg([[W / 2, 0], [W / 2, COURT.FAR_KITCHEN_Y]]));
    center.addPath(seg([[W / 2, COURT.NEAR_KITCHEN_Y], [W / 2, COURT.LENGTH]]));
    return { boundary, kitchen, center };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projector]);

  // Kitchen fills (two trapezoids from net to each kitchen line).
  const kitchenFills = useMemo(() => {
    const W = COURT.WIDTH;
    const far = Skia.Path.Make();
    let q = projector.ground(0, COURT.FAR_KITCHEN_Y);
    far.moveTo(q.x, q.y);
    [[W, COURT.FAR_KITCHEN_Y], [W, COURT.NET_Y], [0, COURT.NET_Y]].forEach(([x, y]) => {
      const p = projector.ground(x, y);
      far.lineTo(p.x, p.y);
    });
    far.close();
    const near = Skia.Path.Make();
    q = projector.ground(0, COURT.NET_Y);
    near.moveTo(q.x, q.y);
    [[W, COURT.NET_Y], [W, COURT.NEAR_KITCHEN_Y], [0, COURT.NEAR_KITCHEN_Y]].forEach(([x, y]) => {
      const p = projector.ground(x, y);
      near.lineTo(p.x, p.y);
    });
    near.close();
    return { far, near };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projector]);

  // Net band (mesh) + tape + posts.
  const net = useMemo(() => {
    const ppf = projector.pxPerFootAt(COURT.NET_Y);
    const band = Skia.Path.Make();
    const bl = projector.ground(0, COURT.NET_Y);
    const br = projector.ground(COURT.WIDTH, COURT.NET_Y);
    const hSide = netHeightAt(0) * ppf * 0.82;
    const hCenter = netHeightAt(COURT.CENTER_X) * ppf * 0.82;
    const cm = projector.ground(COURT.CENTER_X, COURT.NET_Y);
    band.moveTo(bl.x, bl.y);
    band.lineTo(br.x, br.y);
    band.lineTo(br.x, br.y - hSide);
    band.quadTo(cm.x, cm.y - hCenter, bl.x, bl.y - hSide);
    band.close();
    const tape = Skia.Path.Make();
    tape.moveTo(bl.x, bl.y - hSide);
    tape.quadTo(cm.x, cm.y - hCenter, br.x, br.y - hSide);
    return { band, tape, bl, br, hSide };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projector]);

  const flash = sim.messages.find((m) => m.color === "error");

  const drawPlayer = (slot: number) => {
    const p = sim.players[slot];
    const g = projector.ground(p.x, p.y);
    const ppf = projector.pxPerFootAt(p.y);
    const scale = ppf * 0.9;
    const bodyH = scale * 2.6;
    const bodyW = scale * 1.05;
    const headR = scale * 0.62;
    const color = p.colorKey === "teamYou" ? colors.teamYou : p.colorKey === "teamPartner" ? colors.teamPartner : colors.teamRival;
    const feetY = g.y;
    const bodyTop = feetY - bodyH;
    const capsule = Skia.Path.Make();
    capsule.addRRect(Skia.RRectXY(Skia.XYWHRect(g.x - bodyW / 2, bodyTop + headR, bodyW, bodyH - headR), bodyW / 2, bodyW / 2));
    // swing offset for paddle
    const swinging = sim.time - p.swingCue < 0.25;
    const paddleR = scale * 0.5;
    const side = p.team === "near" ? -1 : 1;
    const isGlobalRight = (p.team === "near") === (p.courtSide === "R");
    const px = g.x + (isGlobalRight ? 1 : -1) * bodyW * 0.7;
    const py = bodyTop + headR + (swinging ? -scale * 0.6 : scale * 0.2);
    return (
      <Group key={slot}>
        <Oval rect={Skia.XYWHRect(g.x - bodyW * 0.7, feetY - scale * 0.25, bodyW * 1.4, scale * 0.5)} color={colors.ballShadow} opacity={0.28} />
        <Path path={capsule} color={color} />
        <Circle cx={g.x} cy={bodyTop + headR * 0.6} r={headR} color={color} />
        <Circle cx={g.x} cy={bodyTop + headR * 0.6} r={headR} style="stroke" strokeWidth={scale * 0.12} color={colors.onSurface} opacity={0.25} />
        <Circle cx={px} cy={py + side * scale * 0.4} r={paddleR} color={colors.accentGold} />
      </Group>
    );
  };

  const drawBall = () => {
    const b = sim.ball;
    if (!b.inPlay) return null;
    const g = projector.ground(b.x, b.y);
    const proj = projector.project(b.x, b.y, b.z);
    const ppf = projector.pxPerFootAt(b.y);
    const r = Math.max(3, ppf * 0.35);
    const shadowR = r * (1 + b.z * 0.04);
    const trail = Skia.Path.Make();
    b.trail.forEach((t, i) => {
      const tp = projector.project(t.x, t.y, t.z);
      if (i === 0) trail.moveTo(tp.x, tp.y);
      else trail.lineTo(tp.x, tp.y);
    });
    return (
      <Group>
        <Oval rect={Skia.XYWHRect(g.x - shadowR, g.y - shadowR * 0.4, shadowR * 2, shadowR * 0.8)} color={colors.ballShadow} opacity={Math.max(0.12, 0.4 - b.z * 0.02)} />
        <Path path={trail} style="stroke" strokeWidth={r * 0.9} color={colors.ballColor} opacity={0.25} />
        <Circle cx={proj.x} cy={proj.y} r={r} color={colors.ballColor} />
        <Circle cx={proj.x} cy={proj.y} r={r} style="stroke" strokeWidth={1} color="#C9B400" opacity={0.7} />
        <Circle cx={proj.x - r * 0.3} cy={proj.y} r={r * 0.14} color="#C9B400" opacity={0.6} />
        <Circle cx={proj.x + r * 0.35} cy={proj.y - r * 0.2} r={r * 0.12} color="#C9B400" opacity={0.5} />
      </Group>
    );
  };

  const farPlayers = sim.players.filter((p) => p.team === "far").map((p) => p.slot);
  const nearPlayers = sim.players.filter((p) => p.team === "near").map((p) => p.slot);
  const ballFar = sim.ball.y < COURT.NET_Y;

  return (
    <View style={{ width, height }}>
      {/* Painted court as a background layer (expo-image reliably decodes the
          bundled asset on Expo Go, unlike Skia's image loader). It uses the
          SAME projector scale/offset so it stays pixel-aligned with the
          code-drawn lines rendered by the transparent Skia canvas above. */}
      <Image
        source={courtImg}
        style={{
          position: "absolute",
          left: projector.offsetX,
          top: projector.offsetY,
          width: IMAGE_W * projector.scale,
          height: IMAGE_H * projector.scale,
        }}
        contentFit="fill"
        onError={(e) => console.warn("[court] background image failed to load", e)}
      />
      <Canvas style={{ width, height, backgroundColor: "transparent" }}>
        {/* Kitchen fills (own drawable layer, can flash) */}
        <Path path={kitchenFills.far} color={flash ? colors.kitchenFlash : colors.kitchenFill} opacity={flash ? 0.35 : 0.16} />
        <Path path={kitchenFills.near} color={flash ? colors.kitchenFlash : colors.kitchenFill} opacity={flash ? 0.35 : 0.16} />

        {/* Code-drawn lines */}
        <Path path={lines.boundary} style="stroke" strokeWidth={3.2} color={colors.courtLine} opacity={0.9} />
        <Path path={lines.center} style="stroke" strokeWidth={2.4} color={colors.courtLine} opacity={0.85} />
        <Path path={lines.kitchen} style="stroke" strokeWidth={2.6} color={colors.courtLine} opacity={0.9} />

        {/* Far team behind the net */}
        {farPlayers.map(drawPlayer)}
        {ballFar && drawBall()}

        {/* Net */}
        <Path path={net.band} color={colors.netColor} opacity={0.42} />
        <Path path={net.tape} style="stroke" strokeWidth={3} color={colors.courtLine} />
        <Circle cx={net.bl.x} cy={net.bl.y - net.hSide} r={4} color={colors.netPost} />
        <Circle cx={net.br.x} cy={net.br.y - net.hSide} r={4} color={colors.netPost} />

        {/* Near team in front of the net */}
        {nearPlayers.map(drawPlayer)}
        {!ballFar && drawBall()}
      </Canvas>
    </View>
  );
}
