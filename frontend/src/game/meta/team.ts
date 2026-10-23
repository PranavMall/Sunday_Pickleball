// TEAM roster rules (display only; the Sign spend is wired in Session C).
import { PARTNER_IDS, SIGN_COST, type PartnerId } from "./economyConfig";
import type { SaveDoc } from "./metaStore";

export type RosterStatus =
  | { kind: "active" }
  | { kind: "set_active" }
  | { kind: "sign"; cost: number }
  | { kind: "need"; more: number }
  | { kind: "locked"; text: string };

// Discovered partners only (no silhouettes, no "?" rows).
export function discoveredPartners(d: Pick<SaveDoc, "partners">): PartnerId[] {
  return PARTNER_IDS.filter((id) => d.partners[id]?.discovered);
}

export function rosterStatus(d: Pick<SaveDoc, "partners" | "activePartnerId" | "coins">, id: PartnerId): RosterStatus {
  const p = d.partners[id];
  if (p?.signed) return d.activePartnerId === id ? { kind: "active" } : { kind: "set_active" };
  if (id === "matz") return { kind: "locked", text: "COMING SOON" }; // Matz in 1A
  if (!p?.signable) return { kind: "locked", text: "UNLOCKS AFTER COMMUNITY CUP FINAL" };
  const cost = SIGN_COST[id] ?? 0;
  return d.coins >= cost ? { kind: "sign", cost } : { kind: "need", more: cost - d.coins };
}
