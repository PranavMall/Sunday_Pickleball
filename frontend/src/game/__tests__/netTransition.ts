/* B3 §2 — realistic transition to the net (focused scenarios + small batteries).
 * Run alone: npx tsx src/game/__tests__/netTransition.ts
 */
import { COURT } from "../config/court";
import { PLAYER } from "../config/tuning";
import { GameSimulation } from "../sim/GameSimulation";
import { updateMovement, type MovementInfo } from "../sim/movement";
import type { BallState, Difficulty, Personality, PlayerState } from "../sim/types";
import { b3Stats } from "./b3Report";

const LINE_NEAR = COURT.NEAR_KITCHEN_Y + PLAYER.KITCHEN_LINE_STANDOFF;

function mkPlayer(slot: number, team: "near" | "far", x: number, y: number, extra: Partial<PlayerState> = {}): PlayerState {
  return {
    slot, team, controller: "AI", name: "T", colorKey: "x", x, y, targetX: x, targetY: y,
    courtSide: slot % 2 === 0 ? "R" : "L", isServing: false, inKitchen: false, touchingKitchenLine: false,
    feetEstablished: true, wasInKitchen: false, momentumTimer: 0, reestablishTimer: 0, lastHitTime: -10,
    reactionUntil: 0, committedToBall: false, swingCue: -10, windUpCue: -10,
    stats: { power: 1, control: 1, spin: 1, reach: 1 }, chemistry: 1, difficulty: "CLUB", ...extra,
  };
}
function mkBall(p: Partial<BallState>): BallState {
  return {
    x: 10, y: 15, z: 2, vx: 0, vy: 15, vz: 2, inPlay: true, lastHitBy: 2, lastHitTeam: "far",
    bouncesSinceHit: 0, bounceSideCount: 0, currentSide: "far", totalBounces: 3, crossedNetSinceHit: false,
    lastBounce: null, trail: [], ...p,
  };
}
const info = (extra: Partial<MovementInfo> = {}): MovementInfo => ({
  rallyStrikeCount: 7, serving: false, serverSlot: null, affinityFor: () => 0.6, posErrorFor: () => 0, apexSinceHit: 3, ...extra,
});

// Near pair established at the line; far player hits toward the near team.
function holdScenario(ball: BallState, apex: number) {
  const a = mkPlayer(0, "near", 15, LINE_NEAR, { netIntent: true, netDecidedFor: 6 });
  const b = mkPlayer(1, "near", 5, LINE_NEAR, { netIntent: true, netDecidedFor: 6 });
  const o = mkPlayer(2, "far", 10, COURT.FAR_KITCHEN_Y - 1.2);
  for (let i = 0; i < 20; i++) updateMovement([a, b, o], ball, info({ apexSinceHit: apex }), 1 / 60);
  return { a, b };
}

function lineShare(opp: Difficulty, personalities: (Personality | undefined)[], seeds: number[]) {
  let at = 0, n = 0;
  for (const seed of seeds) {
    const sim = new GameSimulation({ seed, difficulty: opp, controllers: ["AI", "AI", "AI", "AI"], difficulties: ["CLUB", undefined as any, undefined as any, undefined as any], personalities });
    let t = 0;
    while (sim.phase !== "game_over" && t < 60 * 60 * 20) {
      sim.step(); t++;
      if (sim.phase !== "rally") continue;
      for (const p of sim.players) if (p.team === "far") { n++; if (Math.abs(p.y - COURT.FAR_KITCHEN_Y) < 4) at++; }
    }
  }
  return at / Math.max(1, n);
}

export function netTransitionTests(): { name: string; ok: boolean; info?: string }[] {
  const out: { name: string; ok: boolean; info?: string }[] = [];
  // a) HOLD: a normal low ball to my partner's lane — the non-hitter keeps the line.
  {
    const { a, b } = holdScenario(mkBall({ x: 15, y: 22.6, z: 1.8, vx: 0, vy: 9, vz: 1, crossedNetSinceHit: true }), 3);
    const nonHitter = Math.abs(a.y - LINE_NEAR) < Math.abs(b.y - LINE_NEAR) ? b : a;
    const other = nonHitter === a ? b : a;
    out.push({ name: "2: established non-hitting partner HOLDS the line while the ball comes to the team", ok: Math.abs(b.y - LINE_NEAR) < 1 && b.netIntent === true, info: `hitter y=${other.y.toFixed(1)} partner y=${b.y.toFixed(1)}` });
  }
  // a) RETREAT only when needed: a lob over the line.
  {
    const { b } = holdScenario(mkBall({ x: 15, y: 22.6, z: 9, vx: 0, vy: 17, vz: 4, crossedNetSinceHit: true }), 11);
    out.push({ name: "2: a lob over the line makes the line players drop back", ok: b.netIntent === false && b.y > LINE_NEAR + 1, info: `partner y=${b.y.toFixed(1)} intent=${b.netIntent}` });
  }
  // c) after-values: tiers + rally lengths + no stuck states.
  const seeds = Array.from({ length: 12 }, (_, i) => 2000 + i);
  const r = b3Stats("ROOKIE", seeds), c = b3Stats("CLUB", seeds), p = b3Stats("PRO", seeds);
  out.push({ name: "2: Rookie now reaches an all-four-at-net formation (> 0%)", ok: r.allNet > 0.05, info: `${(r.allNet * 100).toFixed(1)}%` });
  out.push({ name: "2: Club / Pro all-four-at-net clearly above B2 (33% / 36%)", ok: c.allNet > 0.38 && p.allNet > 0.41, info: `C ${(c.allNet * 100).toFixed(1)}% P ${(p.allNet * 100).toFixed(1)}%` });
  out.push({ name: "2: tier order Rookie < Club < Pro for all-four-at-net", ok: r.allNet < c.allNet && c.allNet < p.allNet });
  const base = { ROOKIE: 7.28, CLUB: 10.39, PRO: 12.04 };
  const within = [[r, base.ROOKIE], [c, base.CLUB], [p, base.PRO]].every(([s, b]) => Math.abs((s as any).avgRally / (b as number) - 1) <= 0.15);
  out.push({ name: "2: rally lengths within ±15% of B2 baseline", ok: within, info: `${r.avgRally.toFixed(2)}/${c.avgRally.toFixed(2)}/${p.avgRally.toFixed(2)}` });
  out.push({ name: "2: no stuck states", ok: r.stuck + c.stuck + p.stuck === 0 });
  // b) personality: KITCHEN-rush opponents close the line more than DEFENSIVE ones (same tier).
  const ps = seeds.slice(0, 8);
  const k = lineShare("ROOKIE", [undefined, "DEFENSIVE", "KITCHEN", "KITCHEN"], ps);
  const d = lineShare("ROOKIE", [undefined, "DEFENSIVE", "DEFENSIVE", "DEFENSIVE"], ps);
  out.push({ name: "2: personality kitchenRush matters (KITCHEN > DEFENSIVE time at the line)", ok: k > d + 0.03, info: `KITCHEN ${(k * 100).toFixed(0)}% DEFENSIVE ${(d * 100).toFixed(0)}%` });
  return out;
}

if (process.argv[1]?.includes("netTransition")) {
  for (const t of netTransitionTests()) console.log(t.ok ? "PASS" : "FAIL", t.name, t.info ?? "");
}
