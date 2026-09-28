// Future-facing service INTERFACES (stubs only). Keeping INPUT / SIMULATION /
// RENDERING / NETWORK transport separate so online play, profiles, progression
// and purchases can be added later without touching the simulation.

import type { ControllerType } from "../sim/types";

// ---- NetworkService (online play, later) ----------------------------------
export interface NetworkService {
  isConnected(): boolean;
  // A future authoritative transport would send/receive input frames per slot.
  sendInput(frame: number, slot: number, payload: unknown): void;
  onRemoteInput(cb: (frame: number, slot: number, payload: unknown) => void): void;
}

export const networkService: NetworkService = {
  isConnected: () => false,
  sendInput: () => {},
  onRemoteInput: () => {},
};

// ---- ProfileService (anonymous now, accounts later) -----------------------
export interface ProfileService {
  getAnonymousId(): Promise<string>;
  getNickname(): Promise<string | null>;
  setNickname(name: string): Promise<void>;
  // Account sign-in is OUT OF SCOPE for M1-3; interface only.
  signIn?(provider: "apple" | "google" | "email"): Promise<void>;
}

// ---- ProgressionService (cosmetics / XP, later) ---------------------------
export interface ProgressionService {
  getLevel(): number;
  addMatchResult(win: boolean): void;
}

// ---- PurchaseService (store, later; never pay-to-win) ---------------------
export interface PurchaseService {
  getOwnedCosmetics(): string[];
  purchase(sku: string): Promise<boolean>;
}

// Helper so the simulation never hard-codes "one human".
export function defaultControllers(): ControllerType[] {
  return ["LOCAL_HUMAN", "AI", "AI", "AI"];
}
