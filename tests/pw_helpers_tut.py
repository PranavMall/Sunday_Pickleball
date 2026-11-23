# Reference snippet (Playwright, python) used by testing agent for tutorial tap/swipe via CDP touch.
# Not an executable test suite; copied into browser_automation scripts.
SETUP = '''
await page.wait_for_selector('[data-testid="identity-prompt"]', timeout=30000)
await page.fill('[data-testid="player-name-input"]', "TESTAnn")
await page.fill('[data-testid="team-name-input"]', "TESTTeam")
await page.get_by_text("Let's play", exact=True).click()
await page.wait_for_selector('[data-testid="welcome-tutorial-learn"]', timeout=10000)
'''
