// Independent checks for the "Inverse functions" templates. The function is read back from the printed stem and every
// option from its printed LaTeX (plain JavaScript evaluation, no mathjs). The key must undo the function,
// f⁻¹(f(x)) = x, at sample points of the stated domain; every distractor must fail somewhere. Numeric answers are
// recomputed by solving f(x) = y0 with bisection on the printed function.
import { describe, expect, it } from 'vitest';
import { makeRng } from '../rng';
import type { GenType, Generated } from '../types';
import { bisect, displayMath, inlineMath, optionTex, rhs, texFn, texFn1 } from './_fnderiv-check';
import { TEMPLATES } from './inverse-functions';

const SEEDS = 300;
const byId = (id: string) => TEMPLATES.find((t) => t.id === id)!;
const gen = (id: string, seed: number, type: GenType = 'single-choice') => byId(id).generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });

/** The printed function and sample points of its (restricted) domain. */
function readFunction(g: Generated, v: 'x' | 'p') {
  const f = texFn1(rhs(displayMath(g.stem)[0]), v);
  const restr = /\$x>(-?\d+)\$/.exec(g.stem);
  const xs =
    v === 'p'
      ? [0.5, 2, 6, 11, 19]
      : restr
        ? [0.15, 0.5, 1, 2, 3.5, 6, 11].map((t) => Number(restr[1]) + t)
        : [-3.7, -1.2, 0.35, 1.8, 4.4].filter((x) => Number.isFinite(f(x)) && Math.abs(f(x)) < 1e6);
  return { f, xs };
}

function checkInverseQuestion(g: Generated, v: 'x' | 'p') {
  const { f, xs } = readFunction(g, v);
  const w = v === 'x' ? 'y' : 'q';
  expect(xs.length).toBeGreaterThanOrEqual(3);
  const undoes = (text: string) => {
    const inv = texFn1(rhs(optionTex(text)), w);
    return xs.every((x) => Math.abs(inv(f(x)) - x) < 1e-6 * (1 + Math.abs(x)));
  };
  for (const o of g.options!) {
    expect(undoes(o.text!), `${o.id} ${o.text} for ${g.stem}`).toBe(o.id === g.correctAnswer);
    // a factor in front of a fraction gets a \cdot: "2\dfrac{a}{5}" reads as the mixed number 2 + a/5
    expect(o.text, 'number directly before a fraction').not.toMatch(/[0-9]\\d?frac/);
    expect(o.text, 'division by 1').not.toMatch(/\}\{1\}/);
  }
}

/** All solutions of f(x) = y0 on [lo, hi] found by a scan for sign changes plus bisection (poles are rejected). */
function solve(f: (x: number) => number, y0: number, lo: number, hi: number, n = 4000): number[] {
  const h = (x: number) => f(x) - y0;
  const out: number[] = [];
  let x0 = lo;
  let h0 = h(x0);
  for (let i = 1; i <= n; i++) {
    const x1 = lo + ((hi - lo) * i) / n;
    const h1 = h(x1);
    if (Number.isFinite(h0) && Number.isFinite(h1) && h0 * h1 <= 0) {
      const r = bisect(h, x0, x1);
      if (Math.abs(h(r)) < 1e-6 && !out.some((o) => Math.abs(o - r) < 1e-7)) out.push(r);
    }
    x0 = x1;
    h0 = h1;
  }
  return out;
}

function checkNumeric(g: Generated, y0: number, lo: number, hi: number, v: 'x' | 'p' = 'x') {
  const { f } = readFunction(g, v);
  const ans = g.correctAnswer as number;
  const tol = g.tolerance! + 1e-9;
  // 1. a true solution lies within the tolerance of the answer (f continuous there, f − y0 changes sign)
  const near = solve(f, y0, ans - tol, ans + tol, 200);
  expect(near.length, `no solution of f = ${y0} within ${tol} of ${ans}: ${g.stem}`).toBe(1);
  // 2. and there is no other solution elsewhere
  const far = solve(f, y0, lo, hi).filter((r) => Math.abs(r - near[0]) > 0.05);
  expect(far, g.stem).toEqual([]);
}

/** The argument of the printed f^{-1}(...) in a stem. */
function inverseArg(stem: string): number {
  const m = /\^\{-1\}(?:\\left)?\((.+?)(?:\\right)?\)\$/.exec(stem)!;
  return texFn(m[1])({});
}

const SINGLE: [string, 'x' | 'p'][] = [
  ['inverse-functions.linear-fractional', 'x'],
  ['inverse-functions.exp-log', 'x'],
  ['inverse-functions.root-rational', 'x'],
  ['inverse-functions.logistic', 'x'],
  ['inverse-functions.inverse-demand', 'p'],
];

describe('inverse functions: the key undoes the printed function, no distractor does', () => {
  for (const [id, v] of SINGLE) {
    it(id, () => {
      for (let seed = 1; seed <= SEEDS; seed++) checkInverseQuestion(gen(id, seed), v);
    });
  }
});

describe('inverse functions: numeric answers solve f(x) = y0 for the printed function', () => {
  it('inverse-functions.linear-fractional', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('inverse-functions.linear-fractional', seed, 'numeric');
      checkNumeric(g, inverseArg(g.stem), -70, 70);
    }
  });
  it('inverse-functions.exp-log', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('inverse-functions.exp-log', seed, 'numeric');
      const restr = /\$x>(-?\d+)\$/.exec(g.stem);
      checkNumeric(g, inverseArg(g.stem), restr ? Number(restr[1]) + 1e-9 : -20, 60);
    }
  });
  it('inverse-functions.logistic', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('inverse-functions.logistic', seed, 'numeric');
      checkNumeric(g, inverseArg(g.stem), -20, 40);
    }
  });
  it('inverse-functions.inverse-demand', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('inverse-functions.inverse-demand', seed, 'numeric');
      const maths = inlineMath(g.stem);
      checkNumeric(g, texFn(maths[maths.length - 1])({}), 1e-9, 200, 'p');
      // a realistic price for everyday goods
      expect(g.correctAnswer as number, g.stem).toBeGreaterThan(0);
      expect(g.correctAnswer as number, g.stem).toBeLessThanOrEqual(40);
    }
  });
});
