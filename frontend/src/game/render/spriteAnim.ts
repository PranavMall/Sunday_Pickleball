// NEAR-TEAM SPRITE ANIMATOR (render only — reads the sim, never writes it).
// One instance per match; every per-slot field is preallocated, so update()
// allocates nothing. Outputs per slot: row, frame, drawX, drawY (court feet).
import type { ContactEvent } from "../sim/types";
import type { GameSimulation } from "../sim/GameSimulation";
import { SPRITE_META, type SpriteRow, type StrokeRow } from "./sprites";

const R = SPRITE_META.rows;
const CF = SPRITE_META.contact_frame;
const N = 4; // slots
const H = 16; // position history per slot (~0.27 s at 60 fps)
const VEL_WINDOW = 0.1;
const START_MOVE = 0.8; // ft/s
const STOP_MOVE = 0.4;
const HOLD = 0.2; // s, every movement anim (idle included) is held at least this long
const AXIS_SWITCH = 1.5;
const STROKE_AFTER = 0.35;
const WINDUP_FRAME = 0.05; // s per wind-up frame (held on contact frame − 1)
const STRIDE: Record<number, number> = { [R.run_fwd]: 0.75, [R.run_back]: 0.55, [R.step_r]: 0.6, [R.step_l]: 0.6 };
export const END_WALK_S = 0.8;
export const END_REACT_S = 1.1;
export const END_SEQ_S = END_WALK_S + END_REACT_S;
const BASELINE_Y = 43;

const rowNumOf = (r: StrokeRow) => R[r];
const cfOfRow = (row: number): number =>
  row === R.serve ? CF.serve : row === R.smash ? CF.smash : row === R.lob ? CF.lob : CF.forehand;

// Shared per-slot state + the stroke / movement frame logic. `towardNetVy`
// is the sign of vy that means "toward the net" for this side (near −1,
// far +1), which picks run_fwd vs run_back.
class SpriteAnimatorBase {
  readonly row = new Int8Array(N);
  readonly frame = new Int8Array(N);
  readonly drawX = new Float64Array(N);
  readonly drawY = new Float64Array(N);
  // stroke record (per slot): contact time, row
  protected strokeT = new Float64Array(N).fill(-1e9);
  protected strokeRow = new Int8Array(N);
  // movement
  private histT = new Float64Array(N * H);
  private histX = new Float64Array(N * H);
  private histY = new Float64Array(N * H);
  private histI = new Int32Array(N);
  private histN = new Int32Array(N);
  private lastT = new Float64Array(N).fill(-1);
  private moveRow = new Int8Array(N); // current movement row (idle / run / step)
  protected heldSince = new Float64Array(N).fill(-1e9);
  private dist = new Float64Array(N);
  private lastDx = 0;
  private lastDy = 0;

  constructor(private readonly towardNetVy: number) {}

  // Position history sample (sim time only advances while playing); the step
  // since the previous sample is left in lastDx / lastDy.
  protected sample(s: number, x: number, y: number, t: number): void {
    this.lastDx = 0;
    this.lastDy = 0;
    if (t === this.lastT[s]) return;
    const prev = this.histN[s] ? (this.histI[s] + H - 1) % H : -1;
    if (prev >= 0) {
      this.lastDx = x - this.histX[s * H + prev];
      this.lastDy = y - this.histY[s * H + prev];
    }
    const i = this.histI[s];
    this.histT[s * H + i] = t;
    this.histX[s * H + i] = x;
    this.histY[s * H + i] = y;
    this.histI[s] = (i + 1) % H;
    if (this.histN[s] < H) this.histN[s]++;
    this.lastT[s] = t;
  }

  // Stroke follow-through: contact frame → last frame over STROKE_AFTER.
  protected strokeFrame(s: number, t: number): boolean {
    const since = t - this.strokeT[s];
    if (!(since >= 0 && since < STROKE_AFTER)) return false;
    const row = this.strokeRow[s];
    const cf = cfOfRow(row);
    const rest = SPRITE_META.cols - 1 - cf;
    this.row[s] = row;
    this.frame[s] = cf + Math.min(rest, Math.floor((since / STROKE_AFTER) * (rest + 1)));
    this.heldSince[s] = t; // movement restarts its hold after a stroke
    return true;
  }

  // Movement: velocity over the last 0.1 s, hysteresis, hold, axis switch.
  protected moveFrame(s: number, x: number, y: number, t: number): void {
    let vx = 0, vy = 0;
    const n = this.histN[s];
    for (let k = 1; k < n; k++) {
      const j = s * H + ((this.histI[s] + H - 1 - k) % H);
      const age = t - this.histT[j];
      if (age >= VEL_WINDOW || k === n - 1) {
        if (age > 0) {
          vx = (x - this.histX[j]) / age;
          vy = (y - this.histY[j]) / age;
        }
        break;
      }
    }
    const speed = Math.sqrt(vx * vx + vy * vy);
    const cur = this.moveRow[s];
    const wasMoving = cur !== R.idle;
    let want = cur;
    if (!wasMoving ? speed > START_MOVE : speed >= STOP_MOVE) {
      const ax = Math.abs(vx), ay = Math.abs(vy);
      const curAxisY = cur === R.run_fwd || cur === R.run_back;
      const curAxisX = cur === R.step_r || cur === R.step_l;
      const useY = curAxisY ? !(ax > ay * AXIS_SWITCH) : curAxisX ? ay > ax * AXIS_SWITCH : ay >= ax;
      want = useY ? (vy * this.towardNetVy > 0 ? R.run_fwd : R.run_back) : vx > 0 ? R.step_r : R.step_l;
    } else want = R.idle;
    if (want !== cur && t - this.heldSince[s] >= HOLD) {
      this.moveRow[s] = want;
      this.heldSince[s] = t;
    }
    const row = this.moveRow[s];
    this.row[s] = row;
    if (row === R.idle) this.frame[s] = Math.floor(t * 8) % SPRITE_META.cols;
    else {
      this.dist[s] += Math.sqrt(this.lastDx * this.lastDx + this.lastDy * this.lastDy);
      this.frame[s] = Math.floor(this.dist[s] / STRIDE[row]) % SPRITE_META.cols;
    }
  }
}

export class NearSpriteAnimator extends SpriteAnimatorBase {
  private endX0 = new Float64Array(N);
  private endY0 = new Float64Array(N);
  private endStarted = false;

  constructor() {
    super(-1);
  }

  // From match.tsx's contact-event loop.
  onContact(ev: ContactEvent, sim: GameSimulation): void {
    const p = sim.players[ev.slot];
    if (!p || p.team !== "near") return;
    const r: StrokeRow = ev.isServe ? "serve" : ev.shotType === "smash" ? "smash" : ev.shotType === "lob" ? "lob" : ev.x < p.x ? "backhand" : "forehand";
    this.strokeT[ev.slot] = ev.time;
    this.strokeRow[ev.slot] = rowNumOf(r);
  }

  // endElapsed: seconds since game over (render clock), or −1 during play.
  update(sim: GameSimulation, endElapsed: number): void {
    const t = sim.time;
    if (endElapsed >= 0 && !this.endStarted) {
      this.endStarted = true;
      for (let s = 0; s < sim.players.length; s++) {
        this.endX0[s] = sim.players[s].x;
        this.endY0[s] = sim.players[s].y;
      }
    }
    for (let s = 0; s < sim.players.length; s++) {
      const p = sim.players[s];
      if (p.team !== "near") continue;
      if (endElapsed >= 0) {
        this.endPose(s, endElapsed, sim.winner === p.team);
        continue;
      }
      this.drawX[s] = p.x;
      this.drawY[s] = p.y;
      this.sample(s, p.x, p.y, t);
      // 1) Stroke (interrupts movement immediately).
      const human = p.controller === "LOCAL_HUMAN";
      if (human && p.windUpCue > p.swingCue && p.windUpCue > this.strokeT[s] && t - p.windUpCue < 1) {
        const ball = sim.ball;
        // Smash cue in its "smash" phase (or a smash-latched swipe) → the
        // overhead smash row, so the paddle goes up before contact.
        const smash = sim.smashLatched || sim.humanSmashCuePhase() === "smash";
        const row = sim.phase !== "rally" && sim.humanIsServer() ? R.serve : sim.lobArmed ? R.lob : smash ? R.smash : ball.x < p.x ? R.backhand : R.forehand;
        this.row[s] = row;
        this.frame[s] = Math.min(cfOfRow(row) - 1, Math.floor((t - p.windUpCue) / WINDUP_FRAME));
        continue;
      }
      if (this.strokeFrame(s, t)) continue;
      // 2) Movement.
      this.moveFrame(s, p.x, p.y, t);
    }
  }

  // Game over: walk to the baseline (same x) with run_back, then celebrate /
  // slump and hold the peak frame (never the last, neutral frame).
  private endPose(s: number, e: number, won: boolean) {
    const y0 = this.endY0[s];
    this.drawX[s] = this.endX0[s];
    if (e < END_WALK_S) {
      const u = e / END_WALK_S;
      this.drawY[s] = y0 + (BASELINE_Y - y0) * u;
      this.row[s] = R.run_back;
      this.frame[s] = Math.floor((Math.abs(BASELINE_Y - y0) * u) / STRIDE[R.run_back]) % SPRITE_META.cols;
      return;
    }
    this.drawY[s] = BASELINE_Y;
    const peak = won ? 3 : 4;
    this.row[s] = won ? R.celebrate : R.disappointed;
    this.frame[s] = Math.min(peak, Math.floor(((e - END_WALK_S) / END_REACT_S) * SPRITE_META.cols));
  }
}

// FAR-TEAM (rival) animator: AI strokes start at contact (no wind-up);
// rivals face us, so their right hand is on the screen's left (ev.x < p.x →
// forehand). Movement rows flipped: vy > 0 (toward the net) → run_fwd.
// Game over: they stay where they are, idle.
export class FarSpriteAnimator extends SpriteAnimatorBase {
  constructor() {
    super(1);
  }

  onContact(ev: ContactEvent, sim: GameSimulation): void {
    const p = sim.players[ev.slot];
    if (!p || p.team !== "far") return;
    const r: StrokeRow = ev.isServe ? "serve" : ev.shotType === "smash" ? "smash" : ev.shotType === "lob" ? "lob" : ev.x < p.x ? "forehand" : "backhand";
    this.strokeT[ev.slot] = ev.time;
    this.strokeRow[ev.slot] = rowNumOf(r);
  }

  update(sim: GameSimulation, endElapsed: number): void {
    const t = sim.time;
    for (let s = 0; s < sim.players.length; s++) {
      const p = sim.players[s];
      if (p.team !== "far") continue;
      this.drawX[s] = p.x;
      this.drawY[s] = p.y;
      if (endElapsed >= 0) {
        this.row[s] = R.idle;
        this.frame[s] = Math.floor((endElapsed + t) * 8) % SPRITE_META.cols;
        continue;
      }
      this.sample(s, p.x, p.y, t);
      if (this.strokeFrame(s, t)) continue;
      this.moveFrame(s, p.x, p.y, t);
    }
  }
}

export type { SpriteRow };
