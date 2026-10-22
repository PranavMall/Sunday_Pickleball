// LOCAL GUEST IDENTITY (device-only). No accounts, no cloud, no backend.
// Stores the player's chosen Player Name + Team Name in AsyncStorage. This is
// the lightweight identity the progression layer will build on later.
import AsyncStorage from "@react-native-async-storage/async-storage";

const PLAYER_KEY = "pw.playerName";
const TEAM_KEY = "pw.teamName";
const SET_KEY = "pw.identitySet"; // "1" once the user has set or skipped names

export const DEFAULT_PLAYER = "Player";
export const DEFAULT_TEAM = "Pickle-Ballers";
// The pre-rename default. A saved team name EXACTLY equal to this is replaced
// once (at app start) by a random name from TEAM_NAME_POOL.
const LEGACY_DEFAULT_TEAM = "Picklewood";
export const TEAM_NAME_POOL = [
  "Bandra Aces", "Harbour Hawks", "Monsoon Smash", "Gully Rockets", "Coastal Kings",
  "City Spinners", "Metro Mavericks", "Sunset Strikers", "Sea Link Slammers", "Court Cobras",
  "Rally Royals", "Dink Dynasty", "Paddle Pirates", "Smash Squad", "Net Ninjas",
  "Spin Society", "Lob Legends", "Baseline Bandits", "Kitchen Kings", "Volley Vibes",
  "Street Aces", "Island Bounce", "Harbour Heat", "Monsoon Masters", "City Cyclones",
  "Coastal Crew", "Metro Magic", "Gully Giants", "Rally Riders", "Court Comets",
];
export const NAME_MIN = 2;
export const NAME_MAX = 16;

// Small family-friendly profanity screen (substring, case-insensitive). Not
// exhaustive — just blocks the obvious ones for a local display name.
const BLOCKLIST = [
  "fuck", "shit", "bitch", "cunt", "asshole", "dick", "piss", "bastard",
  "nigger", "faggot", "slut", "whore", "retard",
];

export interface NameCheck {
  ok: boolean;
  value: string;
  error?: string;
}

// Trim, length-check (2–16) and profanity-screen a proposed name.
export function validateName(raw: string, label = "Name"): NameCheck {
  const value = (raw ?? "").trim();
  if (value.length < NAME_MIN) return { ok: false, value, error: `${label} needs at least ${NAME_MIN} characters` };
  if (value.length > NAME_MAX) return { ok: false, value, error: `${label} must be ${NAME_MAX} characters or fewer` };
  const lower = value.toLowerCase();
  if (BLOCKLIST.some((w) => lower.includes(w))) return { ok: false, value, error: "Please choose a friendlier name" };
  return { ok: true, value };
}

export interface Identity {
  playerName: string;
  teamName: string;
}

// Always returns usable values (falls back to defaults). Never throws.
export async function getIdentity(): Promise<Identity> {
  try {
    const [p, t] = await Promise.all([
      AsyncStorage.getItem(PLAYER_KEY),
      AsyncStorage.getItem(TEAM_KEY),
    ]);
    return {
      playerName: p && p.trim() ? p : DEFAULT_PLAYER,
      teamName: t && t.trim() ? t : DEFAULT_TEAM,
    };
  } catch {
    return { playerName: DEFAULT_PLAYER, teamName: DEFAULT_TEAM };
  }
}

export async function hasIdentity(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SET_KEY)) === "1";
  } catch {
    return false;
  }
}

// Persist names (clamped to valid values) and mark identity as set.
export async function saveIdentity(playerName: string, teamName: string): Promise<void> {
  const p = validateName(playerName, "Player name");
  const t = validateName(teamName, "Team name");
  const pv = p.ok ? p.value : DEFAULT_PLAYER;
  const tv = t.ok ? t.value : DEFAULT_TEAM;
  try {
    await AsyncStorage.multiSet([[PLAYER_KEY, pv], [TEAM_KEY, tv], [SET_KEY, "1"]]);
  } catch (e) {
    console.warn("[profile] save failed", e);
  }
}

// Rename migration (app start): replace ONLY the exact old default team name.
// Returns the new name, or null when nothing changed. Never throws.
export async function migrateLegacyTeamName(pick: () => number = Math.random): Promise<string | null> {
  try {
    if ((await AsyncStorage.getItem(TEAM_KEY)) !== LEGACY_DEFAULT_TEAM) return null;
    const name = TEAM_NAME_POOL[Math.floor(pick() * TEAM_NAME_POOL.length) % TEAM_NAME_POOL.length];
    await AsyncStorage.setItem(TEAM_KEY, name);
    return name;
  } catch {
    return null;
  }
}

// Skip the first-time prompt: use friendly defaults, mark as set.
export async function skipIdentity(): Promise<void> {
  try {
    await AsyncStorage.multiSet([[PLAYER_KEY, DEFAULT_PLAYER], [TEAM_KEY, DEFAULT_TEAM], [SET_KEY, "1"]]);
  } catch (e) {
    console.warn("[profile] skip failed", e);
  }
}
