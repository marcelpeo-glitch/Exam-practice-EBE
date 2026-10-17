// Independent checks for the Derivatives templates. Functions and option formulas are read back from the printed LaTeX
// (plain JavaScript evaluation in _fnderiv-check, no mathjs) and compared with central differences of the printed
// function. Table questions are checked against smooth functions rebuilt from the table (cubic Hermite interpolation),
// so the chain rule itself is never used; tangency is checked by the touching condition (graph − line has a double
// zero); marginal approximations by a numerical derivative of the printed relation solved for y.
import { describe, expect, it } from 'vitest';
import { numDiff } from '../mathx';
import { makeRng } from '../rng';
import type { GenType, Generated } from '../types';
import { bisect, displayMath, inlineMath, optionTex, rhs, texFn, texFn1 } from './_fnderiv-check';
import { TEMPLATES } from './derivatives';

const SEEDS = 300;
const byId = (id: string) => TEMPLATES.find((t) => t.id === id)!;
const gen = (id: string, seed: number, type: GenType = 'single-choice') => byId(id).generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });
const close = (a: number, b: number, rel: number) => Math.abs(a - b) <= rel * (1 + Math.abs(b));

describe('derivatives.product-exp-at-zero', () => {
  const t = byId('derivatives.product-exp-at-zero');
  it("the key equals a numerical f'(0) and no distractor does", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const g = t.generate({ rng: makeRng(seed), type: 'single-choice', optionCount: 5 });
      const m = g.stem.match(/\\left\((-?\d+)x ([+-]) (\d+)\\right\)e\^\{(-?\d+)x\}/)!;
      const [a, b, c] = [Number(m[1]), Number(m[2] + m[3]), Number(m[4])];
      const expected = numDiff((x) => (a * x + b) * Math.exp(c * x), 0);
      const value = (id: string) => Number(g.options!.find((o) => o.id === id)!.text!.replace(/\$/g, ''));
      expect(value(g.correctAnswer as string)).toBeCloseTo(expected, 4);
      for (const o of g.options!) if (o.id !== g.correctAnswer) expect(Math.abs(value(o.id) - expected)).toBeGreaterThan(0.5);
    }
  });
  it("numeric: the key is an exact integer equal to a numerical f'(0) of the printed function", () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = t.generate({ rng: makeRng(seed), type: 'numeric', optionCount: seed % 2 ? 5 : 4 });
      const m = g.stem.match(/\\left\((-?\d+)x ([+-]) (\d+)\\right\)e\^\{(-?\d+)x\}/)!;
      const [a, b, c] = [Number(m[1]), Number(m[2] + m[3]), Number(m[4])];
      const expected = numDiff((x) => (a * x + b) * Math.exp(c * x), 0);
      expect(g.tolerance, g.stem).toBe(0);
      expect(Number.isInteger(g.correctAnswer), `${g.correctAnswer}`).toBe(true); // tolerance 0 needs an exact integer
      expect(Math.abs((g.correctAnswer as number) - expected), g.stem).toBeLessThan(1e-4);
    }
  });
});

/** The printed function (first display formula) and sample points where it is defined, moderate and smooth. */
function printed(g: Generated) {
  const f = texFn1(rhs(displayMath(g.stem)[0]));
  const xs = [-1.9, -0.6, 0.35, 0.8, 1.3, 2.2, 3.7].filter((x) => {
    const y = f(x);
    if (!Number.isFinite(y) || Math.abs(y) > 1e6) return false;
    const d1 = numDiff(f, x, 1e-5);
    return Number.isFinite(d1) && close(d1, numDiff(f, x, 1e-3), 1e-3);
  });
  return { f, xs };
}

/** Exactly the key option is the derivative of the printed function (at every sample point). */
function checkFormulaOptions(g: Generated) {
  const { f, xs } = printed(g);
  expect(xs.length, g.stem).toBeGreaterThanOrEqual(3);
  const isDerivative = (text: string) => {
    const d = texFn1(rhs(optionTex(text)));
    return xs.every((x) => close(d(x), numDiff(f, x), 1e-4));
  };
  for (const o of g.options!) {
    expect(isDerivative(o.text!), `${o.id} ${o.text} for ${g.stem}`).toBe(o.id === g.correctAnswer);
    expect(o.text, 'a coefficient 1 is not printed').not.toMatch(/(^|[^0-9.])1x/);
  }
}

/** The numeric answer is f'(x0) of the printed function, up to the stated rounding. */
function checkNumericDerivative(g: Generated) {
  const { f } = printed(g);
  const x0 = Number(/'\((-?[\d.]+)\)/.exec(g.stem)![1]);
  expect(Math.abs((g.correctAnswer as number) - numDiff(f, x0)), g.stem).toBeLessThanOrEqual(g.tolerance! + 1e-7);
  // not a near-zero slope that would keep a single significant digit at 3 decimals
  expect(Math.abs(g.correctAnswer as number), g.stem).toBeGreaterThanOrEqual(0.02);
}

/** Cubic Hermite interpolation through (x_i, y_i) with slopes d_i (unit spacing), extrapolated by the end pieces. */
function hermite(xs: number[], ys: number[], ds: number[]) {
  return (x: number) => {
    const i = Math.min(Math.max(Math.floor(x - xs[0]), 0), xs.length - 2);
    const t = x - xs[i];
    return (2 * t ** 3 - 3 * t ** 2 + 1) * ys[i] + (t ** 3 - 2 * t ** 2 + t) * ds[i] + (-2 * t ** 3 + 3 * t ** 2) * ys[i + 1] + (t ** 3 - t ** 2) * ds[i + 1];
  };
}

/** h = F∘G with F, G rebuilt from the table; h'(x0) by central differences. */
function tableDerivative(g: Generated): number {
  const T = g.table!.rows.map((r) => r.map((c) => Number(c.replace(/\$/g, ''))));
  const X = T.map((r) => r[0]);
  const F = hermite(X, T.map((r) => r[1]), T.map((r) => r[3]));
  const G = hermite(X, T.map((r) => r[2]), T.map((r) => r[4]));
  const x0 = Number(/h'\((\d+)\)/.exec(g.stem)![1]);
  return numDiff((x) => F(G(x)), x0, 1e-6);
}

const optionNumber = (text: string) => texFn(rhs(optionTex(text)))({});

describe('derivatives.quotient-rule', () => {
  it('exactly the key is the derivative of the printed quotient', () => {
    for (let seed = 1; seed <= SEEDS; seed++) checkFormulaOptions(gen('derivatives.quotient-rule', seed));
  });
  it("numeric answer equals a numerical f'(x0)", () => {
    for (let seed = 1; seed <= SEEDS; seed++) checkNumericDerivative(gen('derivatives.quotient-rule', seed, 'numeric'));
  });
});

describe('derivatives.chain-rule', () => {
  it('formula options: exactly the key is the derivative; table options: exactly the key is h\'(x0) of the rebuilt functions', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('derivatives.chain-rule', seed);
      if (!g.table) {
        checkFormulaOptions(g);
        continue;
      }
      const exact = tableDerivative(g);
      for (const o of g.options!) expect(Math.abs(optionNumber(o.text!) - exact) < 1e-3, `${o.text} vs ${exact}`).toBe(o.id === g.correctAnswer);
    }
  });
  it('numeric answers', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('derivatives.chain-rule', seed, 'numeric');
      if (g.table) expect(Math.abs((g.correctAnswer as number) - tableDerivative(g))).toBeLessThan(1e-3);
      else checkNumericDerivative(g);
    }
  });
});

// ---------- tangent lines, tangency parameter, marginal approximation ----------

type TKind = 'line' | 'parameter' | 'marginal';
const tKind = (g: Generated): TKind => (/are related by/.test(g.stem) ? 'marginal' : /\+a\$\$/.test(g.stem) ? 'parameter' : 'line');

/** Value and slope of the printed function at the stated point. */
function pointAndSlope(g: Generated) {
  const { f } = printed(g);
  const x0 = Number(/\$x=(-?\d+)\$/.exec(g.stem)![1]);
  return { x0, y0: f(x0), m: numDiff(f, x0) };
}

/** True when the line touches the parabola f(x; a): f − line has a stationary point where it is zero. */
function touches(g: Generated, a: number): boolean {
  const fa = texFn(rhs(displayMath(g.stem)[0]));
  const line = texFn1(rhs(inlineMath(g.stem).find((s) => s.startsWith('y='))!));
  const h = (x: number) => fa({ x, a }) - line(x);
  const xs = bisect((x) => numDiff(h, x), -60, 60);
  return Math.abs(h(xs)) < 1e-6;
}

/** The printed relation (x + A)(y + B) = C or (x + A)(B − y) = C solved for y, and the two x-values of the stem. */
function marginalModel(g: Generated) {
  const r = /\\left\(([a-zA-Z])\+(\d+)\\right\)\\left\((?:([a-zA-Z])\+(\d+)|(\d+)-([a-zA-Z]))\\right\)=(\d+)/.exec(g.stem)!;
  const A = Number(r[2]);
  const C = Number(r[7]);
  const y = r[3] ? (x: number) => C / (x + A) - Number(r[4]) : (x: number) => Number(r[5]) - C / (x + A);
  // check that y(x) satisfies the printed relation (reading the relation back the other way round)
  const x1 = 3.7;
  expect(r[3] ? (x1 + A) * (y(x1) + Number(r[4])) : (x1 + A) * (Number(r[5]) - y(x1))).toBeCloseTo(C, 9);
  const [, from, to] = /from \$(-?[\d.]+)\$ to \$(-?[\d.]+)\$/.exec(g.stem)!.map(Number);
  return { y, from, to };
}

/** Linear approximation of the change, from a numerical derivative of the printed relation solved for y. */
function marginalChange(g: Generated): number {
  const { y, from, to } = marginalModel(g);
  return numDiff(y, from) * (to - from);
}

/** Values of the modelled quantity at the two x-values of the stem. */
function marginalValues(g: Generated) {
  const { y, from, to } = marginalModel(g);
  return { from: y(from), to: y(to) };
}

const changeIn = (text: string) => {
  const m = /(increases|decreases) by about ([\d.]+)/.exec(text)!;
  const dec = m[2].includes('.') ? m[2].length - m[2].indexOf('.') - 1 : 0;
  return { value: (m[1] === 'increases' ? 1 : -1) * Number(m[2]), halfUnit: 0.5 * 10 ** -dec + 1e-9 };
};

describe('derivatives.tangent-line', () => {
  it('single-choice: exactly the key is correct (tangent line / touching parameter / linear approximation)', () => {
    const seen = new Set<TKind>();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('derivatives.tangent-line', seed);
      const kind = tKind(g);
      seen.add(kind);
      for (const o of g.options!) {
        let ok: boolean;
        if (kind === 'line') {
          const { x0, y0, m } = pointAndSlope(g);
          const L = texFn1(rhs(optionTex(o.text!)));
          ok = [-1, 0, 2, 5].every((x) => close(L(x), y0 + m * (x - x0), 1e-6));
        } else if (kind === 'parameter') ok = touches(g, optionNumber(o.text!));
        else {
          const { value, halfUnit } = changeIn(o.text!);
          ok = Math.abs(value - marginalChange(g)) <= halfUnit;
          // the key is never a rounding tie (0.125 shown as 0.13: a student who writes 0.12 is just as right)
          if (o.id === g.correctAnswer) expect(Math.abs(value - marginalChange(g)), o.text).toBeLessThan(halfUnit - 1e-6);
        }
        expect(ok, `${kind} seed ${seed} ${o.id} ${o.text}\n${g.stem}`).toBe(o.id === g.correctAnswer);
      }
    }
    expect([...seen].sort()).toEqual(['line', 'marginal', 'parameter']);
  });
  it('numeric: intercept of the tangent line, touching parameter, approximate change', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('derivatives.tangent-line', seed, 'numeric');
      const ans = g.correctAnswer as number;
      const kind = tKind(g);
      if (kind === 'parameter') expect(touches(g, ans), g.stem).toBe(true);
      else {
        let exact: number;
        if (kind === 'line') {
          const { x0, y0, m } = pointAndSlope(g);
          exact = y0 - m * x0;
        } else exact = marginalChange(g);
        expect(Math.abs(ans - exact), g.stem).toBeLessThanOrEqual(g.tolerance! + 1e-7);
        // no rounding tie at the stated number of decimals (half a unit = 5/6 of the tolerance 0.6·10^-dp)
        if (kind === 'marginal') expect(Math.abs(ans - exact), g.stem).toBeLessThan((g.tolerance! * 5) / 6 - 1e-6);
      }
      if (kind === 'marginal') {
        // the modelled quantity stays meaningful: at least 1 unit at both points and after the approximation
        const v = marginalValues(g);
        for (const y of [v.from, v.to, v.from + (g.correctAnswer as number)]) expect(y, g.stem).toBeGreaterThanOrEqual(0.99); // (answer rounded)
      }
    }
  });
});
