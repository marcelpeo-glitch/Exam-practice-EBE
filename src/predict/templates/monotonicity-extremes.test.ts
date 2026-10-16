// Independent checks for the "Monotonicity, convexity & extremes" templates. The printed formulas are read back from
// the stems (plain JavaScript evaluation of the LaTeX, no mathjs, no factor bookkeeping) and every answer is re-derived
// numerically:
// - counts: zeros and sign changes of f' or f'' on a fine grid (numerical derivatives where only f or f' is printed);
// - convexity sets: the sign of a numerical f'' at thousands of probe points must match membership of the key set,
//   and every distractor set must disagree somewhere;
// - cubic shapes: the signs of f' and f'' at points inside each printed interval;
// - transformed functions: a family of concrete example functions f with the stated properties; a statement about g
//   "must be true" exactly when it holds for every example.
import { describe, expect, it } from 'vitest';
import { numDiff, numDiff2 } from '../mathx';
import { makeRng } from '../rng';
import type { GenType, Generated } from '../types';
import { displayMath, inIvs, optionTex, parseSet, rhs, texFn, texFn1 } from './_fnderiv-check';
import { TEMPLATES } from './monotonicity-extremes';

type Fx = (x: number) => number;
const SEEDS = 300;
const gen = (id: string, seed: number, type: GenType) =>
  TEMPLATES.find((t) => t.id === `monotonicity-extremes.${id}`)!.generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });

/** Checks the key against a recomputed truth per option (single choice) or the set of true options (multi-select). */
function checkOptions(g: Generated, isTrue: (text: string) => boolean) {
  const truths = g.options!.map((o) => ({ id: o.id, ok: isTrue(o.text!) }));
  if (g.type === 'multi-select') expect(truths.filter((t) => t.ok).map((t) => t.id), g.stem).toEqual(g.correctAnswer);
  else for (const t of truths) expect(t.ok, `${t.id}: ${g.options!.find((o) => o.id === t.id)!.text}\n${g.stem}`).toBe(t.id === g.correctAnswer);
}

// ---------- counting on a grid ----------

// Step 1/840 hits every integer and half-integer exactly (where the even-power zeros of the templates lie).
const GRID = Array.from({ length: 24 * 840 + 1 }, (_, i) => -12 + i / 840);

/** Sign changes of g over the grid; values within eps of 0 and undefined values are skipped. */
function signChanges(g: Fx, eps: number): number {
  let prev = 0;
  let n = 0;
  for (const x of GRID) {
    const v = g(x);
    if (!Number.isFinite(v) || Math.abs(v) <= eps) continue;
    const s = Math.sign(v);
    if (prev && s !== prev) n++;
    prev = s;
  }
  return n;
}

/** Distinct zeros of g: sign changes plus touching zeros (local minima of |g| below eps), merged within 0.01. */
function zeroCount(g: Fx, eps: number): number {
  const v = GRID.map(g);
  const pts: number[] = [];
  for (let i = 1; i + 1 < GRID.length; i++) {
    const [a, b, c] = [v[i - 1], v[i], v[i + 1]];
    if (![a, b, c].every(Number.isFinite)) continue;
    if (Math.abs(b) <= eps && Math.abs(b) <= Math.abs(a) && Math.abs(b) <= Math.abs(c)) pts.push(GRID[i]);
    else if (Math.abs(a) > eps && Math.abs(b) > eps && a * b < 0) pts.push(GRID[i]);
  }
  return pts.filter((x, i) => i === 0 || x - pts[i - 1] > 0.01).length;
}

describe('monotonicity-extremes.count-points: zeros and sign changes of the printed f, f′ or f′′ on a grid', () => {
  for (const type of ['single-choice', 'numeric'] as GenType[])
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('count-points', seed, type);
        const shown = displayMath(g.stem)[0].trim();
        const ask = /stationary|horizontal/.test(g.stem) ? 'stat' : /extreme|maximum or a local minimum/.test(g.stem) ? 'ext' : 'infl';
        if (ask === 'infl') expect(g.stem).toMatch(/inflection|between convex and concave/);
        const h = texFn1(rhs(shown));
        let count: number;
        if (shown.startsWith("f''(x)=")) {
          expect(ask).toBe('infl');
          count = signChanges(h, 1e-9);
        } else if (shown.startsWith("f'(x)=")) {
          if (ask === 'infl') count = signChanges((x) => numDiff(h, x, 1e-6), 1e-6);
          else count = ask === 'stat' ? zeroCount(h, 1e-9) : signChanges(h, 1e-9);
        } else {
          expect(shown.startsWith('f(x)=')).toBe(true);
          const d1 = (x: number) => numDiff(h, x, 1e-6);
          count = ask === 'stat' ? zeroCount(d1, 1e-6) : signChanges(d1, 1e-6);
        }
        if (type === 'numeric') expect(g.correctAnswer, g.stem).toBe(count);
        else checkOptions(g, (t) => Number(t) === count);
      }
    });
});

// ---------- convexity sets ----------

describe('monotonicity-extremes.convexity-set: membership of the key set ⇔ sign of a numerical f′′ at probe points', () => {
  it('single-choice', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('convexity-set', seed, 'single-choice');
      const f = texFn1(rhs(displayMath(g.stem)[0]));
      const want = /\bconcave\b/.test(g.stem) ? -1 : 1;
      expect(/\bconvex\b/.test(g.stem)).toBe(want > 0);
      const sets = g.options!.map((o) => parseSet(optionTex(o.text!)));
      const ends = sets.flatMap((s) => s.flatMap((i) => [i.lo, i.hi])).filter(Number.isFinite);
      const probes: number[] = [];
      for (let i = 0; i <= 6000; i++) {
        const x = -30 + i * 0.01 + 0.0031;
        if (!ends.some((e) => Math.abs(x - e) < 0.02)) probes.push(x);
      }
      const truth = probes.map((x) => {
        const y = f(x);
        return Number.isFinite(y) && want * numDiff2(f, x) > 0;
      });
      checkOptions(g, (text) => {
        const s = parseSet(optionTex(text));
        return probes.every((x, i) => inIvs(s, x) === truth[i]);
      });
    }
  });
});

// ---------- cubic shapes ----------

function cubicTruth(f: Fx) {
  return (text: string) => {
    const m = /^\$f\$ is (increasing|decreasing) and (convex|concave) on \$\((-?\d+),(-?\d+)\)\$$/.exec(text);
    if (!m) throw new Error(`unexpected statement ${text}`);
    const mono = m[1] === 'increasing' ? 1 : -1;
    const curv = m[2] === 'convex' ? 1 : -1;
    const lo = Number(m[3]);
    const hi = Number(m[4]);
    return Array.from({ length: 101 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 101).every((x) => mono * numDiff(f, x) > 0 && curv * numDiff2(f, x) > 0);
  };
}

describe('monotonicity-extremes.cubic-shape: signs of numerical f′ and f′′ inside every printed interval', () => {
  for (const type of ['single-choice', 'multi-select'] as GenType[])
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('cubic-shape', seed, type);
        checkOptions(g, cubicTruth(texFn1(rhs(displayMath(g.stem)[0]))));
      }
    });
});

// ---------- transformed functions ----------

// Example functions φ(t) with f(x) = φ(x − c): increasing then decreasing (MAX) or the reverse (MIN). Some are
// positive everywhere, some are not; some are concave/convex everywhere, most change curvature.
const MAX: { f: Fx; pos: boolean }[] = [
  { f: (t) => 1 + 1 / (1 + t * t), pos: true },
  { f: (t) => 0.2 + Math.exp(-t * t), pos: true },
  { f: (t) => 2 / (1 + t * t), pos: true },
  { f: (t) => 5 + 3 * Math.exp(-t * t), pos: true },
  { f: (t) => 3 - t * t, pos: false },
  { f: (t) => -(t ** 4) - 1, pos: false },
  { f: (t) => -Math.log(1 + t * t), pos: false },
];
const MIN: { f: Fx; pos: boolean }[] = [
  { f: (t) => 3 - 1 / (1 + t * t), pos: true },
  { f: (t) => 1.5 - Math.exp(-t * t), pos: true },
  { f: (t) => 1 + t * t, pos: true },
  { f: (t) => 0.5 + (t * t) / (1 + t * t), pos: true },
  { f: (t) => t * t - 4, pos: false },
  { f: (t) => t ** 4, pos: false },
  { f: (t) => Math.log(1 + t * t) - 1, pos: false },
];

/** Does the statement hold for this concrete g (c = the special point)? */
function holds(text: string, g: Fx, c: number): boolean {
  const xs = Array.from({ length: 121 }, (_, i) => c - 3 + i * 0.05).filter((x) => Math.abs(x - c) > 0.01);
  const d1 = (x: number) => numDiff(g, x, 1e-6);
  const d2 = (x: number) => numDiff2(g, x);
  const tol = (x: number) => 1e-6 * (1 + Math.abs(g(x)));
  let m: RegExpExecArray | null;
  if ((m = /^\$g\$ has a (maximum|minimum) at \$x=(-?\d+)\$$/.exec(text))) {
    expect(Number(m[2])).toBe(c);
    return xs.every((x) => (m![1] === 'maximum' ? g(c) > g(x) : g(c) < g(x)));
  }
  if ((m = /^\$g\$ is (increasing|decreasing) for \$x([<>])(-?\d+)\$$/.exec(text))) {
    const s = m[1] === 'increasing' ? 1 : -1;
    return xs.filter((x) => (m![2] === '<' ? x < c : x > c)).every((x) => s * d1(x) > 0);
  }
  if ((m = /^\$g\$ is (increasing|decreasing) on its whole domain$/.exec(text))) {
    const s = m[1] === 'increasing' ? 1 : -1;
    return xs.every((x) => s * d1(x) > 0);
  }
  if (text === '$g$ is convex on its whole domain') return xs.every((x) => d2(x) >= -tol(x));
  if (text === '$g$ is concave on its whole domain') return xs.every((x) => d2(x) <= tol(x));
  if ((m = /^\$g\$ has an inflection point at \$x=(-?\d+)\$$/.exec(text))) return d2(c - 0.05) * d2(c + 0.05) < 0;
  if ((m = /^\$g'\((-?\d+)\)=0\$$/.exec(text))) return Math.abs(d1(c)) < 1e-6;
  throw new Error(`unexpected statement ${text}`);
}

describe('monotonicity-extremes.transformed-function: a statement must be true ⇔ it holds for every example f', () => {
  for (const type of ['single-choice', 'multi-select'] as GenType[])
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('transformed-function', seed, type);
        const m = /\$f'\(x\)([<>])0\$ for \$x<(-?\d+)\$ and \$f'\(x\)([<>])0\$ for \$x>(-?\d+)\$/.exec(g.stem)!;
        expect(m[1]).not.toBe(m[3]);
        expect(m[2]).toBe(m[4]);
        const c = Number(m[2]);
        const positive = /\$f\(x\)>0\$ for every \$x\$/.test(g.stem);
        const gu = texFn(rhs(displayMath(g.stem)[0]).replace(/f\(x\)/g, 'u'));
        const family = (m[1] === '>' ? MAX : MIN).filter((s) => s.pos || !positive);
        const gs = family.map((s) => (x: number) => gu({ u: s.f(x - c) }));
        // the example functions really have the stated properties
        for (const s of family) {
          for (const t of [-2, -0.5, -0.05]) expect((m[1] === '>' ? 1 : -1) * numDiff(s.f, t)).toBeGreaterThan(0);
          for (const t of [0.05, 0.5, 2]) expect((m[3] === '>' ? 1 : -1) * numDiff(s.f, t)).toBeGreaterThan(0);
          if (positive) expect(s.f(0) > 0 && s.f(3) > 0 && s.f(-3) > 0).toBe(true);
        }
        checkOptions(g, (text) => gs.every((gx) => holds(text, gx, c)));
      }
    });
});
