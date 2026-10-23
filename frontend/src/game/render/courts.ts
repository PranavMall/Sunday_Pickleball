// Per-court visuals (render-only). Both courts share the projector calibration
// in perspective.ts unchanged (A 304,521 · B 729,525 · C 888,1197 · D 133,1191).
// config.court selects the entry; unknown ids fall back to Bandra Garden.

export interface CourtVisual {
  image: number; // require()'d asset
  edgeTop: string; // spare-space fill above the image
  edgeBottom: string; // ... and below
  // Live scoreboard text area in IMAGE px (painted face minus a 10 px margin).
  scoreArea: { x0: number; y0: number; x1: number; y1: number };
}

export const COURT_VISUALS: Record<string, CourtVisual> = {
  bandra_garden: {
    image: require("@/assets/images/court_bandra_garden.webp"),
    edgeTop: "#C8B561",
    edgeBottom: "#F0BC3E",
    scoreArea: { x0: 344, y0: 194, x1: 680, y1: 302 }, // face x 332–691, y 184–314
  },
  mumbai_local: {
    image: require("@/assets/images/court_mumbai_local.webp"),
    edgeTop: "#B5C5B0",
    edgeBottom: "#EEB86D",
    scoreArea: { x0: 344, y0: 194, x1: 680, y1: 302 }, // face x 334–689, y 184–312
  },
};

export function courtVisual(court: string | undefined): CourtVisual {
  return COURT_VISUALS[court ?? ""] ?? COURT_VISUALS.bandra_garden;
}
