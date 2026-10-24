# iteration_12 — Phase 1A Session B Commit 3 (3a/3b/3c) Playwright verification

Public URL: https://pickle-career.preview.emergentagent.com

## Executed flows (390x844 unless noted)
1. Fresh save: `localStorage.clear()` → identity-prompt visible → identity-skip-button
   picks random player + team ("Mittu" / "City Spinners"); reload preserves them.
2. Home status row: status-coins "300", status-fans "0", status-form "–".
3. menu-career label "START CAREER" on fresh save.
4. Destination bar: nav-home, nav-career, nav-team, nav-locker, nav-training all present.
   Locker tap shows locker-coming-soon toast and stays on main-menu-screen.
5. Career screen: career-stage "Community Cup", next-match-number "Match 1 of 10",
   rival-name "Bandra Gully Smashers", court-name "Bandra Garden",
   reward-coins "+100", reward-fans "+20". play-match visible without scrolling
   (bottom y=443 on 844-tall viewport, 443 on 667-tall viewport).
6. view-in-team → team-screen, roster-anli highlighted, status-anli ACTIVE,
   team-coins "300".
7. Training: training-partner-name "Anli", training-left "2 of 2 sessions left today",
   scrimmage-left "3 of 3 sessions left today". training-change opens
   training-picker with pick-anli.
8. Overlays: header-inbox → inbox-overlay with inbox-empty text on fresh save;
   header-stats → stats-overlay with stats-body + stats-history-link; overlay-close works.
9. Quick Play: toggle-doubles / toggle-singles correctly show/hide qp-partner.
   difficulty-club launches match-screen; dev-mumbai-court launches match-screen
   with the Mumbai Local court art.
10. Scoreboard inside painted board (score-display):
    - Quick Play bottom row: " RIV 0 "  (top: "●CIT02" — top code is player's team
      "City Spinners" → CIT, serve marker ●, server number 2)
    - Career match 1 bottom row: " BGS 0 "  (BGS = Bandra Gully Smashers)
    - Training bottom row: " DRL 0 "
    - Scrimmage bottom row: " SPR 0 "
    - Dev Mumbai court bottom row: " RIV 0 "
11. Pause: pause-button opens pause-overlay; resume-button and quit-button both
    work (quit returns to the screen the match was launched from — career → career,
    training → training).
12. 375x667 layout: PLAY MATCH visible without scrolling, destination bar does
    not overlap other content.
