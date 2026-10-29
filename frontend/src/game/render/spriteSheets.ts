// SPRITE SHEET LOADER. Skia's useImage(require(...)) does not decode bundled
// assets in Expo Go, so sheets go through expo-asset: download → local file
// URI → Skia.Data → SkImage. Each sheet is decoded once and cached for the
// session. The status is shown in the DEV overlay so a failure is never silent.
import { Asset } from "expo-asset";
import { Skia, type SkImage } from "@shopify/react-native-skia";
import { useEffect, useMemo, useState } from "react";

import { CHARACTER_SHEETS, RIVAL_SHEETS, spriteLoadStatus } from "./sprites";

const modOf = (id: string | undefined): number | undefined => (id ? CHARACTER_SHEETS[id] ?? RIVAL_SHEETS[id] : undefined);

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

// A web load failure rejects with a DOM Event, not an Error.
const reasonText = (e: any): string => (e?.message ? String(e.message) : e?.type ? `load error (${e.type})` : String(e));

// Loads the match's sheets by id, in order: player, partner, rival 0, rival 1
// (absent ids → no sheet). `done` turns true once every sheet has loaded or
// failed; a failed sheet falls back to the placeholder for that slot only.
export function useSpriteSheets(ids: (string | undefined)[]) {
  const key = useMemo(() => ids.map((id) => id ?? "").join("|"), [ids]); // pass a memoised list
  const [state, setState] = useState(() => {
    const mods = ids.map(modOf);
    return { sheets: mods.map((m) => (m ? cache.get(m) ?? null : null)), done: mods.every((m) => !m || cache.has(m)) };
  });
  useEffect(() => {
    let alive = true;
    const list = key.split("|");
    const mods = list.map(modOf);
    spriteLoadStatus.text = "sprites: loading";
    Promise.allSettled(mods.map((m) => (m ? loadSheet(m) : Promise.resolve(null)))).then((rs) => {
      const errs: string[] = [];
      const names: string[] = [];
      rs.forEach((r, i) => {
        if (!mods[i]) return;
        const name = list[i].replace(/^rival_/, "");
        names.push(name);
        if (r.status === "rejected") errs.push(`${name}: ${reasonText(r.reason)}`);
      });
      spriteLoadStatus.text = errs.length ? `sprites: failed – ${errs.join("; ")}` : `sprites: loaded ${names.join(" + ")}`;
      if (errs.length) console.warn("[sprites]", errs.join("; "));
      if (alive) setState({ sheets: rs.map((r) => (r.status === "fulfilled" ? r.value : null)), done: true });
    });
    return () => {
      alive = false;
    };
  }, [key]);
  return state;
}
