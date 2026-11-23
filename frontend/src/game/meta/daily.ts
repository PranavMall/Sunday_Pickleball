// DAILY CHALLENGE (Release 11 Part D): one twist per local day (by weekday),
// rivals from your next uncleared Career match. Pure logic + the match setup.
import { buildMatchConfig } from "../config/matchConfig";
import { CAREER_MATCH_IDS, HUMAN_PRESSURE_MATCHES, QUICK_PLAY_COURT, careerMatch, type CareerMatchDef } from "./economyConfig";
import { dayKeyOf } from "./metaStore";
export { DAILY_REWARD_COINS, DAILY_WINS_KEEP } from "./metaStore";
import { careerLooksOf, nearTeam, partnerOf, type MatchSetup } from "./matchSetup";
import type { RuleModifiers, StartingScore } from "../config/matchConfig";

export const DAILY_UNLOCK_MATCH = "mumbai.community.02";
export const DAILY_CODE = "DLY";
export const DAILY_COLOR = "#6C7A89";
export const DAILY_TEAM = "Daily rivals";

export interface DailyTwist {
  name: string;
  short: string;
  line: string;
  singles?: boolean;
  ruleModifiers?: RuleModifiers;
  startingScore?: StartingScore;
}

// Index = JS weekday (0 = Sunday).
export const DAILY_TWISTS: DailyTwist[] = [
  { name: "Classic", short: "Doubles to 11", line: "Classic doubles to 11." },
  { name: "Quick fire", short: "First to 7", line: "First to 7. No time to warm up.", ruleModifiers: { pointsToWin: 7, winBy: 2 } },
  { name: "Clutch", short: "From 8–8", line: "8–8. Every point counts.", startingScore: { near: 8, far: 8, servingTeam: "near", serverNumber: 1 } },
  { name: "Late start", short: "They lead 3–0", line: "They lead 3–0. Chase them down.", startingScore: { near: 0, far: 3, servingTeam: "near", serverNumber: 1 } },
  { name: "Singles sprint", short: "Singles, first to 7", line: "Just you, one rival, first to 7.", singles: true, ruleModifiers: { pointsToWin: 7, winBy: 2 } },
  { name: "Comeback", short: "You trail 3–4", line: "Rain stopped play at 3–4: you're behind.", startingScore: { near: 3, far: 4, servingTeam: "far", serverNumber: 1 } },
  { name: "Long game", short: "First to 15", line: "First to 15. Pace yourself.", ruleModifiers: { pointsToWin: 15, winBy: 2 } },
];

type DailySave = { career: { cleared: string[] }; dailyChallenge: { wins: string[] } };

export const dailyUnlocked = (d: { career: { cleared: string[] } } | null | undefined) => !!d && d.career.cleared.includes(DAILY_UNLOCK_MATCH);
export const dayKeyToDate = (k: string) => {
  const [y, m, dd] = k.split("-").map(Number);
  return new Date(y, m - 1, dd, 12);
};
export const twistFor = (dayKey: string): DailyTwist => DAILY_TWISTS[dayKeyToDate(dayKey).getDay()];
export const wonToday = (d: DailySave | null | undefined, now: number) => !!d && d.dailyChallenge.wins.includes(dayKeyOf(now));

// The rivals' source: the next uncleared Career match (Match 12's when all are cleared).
export function dailyRivalMatch(cleared: string[]): CareerMatchDef {
  const id = CAREER_MATCH_IDS.find((x) => !cleared.includes(x)) ?? CAREER_MATCH_IDS[CAREER_MATCH_IDS.length - 1];
  return careerMatch(id);
}
export const tierName = (m: CareerMatchDef) => {
  const t = m.ai.includes("PRO") ? "PRO" : m.ai.includes("CLUB") ? "CLUB" : "ROOKIE";
  return t[0] + t.slice(1).toLowerCase();
};

// "6h 12m left" until local midnight.
export function timeLeftText(now: number): string {
  const d = new Date(now);
  const mid = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
  const mins = Math.max(0, Math.floor((mid - now) / 60000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
}

export type DayState = "won" | "missed" | "today" | "future";
// THIS WEEK strip: Monday → Sunday of the current local week.
export function weekStrip(now: number, wins: string[]): { label: string; date: number; key: string; state: DayState }[] {
  const t = new Date(now);
  const monday = new Date(t.getFullYear(), t.getMonth(), t.getDate() - ((t.getDay() + 6) % 7), 12);
  const today = dayKeyOf(now);
  return ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((label, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i, 12);
    const key = dayKeyOf(d.getTime());
    const state: DayState = wins.includes(key) ? "won" : key === today ? "today" : key < today ? "missed" : "future";
    return { label, date: d.getDate(), key, state };
  });
}

// The day's match: you + your active partner vs the next Career match's pair.
export function dailySetup(dayKey: string, cleared: string[], partnerId: string, seed: number, signed: (id: string) => boolean = () => false, boost = 1): MatchSetup {
  const tw = twistFor(dayKey);
  const m = dailyRivalMatch(cleared);
  const looks = careerLooksOf(m, signed);
  const near = nearTeam(partnerId, boost);
  const config = buildMatchConfig({
    seed,
    format: tw.singles ? "singles" : "doubles",
    matchType: "daily",
    court: m.court ?? QUICK_PLAY_COURT,
    near: tw.singles ? { controllers: ["LOCAL_HUMAN"], names: ["You"] } : near,
    far: tw.singles
      ? { controllers: ["AI"], difficulties: [m.ai[0]], personalities: [m.personalities[0]], names: [DAILY_TEAM] }
      : { controllers: ["AI", "AI"], difficulties: [...m.ai], personalities: [...m.personalities], names: [`${DAILY_TEAM} 1`, `${DAILY_TEAM} 2`] },
    ...(tw.startingScore ? { startingScore: { ...tw.startingScore } } : {}),
    ...(tw.ruleModifiers ? { ruleModifiers: { ...tw.ruleModifiers } } : {}),
    ...(HUMAN_PRESSURE_MATCHES.includes(m.id) ? { humanRallyPressure: true } : {}),
  });
  return { mode: "daily", config, rivalCode: DAILY_CODE, rivalName: DAILY_TEAM, label: `daily.${dayKey}`, partnerId: partnerOf(partnerId).id, rivalLooks: tw.singles ? [looks[0]] : looks, twist: { name: tw.name, line: tw.line, short: tw.short }, dailyDay: dayKey };
}

