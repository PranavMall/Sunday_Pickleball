// LOCAL GUEST IDENTITY (device-only). No accounts, no cloud, no backend.
// Stores the player's chosen Player Name + Team Name in AsyncStorage. This is
// the lightweight identity the progression layer will build on later.
import AsyncStorage from "@react-native-async-storage/async-storage";

const PLAYER_KEY = "pw.playerName";
const TEAM_KEY = "pw.teamName";
const SET_KEY = "pw.identitySet"; // "1" once the user has set or skipped names

export const DEFAULT_PLAYER = "Player";
export const DEFAULT_TEAM = "Picklewood";
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

// Skip the first-time prompt: use friendly defaults, mark as set.
export async function skipIdentity(): Promise<void> {
  try {
    await AsyncStorage.multiSet([[PLAYER_KEY, DEFAULT_PLAYER], [TEAM_KEY, DEFAULT_TEAM], [SET_KEY, "1"]]);
  } catch (e) {
    console.warn("[profile] skip failed", e);
  }
}
