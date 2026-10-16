// Independent checks for the "Economic applications" templates. The functions are read back from the printed stems
// (plain JavaScript evaluation of the LaTeX, no mathjs) and the numbers from the printed tables; the answer is then
// recomputed numerically, without the template's formulas: equilibria and demand levels by scanning for sign changes
// plus bisection, revenue/profit optima by a dense grid search refined with golden-section search, the optimal order
// size by brute force over every integer order size, and the cheapest fence by minimising the cost over the width.
// The key must match the recomputed answer and no distractor may (equilibrium distractors must not solve d = s either).
import { describe, expect, it } from 'vitest';
import { makeRng } from '../rng';
import type { GenType, Generated } from '../types';
import { bisect, displayMath, numberIn, rhs, texFn1 } from './_fnderiv-check';
import { TEMPLATES } from './economic-applications';

const SEEDS = 300;
const TYPES: GenType[] = ['single-choice', 'numeric'];
const gen = (id: string, seed: number, type: GenType) =>
  TEMPLATES.find((t) => t.id === `economic-applications.${id}`)!.generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });

/** The printed display formula "lhs=..." as a function of v (null when the stem has none). */
function formula(stem: string, lhs: string, v: string) {
  const t = displayMath(stem).find((s) => s.trim().startsWith(lhs));
  return t ? texFn1(rhs(t), v) : null;
}

/** All roots of h on (0, hi]: geometric grid scan for sign changes plus bisection. */
function positiveRoots(h: (x: number) => number, hi = 1e5): number[] {
  const out: number[] = [];
  const n = 20000;
  let x0 = 1e-6;
  let h0 = h(x0);
  for (let i = 1; i <= n; i++) {
    const x1 = 1e-6 * (hi / 1e-6) ** (i / n);
    const h1 = h(x1);
    if (Number.isFinite(h0) && Number.isFinite(h1) && h0 * h1 <= 0) {
      const r = bisect(h, x0, x1);
      if (!out.some((o) => Math.abs(o - r) < 1e-6 * (1 + r))) out.push(r);
    }
    x0 = x1;
    h0 = h1;
  }
  return out;
}

/** Maximiser of f on [lo, hi]: grid search, then golden-section refinement around the best grid point. */
function argmax(f: (x: number) => number, lo: number, hi: number): number {
  const n = 20000;
  let best = lo;
  let bv = -Infinity;
  for (let i = 0; i <= n; i++) {
    const x = lo + ((hi - lo) * i) / n;
    const v = f(x);
    if (v > bv) {
      bv = v;
      best = x;
    }
  }
  let a = Math.max(lo, best - (hi - lo) / n);
  let b = Math.min(hi, best + (hi - lo) / n);
  const g = (Math.sqrt(5) - 1) / 2;
  for (let k = 0; k < 200; k++) {
    const c = b - g * (b - a);
    const d = a + g * (b - a);
    if (f(c) > f(d)) b = d;
    else a = c;
  }
  return (a + b) / 2;
}

/** (lo, hi] of an interval option such as "between €2000 and €5000". */
function interval(text: string): [number, number] {
  const ns = [...text.matchAll(/€(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  if (text.startsWith('below')) return [-Infinity, ns[0]];
  if (text.startsWith('above')) return [ns[0], Infinity];
  return [ns[0], ns[1]];
}

/** The option matches the answer: the printed value (rounded to 2 decimals) or the interval that contains it. */
function matches(text: string, answer: number): boolean {
  if (/^(below|between|above) /.test(text)) {
    const [lo, hi] = interval(text);
    return answer > lo && answer <= hi;
  }
  return Math.abs(numberIn(text) - answer) <= 0.0051;
}

function checkChoice(g: Generated, answer: number) {
  for (const o of g.options!) expect(matches(o.text!, answer), `${o.id}: ${o.text} (answer ${answer})\n${g.stem}`).toBe(o.id === g.correctAnswer);
}

function checkNumeric(g: Generated, answer: number) {
  expect(Math.abs((g.correctAnswer as number) - answer), g.stem).toBeLessThanOrEqual(g.tolerance! + 1e-9);
}

const check = (g: Generated, answer: number) => (g.type === 'numeric' ? checkNumeric(g, answer) : checkChoice(g, answer));

describe('economic-applications.equilibrium: unique positive root of d − s (or d − level) from the printed functions', () => {
  for (const type of TYPES)
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('equilibrium', seed, type);
        const d = formula(g.stem, 'd(p)=', 'p')!;
        const s = formula(g.stem, 's(p)=', 'p');
        const level = /equal to \$(\d+)\$/.exec(g.stem);
        expect(!!s !== !!level, g.stem).toBe(true);
        const h = s ? (p: number) => d(p) - s(p) : (p: number) => d(p) - Number(level![1]);
        const rs = positiveRoots(h);
        expect(rs.length, g.stem).toBe(1);
        check(g, rs[0]);
        if (type === 'single-choice')
          for (const o of g.options!) if (o.id !== g.correctAnswer) expect(Math.abs(h(numberIn(o.text!))), o.text).toBeGreaterThan(1e-6);
      }
    });
});

describe('economic-applications.optimum: maximiser of p·d(p) or Q·P(Q) − C(Q) by grid + golden-section search', () => {
  for (const type of TYPES)
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('optimum', seed, type);
        const d = formula(g.stem, 'd(p)=', 'p');
        let answer: number;
        if (d) {
          const pStar = argmax((p) => p * d(p), 0, positiveRoots(d)[0]);
          answer = /maximal weekly revenue/.test(g.stem) ? pStar * d(pStar) : pStar;
          if (!/maximal weekly revenue/.test(g.stem)) expect(g.stem).toMatch(/price \$p\$ is the weekly revenue maximal/);
        } else {
          const P = formula(g.stem, 'P(Q)=', 'Q')!;
          const C = formula(g.stem, 'C(Q)=', 'Q')!;
          const Q = argmax((q) => q * P(q) - C(q), 0, positiveRoots(P)[0]);
          if (/maximal weekly profit/.test(g.stem)) answer = Q * P(Q) - C(Q);
          else if (/price \$P\$/.test(g.stem)) answer = P(Q);
          else {
            expect(g.stem).toMatch(/production level \$Q\$/);
            answer = Q;
          }
        }
        check(g, answer);
      }
    });
});

describe('economic-applications.inventory: brute force over all integer order sizes, costs recomputed from the table', () => {
  for (const type of TYPES)
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('inventory', seed, type);
        const get = (label: string) => numberIn(g.table!.rows.find((r) => r[0].startsWith(label))![1]);
        const D = get('Sales per year');
        const K = get('Cost per order');
        const v = get('Value of one unit');
        const r = get('Holding cost') / 100;
        const C = (x: number) => (K * D) / x + (r * v * x) / 2;
        const given = /orders \$x=(\d+)\$/.exec(g.stem);
        if (given) {
          const x = Number(given[1]);
          const o = (K * D) / x;
          const hc = (r * v * x) / 2;
          if (type === 'numeric') {
            const f = Object.fromEntries(g.fields!.map((ff) => [ff.id, ff]));
            expect(Math.abs(f.order.answer - o)).toBeLessThanOrEqual(f.order.tolerance! + 1e-9);
            expect(Math.abs(f.hold.answer - hc)).toBeLessThanOrEqual(f.hold.tolerance! + 1e-9);
          } else
            for (const opt of g.options!) {
              const [a, b] = [...opt.text!.matchAll(/€(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
              expect(Math.abs(a - o) < 0.006 && Math.abs(b - hc) < 0.006, `${opt.text}\n${g.stem}`).toBe(opt.id === g.correctAnswer);
            }
          continue;
        }
        let xOpt = 1;
        for (let x = 2; x <= D; x++) if (C(x) < C(xOpt)) xOpt = x;
        if (/order size \$x\$ keeps/.test(g.stem)) {
          check(g, xOpt);
          if (type === 'single-choice') for (const o of g.options!) if (o.id !== g.correctAnswer) expect(C(numberIn(o.text!))).toBeGreaterThan(C(xOpt) + 1e-9);
        } else {
          expect(g.stem).toMatch(/lowest possible total yearly costs/);
          check(g, C(xOpt));
        }
      }
    });
});

describe('economic-applications.fence: minimise α·A/B + β·B numerically with prices read from the table', () => {
  for (const type of TYPES)
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('fence', seed, type);
        const price = (t: string) => (/no fence/.test(t) ? 0 : numberIn(t));
        const rows = g.table!.rows;
        const alpha = rows.filter((r) => /length/.test(r[0])).reduce((s, r) => s + price(r[1]), 0);
        const beta = rows.filter((r) => /width/.test(r[0])).reduce((s, r) => s + price(r[1]), 0);
        const A = Number(/area of \$(\d+)\$/.exec(g.stem)![1]);
        const cost = (b: number) => (alpha * A) / b + beta * b;
        const B = argmax((b) => -cost(b), 0.1, A);
        const L = A / B;
        let answer: number;
        if (/ratio \$L\/B\$/.test(g.stem)) answer = L / B;
        else if (/width \$B\$/.test(g.stem)) answer = B;
        else if (/length \$L\$ \(in metres\)/.test(g.stem)) answer = L;
        else {
          expect(g.stem).toMatch(/lowest possible fencing costs/);
          answer = cost(B);
        }
        check(g, answer);
        // the sketch shows the same prices as the table
        const svg = decodeURIComponent(g.images![0].src);
        for (const r of rows.slice(1)) expect(svg).toContain(`€${price(r[1])}/m`);
      }
    });
});
