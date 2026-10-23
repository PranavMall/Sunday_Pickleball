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
Milestone 2 Part A (Foundations) + stabilization + a Phase 0 value pass done
(2026-06). Phase 0 (two commits): line-free gameplay court (court_gameplay.webp,
match-only; menu keeps court_background.webp), kitchen-line rule fix + post-
kitchen striker fairness (138/138 tests, seeded doubles byte-identical), and the
meta shell — local Player/Team identity (first-time prompt + Profile), Match
History screen, and a main-menu shell (Quick Match / History / Profile active;
Career / Training / Passport / Trophy Room = Coming Soon). Gameplay feel is
user-approved (8.25/10) and FROZEN. Awaiting user feel re-check, then:
- **Part B** (not started): game feel (swing/follow-through, squash/stretch,
  reactions, smooth walking), serve aim helper, AI returns tuned by difficulty,
  dink rework.
- **Part C** (not started): lob + smash shots, singles menu/UI, new AI profiles.
- **Phase 1** (not started, define first): Career, Training, Passport, Trophy
  Room, progression/economy.
- **Asset step**: real sprites (per `SPRITE_BRIEF.md`), music, dedicated
  sound-design pass (re-enable `SFX_ENABLED`).
Do NOT start Part B until the user approves.

## Milestone 2 — Part A: Foundations (2026-06)
- Input: single-gesture input (no pan+tap double-fire), instant wind-up pose on
  a valid swipe, one ContactEvent per real strike driving sound + haptic once,
  reserved edge margin, dev-only input trace. Android back intercepts to Pause.
- Audio: expo-audio SFX service (pooled, overlap-safe, alternating variants,
  one sound per contact) + persisted mute toggle in the Pause menu.
- Architecture (roadmap §11): match-config-as-data (engine is mode-agnostic),
  team size is config (SINGLES supported in engine + singles serve rule, dev 1v1
  launch), parametric AI profiles + chemistry hook (presets reproduce M1 exactly),
  per-player stat multipliers (neutral default, forced neutral when normalized),
  local match-result logging, layered character contract (placeholders render
  through it), interface-only ProfileService/AnalyticsService/AdService/
  PurchaseService with a SaveModel (cumulative fans, separate form, ratings per
  player AND per pairing).
- Verified: doubles parity byte-for-byte identical (parity.ts) before/after;
  engine suite 99 → 119 passing.


## Milestone 2 — Part B1 (2026-06) — DONE, awaiting user device test
- C1 human post-bounce retrieval fix (intercept/plant + legal swipe firing) · C2 kitchen button NET/BACK · C3 real dinks + let-it-bounce cue · C4 court-fit + small fixes · C6 home hub + fullscreen. (C5 not needed: no singles-specific bug.)
- 194/194 headless tests. Next: wait for user approval before B2 (game feel, serve aim helper, lob/smash later).

## Milestone 2 Part B2 (2026-06) — DONE, awaiting phone test
See CHANGELOG B2 entry. 236/236 tests. Next (only after user approval): Part C (singles menu/UI + AI profiles, asset step), M3 (onboarding, settings, analytics).

## B3 (Pickleball authenticity) — DONE, awaiting phone test. Gameplay frozen after this. Commits d70f8df / a87bf13 / 0e65fee. 263/263 tests.

## Phase 1A Session A (Commits 0–2) — DONE, awaiting phone check (smash timing + fault labels)
- C0 f8bbeb2: rename to Pickle-Ballers (legacy "Picklewood" team → random pool name) + point-end fault label pill.
- C1 7d3ba5f: two-phase smash cue (HIGH BALL — GET READY → SMASH) + human-only smash latch (0.6 ft tolerance). AI untouched.
- C2 728582f: first-to-N scoring fix; src/game/meta (MetaStore single JSON save `pb.meta`, idempotent ledger, analytics, economyConfig with 10 Career IDs).
- Gate: run.ts 263/263 (output identical to fbb61cc), b3Report/shotMix byte-identical, phase1a.ts 110/110, step bench ~2.15µs both.
- Next: Session B (screens, Career, Team) only after user approval.

## Phase 1A Session B — App shell (2026-06, commits 261e5a3 / 6f9edbb / c048949) — USER CHECK PENDING
- 3a: wooden destination bar (Home/Career/Team/Locker locked/Training; replace-nav, animation none, one bg mounted via focus-gated ScreenBg); new Home; Quick Play (app/quickplay.tsx) replaces difficulty.tsx; Skip → random Appendix A names (NAME_MAX raised 16→18 for "Sea Link Slammers"); teamCode(); monogram badges; 11 assets in assets/images.
- 3b: economyConfig Career table (10 IDs community.01-03/local.04-06/district.07-10), PARTNERS (Anli/Upsi/Matz), reward components (win 100c/20f, named rival 75c/25f, Milestone I 100c → Match 3 = 275/45), SIGN_COST upsi 750, TRAINING_MODES (drill pair ROOKIE DEF/KIT, sparring pair CLUB AGG/TAC — assumptions), Career/Team/Training screens, Inbox (src/game/meta/inbox.ts) + Stats overlays, MetaStore.setTrainingPartner/markInboxRead, matchSetup.ts (quick/career/training builders).
- 3c: render/courts.ts (court image, edge fill, scoreboard text area per court), painted scoreboard in match.tsx, old HUD panel removed; dev Mumbai court button on Quick Play (__DEV__).
- Session C NEXT (only after user approval): rewards, career clearing, signing spend, training counters/growth.
- Tests: src/game/__tests__/phase1b.ts (53), scripts/regress1a.sh; baselines from fbb61cc worktree at /tmp/base.

## Commit 3d (d338a10) — UI polish after phone check — USER CHECK PENDING
- src/ui/Text.tsx = the app's only Text/TextInput (allowFontScaling=false; numberOfLines ⇒ shrink-to-fit 0.75, max 2 lines, clip, never "…"). All app/ & src/ui & components import Text from "@/src/ui/Text".
- Titles removed on Career/Team/Training; sizes per brief (max 24pt on destinations); cards rgba cream 0.9 (UI.cardBg).
- src/ui/DestinationBackdrop.tsx in root layout behind Stack (NAV_THEME transparent background); destinations draw no bg; 150ms content FadeIn; Image.prefetch both bgs.
- PickleballIcon (Views) in DestinationBar for Training.
- STOP: Session C not started.
