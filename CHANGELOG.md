# Picklewood — CHANGELOG

Every gameplay behaviour that differs from `prototype_ver_2.1` is logged here with the reason.
Format: **[area]** change — reason.

## Milestone 1 — "The rally works"

### Architecture / determinism
- **[engine]** Rebuilt as a headless TypeScript simulation in LOGICAL COURT FEET (20×44), fully separate from rendering — reason: brief requires simulation independent of rendering/perspective/UI and unit-testable.
- **[engine]** Fixed 60 Hz timestep replaces the prototype's variable `deltaTime` — reason: deterministic, reproducible matches.
- **[engine]** All gameplay randomness comes from a single seedable RNG (mulberry32); no `Math.random()` — reason: any match reproducible from its seed.
- **[render]** Perspective is a projective HOMOGRAPHY fitted to the painted court corners, not the prototype's linear scale — reason: logical court maps exactly onto the artwork.

### Bugs fixed (from the prototype)
- **[shots]** `isDinkShot()` was called with a number instead of the player object, so human swipe-dinks never registered — now shot type is derived correctly from swipe power + court position.
- **[scoring]** Long-rally bonus was checked after `rallyLength` was reset (dead code) — removed the illegal-power bonus system entirely (see Kitchen Mastery).
- **[rules]** In/out used the VISUAL perspective bounds — now uses logical court coordinates only.
- **[rules]** "Volley = any airborne contact" — now a volley is specifically a ball struck before it has bounced since the last hit; hitting a bounced ball in the kitchen is legal.

### Rules made correct (fun concept preserved)
- **[net]** Added a real net plane (36" sidelines, 34" centre). A ball that fails to clear is a fault; a ball that clips the net and still clears stays LIVE (no lets). The prototype had no net interaction.
- **[two-bounce]** Real per-rally tracking: the serve must bounce and the return must bounce before either team may volley. Prototype used a `ball.height>80` proxy.
- **[serve]** Diagonal service box + must clear the kitchen (kitchen line = fault) enforced in logical coords.
- **[kitchen]** Volley-in-NVZ, touching-the-line-on-a-volley, momentum-carry, and re-establishment (both feet out) are all enforced. Standing in the kitchen is legal.
- **[out]** Out-of-bounds is judged only on the FIRST bounce; a second bounce is always the opponent's failure (double bounce). Prototype could mis-call a deep winner "out".
- **[serve side]** (M1) The serve side was originally derived from score parity. This was SUPERSEDED in M1.1 by position-based serving: the server is a tracked player and the serve side comes from their current court (teammates swap on a point), which keeps the 0-0-2 opening-from-the-right correct and handles 2nd-server/side-out cases properly.

### Kitchen systems (both prototype systems addressed)
- **[kitchen button]** The manual rush-in/out button + state machine was REMOVED; kitchen approach is automatic (AI-timed). A small optional **KITCHEN** toggle lets the player hold the near team at the line. — Per user decision.
- **[kitchen mastery]** The pressure meter / Mastery power-up concept is retained in design but its illegal powers (disable net faults, disable out-of-bounds, bounce out-balls back in, alter scoring) were REMOVED. Mastery is OFF in M1 and will be re-tuned in M2 to only aid dink accuracy / positioning / reaction — never overriding RuleManager.

### Serve & controls
- **[serve]** Human serve is now swipe-controlled (direction + power place the ball within the legal diagonal box) instead of a fixed auto-serve on tap — per user decision, more skill.
- **[controls]** Swipe → direction/power/shot-type; immediate and forgiving. No shot buttons, no joystick.

### AI
- **[ai]** One configurable brain. Difficulty (ROOKIE/CLUB/PRO for M1) scales intelligence params only — reaction, positioning, prediction, accuracy, unforced error, kitchen sense, aggression, variety — never ball/foot speed. Personality architecture (DEFENSIVE/AGGRESSIVE/KITCHEN/TACTICAL) is in place, tuned in M2.
- **[ai]** A bounded per-rally "pressure" error ramp guarantees rallies resolve while skill still dominates — reason: two elite AIs would otherwise dink forever. Logged as an arcade design choice.

### Verified
- 45/45 automated tests pass (rules + seeded AI-vs-AI). ROOKIE < CLUB < PRO win rates 100% in cross-difficulty smoke matches; no stuck states.

## Milestone 1.1 — correction pass (2026-06)

### Serving rotation (real doubles)
- **[serve/rotation]** The server is now tracked as a real PLAYER (`serverSlot`), separate from the score's `serverNumber`. Previously the server was re-derived from score parity every serve, so when Server 1 lost, the SAME player re-served as "Server 2". Now: on a point the same server keeps serving and the two teammates swap courts; on a Server-1 loss the PARTNER becomes Server 2 and serves from where they stand; on a side-out the incoming team's right-court player is Server 1 from the right — regardless of score parity.
- **[serve/sides]** `courtSide` is now TEAM-RELATIVE ("R" = that player's own right service court). The far team faces the camera, so its right court is on the LEFT of the screen (low global x). `serviceBoxFor`, `sideX`, movement and rendering convert team-relative → global consistently; serves land in the correct diagonal box for both teams.
- **[serve/receivers]** Receivers are no longer re-positioned or re-sided every point; `setupServe` only places the server. Automatic movement flows the others to ready spots (no teleport resets).

### AI partner
- **[ai/partner]** Match difficulty now scales the two OPPONENTS only. The human's AI partner is fixed at `PARTNER_DIFFICULTY` (CLUB) — configurable in `config/ai.ts`.

### Input
- **[input]** Swipes now expire after `INPUT.SWIPE_BUFFER_TIME` (0.28 s) if the player can't legally strike — an early/late swipe can no longer fire seconds later.

### Human shot quality
- **[shots/human]** Human shots are no longer perfectly accurate. Direction → aim, swipe length → power, and TIMING → quality: good contact (ball at the player) is accurate & safe; reaching at the edge / taking a high ball / an extreme aim adds spread and, when very poor, an occasional net/out. Good swipes never randomly miss. All windows/error amounts live in `config/tuning.ts` `HUMAN` with a single master `forgiveness` knob.
- **[shots/pacing]** Rally pressure ramp firmed (bites in long grinds) so rallies stay snappy and always resolve; AI only, human unaffected.

### Rendering
- **[render/court]** The painted court is now drawn with `expo-image` as a background layer behind a TRANSPARENT Skia canvas (Skia's bundled-image loader didn't decode reliably in Expo Go). Same projector scale/offset keeps it pixel-aligned with the code-drawn lines. Added load-error logging. Asset compressed from a 2.9 MB PNG to a 274 KB WebP (dimensions unchanged, 1024×1536).

### Housekeeping
- **[app]** Renamed to Picklewood (name/slug/scheme); bundle IDs unchanged.
- **[test]** Added `yarn test:game` (pinned `tsx` runner). Debug overlay now shows the match seed.

### Verified (M1.1)
- 71/71 automated tests pass, including new serve-rotation and stale-swipe tests.
- 150 seeded AI-vs-AI matches (50 per ROOKIE/CLUB/PRO) complete with **0 stuck states**; worst single point ~26 s, longest full match ~13 min (a 101-point PRO deuce). ROOKIE<CLUB<PRO cross-difficulty win rate 100%.

## Milestone 1.2 — correction pass (2026-06)

### Must-fix bugs
- **[serve/position]** The server now stands BEHIND their baseline (configurable `PLAYER.SERVE_STANDOFF`), not inside the court. The server WALKS into position (not a snap) and is exempt from the movement half-clamp while serving; normal clamping resumes after contact. The ball tracks the server's hand until the serve is struck; AI serves once settled (with a hard-cap so it can never stall).
- **[ai/returns]** Serve returns are fixed end-to-end. Serves are now a soft, loopy, mid-court arc (not a deep/fast winner) so the receiver has time to set; serve RETURNS (and third shots) are deliberately soft, central and mid-court so the other team can reach them. Automatic reach raised slightly (`PLAYER.REACH` 3.0→3.3). Measured (real default config): ROOKIE return-of-serve 0%→~94%, CLUB/PRO ~100%; the near team now reaches ~85–94% of returns (was ~33%). Rookie points/game 0.1→~5 (target 4–7) — Rookie now returns most serves and loses through slower reaction, weaker placement and rally mistakes, not failed returns (ROOKIE tuned: lower accuracy, higher unforced error, kept reaction low enough to return).
- **[ui/kitchen]** Removed the KITCHEN toggle button (it had no effect on movement). Kitchen positioning returns in M2.
- **[ui/pause]** Pause menu is exactly Resume / Restart / Quit to Menu (Share is result-screen only), with a compact, safe-area-aware, small-phone-friendly layout; it is mutually exclusive with the result overlay.

### Controls
- **[serve/human]** Human serves now use a quality model: a very short swipe or an extreme angle can go net/long/wide/wrong-box; normal serves stay safe. Uses the current `forgiveness`.
- **[input/aim]** Aim now uses the FULL swipe vector. A downward/backward swipe (dy>0) is a mishit that overcooks depth (tends out) — documented and tested.
- **[shots/errors]** Mishits are varied (net / long / wide) instead of a single flat net dump. Good swipes still never randomly miss.
- **[input/timing]** A buffered swipe is executed at the ball's CLOSEST APPROACH within the hit window (not at the edge of reach); timing quality is scored by how early/late the swipe was vs that ideal contact, not raw contact distance. The 0.28 s buffer length is unchanged. Engine swipe→contact latency measured headlessly: avg ~149 ms / p90 ~233 ms, almost entirely the intentional wait for the ball to arrive (true pipeline cost is ≤1 fixed step ≈17 ms); real-device gesture+rAF add on top and remain the authoritative perceived-latency check.
- **[input/dink]** Dink thresholds widened (range 3→4.5 ft from the kitchen line, power cap 0.32→0.42). Added a subtle "Dink range" cue and a brief shot-type label after each human hit.

### AI variety (Club/Pro)
- **[ai/variety]** Club/Pro now mix deep pushes to the baseline, side-to-side placement and attacking the short ball (scales with `tacticalVariety`); Rookie stays simple. Avg rally length before/after this variety change stayed within noise (AI-vs-AI smoke longest-rally unchanged in character).

### Tests & housekeeping
- **[test]** Added tests: server behind the baseline (near & far), human serve faults, swipe-direction mapping (incl. downward swipes), timing early-vs-late quality, partner staying CLUB at every difficulty, and REAL default-config simulations (slot 0 = CLUB "human", default partner, opponents at difficulty). Suite now 99/99 passing.
- **[test]** Added `src/game/__tests__/report.ts` (run: `yarn tsx src/game/__tests__/report.ts`) that prints return-of-serve rates, Rookie points/game, avg rally length and input-latency — all on the real default config.
- **[engine]** Single shared reach constant `PLAYER.REACH_MULT` used by both `computeReach` and the human quality model.
- **[changelog]** Tidied the outdated M1 serving line (above).

## Milestone 2 — Part A: Foundations (2026-06)

Goal: fix remaining input bugs, add hit sounds, and prepare the engine
architecture (roadmap §11) WITHOUT changing how doubles plays. Only roadmap
Phase 0 is in scope. Behaviour parity verified: a fixed battery of seeded
AI-vs-AI doubles matches is byte-for-byte identical before vs after the refactor
(`src/game/__tests__/parity.ts`), scoring/rules/forgiveness/rally-pace/AI tuning
all unchanged. Engine suite 99 → **119** passing (20 new singles tests).

### Input fixes & responsiveness
- **[input/gesture]** Match input is now a SINGLE `Gesture.Pan` (tap vs swipe is
  derived from the translation). The old `Gesture.Exclusive(pan, tap)` is gone —
  one gesture can no longer resolve as two inputs.
- **[input/windup]** A valid swipe is acknowledged INSTANTLY by starting the
  player's wind-up pose (`windUpCue`). This does not fake contact: the real
  contact frame fires once, later, when the sim records the strike.
  SWIPE → wind-up → CONTACT → follow-through. Never two perceived impacts.
- **[feedback/contact]** The sim emits ONE `ContactEvent` per real strike; the
  renderer drains them each frame to fire sound + haptic exactly once on the
  contact frame (contact flash / ball squash are the Part B game-feel additions,
  wired to the same single event).
- **[input/edge]** A ~24 px left/right edge margin is reserved from game swipe
  input (the focused Android back handler is the real back-gesture protection,
  not this margin).
- **[input/trace]** Added a dev-only circular trace (last 20 input/contact
  events: time, dx/dy/power, buffered/consumed/expired, striker slot, lastHitBy);
  shown on the match screen under `__DEV__` only, hidden in production.
- Investigation (`src/game/__tests__/inputProbe.ts`): a double-fired gesture
  still yields exactly ONE contact; consecutive near-team contacts with no far
  hit between are effectively absent in normal rallies (min gap ~2.9 s); engine
  swipe→contact is avg ~129 ms (min 0 ms pure-pipeline) — the rest is the
  intentional wait for the ball to arrive, now masked by the instant wind-up.

### Android back gesture
- **[nav/back]** While the match screen is focused, hardware/gesture back is
  intercepted: playing → opens Pause; paused → resumes; game over → to Menu. The
  match screen sets `gestureEnabled:false` so no app-level swipe-back fires
  during gameplay. (NOT verifiable in Expo Go / web — needs a real Android device
  with gesture navigation.)

### Hit sounds
- **[audio]** Added `expo-audio` SFX service (`src/game/services/sfx.ts`): all
  eight supplied WAVs are preloaded at match start into small per-variant POOLS
  (round-robin) so overlapping hits never cut each other off. Exactly one sound
  per real contact, variants alternate. Mapping: pop = normal, drive = hard,
  kitchen_soft = dinks, kitchen_bright = soft drops (owner to confirm by ear).
- **[audio/mute]** Mute toggle added to the Pause menu (persisted via
  AsyncStorage). Supplied WAVs are NOT re-encoded. `ASSET_LICENCES.md` added.

### Architecture (roadmap §11)
- **[config]** MATCH-CONFIG-AS-DATA: every match launches from a `MatchConfig`
  (court, format, teams, AI profiles, match type, starting score, rule modifiers,
  objectives, stat-normalization flag). The engine is mode-agnostic — it never
  inspects `matchType`. Today's quick match is `quickMatchConfig()`.
- **[engine/teamsize]** Team size is DATA. The four-player assumption is removed
  from construction, serving, scoring, movement and rendering. SINGLES is
  supported in the engine: centre-court coverage and the singles serve rule
  (serve from the right on an even server score, left on odd; no server number;
  two-number score, immediate side-out). Dev-only 1v1 launch button on the
  difficulty screen (no singles menu yet). 20 new singles tests.
- **[ai/profiles]** Parametric `AIProfile`s (aggression, dinkPreference,
  poachRate, lobTendency, reactionSpeed, courtCoverage, errorRate) wrap the
  authoritative engine params; ROOKIE/CLUB/PRO presets reproduce today's
  behaviour EXACTLY. Personalities are presets too. Neutral `chemistry` hook
  (identity at 1.0 — never makes a partner worse). Partner stays CLUB and can
  make great plays.
- **[engine/stats]** Per-player stat multipliers (power, control, spin, reach),
  neutral 1.0 by default and forced neutral under stat normalization (ranked).
  `reach` and `control` are wired now (identity at 1.0); power/spin are hooks.
- **[meta/log]** Match result logging (`services/matchLog.ts`) stores a compact
  local record (config summary, teams/profiles, final score, rally stats, match
  type, timestamp) in AsyncStorage at match end. No backend.
- **[render/character]** Layered character contract
  (`render/character.tsx`): body, hair, top, bottom, shoes, head accessory,
  wrist accessory, paddle as separate layers on a shared rig, composited in
  Skia. Placeholder players now render THROUGH this system. See `SPRITE_BRIEF.md`.
- **[services]** Interface-only contracts (`services/interfaces.ts`):
  ProfileService (guest id, player/team names, SaveModel with CUMULATIVE fans +
  separate hot/normal/cold form, ratings per PLAYER and per PAIRING),
  AnalyticsService, AdService (named placements), PurchaseService. No SDKs.

## Milestone 2 — Part A: performance / latency / audio pass (2026-06)

Rejected build felt ~4.5/10 (doubles ~41 fps, dev singles ~25 fps in Expo Go).
This pass restores native feel WITHOUT adding features and WITHOUT touching
scoring/rules/AI tuning/rally pace/forgiveness (parity re-proven byte-identical;
119/119 tests pass).

### Rendering performance
- **[render/character]** The layered placeholder now draws ONLY cheap Skia
  primitives (Circle/Oval) and allocates ZERO Skia Paths per frame (was ~4
  Path.Make() per player per frame). The layer contract is unchanged.
- **[ui/hud]** The HUD is a React.memo component fed primitives, so its text
  subtree no longer reconciles every frame — only the Skia canvas redraws.
- **[ui/dev]** The dev FPS/debug readout and input trace are no longer rendered
  continuously — behind an explicit dev toggle (top-left DEV chip, dev only).
- Sim cost measured negligible: 8.2 µs/step (doubles), 3.1 µs/step (singles) —
  singles is LIGHTER than doubles, so its Expo-Go slowness is the dev-runtime
  render pipeline, not the sim. Native release build + on-screen fps stat are the
  authoritative measure.

### Input latency
- **[input/arm]** A swipe is ARMED on finger-DOWN (onUpdate) once past the
  threshold; the sim no longer waits for onEnd. The armed dx/dy/power snapshot is
  refreshed while held (long swipe still builds full power). One armed input per
  gesture; consumed once at ideal contact if the ball arrives before release (64
  of 120 human contacts consumed mid-gesture). Serves still fire on RELEASE.
  Direction→aim, length→power, timing→quality unchanged; forgiveness untouched.

### Audio
- **[audio/contact]** A paddle sound fires on EVERY real contact, mishits
  included — tied to physical contact, not shot success.
- **[audio/bounce]** New authoritative BounceEvent (once per real court bounce,
  never inferred from shot type); one bounce sound, quieter, scaled by impact
  speed. CONTACT and BOUNCE are separate event types.
- **[audio/reliability]** Each player re-arms (seekTo 0) on finish so it is
  pre-rewound before reuse — fixes the Android seek/play race and skipped sounds;
  play() prefers an idle voice; readiness reported (sfx.ready, logged).
- **[audio/pool]** Pool reduced 24 → 16 players (2/file), the minimum for clean
  overlap. Supplied WAVs not re-encoded.

## Milestone 2 — Part A: Phase 0 value pass (2026-06)

Two independently-revertable commits. Gameplay feel (swipe/arming/wind-up,
speed, reach, physics, AI tuning, rally pace, forgiveness, scoring) is FROZEN.

### Commit A — court + kitchen fixes
- **[render/court]** New LINE-FREE gameplay court `court_gameplay.webp`
  (1024×1536, 371 KB) used ONLY on the match screen; `court_background.webp`
  stays the main-menu background. The code-drawn geometry (sidelines, baselines,
  kitchen/NVZ lines, centre lines, net, posts) remains authoritative and is drawn
  over the painted blue surface. Homography corners recalibrated to the new art
  (FL 304,521 · FR 729,525 · NR 888,1197 · NL 133,1191 — used as supplied, no
  further adjustment needed; lines sit naturally).
- **[rules/kitchen-line]** Touching the NVZ line now counts as being in the
  kitchen wherever the rule cares: a volley while on the line faults
  (KITCHEN_VOLLEY), momentum carrying a just-volleyed player ONTO the line faults
  (KITCHEN_MOMENTUM), re-establishment is blocked while touching the line, and the
  re-establish timer only runs when fully outside AND off the line
  (`RuleManager.isKitchenContact` / `tickKitchenRecovery`).
- **[sim/fairness]** Post-kitchen striker fairness: a player who has been in the
  kitchen and not re-established BOTH feet is NOT auto-designated to VOLLEY an
  airborne ball (`RuleManager.eligibleForAirborneVolley`), so automatic movement
  can't manufacture an unavoidable kitchen fault after a legal bounced-ball
  retrieval; in doubles the partner may take it; a BOUNCED ball is always
  playable from the kitchen. RuleManager still faults a genuine illegal volley.
- **[test]** +9 deterministic tests (129 → 138, 0 failed). Seeded doubles battery
  byte-for-byte identical before/after (0/100 matches changed; avgLongestRally
  25.02, Rookie<Club<Pro preserved, 0 stuck states) — the AI already avoids
  illegal volleys, so these are correctness/safety fixes for edge + human cases.

### Commit B — identity, history, menu (UI/data only, no sim change)
- **[meta/identity]** Local guest identity (`services/profile.ts`): Player + Team
  name, 2–16 chars, trimmed, basic profanity screen, Skip → defaults (Player /
  Picklewood), persisted in AsyncStorage. First-time prompt on the main menu and
  an editable Profile screen. HUD serve label uses the player name; the result
  overlay shows the team name.
- **[meta/history]** Match History screen: Played / Wins / Win % / Longest-rally
  header, recent matches newest-first (date, Singles/Doubles, opponent
  difficulty, score, Win/Loss, longest rally), empty state. `Array.isArray` guard
  added to the match-log read/write so a corrupt store can't crash.
- **[ui/menu]** Main-menu shell: Quick Match / Match History / Profile active;
  Career / Training / Passport / Trophy Room shown as Coming Soon (no navigation,
  transient toast on tap). Keeps the existing watercolour background.

## Milestone 2 — Part A: stabilization pass (2026-06)

User-approved swipe controls + wind-up feel are FROZEN. Three targeted changes
only; M2 Part B NOT started.

### Audio disabled
- **[audio/off]** Central `SFX_ENABLED = false` master switch in
  `services/sfx.ts`. When off, `preload()` short-circuits BEFORE creating any
  player, so ZERO `AudioPlayer` instances exist; no contact/bounce sound plays.
  The Pause menu "Sound: On/Off" row is hidden (menu is Resume / Restart / Quit).
  `ContactEvent`, `BounceEvent` and the whole SFX service remain in place for a
  future dedicated sound-design pass — re-enable with the one flag. Supplied WAVs
  untouched. (Verified: 0 AudioPlayer instances, no audio warnings; testing agent
  confirmed the mute-button is absent.)

### Lightweight placeholder rendering (A/B vs M1.2)
- **[render/character]** The placeholder character now draws only a body
  capsule + head + paddle (the depth-scaled court shadow is drawn by
  `GameCanvas`), roughly M1.2 render complexity. The per-garment/accessory
  layers are no longer each drawn as separate placeholder drawables. The layered
  CONTRACT/types (`CHAR_LAYER_ORDER`, `CharacterColors`, etc.) are kept intact
  for real sprites later. The approved wind-up / swing paddle motion is preserved.

### Bounced kitchen-ball retrieval fix (engine)
- **[sim/predict]** ROOT CAUSE: `predictContact()` started its forward-sim bounce
  counter at 0, ignoring the LIVE ball's `bouncesSinceHit`. So (a) it reported
  `bounced:false` for a ball that had already bounced in the kitchen — making
  automatic movement HOLD the player behind the NVZ line instead of pursuing the
  legal post-bounce ball; and (b) during the opening two-bounce phase it waited
  for an UNNECESSARY second predicted bounce before treating a contact as legal.
  FIX (one line): seed `let bounces = ball.bouncesSinceHit`. Now an
  already-completed required bounce counts as done, `pred.bounced` reflects the
  live ball, and automatic movement (human AND AI) pursues a legally-bounced
  kitchen ball; an UNBOUNCED ball still holds behind the line (no illegal volley
  introduced). Kitchen volley/momentum/re-establishment rules unchanged; works in
  singles and doubles. Strike eligibility (`computeReach`) already respected the
  live bounce state — only movement prediction needed the correction.
- **[test]** +10 tests (suite 119 → **129**, 0 failed): kitchen retrieval (A),
  two-bounce recognition + gating (B), unbounced-kitchen safety (C). Doubles
  before/after battery (`parity.ts`, intentionally NOT byte-identical now):
  win-rate relationships preserved (CLUB>ROOKIE, PRO>CLUB), avgLongestRally
  24.93→25.02, avgRallies 34.8→32.7, 0 kitchen faults, 0 stuck states — all
  differences attributable only to the movement-prediction correction.
