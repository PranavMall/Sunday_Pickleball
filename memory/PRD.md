# Picklewood — PRD

## Problem statement
Build a polished, portrait, arcade-authentic 2v2 pickleball game for iOS/Android. Automatic
player movement, swipe shot control, pseudo-3D ball on a perspective watercolour court,
configurable AI difficulty/personalities. Behavioural reference: `prototype_ver_2.1`. Visual
reference: supplied garden-court artwork. Success = one match feels fun enough to tap REMATCH.
Work in milestones; stop for review after each.

## Architecture
- Headless deterministic TS sim in logical court FEET (fixed 60Hz, seeded RNG), separate from
  rendering. Pipeline: logical → simulation → perspective (homography onto painted court) → Skia.
- Slots support LOCAL_HUMAN / AI / REMOTE_HUMAN; network/profile/progression/purchase are stubs.
- Renderer: React Native Skia (native authoritative; web preview via CanvasKit loader).

## Personas
- Casual mobile player wanting quick, satisfying arcade matches.
- Returning player mastering shot placement, kitchen play and difficulty tiers.

## Core requirements (static)
Portrait only; 2v2 (human + AI partner vs 2 AI); automatic movement; swipe control; pseudo-3D
ball + shadow + net; full pickleball rules in RuleManager; doubles side-out scoring to 11 win-by-2;
ROOKIE/CLUB/PRO (M1) with personalities; result + rematch; rules unit tests.

## Implemented (2026-06 — Milestone 1)
- Full simulation: BallController physics, target-aimed shots (serve/drive/dink/drop),
  automatic movement with interception prediction + spacing, one configurable AIController.
- RuleManager: serve (diagonal box, clear kitchen), two-bounce, net (clip-and-live), in/out,
  double bounce, kitchen volley/momentum/re-establishment, dead ball.
- ScoreManager: 0-0-2 opening, server 1/2 rotation, side-out, switch sides on point, 11 win-by-2.
- PerspectiveRenderer homography calibrated to painted court; code-drawn lines/kitchen/net at
  official positions; depth-scaled players; ball + shadow + trail; kitchen flash.
- UI: main menu, difficulty select, match (HUD score/server/rally/pause, kitchen toggle, serve/hit
  hints, debug FPS overlay), result overlay (winner, score, longest rally, rallies, dinks, kitchen
  faults, REMATCH/Menu/Share), landscape rotate overlay.
- 45/45 automated tests pass (rules + seeded AI-vs-AI). ROOKIE<CLUB<PRO 100% win rate; no stuck states.

## Backlog
- P0 (M2): integrate supplied sprites/ball/audio; character animation + game feel; lob + smash;
  CASUAL/ADVANCED/LEGEND; tuned personalities; Kitchen Mastery (rule-safe, toggleable).
- P1 (M3): nickname flow, How to Play, settings, privacy notice, delete-my-data; PostHog analytics
  + Sentry; share; performance pass; installable builds + web beta.
- P2 (future, NOT now): accounts/sign-in, online multiplayer, store/purchases, ads, extra courts.

## Milestone 1.1 correction pass (2026-06)
- Serving tracked as a real PLAYER; correct doubles rotation (server keeps serve + teammates
  swap on a point; partner becomes Server 2 on a loss; side-out picks the right-court player).
- courtSide is now TEAM-RELATIVE (far team's right = screen-left); serve boxes correct both ways.
- Receivers no longer reset each point; only the server is placed.
- AI partner fixed at CLUB; difficulty scales the two opponents only.
- Swipes expire after 0.28 s (no stale/delayed shots).
- Human shot quality: timing/aim → accuracy & occasional net/out (master `forgiveness` knob).
- Court painted via expo-image behind a transparent Skia canvas (fixes Expo Go); WebP 274 KB.
- Renamed to Picklewood; `yarn test:game`; seed shown in debug overlay.
- 71/71 tests pass; 150 seeded AI-vs-AI matches (50/tier) complete, 0 stuck states.

## Next tasks
Await user sign-off on Milestone 1 (post-1.1 corrections). Do NOT start M2 until approved.
