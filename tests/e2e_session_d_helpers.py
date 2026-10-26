# Phase 1A Session D (Commits 6-8) — Playwright helper snippets used by the testing agent.
# Paste into the browser_automation tool (runs inside an async fn with `page`). Viewport 375x667.
import json

BASE = "https://pickle-team-up.preview.emergentagent.com"  # = frontend/.env EXPO_PACKAGER_PROXY_URL

# Career Match 3 clean path seed (localStorage key 'pb.meta', schemaVersion 1)
SEED_M3 = {
    "schemaVersion": 1, "coins": 500, "fans": 40, "activePartnerId": "anli", "trainingPartnerId": "anli",
    "partners": {"anli": {"discovered": True, "signable": True, "signed": True, "growth": 24},
                 "upsi": {"discovered": True, "signable": False, "signed": False, "growth": 0}},
    "chemistryHalves": {"player+anli": 8},
    "career": {"cleared": ["mumbai.community.01", "mumbai.community.02"], "nextMatchId": "mumbai.community.03",
               "firstClearWins": 2, "firstClearLosses": 0},
    "courtsPlayed": ["dadar"],
}


async def seed(page, doc):
    await page.evaluate("s=>localStorage.setItem('pb.meta', s)", json.dumps(doc))


async def force_result(page, win: bool, skip: bool = True):
    """Requires DEV hook globalThis.__pwSim (app/match.tsx). Forces game over, skips end sequence,
    clicks through celebration pop-ups (Later / Continue) until result-overlay is shown."""
    await page.wait_for_function("()=>window.__pwSim", timeout=20000)
    await page.wait_for_timeout(2200)
    await page.evaluate("w=>{const s=window.__pwSim; s.score.nearScore=w?11:6; s.score.farScore=w?7:11;"
                        " s.winner=w?'near':'far'; s.phase='game_over';}", win)
    await page.wait_for_timeout(400)
    if skip:
        await page.click('[data-testid="end-sequence-skip"]', force=True)
    for _ in range(4):
        await page.wait_for_timeout(500)
        if await page.locator('[data-testid="result-overlay"]').count():
            break
        for b in ["celebration-later", "celebration-continue"]:
            if await page.locator(f'[data-testid="{b}"]').count():
                await page.click(f'[data-testid="{b}"]', force=True)
                break
    await page.wait_for_selector('[data-testid="result-overlay"]', timeout=5000)
    await page.wait_for_timeout(1800)  # count-up finishes ~1.75 s
