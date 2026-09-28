import React from "react";
import { Platform, Text, View } from "react-native";

import type { GameSimulation } from "../sim/GameSimulation";
import type { Projector } from "./perspective";

export interface CourtRendererProps {
  sim: GameSimulation;
  projector: Projector;
  width: number;
  height: number;
  frame: number;
}

// On native, Skia is ready immediately — render the canvas directly. On web,
// the CanvasKit WASM must load first, so we use WithSkiaWeb which only mounts
// the canvas module once Skia is initialised. (The native build is
// authoritative; this keeps the browser preview/beta working cleanly.)
export function CourtRenderer(props: CourtRendererProps) {
  if (Platform.OS !== "web") {
    const { GameCanvas } = require("./GameCanvas");
    return <GameCanvas {...props} />;
  }
  return <WebCanvas {...props} />;
}

function WebCanvas(props: CourtRendererProps) {
  const [Comp, setComp] = React.useState<React.ComponentType<CourtRendererProps> | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const web = await import("@shopify/react-native-skia/lib/module/web");
        await web.LoadSkiaWeb({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/canvaskit-wasm@0.41.0/bin/full/${file}`,
        });
        const mod = await import("./GameCanvas");
        if (alive) setComp(() => mod.GameCanvas);
      } catch (e) {
        console.warn("Skia web load failed", e);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!Comp) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#2E3D2A" }}>
        <Text style={{ color: "#FBF6E9", fontSize: 16, opacity: 0.85 }}>Loading court…</Text>
      </View>
    );
  }
  return <Comp {...props} />;
}
