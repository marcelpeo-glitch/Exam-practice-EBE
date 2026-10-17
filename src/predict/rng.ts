// Seeded pseudo-random numbers, so a predicted exam can be regenerated from its seed (and tests are reproducible).

export interface Rng {
  readonly seed: number;
  /** Uniform in [0, 1). */
  next(): number;
  /** Integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** A value min, min+step, ..., max (rounded to the step's decimals). */
  step(min: number, max: number, step: number): number;
  pick<T>(items: readonly T[]): T;
  /** A new array in random order. */
  shuffle<T>(items: readonly T[]): T[];
  /** k distinct items. */
  sample<T>(items: readonly T[], k: number): T[];
  chance(p: number): boolean;
  /** Random sign: +1 or −1. */
  sign(): 1 | -1;
}

const decimalsOf = (x: number) => {
  const s = String(x);
  return s.includes('.') ? s.length - s.indexOf('.') - 1 : 0;
};

/** mulberry32: small, fast and good enough for picking exam numbers. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const shuffle = <T>(items: readonly T[]) => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return {
    seed: seed >>> 0,
    next,
    int,
    step(min, max, step) {
      const n = Math.round((max - min) / step);
      const d = Math.max(decimalsOf(step), decimalsOf(min));
      return Number((min + int(0, n) * step).toFixed(d));
    },
    pick: (items) => {
      if (!items.length) throw new Error('pick from an empty list');
      return items[Math.floor(next() * items.length)];
    },
    shuffle,
    sample: (items, k) => shuffle(items).slice(0, k),
    chance: (p) => next() < p,
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

/** A fresh random seed (crypto-quality where available). */
export function randomSeed(): number {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  } catch {
    return Math.floor(Math.random() * 2 ** 32);
  }
}

/** Derive an independent sub-seed (e.g. one per question slot) from a seed and a label. */
export function subSeed(seed: number, label: string | number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const ch of String(label)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}
