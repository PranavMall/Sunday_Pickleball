// TEAM roster rules (display; signing goes through MetaStore.signPartner).
import { CAREER_UNLOCKS, PARTNER_IDS, SIGN_COST, STAGE_NAMES, careerMatch, CAREER_MATCH_IDS, type PartnerId } from "./economyConfig";
import type { SaveDoc } from "./metaStore";

export type RosterStatus =
  | { kind: "active" }
  | { kind: "set_active" }
  | { kind: "sign"; cost: number }
  | { kind: "need"; more: number }
  | { kind: "locked"; text: string };

// "UNLOCKS AFTER <STAGE> FINAL", from the Career match whose win makes them signable.
function unlockText(id: PartnerId): string {
  const n = Object.keys(CAREER_UNLOCKS).map(Number).find((k) => CAREER_UNLOCKS[k].partnerId === id && CAREER_UNLOCKS[k].flag === "signable");
  if (!n) return "LOCKED";
  return `UNLOCKS AFTER ${STAGE_NAMES[careerMatch(CAREER_MATCH_IDS[n - 1]).stageKey].toUpperCase()} FINAL`;
}

// Discovered partners only (no silhouettes, no "?" rows).
export function discoveredPartners(d: Pick<SaveDoc, "partners">): PartnerId[] {
  return PARTNER_IDS.filter((id) => d.partners[id]?.discovered);
}

export function rosterStatus(d: Pick<SaveDoc, "partners" | "activePartnerId" | "coins">, id: PartnerId): RosterStatus {
  const p = d.partners[id];
  if (p?.signed) return d.activePartnerId === id ? { kind: "active" } : { kind: "set_active" };
  if (!p?.signable) return { kind: "locked", text: unlockText(id) };
  const cost = SIGN_COST[id] ?? 0;
  return d.coins >= cost ? { kind: "sign", cost } : { kind: "need", more: cost - d.coins };
}
