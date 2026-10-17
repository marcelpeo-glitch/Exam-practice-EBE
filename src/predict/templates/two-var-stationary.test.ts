// Independent checks for the "Two variables: stationary points" templates. The function is read back from the printed
// stem with the plain-JavaScript LaTeX evaluator (no mathjs, none of the template's formulas), and all derivatives are
// finite differences of the printed function:
// - find-point / count: all stationary points are found by Newton's method (numerical gradient and Hessian) started
//   from a grid of points; the key must be the (number of) solution(s), and no distractor point may be stationary;
// - status: the point must be stationary, C comes from the numerical Hessian, and for C ≠ 0 the verdict is confirmed
//   by sampling f on a small circle around the point (all higher → minimum, all lower → maximum, both → saddle);
// - profit: the profit function is rebuilt from the printed demand/cost/price numbers and maximised numerically
//   (Newton + a check that every nearby point is worse); the key must be the maximum (or maximiser).
import { describe, expect, it } from 'vitest';
import { makeRng } from '../rng';
import type { GenType, Generated } from '../types';
import { displayMath, inlineMath, optionTex, rhs, texFn } from './_fnderiv-check';
import { TEMPLATES } from './two-var-stationary';

const SEEDS = 300;
const TYPES: GenType[] = ['single-choice', 'numeric'];
const gen = (id: string, seed: number, type: GenType) =>
  TEMPLATES.find((t) => t.id === `two-var-stationary.${id}`)!.generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });

type F2 = (x: number, y: number) => number;

/** The printed function after `lhs` in the stem's display maths. */
function printed(stem: string, lhs = 'f(x,y)='): F2 {
  const t = displayMath(stem).find((d) => d.trim().startsWith(lhs))!;
  const f = texFn(rhs(t));
  return (x, y) => f({ x, y });
}

/** Gradient and Hessian by central differences (9 evaluations). */
function derivs(f: F2, x: number, y: number, h = 1e-4) {
  const f0 = f(x, y);
  const [fxp, fxm, fyp, fym] = [f(x + h, y), f(x - h, y), f(x, y + h), f(x, y - h)];
  const fxy = (f(x + h, y + h) - f(x + h, y - h) - f(x - h, y + h) + f(x - h, y - h)) / (4 * h * h);
  return { gx: (fxp - fxm) / (2 * h), gy: (fyp - fym) / (2 * h), fxx: (fxp - 2 * f0 + fxm) / (h * h), fyy: (fyp - 2 * f0 + fym) / (h * h), fxy };
}

/** Newton's method for ∇f = 0 from (x, y); null when it does not converge. */
function newton(f: F2, x: number, y: number): [number, number] | null {
  for (let k = 0; k < 60; k++) {
    const d = derivs(f, x, y);
    const det = d.fxx * d.fyy - d.fxy * d.fxy;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
    const dx = (d.fyy * d.gx - d.fxy * d.gy) / det;
    const dy = (d.fxx * d.gy - d.fxy * d.gx) / det;
    [x, y] = [x - dx, y - dy];
    if (Math.abs(x) > 50 || Math.abs(y) > 50) return null;
    if (Math.hypot(dx, dy) < 1e-11) break;
  }
  const d = derivs(f, x, y);
  return Math.hypot(d.gx, d.gy) < 1e-5 ? [x, y] : null;
}

/**
 * All stationary points in [−10, 10]²: |∇f| is sampled on a grid (spacing 0.25), and Newton's method is started from
 * every grid point where |∇f| is a local minimum (and from a coarse grid); the solutions are merged.
 */
function stationaryPoints(f: F2): [number, number][] {
  const n = 80;
  const at = (i: number) => -10 + i * 0.25;
  const norm = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => {
      const [x, y, h] = [at(i), at(j), 1e-5];
      return Math.hypot(f(x + h, y) - f(x - h, y), f(x, y + h) - f(x, y - h)) / (2 * h);
    }),
  );
  const starts: [number, number][] = [];
  for (let i = 1; i < n; i++)
    for (let j = 1; j < n; j++) {
      let isMin = true;
      for (let di = -1; di <= 1 && isMin; di++) for (let dj = -1; dj <= 1; dj++) if (norm[i + di][j + dj] < norm[i][j]) isMin = false;
      if (isMin) starts.push([at(i), at(j)]);
    }
  for (let x = -9; x <= 9; x += 3) for (let y = -9; y <= 9; y += 3) starts.push([x + 0.37, y - 0.21]);
  const out: [number, number][] = [];
  for (const [x0, y0] of starts) {
    const r = newton(f, x0, y0);
    if (r && Math.abs(r[0]) <= 10 && Math.abs(r[1]) <= 10 && !out.some(([a, b]) => Math.hypot(a - r[0], b - r[1]) < 1e-4)) out.push(r);
  }
  return out;
}

const isStationary = (f: F2, x: number, y: number) => {
  const d = derivs(f, x, y);
  return Math.hypot(d.gx, d.gy) < 1e-5 * (1 + Math.abs(f(x, y)));
};

/** "(a,b)" as LaTeX → [a, b] (a and b may be fractions). */
function pointOf(tex: string): [number, number] {
  const inner = tex.trim().replace(/^\(|\)$/g, '');
  let depth = 0;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '{') depth++;
    else if (inner[i] === '}') depth--;
    else if (inner[i] === ',' && depth === 0) return [texFn(inner.slice(0, i))({}), texFn(inner.slice(i + 1))({})];
  }
  throw new Error(`not a point: ${tex}`);
}

describe('two-var-stationary.find-point: Newton on the printed f', () => {
  it('single-choice: the key is the unique stationary point, no other option is stationary', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('find-point', seed, 'single-choice');
      const f = printed(g.stem);
      const sp = stationaryPoints(f);
      expect(sp.length, g.stem).toBe(1);
      for (const o of g.options!) {
        const [x, y] = pointOf(optionTex(o.text!));
        const isKey = Math.hypot(x - sp[0][0], y - sp[0][1]) < 1e-6;
        expect(isKey, `${o.id}: ${o.text}\n${g.stem}`).toBe(o.id === g.correctAnswer);
        if (o.id !== g.correctAnswer) expect(isStationary(f, x, y), `${o.id}: ${o.text}`).toBe(false);
      }
    }
  });
  it('numeric: the two fields are the coordinates of the stationary point', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('find-point', seed, 'numeric');
      const sp = stationaryPoints(printed(g.stem));
      expect(sp.length, g.stem).toBe(1);
      const [fx, fy] = g.fields!;
      expect(Math.abs(fx.answer - sp[0][0])).toBeLessThanOrEqual(fx.tolerance! + 1e-6);
      expect(Math.abs(fy.answer - sp[0][1])).toBeLessThanOrEqual(fy.tolerance! + 1e-6);
    }
  });
});

type Status = 'min' | 'max' | 'saddle' | 'undMin' | 'undMax';
function statusOfText(t: string): Status {
  if (/inconclusive/.test(t)) return /either a minimum/.test(t) ? 'undMin' : 'undMax';
  if (/local minimum/.test(t)) return 'min';
  if (/local maximum/.test(t)) return 'max';
  if (/saddle point/.test(t)) return 'saddle';
  throw new Error(`unknown status ${t}`);
}

/** The given point (first inline "(a,b)") and the course's verdict from the numerical Hessian, confirmed by sampling. */
function judge(g: Generated) {
  const f = printed(g.stem);
  const [x, y] = pointOf(inlineMath(g.stem).find((m) => /^\(-?\d+,-?\d+\)$/.test(m))!);
  expect(isStationary(f, x, y), g.stem).toBe(true);
  const d = derivs(f, x, y, 1e-3);
  const C = d.fxx * d.fyy - d.fxy * d.fxy;
  const Cr = Math.round(C) || 0; // no −0
  expect(Math.abs(C - Cr), 'integer C').toBeLessThan(1e-3 * (1 + Math.abs(C)));
  let st: Status;
  if (Cr === 0) st = Math.round(d.fxx) > 0 || Math.round(d.fyy) > 0 ? 'undMin' : 'undMax';
  else {
    st = Cr < 0 ? 'saddle' : d.fxx > 0 ? 'min' : 'max';
    const f0 = f(x, y);
    const diffs = Array.from({ length: 72 }, (_, i) => f(x + 1e-3 * Math.cos((i * Math.PI) / 36 + 0.01), y + 1e-3 * Math.sin((i * Math.PI) / 36 + 0.01)) - f0);
    const sampled: Status = diffs.every((v) => v > 0) ? 'min' : diffs.every((v) => v < 0) ? 'max' : 'saddle';
    expect(sampled, `sampling disagrees with the Hessian\n${g.stem}`).toBe(st);
  }
  return { st, C: Cr };
}

describe('two-var-stationary.status: numerical Hessian, confirmed by sampling around the point', () => {
  it('single-choice: only the key gives the right status', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('status', seed, 'single-choice');
      const { st } = judge(g);
      for (const o of g.options!) expect(statusOfText(o.text!) === st, `${o.id}: ${o.text} (${st})\n${g.stem}`).toBe(o.id === g.correctAnswer);
    }
  });
  it('numeric: the answer is C at the point', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('status', seed, 'numeric');
      expect(g.correctAnswer, g.stem).toBe(judge(g).C);
    }
  });
});

describe('two-var-stationary.count: all stationary points found by Newton from a grid', () => {
  for (const type of TYPES)
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('count', seed, type);
        const f = printed(g.stem);
        const sp = stationaryPoints(f);
        const other = /Apart from|Besides/.test(g.stem);
        if (other) {
          const [x, y] = pointOf(inlineMath(g.stem).find((m) => /^\(-?\d+,-?\d+\)$/.test(m))!);
          expect(sp.some(([a, b]) => Math.hypot(a - x, b - y) < 1e-6), g.stem).toBe(true);
        }
        const answer = sp.length - (other ? 1 : 0);
        if (type === 'numeric') expect(g.correctAnswer, g.stem).toBe(answer);
        else for (const o of g.options!) expect(Number(o.text) === answer, `${o.id}: ${o.text} (${answer})\n${g.stem}`).toBe(o.id === g.correctAnswer);
      }
    });
});

/** The asked quantity, recomputed by maximising the profit rebuilt from the printed numbers. */
function profitAnswer(stem: string): number {
  let profit: F2;
  if (stem.includes('Q_1=')) {
    const q = (i: number) => {
      const m = new RegExp(`Q_${i}=(\\d+)-(\\d*)P_${i}`).exec(stem)!;
      return [Number(m[1]), m[2] === '' ? 1 : Number(m[2])];
    };
    const [[a1, b1], [a2, b2]] = [q(1), q(2)];
    const cm = /C=(\d+)\(Q_1\+Q_2\)(?:\+(\d+))?/.exec(stem)!;
    const [c, F] = [Number(cm[1]), Number(cm[2] ?? 0)];
    profit = (p1, p2) => p1 * (a1 - b1 * p1) + p2 * (a2 - b2 * p2) - c * (a1 - b1 * p1 + a2 - b2 * p2) - F;
  } else {
    const [, p, q] = /at €(\d+) and €(\d+) each/.exec(stem)!.map(Number);
    const C = printed(stem, 'C(x,y)=');
    profit = (x, y) => p * x + q * y - C(x, y);
  }
  // Newton from (1, 1) with numerical derivatives, then: no nearby point may be better
  let [x, y] = [1, 1];
  for (let k = 0; k < 20; k++) {
    const d = derivs(profit, x, y, 1e-2);
    const det = d.fxx * d.fyy - d.fxy * d.fxy;
    [x, y] = [x - (d.fyy * d.gx - d.fxy * d.gy) / det, y - (d.fxx * d.gy - d.fxy * d.gx) / det];
  }
  const best = profit(x, y);
  for (const r of [1, 0.01]) for (let i = 0; i < 16; i++) expect(profit(x + r * Math.cos(i / 2.5), y + r * Math.sin(i / 2.5))).toBeLessThan(best);
  expect(x > 0 && y > 0, stem).toBe(true);
  if (/maximal profit/.test(stem)) return best;
  return x; // the price in market 1, or the quantity x
}

describe('two-var-stationary.profit: profit maximised numerically from the printed numbers', () => {
  for (const type of TYPES)
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('profit', seed, type);
        const answer = profitAnswer(g.stem);
        if (type === 'numeric') expect(Math.abs((g.correctAnswer as number) - answer), g.stem).toBeLessThanOrEqual((g.tolerance ?? 0) + 1e-6);
        else
          for (const o of g.options!)
            expect(Math.abs(Number(o.text!.replace('€', '')) - answer) < 0.006, `${o.id}: ${o.text} (${answer})\n${g.stem}`).toBe(o.id === g.correctAnswer);
      }
    });
});
