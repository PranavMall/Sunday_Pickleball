// Low-latency hit-sound service.
//
// Placeholder SFX supplied by the user (mono WAVs, trimmed to start within
// ~4 ms — we never re-encode them). Requirements implemented here:
//   • Preload every sound at match start (createAudioPlayer holds a decoded,
//     ready-to-play native player — the low-latency path for very short clips).
//   • Exactly ONE sound per real contact, fired on the contact frame by the
//     renderer draining ContactEvents (see match.tsx). Variants alternate.
//   • Overlap-safe: each variant has a small POOL of players used round-robin,
//     so a new hit never cuts off the previous one or builds up delay.
//   • Mute toggle (persisted), exposed in the pause menu.
//   • Dev latency probe: wall-clock from draining a contact event to the
//     native play() call (the JS contribution). True audio-output latency after
//     play() is OS/device dependent and must be confirmed on a real device.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

import type { ContactEvent } from "../sim/types";

type SetKey = "pop" | "drive" | "kitchen_soft" | "kitchen_bright";

// [variant0, variant1] per set.
const FILES: Record<SetKey, number[]> = {
  pop: [require("@/assets/audio/sfx_pop_1.wav"), require("@/assets/audio/sfx_pop_2.wav")],
  drive: [require("@/assets/audio/sfx_drive_1.wav"), require("@/assets/audio/sfx_drive_2.wav")],
  kitchen_soft: [
    require("@/assets/audio/sfx_kitchen_soft_1.wav"),
    require("@/assets/audio/sfx_kitchen_soft_2.wav"),
  ],
  kitchen_bright: [
    require("@/assets/audio/sfx_kitchen_bright_1.wav"),
    require("@/assets/audio/sfx_kitchen_bright_2.wav"),
  ],
};

const SET_KEYS: SetKey[] = ["pop", "drive", "kitchen_soft", "kitchen_bright"];
const POOL = 3; // players per variant (overlap headroom)
const MUTE_KEY = "pw.sfx.muted";

// Contact → sound mapping. Normal paddle = pop; strong drive/smash = drive;
// dinks = kitchen_soft (soft paddle); soft drops = kitchen_bright. The user will
// confirm soft/bright (paddle vs bounce) by ear — easy to swap here.
function pickSet(shotType: ContactEvent["shotType"], power: number): SetKey {
  switch (shotType) {
    case "dink":
      return "kitchen_soft";
    case "drop":
      return "kitchen_bright";
    case "smash":
      return "drive";
    case "drive":
      return power > 0.55 ? "drive" : "pop";
    case "serve":
    case "lob":
    default:
      return "pop";
  }
}

class Sfx {
  private players: Record<SetKey, AudioPlayer[][]> = {} as any; // [variant][poolIdx]
  private rr: Record<SetKey, number[]> = {} as any; // round-robin per variant
  private variant: Record<SetKey, number> = {} as any; // alternates 0/1
  private ready = false;
  private _muted = false;
  lastLatencyMs = 0; // dev: contact-drain → play() call

  async preload() {
    if (this.ready) return;
    try {
      const saved = await AsyncStorage.getItem(MUTE_KEY);
      this._muted = saved === "1";
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionModeAndroid: "doNotMix",
        shouldRouteThroughEarpiece: false,
      });
      for (const key of SET_KEYS) {
        this.players[key] = FILES[key].map((src) =>
          Array.from({ length: POOL }, () => createAudioPlayer(src)),
        );
        this.rr[key] = FILES[key].map(() => 0);
        this.variant[key] = 0;
      }
      this.ready = true;
    } catch (e) {
      console.warn("[sfx] preload failed", e);
    }
  }

  get muted() {
    return this._muted;
  }

  async setMuted(m: boolean) {
    this._muted = m;
    try {
      await AsyncStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {}
  }

  async toggleMuted() {
    await this.setMuted(!this._muted);
    return this._muted;
  }

  // Fire a single contact sound (alternating variant, round-robin pool player).
  playForContact(ev: ContactEvent) {
    if (!this.ready || this._muted || ev.miss) return;
    const start = now();
    const set = pickSet(ev.shotType, ev.power);
    const v = this.variant[set];
    this.variant[set] = 1 - v; // alternate variants each hit
    const pool = this.players[set][v];
    const idx = this.rr[set][v];
    this.rr[set][v] = (idx + 1) % pool.length;
    const p = pool[idx];
    try {
      p.seekTo(0);
      p.volume = 1;
      p.play();
    } catch {}
    if (__DEV__) this.lastLatencyMs = now() - start;
  }

  teardown() {
    if (!this.ready) return;
    for (const key of SET_KEYS) {
      for (const pool of this.players[key]) for (const p of pool) {
        try {
          p.remove();
        } catch {}
      }
    }
    this.ready = false;
    this.players = {} as any;
  }
}

function now(): number {
  const g: any = globalThis as any;
  return g.performance?.now ? g.performance.now() : Date.now();
}

export const sfx = new Sfx();
export const SFX_AVAILABLE = Platform.OS !== "web"; // decodes on native reliably
