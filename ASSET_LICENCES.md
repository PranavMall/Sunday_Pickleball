# Picklewood — Asset Licences

All third-party and supplied assets used in the app, with their source and
licence. Keep this current whenever an asset is added or replaced.

## Audio — hit SFX (placeholders)
Supplied by the project owner (Pranav). Processed placeholders: leading silence
removed (each hit starts within ~4 ms), mono 44.1 kHz 16-bit WAV, peak-normalised
to −3 dBFS with a short fade-out. **Not re-encoded by the app** (we never add
leading silence). To be replaced before launch.

| File | Use in game | Source | Licence |
|------|-------------|--------|---------|
| `assets/audio/sfx_pop_1.wav`, `sfx_pop_2.wav` | Normal paddle contact (serve, soft drive) | Supplied by owner | Owner-provided, project use |
| `assets/audio/sfx_drive_1.wav`, `sfx_drive_2.wav` | Hard contact (strong drives / smash) | Supplied by owner | Owner-provided, project use |
| `assets/audio/sfx_kitchen_soft_1.wav`, `sfx_kitchen_soft_2.wav` | Dinks (soft paddle) — one of soft/bright is paddle, the other the bounce (owner to confirm by ear) | Supplied by owner (sliced from a recorded dink rally) | Owner-provided, project use |
| `assets/audio/sfx_kitchen_bright_1.wav`, `sfx_kitchen_bright_2.wav` | Soft drops / bounce | Supplied by owner (sliced from a recorded dink rally) | Owner-provided, project use |

Contact → sound mapping lives in `src/game/services/sfx.ts` (`pickSet`), easy to
re-map once the owner confirms soft vs bright by ear.

## Images
| File | Use | Source | Licence |
|------|-----|--------|---------|
| `assets/images/court_background.webp` | Painted garden court background | Supplied by owner | Owner-provided, project use |

## Fonts
System fonts only (no bundled custom fonts at this time).
