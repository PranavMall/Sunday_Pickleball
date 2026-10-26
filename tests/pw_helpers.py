# Shared helper snippets for Playwright browser_automation scripts (Pickle-Ballers web preview).
# Copy into scripts: set_meta, force_win, finish_popups, watch_cover, sprite_status.
SET_META_JS = """(patch) => { const d = JSON.parse(localStorage.getItem('pb.meta')); Object.assign(d, patch); localStorage.setItem('pb.meta', JSON.stringify(d)); }"""
FORCE_WIN_JS = """() => { const s = globalThis.__pwSim; let n = 0; while (s.phase !== 'game_over' && n < 400) { s.debugPlayPoint('near'); n++; } return [s.phase, n]; }"""
WATCH_COVER_JS = """() => { window.__cov = []; const t0 = performance.now(); window.__covT = setInterval(() => { window.__cov.push(!!document.querySelector('[data-testid="loading-cover"]')); }, 10); }"""
