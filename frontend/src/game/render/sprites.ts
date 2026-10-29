// CHARACTER SPRITES (render only). Adding a character = one sheet file + one
// line in CHARACTER_SHEETS. Every sheet shares SPRITE_META (768 × 1200, 8 × 12
// cells of 96 × 100, feet point (48, 99), body 64 px tall).
export const SPRITE_META = {
  cell: [96, 100],
  cols: 8,
  feet: [48, 99],
  body_px: 64,
  rows: { idle: 0, run_fwd: 1, run_back: 2, step_r: 3, step_l: 4, forehand: 5, backhand: 6, lob: 7, smash: 8, serve: 9, celebrate: 10, disappointed: 11 },
  contact_frame: { forehand: 3, backhand: 3, lob: 3, smash: 4, serve: 4 },
} as const;

export type SpriteRow = keyof typeof SPRITE_META.rows;
export type StrokeRow = keyof typeof SPRITE_META.contact_frame;

// Back-view sheets of the player's team (near side). Rivals have none yet.
export const PLAYER_CHARACTER_ID = "qt";
export const CHARACTER_SHEETS: Record<string, number> = {
  qt: require("@/assets/images/player_qt_back.png"),
  anli: require("@/assets/images/partner_anli_back.png"),
  upsi: require("@/assets/images/partner_upsi_back.png"),
};

// Partner faces (Badge shows them on the partner colour, cropped to a circle).
export const PORTRAITS: Record<string, number> = {
  anli: require("@/assets/images/portrait_anli.png"),
  upsi: require("@/assets/images/portrait_upsi.png"),
};

// Sheet load status, read by the DEV overlay (kept here, outside the Skia
// module, so match.tsx can read it before Skia loads on web).
export const spriteLoadStatus = { text: "sprites: loading" };
// Partner faces (Badge): a portrait that fails is recorded here and shown in
// the DEV overlay under the sprite line — never a silent fallback.
const faceFails: Record<string, string> = {};
export const portraitLoadStatus = {
  text: "faces: ok",
  fail(id: string, reason: string) {
    faceFails[id] = reason;
    this.text = `faces: failed – ${Object.entries(faceFails).map(([k, r]) => `${k}: ${r}`).join("; ")}`;
  },
};

// On-court size: k = 2.38 × pxPerFoot × 1.3 / body_px.
export const SPRITE_SCALE = (2.38 * 1.3) / SPRITE_META.body_px;
