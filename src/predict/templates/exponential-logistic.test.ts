// Independent checks for the "Exponential & logistic growth" templates. Every number is read back from the printed stem
// or table, and the key is recomputed another way than the template does: year-by-year / week-by-week enumeration with
// powers instead of logarithms, numerical derivatives of the printed function (read with plain JavaScript, no mathjs),
// and bisection instead of solving with logarithms. Every distractor must fail the same check.
import { describe, expect, it } from 'vitest';
import { numDiff } from '../mathx';
import { makeRng } from '../rng';
import type { GenType, Generated } from '../types';
import { bisect, displayMath, rhs, texFn, texFn1 } from './_fnderiv-check';
import { TEMPLATES } from './exponential-logistic';

const SEEDS = 300;
const byId = (id: string) => TEMPLATES.find((t) => t.id === id)!;
const gen = (id: string, seed: number, type: GenType = 'single-choice') => byId(id).generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });
const keyText = (g: Generated) => g.options!.find((o) => o.id === g.correctAnswer)!.text!;
const lastInt = (s: string) => Number(/(\d+)\s*$/.exec(s)![1]);

describe('exponential-logistic.percentage-growth', () => {
  const read = (stem: string) => {
    const p = Number(/(\d+)% per year/.exec(stem)![1]);
    const Y0 = Number(/1 January (\d{4})/.exec(stem)![1]);
    const times = /(\d+(?:\.\d+)?) times as large/.exec(stem);
    const pct = /(?:below|dropped to) (\d+)% of/.exec(stem);
    const grow = !!times;
    return { Y0, grow, g: grow ? 1 + p / 100 : 1 - p / 100, k: grow ? Number(times![1]) : Number(pct![1]) / 100 };
  };
  it('the key year is found by compounding year by year; no other option is', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('exponential-logistic.percentage-growth', seed);
      const { Y0, grow, g: f, k } = read(g.stem);
      let n = 0; // the level passes k during year Y0 + n: at its end (t = n + 1) it has passed, at its start it had not
      while (!(grow ? f ** (n + 1) >= k : f ** (n + 1) < k)) n++;
      expect(grow ? f ** n < k : f ** n >= k).toBe(true);
      for (const o of g.options!) expect(Number(o.text) === Y0 + n, `${o.text} vs ${Y0 + n}: ${g.stem}`).toBe(o.id === g.correctAnswer);
    }
  });
  it('numeric: the number of years solves g^t = k (bisection)', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('exponential-logistic.percentage-growth', seed, 'numeric');
      const { g: f, k } = read(g.stem);
      const t = bisect((x) => f ** x - k, 0, 200);
      expect(Math.abs((g.correctAnswer as number) - t)).toBeLessThanOrEqual(g.tolerance! + 1e-9);
    }
  });
});

describe('exponential-logistic.two-observations', () => {
  /** First period in which the exponential through the two table values passes the level (enumeration). */
  const firstPeriod = (g: Generated) => {
    const [[, a], [w, b]] = g.table!.rows.map((r) => r.map(Number));
    const [, rel, x] = /for the first time (below|above) (\d+)/.exec(g.stem)!;
    const N = (n: number) => a * (b / a) ** ((n - 1) / (w - 1));
    expect(N(w)).toBeCloseTo(b, 6);
    let n = 1;
    while (!(rel === 'below' ? N(n) < Number(x) : N(n) > Number(x))) n++;
    expect(n).toBeLessThanOrEqual(w);
    return n;
  };
  it('exactly the key option is the first period past the level', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('exponential-logistic.two-observations', seed);
      const n = firstPeriod(g);
      for (const o of g.options!) expect(lastInt(o.text!) === n, `${o.text} vs ${n}`).toBe(o.id === g.correctAnswer);
    }
  });
  it('numeric', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('exponential-logistic.two-observations', seed, 'numeric');
      expect(g.correctAnswer).toBe(firstPeriod(g));
    }
  });
});

describe('exponential-logistic.logistic-constants', () => {
  const val = (re: RegExp, s: string) => Number(re.exec(s)![1]);
  /** The printed model as f(t; c) or f(t; c1, c2), read with plain JavaScript. */
  const model = (g: Generated) => texFn(rhs(displayMath(g.stem)[0].replace(/c_1/g, 'p').replace(/c_2/g, 'q')));
  const fits = (g: Generated, env: Record<string, number>, tol: number) => {
    const f = model(g);
    const B = val(/f'\(0\)=([\d.]+)/, g.stem);
    const okRate = Math.abs(numDiff((t) => f({ ...env, t }), 0) - B) <= tol;
    if (!/c_1/.test(g.stem)) return okRate;
    return okRate && Math.abs(f({ ...env, t: 0 }) - val(/f\(0\)=([\d.]+)/, g.stem)) <= tol;
  };
  it('exactly the key reproduces the printed f(0) and the numerical f\'(0)', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('exponential-logistic.logistic-constants', seed);
      for (const o of g.options!) {
        const m = /c_1=(-?[\d.]+)\$ and \$c_2=(-?[\d.]+)/.exec(o.text!);
        const env = m ? { p: Number(m[1]), q: Number(m[2]) } : { c: Number(o.text!.replace(/\$/g, '')) };
        expect(fits(g, env, 1e-6), `${o.text}: ${g.stem}`).toBe(o.id === g.correctAnswer);
      }
    }
  });
  it('numeric: solving the two conditions numerically gives the answer(s)', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('exponential-logistic.logistic-constants', seed, 'numeric');
      const f = model(g);
      const B = val(/f'\(0\)=([\d.]+)/, g.stem);
      if (g.fields) {
        // f(t) = p + q·s(t): q from the rate, then p from the value
        const q = B / numDiff((t) => f({ p: 0, q: 1, t }), 0);
        const p = val(/f\(0\)=([\d.]+)/, g.stem) - q * f({ p: 0, q: 1, t: 0 });
        const [f1, f2] = g.fields;
        expect(Math.abs(f1.answer - p)).toBeLessThanOrEqual(f1.tolerance! + 1e-9);
        expect(Math.abs(f2.answer - q)).toBeLessThanOrEqual(f2.tolerance! + 1e-9);
      } else {
        const c = B / numDiff((t) => f({ c: 1, t }), 0); // f is proportional to c
        expect(Math.abs((g.correctAnswer as number) - c)).toBeLessThanOrEqual(g.tolerance! + 1e-9);
      }
    }
  });
});

describe('exponential-logistic.time-to-level', () => {
  /** The time asked for, by bisection on the printed function (or its numerical derivative). */
  const solve = (g: Generated) => {
    const N = texFn1(rhs(displayMath(g.stem)[0]), 't');
    if (/N'\(t\)/.test(g.stem)) {
      const L = Number(/drop below (\d+)/.exec(g.stem)![1]);
      return bisect((t) => numDiff(N, t) - L, 0, 200);
    }
    if (/doubled/.test(g.stem)) return bisect((t) => N(t) - 2 * N(0), 0, 100);
    const q = Number(/reach (\d+)% of/.exec(g.stem)![1]) / 100;
    const M = N(1e4); // the long-run level, from the function itself
    return bisect((t) => N(t) - q * M, 0, 200);
  };
  it('exactly the key option is the time found by bisection (to the printed 2 decimals)', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('exponential-logistic.time-to-level', seed);
      kinds.add(/N'\(t\)/.test(g.stem) ? 'rate' : /doubled/.test(g.stem) ? 'double' : 'logistic');
      const t = solve(g);
      for (const o of g.options!) expect(Math.abs(parseFloat(o.text!) - t) <= 0.005 + 1e-9, `${o.text} vs ${t}`).toBe(o.id === g.correctAnswer);
    }
    expect(kinds.size).toBe(3);
  });
  it('numeric', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('exponential-logistic.time-to-level', seed, 'numeric');
      expect(Math.abs((g.correctAnswer as number) - solve(g))).toBeLessThanOrEqual(g.tolerance! + 1e-9);
    }
  });
});

it('keys are not always the same option letter', () => {
  for (const t of TEMPLATES) {
    const letters = new Set(Array.from({ length: 40 }, (_, i) => gen(t.id, i + 1).correctAnswer));
    expect(letters.size, t.id).toBeGreaterThan(1);
    expect(keyText(gen(t.id, 1)).length).toBeGreaterThan(0);
  }
});
