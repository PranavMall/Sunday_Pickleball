# Picklewood

A portrait, arcade-authentic 2v2 pickleball game for iOS & Android (Expo + React Native Skia).
You + an AI partner vs two AI rivals on a hand-painted watercolour garden court.

## Run
- `cd frontend && yarn` then start via Expo (Metro on port 3000 in this environment).
- Open in Expo Go (QR) or the web preview.

## Architecture
Gameplay is a headless, deterministic TypeScript simulation in logical court FEET, fully
separate from rendering:

```
src/game/
  config/   court geometry, tuning, AI difficulty table + personalities
  core/     seedable RNG
  sim/      GameSimulation (fixed 60Hz), movement, AIController, RuleManager,
            ScoreManager, shots, physics, types
  render/   perspective (homography -> painted court), GameCanvas (Skia), CourtRenderer
  services/ NetworkService/ProfileService/ProgressionService/PurchaseService (stubs),
            AnalyticsService, CrashReporting
app/        index (menu) · difficulty · match (game + HUD + result)
```

- Pipeline: logical court -> simulation -> perspective projection -> Skia 2D.
- All rule decisions live in `RuleManager`; all randomness is seeded (`core/rng`).
- Renderer: React Native Skia (native authoritative); web preview loads CanvasKit via `CourtRenderer`.

## Tests
Headless rules + seeded AI-vs-AI smoke matches:

```
cd frontend && npx tsx src/game/__tests__/run.ts
```

## Assets
`assets/images/court_background.png` is the supplied artwork (temporary until final art / a
line-free version arrives). Character sprites, ball sprite and audio are placeholders in M1.

See `CHANGELOG.md` for every behaviour change from the prototype.
