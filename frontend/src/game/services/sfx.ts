// Low-latency hit/bounce sound service.
//
// Placeholder SFX supplied by the user (mono WAVs, trimmed — never re-encoded).
//   • Preload at match start; report readiness.
//   • Exactly ONE sound per real CONTACT (incl. net/long/wide mishits — a paddle
//     sound is tied to physical paddle-ball contact, not whether the shot is in).
//   • Exactly ONE sound per real BOUNCE (separate event type; quieter; volume
//     scales with impact speed).
//   • Overlap-safe with the MINIMUM pool: 2 players per file (16 total). Each
//     player re-arms (seekTo 0) the instant it finishes, so it is already
//     rewound before it is needed — no seek/play race on Android, no cut-offs.
//   • Variants alternate. Mute toggle (persisted).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

import type { BounceEvent, ContactEvent } from "../sim/types";

type SetKey = "pop" | "drive" | "kitchen_soft" | "kitchen_bright";

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
const POOL = 2; // players per file → clean overlap with minimum instances (16)
const MUTE_KEY = "pw.sfx.muted";

// Easy-to-swap mapping (owner will confirm paddle vs bounce by ear).
const CONTACT_SOFT_SET: SetKey = "kitchen_bright"; // soft paddle (dink/drop) contact
const BOUNCE_SET: SetKey = "kitchen_soft"; // ball bounce on the court

// CONTACT → set. Normal paddle = pop; strong drive/smash = drive; soft shots use
// the "soft" kitchen set.
function contactSet(shotType: ContactEvent["shotType"], power: number): SetKey {
  switch (shotType) {
    case "dink":
    case "drop":
      return CONTACT_SOFT_SET;
    case "smash":
      return "drive";
    case "drive":
      return power > 0.55 ? "drive" : "pop";
    default:
      return "pop";
  }
}

interface Voice {
  player: AudioPlayer;
  busy: boolean;
}

class Sfx {
  private voices: Record<SetKey, Voice[][]> = {} as any; // [variant][poolIdx]
  private rr: Record<SetKey, number[]> = {} as any;
  private variant: Record<SetKey, number> = {} as any;
  private _ready = false;
  private _muted = false;
  lastLatencyMs = 0;
  playedCount = 0; // dev: total sounds actually triggered

  get ready() {
    return this._ready;
  }

  async preload() {
    if (this._ready) return;
    try {
      const saved = await AsyncStorage.getItem(MUTE_KEY);
      this._muted = saved === "1";
      await setAudioModeAsync({
        playsInSilentMode: true,
        interruptionModeAndroid: "doNotMix",
        shouldRouteThroughEarpiece: false,
      });
      for (const key of SET_KEYS) {
        this.voices[key] = FILES[key].map((src) =>
          Array.from({ length: POOL }, () => {
            const player = createAudioPlayer(src);
            const voice: Voice = { player, busy: false };
            // Re-arm as soon as playback finishes: rewind now so the next play()
            // can fire immediately (no seek/play race, especially on Android).
            player.addListener("playbackStatusUpdate", (s: any) => {
              if (s?.didJustFinish) {
                voice.busy = false;
                try {
                  player.seekTo(0);
                } catch {}
              }
            });
            return voice;
          }),
        );
        this.rr[key] = FILES[key].map(() => 0);
        this.variant[key] = 0;
      }
      this._ready = true;
      console.log("[sfx] ready — 16 players preloaded");
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

  // Pick an idle (already-rewound) voice for the set's current variant; fall
  // back to round-robin with an explicit rewind if all are busy.
  private fire(set: SetKey, volume: number) {
    if (!this._ready || this._muted) return;
    const v = this.variant[set];
    this.variant[set] = 1 - v; // alternate variants each hit
    const pool = this.voices[set][v];
    let voice = pool.find((x) => !x.busy);
    if (!voice) {
      const idx = this.rr[set][v];
      this.rr[set][v] = (idx + 1) % pool.length;
      voice = pool[idx];
      try {
        voice.player.seekTo(0);
      } catch {}
    }
    voice.busy = true;
    try {
      voice.player.volume = volume;
      voice.player.play();
      this.playedCount++;
    } catch {
      voice.busy = false;
    }
  }

  // One sound per real contact — mishits included (do NOT suppress on miss).
  playForContact(ev: ContactEvent) {
    const start = now();
    this.fire(contactSet(ev.shotType, ev.power), 1);
    if (__DEV__) this.lastLatencyMs = now() - start;
  }

  // One sound per real bounce — quieter, scaled by impact speed.
  playForBounce(ev: BounceEvent) {
    const vol = Math.max(0.15, Math.min(0.6, 0.15 + ev.speed / 40));
    this.fire(BOUNCE_SET, vol);
  }

  teardown() {
    if (!this._ready) return;
    for (const key of SET_KEYS)
      for (const pool of this.voices[key])
        for (const v of pool) {
          try {
            v.player.remove();
          } catch {}
        }
    this._ready = false;
    this.voices = {} as any;
  }
}

function now(): number {
  const g: any = globalThis as any;
  return g.performance?.now ? g.performance.now() : Date.now();
}

export const sfx = new Sfx();
export const SFX_AVAILABLE = Platform.OS !== "web";
