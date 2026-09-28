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
- **[serve side]** Serve side is by the serving team's score parity (even = right, odd = left), giving the correct 0-0-2 opening from the right.

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
