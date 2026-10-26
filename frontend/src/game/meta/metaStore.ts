// METASTORE: the one in-memory owner of all progression state. It writes ONE
// JSON document (schemaVersion) to storage, strictly sequentially (a write
// chain of snapshots — no parallel read-modify-write anywhere). Identity stays
// in the existing pw.playerName / pw.teamName / pw.identitySet keys.
//
// Every Coins / Gems / Fans / Growth / Chemistry change goes through applyLedger
// (idempotent by rewardId; balances never negative; Fans never decrease).
// Analytics are emitted at the mutation points. All functions take `now` (ms).
// Nothing in src/game/sim imports this module.
import { analytics } from "../services/analytics";
import {
  CAREER_MATCH_IDS,
  CAREER_MATCHES,
  CAREER_REWARDS,
  CAREER_UNLOCKS,
  CHEMISTRY_HALVE_AT,
  CHEMISTRY_MAX,
  GROWTH_MAX,
  PARTNERS,
  QUICK_PLAY_REWARDS,
  SIGN_COST,
  TRAINING_MODES,
  careerMatch,
  milestoneFor,
  type PartnerId,
  FIRST_CAREER_MATCH_ID,
  FIRST_SESSION_START,
  FORM_START,
  HOME_CITY,
  LEDGER_KEEP,
  META_STORAGE_KEY,
  SCHEMA_VERSION,
  STARTER_PARTNER_ID,
  START_VALUES,
  type Currency,
} from "./economyConfig";

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface PartnerState {
  discovered: boolean;
  signable: boolean;
  signed: boolean;
  growth: number;
}

export interface LedgerEntry {
  rewardId: string;
  currency: Currency;
  target?: string; // partnerId (growth) or pairing key (chemistry)
  valueBefore: number;
  delta: number;
  valueAfter: number;
  sourceType: string;
  sourceId: string;
  timestamp: number;
}

export interface SaveDoc {
  schemaVersion: number;
  guestId: string;
  homeCity: string;
  firstSession: string;
  coins: number;
  gems: number;
  fans: number;
  form: string;
  formStreak: number;
  activePartnerId: string;
  trainingPartnerId: string;
  partners: Record<string, PartnerState>;
  chemistryHalves: Record<string, number>; // pairing key → half points (0..200)
  career: { cleared: string[]; nextMatchId: string; firstClearWins: number; firstClearLosses: number };
  namedRivals: Record<string, boolean>;
  milestones: Record<string, boolean>;
  daily: { dayKey: string; training: number; scrimmage: number };
  inboxRead: string[];
  rewardIds: string[]; // every applied rewardId (idempotency)
  ledger: LedgerEntry[]; // recent history (LEDGER_KEEP)
}

export type MatchKind = "career" | "training" | "scrimmage" | "quick";

// What one completed match granted (result screen). Lines = one per ledger
// grant; events = discoveries / milestones that happened.
export interface MatchOutcome {
  applied: boolean;
  lines: string[];
  events: string[];
  capped?: boolean; // training/scrimmage after the daily cap
  // Result-screen data, all taken from this match's ledger entries.
  coins?: CurrencyTile; // only when Coins changed
  fans?: CurrencyTile; // only when Fans changed
  partner?: PartnerDelta;
  moments: Moment[]; // celebration pop-ups, in order (max 3)
}
export interface CurrencyTile {
  before: number;
  after: number;
  parts: string[]; // "Win +100", "Rival +100", ...
}
export interface PartnerDelta {
  id: string;
  growthBefore: number;
  growthAfter: number;
  chemBefore: number;
  chemAfter: number;
}
export type Moment =
  | { kind: "stage"; stageKey: string; rival: string; milestone?: string }
  | { kind: "court"; court: string }
  | { kind: "partner"; partnerId: string; flag: "discovered" | "signable"; event: string };

export interface Source {
  sourceType: string;
  sourceId: string;
}

export type LedgerResult =
  | { ok: true; applied: boolean; entry?: LedgerEntry }
  | { ok: false; reason: "insufficient" | "fans_never_decrease" | "invalid" };

// Local calendar date, e.g. "2026-06-14" (zero-padded → string order = date order).
export function dayKeyOf(now: number): string {
  const d = new Date(now);
  const p = (n: number) => (n < 10 ? "0" : "") + n;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Unique per match without any storage write at match start.
export function newMatchId(now: number, rand: () => number = Math.random): string {
  return `${now.toString(36)}${Math.floor(rand() * 36 ** 6).toString(36).padStart(6, "0")}`;
}

export function pairingKey(partnerId: string): string {
  return `player+${partnerId}`;
}

export function freshSave(now: number, rand: () => number = Math.random): SaveDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    guestId: `g_${newMatchId(now, rand)}${Math.floor(rand() * 36 ** 6).toString(36)}`,
    homeCity: HOME_CITY,
    firstSession: FIRST_SESSION_START,
    coins: START_VALUES.coins,
    gems: START_VALUES.gems,
    fans: START_VALUES.fans,
    form: FORM_START,
    formStreak: 0,
    activePartnerId: STARTER_PARTNER_ID,
    trainingPartnerId: STARTER_PARTNER_ID,
    partners: { [STARTER_PARTNER_ID]: { discovered: true, signable: true, signed: true, growth: 0 } },
    chemistryHalves: { [pairingKey(STARTER_PARTNER_ID)]: 0 },
    career: { cleared: [], nextMatchId: FIRST_CAREER_MATCH_ID, firstClearWins: 0, firstClearLosses: 0 },
    namedRivals: {},
    milestones: {},
    daily: { dayKey: dayKeyOf(now), training: 0, scrimmage: 0 },
    inboxRead: [],
    rewardIds: [],
    ledger: [],
  };
}

// Field-by-field sanitise onto a fresh save: a corrupt field falls back to its
// default; unparseable / non-object data → a full fresh save. Never throws.
export function sanitiseSave(raw: unknown, now: number, rand: () => number = Math.random): SaveDoc {
  const base = freshSave(now, rand);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const r = raw as Record<string, any>;
  if (typeof r.schemaVersion !== "number") return base;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : d);
  const str = (v: unknown, d: string) => (typeof v === "string" && v ? v : d);
  const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  const boolMap = (v: unknown) => {
    const out: Record<string, boolean> = {};
    if (v && typeof v === "object") for (const [k, b] of Object.entries(v)) if (typeof b === "boolean") out[k] = b;
    return out;
  };
  const partners: Record<string, PartnerState> = { ...base.partners };
  if (r.partners && typeof r.partners === "object") {
    for (const [id, p] of Object.entries<any>(r.partners)) {
      if (!p || typeof p !== "object") continue;
      partners[id] = { discovered: !!p.discovered, signable: !!p.signable, signed: !!p.signed, growth: num(p.growth, 0) };
    }
  }
  const chemistryHalves: Record<string, number> = { ...base.chemistryHalves };
  if (r.chemistryHalves && typeof r.chemistryHalves === "object") {
    for (const [k, v] of Object.entries(r.chemistryHalves)) chemistryHalves[k] = Math.min(CHEMISTRY_MAX * 2, Math.round(num(v, 0)));
  }
  const c = r.career && typeof r.career === "object" ? r.career : {};
  const dly = r.daily && typeof r.daily === "object" ? r.daily : {};
  return {
    schemaVersion: SCHEMA_VERSION,
    guestId: str(r.guestId, base.guestId),
    homeCity: str(r.homeCity, base.homeCity),
    firstSession: str(r.firstSession, base.firstSession),
    coins: num(r.coins, base.coins),
    gems: num(r.gems, base.gems),
    fans: num(r.fans, base.fans),
    form: str(r.form, base.form),
    formStreak: typeof r.formStreak === "number" && Number.isFinite(r.formStreak) ? r.formStreak : 0,
    activePartnerId: str(r.activePartnerId, base.activePartnerId),
    trainingPartnerId: str(r.trainingPartnerId, base.trainingPartnerId),
    partners,
    chemistryHalves,
    career: {
      cleared: strArr(c.cleared).filter((id: string) => (CAREER_MATCH_IDS as readonly string[]).includes(id)),
      nextMatchId: (CAREER_MATCH_IDS as readonly string[]).includes(c.nextMatchId) ? c.nextMatchId : base.career.nextMatchId,
      firstClearWins: num(c.firstClearWins, 0),
      firstClearLosses: num(c.firstClearLosses, 0),
    },
    namedRivals: boolMap(r.namedRivals),
    milestones: boolMap(r.milestones),
    daily: {
      dayKey: typeof dly.dayKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dly.dayKey) ? dly.dayKey : base.daily.dayKey,
      training: num(dly.training, 0),
      scrimmage: num(dly.scrimmage, 0),
    },
    inboxRead: strArr(r.inboxRead),
    rewardIds: strArr(r.rewardIds),
    ledger: Array.isArray(r.ledger) ? r.ledger.slice(-LEDGER_KEEP) : [],
  };
}

export class MetaStore {
  private docState: SaveDoc | null = null;
  private rewardSet = new Set<string>();
  private writeChain: Promise<void> = Promise.resolve();
  writes = 0; // completed writes (tests / diagnostics)

  constructor(private storage: StorageAdapter, private rand: () => number = Math.random) {}

  get loaded(): boolean {
    return this.docState !== null;
  }

  // Read-only view of the current save (do not mutate).
  get doc(): Readonly<SaveDoc> {
    if (!this.docState) throw new Error("MetaStore not loaded");
    return this.docState;
  }

  // APP START: read once; missing/corrupt → fresh starter save. Never throws.
  async load(now: number): Promise<void> {
    let raw: unknown = null;
    try {
      const s = await this.storage.getItem(META_STORAGE_KEY);
      raw = s ? JSON.parse(s) : null;
    } catch {
      raw = null;
    }
    this.docState = sanitiseSave(raw, now, this.rand);
    this.rewardSet = new Set(this.docState.rewardIds);
    this.rollDay(now);
    this.save();
    await this.flush();
  }

  // Sequential write of a SNAPSHOT taken now.
  save(): void {
    if (!this.docState) return;
    const json = JSON.stringify(this.docState);
    this.writeChain = this.writeChain
      .then(() => this.storage.setItem(META_STORAGE_KEY, json))
      .then(() => {
        this.writes++;
      })
      .catch((e) => console.warn("[meta] save failed", e));
  }

  flush(): Promise<void> {
    return this.writeChain;
  }

  // ---- Day key / daily caps ---------------------------------------------
  // A new LATER local date resets daily usage. A date that goes BACKWARDS keeps
  // the last day key, so a clock change can never refresh a cap.
  rollDay(now: number): void {
    const d = this.doc as SaveDoc;
    const k = dayKeyOf(now);
    if (k > d.daily.dayKey) d.daily = { dayKey: k, training: 0, scrimmage: 0 };
  }

  dailyUsage(now: number): { training: number; scrimmage: number } {
    this.rollDay(now);
    return { training: this.doc.daily.training, scrimmage: this.doc.daily.scrimmage };
  }

  // ---- Ledger -----------------------------------------------------------
  chemistry(partnerId: string): number {
    return Math.floor((this.doc.chemistryHalves[pairingKey(partnerId)] ?? 0) / 2);
  }

  private read(currency: Currency, target?: string): number {
    const d = this.doc;
    switch (currency) {
      case "coins": return d.coins;
      case "gems": return d.gems;
      case "fans": return d.fans;
      case "growth": return d.partners[target ?? ""]?.growth ?? 0;
      case "chemistry": return (d.chemistryHalves[target ?? ""] ?? 0) / 2;
    }
  }

  private write(currency: Currency, value: number, target?: string) {
    const d = this.docState!;
    switch (currency) {
      case "coins": d.coins = value; break;
      case "gems": d.gems = value; break;
      case "fans": d.fans = value; break;
      case "growth": d.partners[target!].growth = value; break;
      case "chemistry": d.chemistryHalves[target!] = Math.round(value * 2); break;
    }
  }

  // The single mutation point. Idempotent by rewardId (a repeat is a no-op).
  // Does NOT save — callers batch and save once.
  private applyLedger(rewardId: string, currency: Currency, delta: number, src: Source, now: number, target?: string): LedgerResult {
    if (this.rewardSet.has(rewardId)) return { ok: true, applied: false };
    if (!Number.isFinite(delta)) return { ok: false, reason: "invalid" };
    if (currency === "growth" && !this.doc.partners[target ?? ""]) return { ok: false, reason: "invalid" };
    if (currency === "chemistry" && !target) return { ok: false, reason: "invalid" };
    if (currency === "fans" && delta < 0) return { ok: false, reason: "fans_never_decrease" };
    if (currency === "chemistry") delta = Math.round(delta * 2) / 2; // 0.5 steps
    const before = this.read(currency, target);
    let after = before + delta;
    if (after < 0) return { ok: false, reason: "insufficient" };
    if (currency === "chemistry") after = Math.min(CHEMISTRY_MAX, after);
    if (currency === "growth") after = Math.min(GROWTH_MAX, after);
    this.write(currency, after, target);
    const entry: LedgerEntry = {
      rewardId, currency, target, valueBefore: before, delta: after - before, valueAfter: after,
      sourceType: src.sourceType, sourceId: src.sourceId, timestamp: now,
    };
    const d = this.docState!;
    this.rewardSet.add(rewardId);
    d.rewardIds.push(rewardId);
    d.ledger.push(entry);
    if (d.ledger.length > LEDGER_KEEP) d.ledger.splice(0, d.ledger.length - LEDGER_KEEP);
    if (delta < 0) analytics.track("economy_spend", { rewardId, currency, amount: -entry.delta, after, sourceType: src.sourceType, sourceId: src.sourceId });
    else analytics.track("economy_reward_granted", { rewardId, currency, target, delta: entry.delta, after, sourceType: src.sourceType, sourceId: src.sourceId });
    if (currency === "growth" || currency === "chemistry") {
      analytics.track("partner_progress_changed", { partner: target, currency, before, after });
    }
    return { ok: true, applied: true, entry };
  }

  // Grant a positive amount (saved immediately).
  grant(rewardId: string, currency: Currency, amount: number, src: Source, now: number, target?: string): LedgerResult {
    if (!(amount >= 0)) return { ok: false, reason: "invalid" };
    const r = this.applyLedger(rewardId, currency, amount, src, now, target);
    if (r.ok && r.applied) this.save();
    return r;
  }

  // Spend Coins or Gems. Fails cleanly (no change) when short.
  spend(spendId: string, currency: "coins" | "gems", amount: number, src: Source, now: number): LedgerResult {
    if (!(amount > 0)) return { ok: false, reason: "invalid" };
    const r = this.applyLedger(spendId, currency, -amount, src, now);
    if (r.ok && r.applied) this.save();
    return r;
  }

  // MATCH END: compute and apply every reward of one match from economyConfig
  // (rewardIds derive from the matchId), update career / discovery / daily
  // usage, emit the completion event, save ONCE. A repeated matchId is a
  // no-op. A match that never reaches here (quit or app killed mid-match)
  // grants and records nothing. Returns the result-screen lines.
  completeMatch(
    m: {
      matchId: string;
      kind: MatchKind;
      won: boolean;
      careerMatchId?: string;
      partnerId?: string; // the partner who actually played
    },
    now: number,
  ): MatchOutcome {
    const doneId = `${m.kind}:${m.matchId}:completed`;
    const out: MatchOutcome = { applied: false, lines: [], events: [], moments: [] };
    if (this.rewardSet.has(doneId)) return out;
    out.applied = true;
    const d = this.docState!;
    const src: Source = { sourceType: m.kind, sourceId: m.careerMatchId ?? m.matchId };
    const entries: LedgerEntry[] = [];
    const give = (key: string, currency: Currency, amount: number, target?: string): number => {
      const r = this.applyLedger(`${m.kind}:${m.matchId}:${key}`, currency, amount, src, now, target);
      if (r.ok && r.applied) entries.push(r.entry!);
      return r.ok && r.applied ? r.entry!.delta : 0;
    };
    const tile = (cur: "coins" | "fans", label: string, v: number) => {
      if (v <= 0) return;
      const e = entries[entries.length - 1];
      const t = (out[cur] ??= { before: e.valueBefore, after: e.valueAfter, parts: [] });
      t.after = e.valueAfter;
      t.parts.push(`${label} +${v}`);
    };
    const coinsLine = (key: string, amount: number, suffix = "", label = "Win") => {
      const v = give(key, "coins", amount);
      if (v > 0) out.lines.push(`+${v} Coins${suffix}`);
      tile("coins", label, v);
    };
    const fansLine = (key: string, amount: number, suffix = "", label = "Win") => {
      const v = give(key, "fans", amount);
      if (v > 0) out.lines.push(`+${v} Fans${suffix}`);
      tile("fans", label, v);
    };
    // Partner progress: Growth caps at 100; Chemistry is halved at 50+ (stored
    // in half points). The line shows the base reward, as the cards do.
    const partnerLine = (partnerId: string, growth: number, chemistry: number) => {
      if (!d.partners[partnerId]) return;
      const key = pairingKey(partnerId);
      const chemNow = (d.chemistryHalves[key] ?? 0) / 2;
      const gBefore = d.partners[partnerId].growth;
      const g = give(`growth:${partnerId}`, "growth", growth, partnerId);
      const c = give(`chemistry:${key}`, "chemistry", chemNow >= CHEMISTRY_HALVE_AT ? chemistry / 2 : chemistry, key);
      out.partner = { id: partnerId, growthBefore: gBefore, growthAfter: d.partners[partnerId].growth, chemBefore: chemNow, chemAfter: (d.chemistryHalves[key] ?? 0) / 2 };
      const parts = [g > 0 ? `+${g} Growth` : "", c > 0 ? `+${chemistry} Chemistry` : ""].filter(Boolean);
      if (parts.length) out.lines.push(`${PARTNERS[partnerId as PartnerId]?.name ?? partnerId} ${parts.join(" · ")}`);
    };
    this.rewardSet.add(doneId);
    d.rewardIds.push(doneId);
    this.rollDay(now);
    if (m.kind === "career" && m.careerMatchId) {
      const id = m.careerMatchId;
      const def = careerMatch(id);
      const R = CAREER_REWARDS;
      const firstAttempt = !d.career.cleared.includes(id);
      if (firstAttempt && m.won) {
        coinsLine("coins", R.win.coins);
        fansLine("fans", R.win.fans);
        if (def.namedRival && !d.namedRivals[id]) {
          d.namedRivals[id] = true;
          coinsLine("rival.coins", R.namedRival.coins, " · Rival defeated", "Rival");
          fansLine("rival.fans", R.namedRival.fans, " · Rival defeated", "Rival");
          out.moments.push({ kind: "stage", stageKey: def.stageKey, rival: def.rival });
        }
        d.career.firstClearWins++;
        d.career.cleared.push(id);
        const ms = milestoneFor(d.career.firstClearWins);
        if (ms && !d.milestones[ms.id]) {
          d.milestones[ms.id] = true;
          coinsLine(`${ms.id}.coins`, ms.coins, ` · ${ms.label}`, ms.label);
          out.events.push(`${ms.label} reached`);
          const st = out.moments.find((x) => x.kind === "stage");
          if (st && st.kind === "stage") st.milestone = ms.label;
          analytics.track("milestone_completed", { id: ms.id });
        }
        const unlock = CAREER_UNLOCKS[def.number];
        if (unlock) {
          const p = (d.partners[unlock.partnerId] ??= { discovered: false, signable: false, signed: false, growth: 0 });
          if (!p[unlock.flag]) {
            p.discovered = true;
            if (unlock.flag === "signable") p.signable = true;
            out.events.push(unlock.event);
            out.moments.push({ kind: "partner", partnerId: unlock.partnerId, flag: unlock.flag, event: unlock.event });
            analytics.track(unlock.flag === "signable" ? "partner_signable" : "partner_discovered", { partner: unlock.partnerId });
          }
        }
        const next = CAREER_MATCH_IDS.find((cid) => !d.career.cleared.includes(cid));
        if (next) d.career.nextMatchId = next;
        // New court: the next match opens on a court no earlier match used.
        const nm = next ? careerMatch(next) : null;
        if (nm?.enabled && nm.court && !CAREER_MATCHES.some((x) => x.number < nm.number && x.court === nm.court)) {
          out.moments.splice(out.moments[0]?.kind === "stage" ? 1 : 0, 0, { kind: "court", court: nm.court });
        }
      } else if (firstAttempt) {
        d.career.firstClearLosses++;
        coinsLine("coins", R.loss.coins, "", "Loss");
        fansLine("fans", R.loss.fans, "", "Loss");
      } else {
        coinsLine("coins", m.won ? R.replay.winCoins : R.replay.lossCoins, "", m.won ? "Replay win" : "Replay");
      }
      const pr = m.won ? R.partnerWin : R.partnerLoss;
      partnerLine(m.partnerId ?? d.activePartnerId, pr.growth, pr.chemistry);
      analytics.track("career_match_completed", { matchId: m.matchId, careerMatchId: id, won: m.won, replay: !firstAttempt });
    } else if (m.kind === "training" || m.kind === "scrimmage") {
      // Daily cap by local day key (rollDay above never moves backwards).
      // After the cap the match still counts and grants nothing. Never Coins/Fans.
      const t = TRAINING_MODES[m.kind];
      const used = d.daily[m.kind];
      d.daily[m.kind] = used + 1;
      if (used < t.dailyCap) partnerLine(m.partnerId ?? d.trainingPartnerId, t.growth, t.chemistry);
      else {
        out.capped = true;
        out.lines.push("Progress used today — play for fun");
      }
      analytics.track(m.kind === "training" ? "training_completed" : "scrimmage_completed", { matchId: m.matchId, won: m.won, capped: !!out.capped });
    } else {
      coinsLine("coins", m.won ? QUICK_PLAY_REWARDS.winCoins : QUICK_PLAY_REWARDS.lossCoins, "", m.won ? "Win" : "Loss");
      analytics.track("quick_play_completed", { matchId: m.matchId, won: m.won });
    }
    this.save();
    return out;
  }

  // ---- Partners / flags (each saves once) --------------------------------
  // SIGN: one serialized transaction — check Coins ≥ cost → subtract once
  // (stable spend id, so never twice) → mark signed → save → emit.
  signPartner(partnerId: string, now: number): boolean {
    const d = this.docState!;
    const p = d.partners[partnerId];
    const cost = SIGN_COST[partnerId as PartnerId];
    if (!p || !p.signable || p.signed || cost === undefined || d.coins < cost) return false;
    const r = this.applyLedger(`sign:${partnerId}`, "coins", -cost, { sourceType: "sign", sourceId: partnerId }, now);
    if (!r.ok || !r.applied) return false;
    p.signed = true;
    p.discovered = true;
    d.chemistryHalves[pairingKey(partnerId)] ??= 0;
    this.save();
    analytics.track("partner_signed", { partner: partnerId, cost, t: now });
    return true;
  }

  // Training partner is separate from the Career active partner (never changes it).
  setTrainingPartner(partnerId: string): boolean {
    const d = this.docState!;
    if (!d.partners[partnerId]?.signed || d.trainingPartnerId === partnerId) return false;
    d.trainingPartnerId = partnerId;
    this.save();
    return true;
  }

  // Inbox: only READ ids are stored (messages are derived from save flags).
  markInboxRead(ids: string[]): boolean {
    const d = this.docState!;
    const add = ids.filter((id) => !d.inboxRead.includes(id));
    if (!add.length) return false;
    d.inboxRead.push(...add);
    this.save();
    return true;
  }

  setActivePartner(partnerId: string): boolean {
    const d = this.docState!;
    if (!d.partners[partnerId]?.signed || d.activePartnerId === partnerId) return false;
    const from = d.activePartnerId;
    d.activePartnerId = partnerId;
    analytics.track("active_partner_changed", { from, to: partnerId });
    this.save();
    return true;
  }

  // Milestone progress (flags only are persisted): completes once.
  milestoneProgress(id: string, value: number, target: number): boolean {
    const d = this.docState!;
    if (d.milestones[id]) return false;
    analytics.track("milestone_progress", { id, value, target });
    if (value < target) return false;
    d.milestones[id] = true;
    analytics.track("milestone_completed", { id });
    this.save();
    return true;
  }
}
