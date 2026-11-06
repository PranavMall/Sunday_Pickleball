// SHEET CACHE (no React / Skia imports, so it is testable headlessly). Keeps
// ONLY the current match's sheets (+ the prefetched next set) decoded; every
// other sheet is disposed when a set is made current. A failed decode is
// retried twice (after 0.5 s and 1.5 s) before the caller falls back.
export interface Disposable {
  dispose?: () => void;
}

export const RETRY_DELAYS_MS = [500, 1500];
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class SheetCache<T extends Disposable> {
  readonly cache = new Map<number, T>();
  readonly pending = new Map<number, Promise<T>>();
  private current = new Set<number>();
  private prefetched = new Set<number>();

  constructor(public decode: (mod: number) => Promise<T>, private delays: number[] = RETRY_DELAYS_MS) {}

  private wanted(mod: number) {
    return this.current.has(mod) || this.prefetched.has(mod);
  }

  load(mod: number): Promise<T> {
    const hit = this.cache.get(mod);
    if (hit) return Promise.resolve(hit);
    let p = this.pending.get(mod);
    if (!p) {
      p = (async () => {
        let lastErr: unknown;
        for (let attempt = 0; attempt <= this.delays.length; attempt++) {
          if (attempt > 0) await wait(this.delays[attempt - 1]);
          try {
            const img = await this.decode(mod);
            if (!this.wanted(mod)) {
              img.dispose?.(); // evicted while loading
              throw new Error("evicted");
            }
            this.cache.set(mod, img);
            return img;
          } catch (e) {
            lastErr = e;
            if ((e as Error)?.message === "evicted") break;
          }
        }
        throw lastErr;
      })();
      this.pending.set(mod, p);
      const done = () => {
        if (this.pending.get(mod) === p) this.pending.delete(mod);
      };
      p.then(done, done);
    }
    return p;
  }

  private evict() {
    for (const [mod, img] of this.cache) {
      if (this.wanted(mod)) continue;
      img.dispose?.();
      this.cache.delete(mod);
    }
    for (const mod of [...this.pending.keys()]) if (!this.wanted(mod)) this.pending.delete(mod);
  }

  // A match's sheet set loads: it becomes current; everything else is evicted.
  setCurrent(mods: number[]) {
    this.current = new Set(mods);
    this.prefetched = new Set([...this.prefetched].filter((m) => !this.current.has(m)));
    this.evict();
  }

  // NEXT MATCH offered: warm the next set (kept on eviction).
  prefetch(mods: number[]) {
    this.prefetched = new Set(mods.filter((m) => !this.current.has(m)));
    for (const m of this.prefetched) this.load(m).catch(() => {});
  }
}
