// INBOX: messages derived from save flags (no server). Only read IDs are stored.
import type { SaveDoc } from "./metaStore";

export interface InboxMessage {
  id: string;
  sender: string; // monogram + name
  senderId?: string; // partner id (portrait / colour)
  subject: string;
  line: string;
  cta: { label: string; path: "/career" | "/team" };
}

const MANAGER = "Team Manager";

export function inboxMessages(d: Pick<SaveDoc, "career" | "partners">): InboxMessage[] {
  const cleared = d.career.cleared;
  const out: InboxMessage[] = [
    { id: "inbox.welcome", sender: MANAGER, subject: "Your Community Cup starts now", line: "Three matches in Bandra. Win the final.", cta: { label: cleared.length ? "VIEW CAREER" : "PLAY MATCH 1", path: "/career" } },
  ];
  if (cleared.includes("mumbai.community.02") || d.partners.upsi?.discovered)
    out.push({ id: "inbox.met_upsi", sender: "Upsi", senderId: "upsi", subject: "Nice game in Dadar.", line: "Win the Community Cup and come find me.", cta: { label: "VIEW CAREER", path: "/career" } });
  if (cleared.includes("mumbai.community.03")) {
    out.push({ id: "inbox.upsi_signable", sender: MANAGER, subject: "Upsi is available", line: "Sign her in Team for 750 Coins.", cta: { label: "VIEW TEAM", path: "/team" } });
    out.push({ id: "inbox.new_court_local", sender: MANAGER, subject: "Mumbai Local is open", line: "The Mumbai Local Series is played there.", cta: { label: "VIEW CAREER", path: "/career" } });
  }
  if (cleared.includes("mumbai.local.05")) {
    out.push({ id: "inbox.matz_watching", sender: "Matz", senderId: "matz", subject: "Saw your match. Not bad.", line: "Keep winning and we will talk.", cta: { label: "VIEW TEAM", path: "/team" } });
    out.push({ id: "inbox.local_final_soon", sender: MANAGER, subject: "Match 6 coming soon", line: "The Mumbai Local Series Final arrives in an update.", cta: { label: "VIEW CAREER", path: "/career" } });
  }
  return out;
}

export function hasUnread(d: Pick<SaveDoc, "career" | "partners" | "inboxRead">): boolean {
  return inboxMessages(d).some((m) => !d.inboxRead.includes(m.id));
}
