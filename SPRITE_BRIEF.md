# Picklewood — Character Sprite Brief (v1, Milestone 2 Part A)

This is the one-page spec for producing character art. Characters are drawn as a
stack of **independent layers on a shared rig**, composited in Skia. Placeholder
players already render through this exact system (`src/game/render/character.tsx`),
so finished art drops in as a pure asset change — no renderer rewrite.

Deliver art to this contract and nothing downstream needs to change.

## 1. Layers (one sprite sheet per layer)
Draw order, farthest (feet) to nearest (head) — a frame MUST respect it:

1. `shoes`
2. `bottom` (shorts/skirt)
3. `top` (shirt)
4. `wristAccessory` (band / watch) — optional, may be empty
5. `paddle` (held in the hand; includes the forearm/grip)
6. `body` (head + neck + skin; arms baked into top where needed)
7. `hair`
8. `headAccessory` (cap / visor / sunglasses) — optional, may be empty

Each layer is its own transparent PNG sequence so colours/items can be mixed and
matched per character. Unused optional layers ship as fully transparent frames.

## 2. Rig & anchor points
- **Anchor origin = the FEET** (the point that sits on the court). All layers
  share this origin so they stack correctly at any on-court depth.
- **Rig height ≈ 2.6 "logical feet"** tall at scale 1. The engine scales every
  layer uniformly by `pxPerFoot` at the player's court depth (near players are
  larger, far players smaller) — art must be drawn at a single canonical size
  and NOT pre-baked with perspective.
- Keep the **hand/paddle anchor** consistent across frames (the paddle layer is
  swept/raised by code for wind-up and follow-through).
- Horizontal centre of the rig = the player's x. Feet line = bottom of the frame.

## 3. Views (required)
Two views per character, because the court is pseudo-3D:
- **`back`** — used for NEAR-court players (seen from behind the baseline).
- **`front`** — used for FAR-court players (seen face-on across the net).

## 4. Animation list (frame sequences per view)
Milestone 2 uses these; name sheets by `state`:
- `idle` (2–4 frames, subtle breathing)
- `walk` (6–8 frames, used for automatic movement — Part B game-feel)
- `ready` / `split-step` (2–4 frames)
- `windup` (anticipation, 3–5 frames) — triggered the instant a swipe is accepted
- `swing` (contact + follow-through, 4–6 frames) — the "pop" is the contact frame
- `react_win` / `react_lose` (2–4 frames each) — point reactions

Contact happens on a specific `swing` frame; mark it (e.g. `swing_03`) so code can
sync the single contact flash/sound/haptic to it.

## 5. Frame size, format & naming
- **Frame size:** 256 × 384 px canvas per frame (portrait, 2:3), rig centred
  horizontally, feet on the bottom edge. Trim/padding consistent across frames.
- **Format:** PNG with straight (non-premultiplied) alpha, or a packed sprite
  atlas + JSON (TexturePacker-style) per layer per view.
- **Naming:** `pw_<layer>_<view>_<state>_<frame>.png`
  e.g. `pw_paddle_back_swing_03.png`, `pw_hair_front_idle_01.png`.
- **Palette:** art should be tintable where possible (team colour is applied to
  `top` by code); supply neutral/white-mask variants if you want code tinting.

## 6. Out of scope for this brief
No court art, ball art, net art, UI or FX here — those are separate assets.
