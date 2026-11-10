// SHARE MESSAGES (text only). The result screen's share text, from the
// finished match. First matching row wins. STORE_LINK gets the Play Store
// link in Release 15; when not empty it is appended on a new line.
export const STORE_LINK = "";

export interface ShareCtx {
  mode: string; // "career" | "quick" | ...
  score: string; // "11–4" (mine first)
  rival: string;
  court: string;
  partner: string;
  rivalPoints: number;
  careerNumber?: number; // Career match number
  stageFinalFirstClear?: boolean; // a stage final won for the first time
  stageName?: string;
  trophyCount?: number; // trophies won after this match
}

function body(c: ShareCtx): string {
  if (c.mode === "career") {
    if (c.stageFinalFirstClear) return `🏆 ${c.stageName} champions! ${c.score} vs ${c.rival} at ${c.court}. That's trophy ${c.trophyCount} of 4 in Pickle-Ballers 🥒`;
    if (c.careerNumber === 8) return `🥒 Rain stopped play at 3–4. We came back and won ${c.score} vs ${c.rival} at ${c.court}. Pickle-Ballers`;
    if (c.careerNumber === 10) return `🥒 The lights failed at 8–8. We finished it ${c.score} vs ${c.rival}. Pickle-Ballers`;
    if (c.careerNumber === 5) return `🥒 They turned up late, we turned up ready: ${c.score} vs ${c.rival} at ${c.court}. Pickle-Ballers`;
    if (c.rivalPoints <= 2) return `🥒 ${c.score} vs ${c.rival}. Somebody check on them. Pickle-Ballers, Match ${c.careerNumber} of 12`;
    return `🥒 Beat ${c.rival} ${c.score} at ${c.court}. ${c.partner} wants half the credit. Pickle-Ballers, Match ${c.careerNumber} of 12`;
  }
  return `🥒 Won ${c.score} in Pickle-Ballers Quick Play. Doubles, kitchen rules, no mercy.`;
}

export function shareMessage(c: ShareCtx): string {
  return withLink(body(c));
}

export function withLink(text: string): string {
  return STORE_LINK ? `${text}\n${STORE_LINK}` : text;
}
