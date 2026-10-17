// Independent checks for the "Two variables: partial derivatives & level curves" templates. Every function is read
// back from the printed stem with the plain-JavaScript LaTeX evaluator (no mathjs, none of the template's formulas):
// - partial derivatives: Richardson-extrapolated central differences of the printed f at sample points; only the key
//   option agrees with them everywhere, and numeric answers match the difference quotient at the printed point;
// - level-curve shapes: points of two level curves are traced numerically (root scan + bisection in y) and fitted:
//   linear in x, quadratic in x, linear in ln x or √x, exponential (constant ratio of successive differences) or a
//   circle (x² + y² linear in x and y). Exactly one shape fits, and it is the shape of the key option only;
// - same level curves: each printed g(x, y) is evaluated with three concrete test functions f; g keeps the level
//   curves iff it is constant along every traced level curve of f and different level curves get different values;
// - MRS / slope: the slope of the level curve through the printed point is measured by moving the first variable a
//   little and solving F(a + h, b) = F(a, b) for b with bisection (dy/dx along the curve), no partial derivatives.
import { describe, expect, it } from 'vitest';
import { makeRng } from '../rng';
import type { GenType, Generated } from '../types';
import { bisect, displayMath, optionTex, rhs, texFn, type Env } from './_fnderiv-check';
import { TEMPLATES } from './two-var-partials';

const SEEDS = 300;
const gen = (id: string, seed: number, type: GenType) =>
  TEMPLATES.find((t) => t.id === `two-var-partials.${id}`)!.generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });
const close = (a: number, b: number, rel = 1e-6) => Math.abs(a - b) <= rel * (1 + Math.abs(a) + Math.abs(b));
const ok = (v: number) => Number.isFinite(v) && Math.abs(v) < 1e9;

/** The printed f(x, y) (first display formula of the stem). */
const printedF = (g: Generated) => {
  const f = texFn(rhs(displayMath(g.stem)[0]));
  return (x: number, y: number) => f({ x, y });
};

// ---------- 1. partial derivatives ----------

/** ∂f/∂w by central differences with one Richardson step (error O(h⁴)). */
function partial(f: (x: number, y: number) => number, x: number, y: number, w: 'x' | 'y', h = 1e-3): number {
  const D = (k: number) => (w === 'x' ? (f(x + k, y) - f(x - k, y)) / (2 * k) : (f(x, y + k) - f(x, y - k)) / (2 * k));
  return (4 * D(h / 2) - D(h)) / 3;
}

/** The variable of the asked partial derivative: "∂f/∂x" or "with respect to $x$". */
const askedVar = (stem: string) => (/\\partial f\}\{\\partial ([xy])\}/.exec(stem) ?? /with respect to \$([xy])\$/.exec(stem))![1] as 'x' | 'y';

/** A 12 × 12 grid of sample points in [−1.5, 1.5]² (off the integers). */
const SAMPLE = Array.from({ length: 144 }, (_, k) => [-1.43 + 0.26 * (k % 12), -1.39 + 0.26 * Math.floor(k / 12)]);

describe('two-var-partials.partial-derivative: compared with numerical differentiation of the printed f', () => {
  it('single-choice: only the key equals the difference quotient at every sample point', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('partial-derivative', seed, 'single-choice');
      const f = printedF(g);
      const w = askedVar(g.stem);
      // points well inside the domain (f defined in a small box around them)
      const pts = SAMPLE.filter(([x, y]) => [-0.01, 0, 0.01].every((d) => ok(f(x + d, y + d)) && ok(f(x - d, y + d))) && ok(f(x, y)));
      expect(pts.length, g.stem).toBeGreaterThanOrEqual(3);
      const ref = pts.map(([x, y]) => partial(f, x, y, w));
      for (const o of g.options!) {
        const d = texFn(optionTex(o.text!));
        const same = pts.every(([x, y], i) => close(d({ x, y }), ref[i], 1e-6));
        expect(same, `${o.id}: ${o.text}\n${g.stem}`).toBe(o.id === g.correctAnswer);
      }
    }
  });
  it('numeric: the answer is the difference quotient at the printed point', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('partial-derivative', seed, 'numeric');
      const f = printedF(g);
      const w = askedVar(g.stem);
      const m = /\((-?\d+),(-?\d+)\)\$/.exec(g.stem)!;
      const [x, y] = [Number(m[1]), Number(m[2])];
      expect(ok(f(x, y)), g.stem).toBe(true);
      const v = partial(f, x, y, w, 1e-4);
      expect(Math.abs((g.correctAnswer as number) - v), `${g.correctAnswer} vs ${v}\n${g.stem}`).toBeLessThanOrEqual(g.tolerance! + 1e-6);
    }
  });
});

// ---------- 2. level-curve shapes ----------

type Shape = 'line' | 'circle' | 'exp' | 'log' | 'sqrt' | 'parab';
function shapeOfText(t: string): Shape {
  const s = (
    [
      [/^Straight/, 'line'],
      [/^Circles/, 'circle'],
      [/exponential/, 'exp'],
      [/logarithmic/, 'log'],
      [/square-root/, 'sqrt'],
      [/^Parabolas/, 'parab'],
    ] as const
  ).find(([re]) => re.test(t));
  if (!s) throw new Error(`unknown shape option ${t}`);
  return s[1];
}

/** Least squares: coefficients of `basis` for the targets, and the largest residual. */
function fit(rows: number[][], target: number[]): { coef: number[]; res: number } {
  const k = rows[0].length;
  const A = Array.from({ length: k }, (_, i) => [...Array.from({ length: k }, (_, j) => rows.reduce((s, r) => s + r[i] * r[j], 0)), rows.reduce((s, r, n) => s + r[i] * target[n], 0)]);
  for (let c = 0; c < k; c++) {
    const p = A.slice(c).reduce((b, r, i) => (Math.abs(r[c]) > Math.abs(A[b][c]) ? c + i : b), c);
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < k; r++) if (r !== c) {
      const m = A[r][c] / A[c][c];
      for (let j = c; j <= k; j++) A[r][j] -= m * A[c][j];
    }
  }
  const coef = A.map((r, i) => r[k] / r[i]);
  const res = Math.max(...rows.map((r, n) => Math.abs(r.reduce((s, v, i) => s + v * coef[i], 0) - target[n])));
  return { coef, res };
}

/** All y in [−80, 80] with f(x, y) = c (scan for sign changes, then bisection). */
function ySolutions(f: (x: number, y: number) => number, x: number, c: number): number[] {
  const out: number[] = [];
  const h = (y: number) => f(x, y) - c;
  let y0 = -80;
  let h0 = h(y0);
  for (let i = 1; i <= 3200; i++) {
    const y1 = -80 + i * 0.05;
    const h1 = h(y1);
    if (Number.isFinite(h0) && Number.isFinite(h1) && h0 * h1 <= 0 && h0 !== h1) {
      const r = bisect(h, y0, y1);
      if (Math.abs(h(r)) < 1e-7 * (1 + Math.abs(c)) && !out.some((o) => Math.abs(o - r) < 1e-6)) out.push(r);
    }
    y0 = y1;
    h0 = h1;
  }
  return out;
}

/** The shapes that fit the level curve f = c traced for x in xs (each branch y_i(x) separately, or all as a circle). */
function shapesOf(f: (x: number, y: number) => number, c: number, xs: number[]): Shape[] {
  const sols = xs.map((x) => ySolutions(f, x, c));
  const found = new Set<Shape>();
  const all = xs.flatMap((x, i) => sols[i].map((y) => [x, y]));
  const scale = 1 + Math.max(...all.map(([x, y]) => x * x + y * y));
  if (all.length >= 5 && fit(all.map(([x, y]) => [1, x, y]), all.map(([x, y]) => x * x + y * y)).res < 1e-7 * scale) found.add('circle');
  const n = sols[0].length;
  if (n > 0 && sols.every((s) => s.length === n))
    for (let b = 0; b < n; b++) {
      const ys = sols.map((s) => s[b]);
      const tol = 1e-7 * (1 + Math.max(...ys.map(Math.abs)));
      const fits = (basis: (x: number) => number[], nonzero: number) => {
        const r = fit(xs.map(basis), ys);
        return r.res < tol && Math.abs(r.coef[nonzero]) > 1e-6;
      };
      if (fits((x) => [1, x], 1)) found.add('line');
      else if (fits((x) => [1, x, x * x], 2)) found.add('parab');
      if (xs.every((x) => x > 0) && fits((x) => [1, Math.log(x)], 1)) found.add('log');
      if (xs.every((x) => x >= 0) && fits((x) => [1, Math.sqrt(x)], 1)) found.add('sqrt');
      const d = ys.slice(1).map((y, i) => y - ys[i]);
      const r = d.slice(1).map((v, i) => v / d[i]);
      if (d.every((v) => Math.abs(v) > 1e-9) && r.every((v) => close(v, r[0], 1e-6)) && Math.abs(r[0] - 1) > 1e-4) found.add('exp');
    }
  return [...found];
}

/** Classify the level curves of the printed f at two different levels (both through points with x near x0). */
function classify(f: (x: number, y: number) => number): Shape[] {
  for (const x0 of [1.5, 0.8, 2.6, -0.6, -1.7, 3.4, -2.8]) {
    const ys = Array.from({ length: 4001 }, (_, i) => -20 + i * 0.01).filter((y) => ok(f(x0, y)) && ok(f(x0 - 0.5, y)) && ok(f(x0 + 0.5, y)));
    if (ys.length < 30) continue;
    const xs = Array.from({ length: 11 }, (_, i) => x0 - 0.5 + i * 0.1);
    const levels = [ys[Math.floor(ys.length / 2)], ys[Math.floor(ys.length * 0.3)]].map((y) => f(x0, y));
    const shapes = levels.map((c) => shapesOf(f, c, xs));
    if (shapes.some((s) => s.length === 0)) continue;
    expect(shapes[0], 'both levels have the same shape').toEqual(shapes[1]);
    return shapes[0];
  }
  throw new Error('no level curve traced');
}

describe('two-var-partials.level-curve-shape: level curves traced numerically and fitted', () => {
  it('exactly one shape fits, and only the key option names it', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('level-curve-shape', seed, 'single-choice');
      let shapes: Shape[];
      try {
        shapes = classify(printedF(g));
      } catch (e) {
        throw new Error(`seed ${seed}: ${(e as Error).message}\n${g.stem}`);
      }
      expect(shapes.length, `${shapes.join(',')}\n${g.stem}`).toBe(1);
      for (const o of g.options!) expect(shapeOfText(o.text!) === shapes[0], `${o.id}: ${o.text} (${shapes[0]})\n${g.stem}`).toBe(o.id === g.correctAnswer);
    }
  });
});

// ---------- 3. same level curves ----------

/** Test functions f with explicit level curves: points (x, y) with f(x, y) = c, parametrised by t. */
const TEST_F: { f: (x: number, y: number) => number; on: (c: number, t: number) => [number, number] }[] = [
  { f: (x, y) => x + 2 * y, on: (c, t) => [t, (c - t) / 2] },
  { f: (x, y) => y - x * x, on: (c, t) => [t, c + t * t] },
  { f: (x, y) => x * y, on: (c, t) => [t, c / t] },
];
const LEVELS = [-1.5, 0.7, 2.3];
const TS = [-1.9, -0.6, 0.8, 1.7];

/** g keeps the level curves of every test f: constant along each level curve, different on different ones. */
function keepsLevelCurves(gText: string): boolean {
  const body = /g\(x,y\)=(.+)$/.exec(optionTex(gText))![1].replace(/f\(x,y\)/g, 'F');
  const g = texFn(body);
  return TEST_F.every(({ f, on }) => {
    const per = LEVELS.map((c) =>
      TS.map((t) => {
        const [x, y] = on(c, t);
        expect(Math.abs(f(x, y) - c)).toBeLessThan(1e-12);
        return g({ x, y, F: f(x, y) } as Env);
      }),
    );
    const constant = per.every((vs) => vs.every((v) => close(v, vs[0], 1e-9)));
    const distinct = per.every((vs, i) => per.every((ws, j) => i === j || !close(vs[0], ws[0], 1e-6)));
    return constant && distinct;
  });
}

describe('two-var-partials.same-level-curves: each g tested with concrete functions f', () => {
  it('single-choice: only the key keeps the level curves', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('same-level-curves', seed, 'single-choice');
      for (const o of g.options!) expect(keepsLevelCurves(o.text!), `${o.id}: ${o.text}`).toBe(o.id === g.correctAnswer);
    }
  });
  it('multi-select: the key is exactly the set of g that keep the level curves', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('same-level-curves', seed, 'multi-select');
      const good = g.options!.filter((o) => keepsLevelCurves(o.text!)).map((o) => o.id);
      expect(good).toEqual(g.correctAnswer);
    }
  });
});

// ---------- 4. MRS / slope of a level curve ----------

/** The printed function, the asked ratio −F'_a/F'_b and the point, read from the stem. */
function readMrs(g: Generated) {
  const def = displayMath(g.stem)[0];
  const [, , v1, v2] = /^([UQf])\((\w),(\w)\)=/.exec(def)!;
  const F = texFn(rhs(def));
  const [, a, b] = /-\\dfrac\{\w'_\{(\w)\}\}\{\w'_\{(\w)\}\}/.exec(g.stem)!;
  const pm = /\$\((\w),(\w)\)=\((-?\d+),(-?\d+)\)\$/.exec(g.stem)!;
  const at: Env = { [pm[1]]: Number(pm[3]), [pm[2]]: Number(pm[4]) };
  expect([v1, v2].sort()).toEqual([a, b].sort());
  return { F, a, b, at };
}

/** db/da along the level curve F = F(point): move a by ±h and solve for b with bisection. */
function slopeAlongCurve({ F, a, b, at }: ReturnType<typeof readMrs>, h = 1e-4): number {
  const F0 = F(at);
  const solveB = (aVal: number) => {
    const G = (bVal: number) => F({ ...at, [a]: aVal, [b]: bVal }) - F0;
    for (const d of [1e-3, 1e-2, 0.1]) if (G(at[b] - d) * G(at[b] + d) < 0) return bisect(G, at[b] - d, at[b] + d);
    throw new Error('level curve not found');
  };
  return (solveB(at[a] + h) - solveB(at[a] - h)) / (2 * h);
}

describe('two-var-partials.mrs-slope: slope of the level curve measured by solving F = const numerically', () => {
  it('single-choice: only the key equals the measured slope', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('mrs-slope', seed, 'single-choice');
      const s = slopeAlongCurve(readMrs(g));
      for (const o of g.options!) {
        const v = texFn(optionTex(o.text!))({});
        expect(close(v, s, 1e-5), `${o.id}: ${o.text} vs ${s}\n${g.stem}`).toBe(o.id === g.correctAnswer);
      }
    }
  });
  it('numeric: the answer is the measured slope', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('mrs-slope', seed, 'numeric');
      const s = slopeAlongCurve(readMrs(g));
      expect(Math.abs((g.correctAnswer as number) - s), g.stem).toBeLessThanOrEqual(g.tolerance! + 1e-6);
    }
  });
});
