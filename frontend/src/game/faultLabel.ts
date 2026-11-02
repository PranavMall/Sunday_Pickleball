// FAULT LABEL (display only): maps the point-ending FaultEvent to the short
// pill shown above the tactical row. Pure; never touches the simulation.
import type { FaultEvent, Team } from "./sim/types";

export const FAULT_LABEL_SECONDS = 1.2;
export const FAULT_HINT_SECONDS = 2.0; // the pill stays longer when it explains
export const FAULT_HINT_MAX = 3; // per fault type per app session

export interface FaultLabel {
  text: string;
  mine: boolean; // true = my team faulted (red border), false = rivals (gold)
  hint?: string; // the rule, only for my team's faults
}

const HINTS: Partial<Record<FaultEvent["reason"], string>> = {
  TWO_BOUNCE: "Serve and return must bounce first",
  KITCHEN_VOLLEY: "No volleys from inside the kitchen",
  KITCHEN_MOMENTUM: "Your momentum carried you into the kitchen",
  KITCHEN_NOT_ESTABLISHED: "Both feet out of the kitchen before you volley",
  SERVE_WRONG_BOX: "Serve to the diagonal box",
  SERVE_KITCHEN: "The serve must land past the kitchen line",
  OWN_COURT: "The ball must cross the net",
};

// In-memory only (no storage): how often each hint was shown this session.
// Decided once per point end (keyed by its sim time), so re-renders never count.
const hintShows: Record<string, number> = {};
let hintPointAt = NaN;
let hintPointOn = false;
export function showHintForPoint(label: FaultLabel | null, reason: string | undefined, pointTime: number): boolean {
  if (pointTime !== hintPointAt) {
    hintPointAt = pointTime;
    hintPointOn = !!(label?.hint && reason && (hintShows[reason] ?? 0) < FAULT_HINT_MAX);
    if (hintPointOn) hintShows[reason!] = (hintShows[reason!] ?? 0) + 1;
  }
  return hintPointOn;
}

export function faultLabelFor(fault: FaultEvent | null, myTeam: Team = "near"): FaultLabel | null {
  if (!fault) return null;
  const mine = fault.faultingTeam === myTeam;
  let base: string | null;
  switch (fault.reason) {
    case "TWO_BOUNCE": base = "TWO-BOUNCE FAULT"; break;
    case "KITCHEN_VOLLEY":
    case "KITCHEN_MOMENTUM":
    case "KITCHEN_NOT_ESTABLISHED": base = "KITCHEN FAULT"; break;
    case "NET":
    case "SERVE_NET": base = "NET"; break;
    case "OUT":
    case "SERVE_OUT": base = "OUT"; break;
    case "SERVE_WRONG_BOX":
    case "SERVE_KITCHEN": base = "SERVE FAULT"; break;
    // Already worded from my point of view, so no "· Rivals" suffix.
    case "DOUBLE_BOUNCE": return { text: mine ? "MISSED" : "WINNER", mine };
    case "OWN_COURT": base = "DIDN'T CROSS"; break;
    default: base = null; // DEAD_BALL → no label
  }
  if (!base) return null;
  const hint = mine ? HINTS[fault.reason] : undefined;
  return hint ? { text: base, mine, hint } : { text: mine ? base : `${base} · Rivals`, mine };
}
