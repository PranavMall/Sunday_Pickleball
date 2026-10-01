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
