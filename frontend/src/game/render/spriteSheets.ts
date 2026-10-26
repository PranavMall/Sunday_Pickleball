// SPRITE SHEET LOADER. Skia's useImage(require(...)) does not decode bundled
// assets in Expo Go, so sheets go through expo-asset: download → local file
// URI → Skia.Data → SkImage. Each sheet is decoded once and cached for the
// session. The status is shown in the DEV overlay so a failure is never silent.
import { Asset } from "expo-asset";
import { Skia, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useState } from "react";

import { spriteLoadStatus } from "./sprites";

const cache = new Map<number, SkImage>();
const pending = new Map<number, Promise<SkImage>>();


function loadSheet(mod: number): Promise<SkImage> {
  const hit = cache.get(mod);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(mod);
  if (!p) {
    p = (async () => {
      const asset = Asset.fromModule(mod);
      await asset.downloadAsync();
      const uri = asset.localUri ?? asset.uri;
      if (!uri) throw new Error("no asset uri");
      const data = await Skia.Data.fromURI(uri);
      const img = Skia.Image.MakeImageFromEncoded(data);
      if (!img) throw new Error(`decode failed (${uri.split("/").pop()})`);
      cache.set(mod, img);
      return img;
    })();
    pending.set(mod, p);
    p.catch(() => pending.delete(mod));
  }
  return p;
}

// Loads the given sheets (player + current partner). `done` turns true once
// every sheet has loaded or failed (failure → placeholder for that slot).
export function useSpriteSheets(a: number | undefined, b: number | undefined) {
  const [state, setState] = useState(() => ({ a: a ? cache.get(a) ?? null : null, b: b ? cache.get(b) ?? null : null, done: (!a || cache.has(a)) && (!b || cache.has(b)) }));
  useEffect(() => {
    let alive = true;
    const one = (m: number | undefined) => (m ? loadSheet(m) : Promise.resolve(null));
    Promise.allSettled([one(a), one(b)]).then(([ra, rb]) => {
      const errs = [ra, rb].filter((r): r is PromiseRejectedResult => r.status === "rejected").map((r) => String(r.reason?.message ?? r.reason));
      spriteLoadStatus.text = errs.length ? `sprites: failed – ${errs[0]}` : "sprites: loaded";
      if (errs.length) console.warn("[sprites]", errs.join("; "));
      if (alive) setState({ a: ra.status === "fulfilled" ? ra.value : null, b: rb.status === "fulfilled" ? rb.value : null, done: true });
    });
    return () => {
      alive = false;
    };
  }, [a, b]);
  return state;
}
