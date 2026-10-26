// ONE persistent destination background behind the Stack (root layout).
// Home / Training / Quick Play → bg_home; Career / Team → bg_career_mumbai.
// A change of background is a 200 ms cross-fade inside this single image;
// moving between two screens that share a background changes nothing.
// Profile / history cover it with their own opaque view; on /match it renders nothing.
import { Image } from "expo-image";
import { usePathname } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Image as RNImage, StyleSheet } from "react-native";

const BG_HOME = require("@/assets/images/bg_home.webp");
const BG_CAREER = require("@/assets/images/bg_career_mumbai.webp");

const BY_PATH: Record<string, number> = {
  "/": BG_HOME,
  "/training": BG_HOME,
  "/quickplay": BG_HOME,
  "/career": BG_CAREER,
  "/team": BG_CAREER,
};

export function DestinationBackdrop() {
  const pathname = usePathname();
  const last = useRef<number>(BG_HOME);
  if (BY_PATH[pathname] !== undefined) last.current = BY_PATH[pathname];

  // Prefetch both backgrounds into memory at app start (while Home shows).
  useEffect(() => {
    try {
      const uris = [BG_HOME, BG_CAREER].map((m) => RNImage.resolveAssetSource(m)?.uri).filter(Boolean) as string[];
      if (uris.length) Image.prefetch(uris, "memory-disk").catch(() => {});
    } catch {
      // resolveAssetSource unavailable (web): the first render decodes it.
    }
  }, []);

  // In a match nothing is drawn behind the court: the image is released from
  // the view tree and comes back from the memory cache on leaving.
  if (pathname === "/match") return null;
  return <Image source={last.current} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={200} testID="destination-backdrop" />;
}
