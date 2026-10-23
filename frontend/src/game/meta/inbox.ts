// INBOX: a short list derived from save flags (no server). Only read IDs are stored.
import type { SaveDoc } from "./metaStore";

export interface InboxMessage {
  id: string;
  text: string;
}

export function inboxMessages(d: Pick<SaveDoc, "career" | "partners">): InboxMessage[] {
  const cleared = d.career.cleared;
  const out: InboxMessage[] = [];
  if (cleared.includes("mumbai.community.02") || d.partners.upsi?.discovered) out.push({ id: "inbox.met_upsi", text: "You met Upsi in Dadar" });
  if (cleared.includes("mumbai.community.03")) out.push({ id: "inbox.upsi_signable", text: "Upsi can now be signed" });
  if (cleared.includes("mumbai.local.05")) out.push({ id: "inbox.local_final_soon", text: "Mumbai Local Series Final — coming soon" });
  return out;
}

export function hasUnread(d: Pick<SaveDoc, "career" | "partners" | "inboxRead">): boolean {
  return inboxMessages(d).some((m) => !d.inboxRead.includes(m.id));
}
