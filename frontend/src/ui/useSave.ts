// Screen-level read hooks for the save + identity. Read on focus only (never
// during a rally); mutations go through the MetaStore and then refresh().
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { initMeta, meta } from "@/src/game/meta";
import type { SaveDoc } from "@/src/game/meta/metaStore";
import { getIdentity, type Identity } from "@/src/game/services/profile";

export function useSave(): { save: SaveDoc | null; identity: Identity | null; refresh: () => void } {
  const [save, setSave] = useState<SaveDoc | null>(meta.loaded ? (structuredCloneSafe(meta.doc) as SaveDoc) : null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const refresh = useCallback(() => {
    let alive = true;
    initMeta().then(() => alive && setSave(structuredCloneSafe(meta.doc) as SaveDoc));
    getIdentity().then((id) => alive && setIdentity(id));
    return () => {
      alive = false;
    };
  }, []);
  useFocusEffect(refresh);
  return { save, identity, refresh: () => void refresh() };
}

function structuredCloneSafe<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function formLabel(form: string | undefined): string {
  return form === "hot" ? "HOT" : form === "cold" ? "COLD" : "–";
}
