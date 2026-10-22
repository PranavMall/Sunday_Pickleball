/* Phase 1A tests (Session A). Run: npx tsx src/game/__tests__/phase1a.ts */
import { faultLabelFor } from "../faultLabel";
import type { FaultEvent, FaultReason, Team } from "../sim/types";

let passed = 0;
let failed = 0;
export function ok(cond: boolean, name: string) {
  if (cond) passed++;
  else {
    failed++;
    console.log("  ✗ FAIL:", name);
  }
}
export function eq(a: unknown, b: unknown, name: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
}

const f = (reason: FaultReason, faultingTeam: Team): FaultEvent => ({ reason, faultingTeam, x: 0, y: 0, message: "" });

function faultLabelTests() {
  console.log("\n[Commit 0: fault label]");
  eq(faultLabelFor(f("TWO_BOUNCE", "near"))?.text, "TWO-BOUNCE FAULT", "TWO_BOUNCE mine");
  eq(faultLabelFor(f("TWO_BOUNCE", "far"))?.text, "TWO-BOUNCE FAULT · Rivals", "TWO_BOUNCE rivals");
  for (const r of ["KITCHEN_VOLLEY", "KITCHEN_MOMENTUM", "KITCHEN_NOT_ESTABLISHED"] as FaultReason[])
    eq(faultLabelFor(f(r, "near"))?.text, "KITCHEN FAULT", r);
  eq(faultLabelFor(f("NET", "far"))?.text, "NET · Rivals", "NET rivals");
  eq(faultLabelFor(f("SERVE_NET", "near"))?.text, "NET", "SERVE_NET");
  eq(faultLabelFor(f("OUT", "near"))?.text, "OUT", "OUT");
  eq(faultLabelFor(f("SERVE_OUT", "far"))?.text, "OUT · Rivals", "SERVE_OUT rivals");
  eq(faultLabelFor(f("SERVE_WRONG_BOX", "near"))?.text, "SERVE FAULT", "SERVE_WRONG_BOX");
  eq(faultLabelFor(f("SERVE_KITCHEN", "far"))?.text, "SERVE FAULT · Rivals", "SERVE_KITCHEN rivals");
  eq(faultLabelFor(f("DOUBLE_BOUNCE", "far"))?.text, "WINNER", "DOUBLE_BOUNCE rivals → WINNER");
  eq(faultLabelFor(f("DOUBLE_BOUNCE", "near"))?.text, "MISSED", "DOUBLE_BOUNCE mine → MISSED");
  eq(faultLabelFor(f("OWN_COURT", "near"))?.text, "DIDN'T CROSS", "OWN_COURT");
  eq(faultLabelFor(f("DEAD_BALL", "near")), null, "DEAD_BALL → no label");
  eq(faultLabelFor(null), null, "no fault → no label");
  eq(faultLabelFor(f("OUT", "near"))?.mine, true, "my fault → red (mine)");
  eq(faultLabelFor(f("OUT", "far"))?.mine, false, "rival fault → gold");
}

export const suites: { name: string; run: () => void | Promise<void> }[] = [{ name: "faultLabel", run: faultLabelTests }];

if (process.argv[1]?.includes("phase1a")) {
  (async () => {
    for (const s of suites) await s.run();
    console.log(`\n=== PHASE 1A RESULT: ${passed} passed, ${failed} failed ===`);
    if (failed) process.exit(1);
  })();
}
