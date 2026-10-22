// FAULT LABEL (display only): maps the point-ending FaultEvent to the short
// pill shown above the tactical row. Pure; never touches the simulation.
import type { FaultEvent, Team } from "./sim/types";

export const FAULT_LABEL_SECONDS = 1.2;

export interface FaultLabel {
  text: string;
  mine: boolean; // true = my team faulted (red border), false = rivals (gold)
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
  return { text: mine ? base : `${base} · Rivals`, mine };
}
