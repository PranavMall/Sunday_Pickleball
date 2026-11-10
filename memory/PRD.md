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

## Phase 1A Session C (2026-06) — Commits 4–5 DONE, awaiting Pranav's full phone test
- Commit 4 (f835d5f): MetaStore.completeMatch computes all rewards from economyConfig (Career first-clear win 100C/20F, loss 35C; rival first defeat 100C/25F; Milestones I/II/III 75/150/250 at 3/6/10 first-clear wins; replay 40/14C; partner +8/+5 Growth +1 Chem, chem halved at 50+, growth cap 100; Quick Play 40/20C). Discovery: Upsi met (M2), signable (M3), Matz discovered (M5). New result screen (grant lines, events, next goal, mode buttons). Career replays via the progress strip; Match 6 COMING SOON. Form removed from Home/Stats (fields stay in save, unused). DestinationBackdrop renders nothing on /match.
- Commit 5 (9498bc8 + polish): signPartner = one transaction (spend id sign:upsi), make-active prompt; replay substitution (Upsi→Kiran, Matz→Vikram when signed); Training +20/+2, Scrimmage +10/+1 to training partner, caps 2/3 per local day, after-cap grants nothing; PLAY AGAIN/BACK.
- Tests: phase1c.ts 53/53; run.ts 263/263; b3Report/shotMix byte-identical to fbb61cc; step 2.16 µs (was 2.15–2.16).
- NEXT: STOP. Do not start First Session tutorial / presentation layer until Pranav approves.

## Phase 1A Session D (2026-06) — Commits 6–8 DONE, awaiting Pranav's phone test (STOP rule)
- c2985ec Commit 6: Next line Career only; Share only Career/Quick Play wins; backdrop memory-disk; sizes −15–20%; 80% cream cards; Team one card per partner; Stats 6-cell grid w/ icons; celebration pop-ups (stage/new court/partner) + animated result card (src/ui/MatchEnd.tsx) from this match's ledger entries.
- 660619c Commit 7: Growth running total + levels (src/game/meta/levels.ts), stage cap 300/500; PARTNER_REWARDS win/loss by mode; Chemistry fade (chemistry_fade ledger, 25-floor, catch-up, Rusty); Team info + 4 actions; Quick Play own partner (quickPartnerId); Career codes/replay marks/NEW court tag (courtsPlayed); M3–5 line-ups; Inbox sender/subject/line/CTA.
- fc0663b Commit 8: near-team pixel sprites (render/sprites.ts CHARACTER_SHEETS, render/spriteAnim.ts preallocated animator, one Atlas per sheet), game-over walk+celebrate 1.9 s, portraits in Badge, DEV Sprites On/Off.
- Tests changed (rule changed by brief): phase1c partner lines/values (7.2), growth cap (7.1), training values; phase1b inbox (7.9), Match 4 line-up (7.8). New sessionD block in phase1c. phase1c 72/72, run.ts 263/263, b3Report/shotMix byte-identical vs fbb61cc, step 2.15–2.19 µs.
- Web DEV probe Sprites On vs Off: 60 fps, 60 renders/s, work 0.1 ms both. Phone A/B pending.
- Testing: /app/test_reports/iteration_14.json — all flows pass.

## Commit 8.2 (06055f5) — seven fixes
- Capped Training/Scrimmage never fades Chemistry; per-match loading cover (CourtRenderer keyed by matchId); Chemistry halves shown; Training/Scrimmage win/loss line; smash wind-up uses smash row; expo-asset direct dep; DEV sprite line names sheets.
- STOP: awaiting Pranav phone test.

## Release 9: Commit 8.3 (1407ac1) + Commit 9 (8d5bc27, fit 2nd commit)
- 8.3: receivers hold depth on serve return (new frozen baseline: b3 md5 097a6010…, shotMix 12388643…); court memory-disk cache + next-court prefetch; portrait onError + DEV faces line.
- 9: 14 rival front sprites with per-match looks, 4-sheet loader, FarSpriteAnimator; stage trophies; Matz face; short team names; Maharashtra Championship.
- STOP: awaiting Pranav phone test. Open question: Quick Play may show a signed Upsi/Matz on the rival side.

## Release 10 (commits 227d5b9 + fit fix)
- 12-match Mumbai career (community/local/tour/district), all enabled; Matches 4–5 rebalanced (ROOKIE+PRO)
- 4 new courts (Nashik, Mahabaleshwar, Pune, Marine Drive Night), 12 rival sheets, Maharashtra Championship trophy
- Matz signable after Match 6 (1000 Coins), partner_matz_back sheet; Team locked text derived from unlocks
- Quick Play rivals: (seed mod 12)+1 with reserve looks (no Upsi/Matz)
- Mumbai Journey card (src/ui/JourneyCard.tsx) replaces Tournament Progress
- Quick Play: 7 paid matches/day (daily.quick), "Coins used today — play for fun"
- Fault pill rule hints (faultLabel.ts), first 3 per type per session, 2.0 s
- md5 b3Report 097a601037a7adc4e88b4ac8994948ea / shotMix 1238864370f30941b8b7966da795b3e6 unchanged

## Release 10.1 (Jun 2026)
- Image loading: SheetCache (current + prefetched next set only, dispose others, 2 retries 0.5/1.5 s), court image retry x2 + DEV court line, next-match rival sheets prefetched.
- Overlay: backdrop Pressable behind plain sheet (scroll fixed); inbox done conditions + read at 60%.
- DEV jump to Match N + DEV +2000 Coins (Career, __DEV__ only).
- Twists on 2/5/8/10/12 (chip, talk, 2 s pill); Match talk route /talk (DialogueScene), first play only, talkSeen saved.
- applyChemistry rewritten (k toward PRO, cached); partnerBoost(level, chem) as AI partner engine chemistry in all AI-partner modes.
- LEVEL UP + heart moments; cap text "Win the <stage> final to keep growing".
- Trophy cabinet (/cabinet), Home Trophies cell, career.trophies save field.
- New LOB / NET-BACK buttons (TacticalButtons.tsx, segment cooldown ring).
- Team grid + partner pop-up + trimmed Partner stats card.
- Tests: phase1a 163, phase1b 74, phase1c 123, run.ts 265; md5 b3 097a6010.. / shotMix 12388643.. unchanged.

## Release 10.2 (commits aad7b53 A · 825d77c B · 83df137 C) — STOPPED for phone test
- A: court_strawberry.webp for Mahabaleshwar (keyed + 1 retry), NEXT MATCH plays Match talk, new Next Match card (TWIST/NEW tags, twist.short), "Try again" goal after loss, trophy pop-ups + TROPHY_SHORT, dialogue 300 ms tap lock, twist pill until first serve, shareMessage (src/game/meta/share.ts, STORE_LINK empty).
- B: bar Team · Passport · Home(raised) · Locker · Records; new Home; Records tabs (Trophies/Stats/History; /cabinet,/history redirect); Settings overlay (settings.haptics); Inbox only on Passport.
- C: Tutorial mode (TUTOR personality row in ai.ts, src/game/meta/tutorial.ts TutorialRun), save.tutorial {done,hidden,steps,doneAt,careerPrompted}, entries: welcome step 2, Home tile, Match 1 prompt (once), Settings replay; +100 Coins once; tutorial_* analytics events.
- md5 after A, B, C: 097a601037a7adc4e88b4ac8994948ea / 1238864370f30941b8b7966da795b3e6 (baseline).
- Known low: LEARN THE BASICS label truncates at 320 px width (fine at 375); match screen web horizontal overflow (pre-existing).
