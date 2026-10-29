# Shared helper snippets for Playwright browser_automation scripts (Pickle-Ballers web preview).
# Copy into scripts: set_meta, force_win, finish_popups, watch_cover, sprite_status.
SET_META_JS = """(patch) => { const d = JSON.parse(localStorage.getItem('pb.meta')); Object.assign(d, patch); localStorage.setItem('pb.meta', JSON.stringify(d)); }"""
FORCE_WIN_JS = """() => { const s = globalThis.__pwSim; let n = 0; while (s.phase !== 'game_over' && n < 400) { s.debugPlayPoint('near'); n++; } return [s.phase, n]; }"""
WATCH_COVER_JS = """() => { window.__cov = []; const t0 = performance.now(); window.__covT = setInterval(() => { window.__cov.push(!!document.querySelector('[data-testid="loading-cover"]')); }, 10); }"""
# Iteration 17: forced win (reliable) + async asset-delay route (handler MUST await route.continue_()).
FORCE_WIN_FAULT_JS = """() => { const s=globalThis.__pwSim; s.score.nearScore=s.pointsToWin-1; s.score.farScore=0; s.score.servingTeam='near'; s.registerFault({reason:'OUT',faultingTeam:'far',x:0,y:0,message:'qa'}); return s.phase; }"""
SIM_NAMES_JS = """() => JSON.stringify({seed: globalThis.__pwSim.config?.seed, names: globalThis.__pwSim.players.map(p=>p.name)})"""
# async def delayed(route): await asyncio.sleep(2.0); await route.continue_()
