// Seedable deterministic RNG (mulberry32). EVERY gameplay-affecting random
// value MUST come from an instance of this, never Math.random(), so any match
// is exactly reproducible from its seed.

export class RNG {
  private state: number;
  readonly seed: number;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.state = this.seed || 1;
  }

  // float in [0, 1)
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // float in [min, max)
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  // symmetric noise in [-amount, amount]
  noise(amount: number): number {
    return (this.next() * 2 - 1) * amount;
  }

  // true with probability p
  chance(p: number): boolean {
    return this.next() < p;
  }

  int(minInclusive: number, maxExclusive: number): number {
    return Math.floor(this.range(minInclusive, maxExclusive));
  }
}
