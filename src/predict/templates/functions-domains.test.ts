// Independent checks for the "Functions & domains" templates. The function is read back from the printed stem and
// evaluated with plain JavaScript (strict real semantics: √ of a negative, ln of a non-positive number and division by
// zero are undefined); every option is read back as a set or a condition. The key must agree with "where the printed
// function is defined" at every probe point (end points included), and every distractor must disagree somewhere.
import { describe, expect, it } from 'vitest';
import { makeRng } from '../rng';
import type { GenType, Generated } from '../types';
import { bisect, conditions, defined, displayMath, inIvs, optionTex, parseSet, rhs, texFn, texFn1, type Iv } from './_fnderiv-check';
import { TEMPLATES } from './functions-domains';

const SEEDS = 300;
const byId = (id: string) => TEMPLATES.find((t) => t.id === id)!;
const gen = (id: string, seed: number, type: GenType = 'single-choice') => byId(id).generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });
const stemFn = (g: Generated) => texFn1(rhs(displayMath(g.stem)[0]));

/** Probe points: a grid, plus points just left/right of (and at) every end point of every option. */
function probes(g: Generated, lo: number, hi: number, step: number): number[] {
  const pts: number[] = [];
  for (let x = lo; x <= hi + 1e-9; x += step) pts.push(Math.round(x * 1000) / 1000);
  for (const o of g.options!) {
    for (const i of parseSet(optionTex(o.text!))) {
      for (const e of [i.lo, i.hi]) {
        if (!Number.isFinite(e)) continue;
        const d = 1e-4 * Math.max(1, Math.abs(e));
        pts.push(e, e - d, e + d);
      }
    }
  }
  return pts;
}

function checkSetQuestion(g: Generated, pts: number[]) {
  const f = stemFn(g);
  const def = (x: number) => defined(f(x));
  const sets: Record<string, Iv[]> = Object.fromEntries(g.options!.map((o) => [o.id, parseSet(optionTex(o.text!))]));
  const usable = pts;
  const keySet = sets[g.correctAnswer as string];
  for (const x of usable) expect(inIvs(keySet, x), `key at x=${x}: ${g.stem}`).toBe(def(x));
  for (const o of g.options!) {
    if (o.id === g.correctAnswer) continue;
    expect(usable.some((x) => inIvs(sets[o.id], x) !== def(x)), `distractor ${o.text} is also correct for ${g.stem}`).toBe(true);
  }
}

describe('functions-domains.quadratic-inside', () => {
  it('single-choice: the key is exactly where the printed function is defined; no distractor is', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('functions-domains.quadratic-inside', seed);
      checkSetQuestion(g, probes(g, -15, 15, 0.25));
    }
  });
  it('multi-select: an option is correct exactly when the function is defined at that x', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('functions-domains.quadratic-inside', seed, 'multi-select');
      const f = stemFn(g);
      const key = g.correctAnswer as string[];
      for (const o of g.options!) {
        const x = texFn(rhs(optionTex(o.text!)))({});
        expect(key.includes(o.id), `x=${x} in ${g.stem}`).toBe(defined(f(x)));
      }
    }
  });
});

describe('functions-domains.excluded-point', () => {
  it('single-choice: the key matches where the printed function is defined (grid + around every end point)', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('functions-domains.excluded-point', seed);
      checkSetQuestion(g, probes(g, -12, 40, 0.05));
    }
  });
  it('numeric: the answer is the single pole of the printed function, found by bisection', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('functions-domains.excluded-point', seed, 'numeric');
      const f = stemFn(g);
      const poles: number[] = [];
      let x0 = -12;
      let f0 = f(x0);
      for (let x = -12 + 0.002; x <= 40; x += 0.002) {
        const f1 = f(x);
        if (Number.isFinite(f0) && Number.isFinite(f1) && Math.sign(f0) !== Math.sign(f1)) {
          const r = bisect(f, x0, x);
          if (Math.abs(f(r)) > 1e5) poles.push(r);
        }
        x0 = x;
        f0 = f1;
      }
      expect(poles.length, `poles of ${g.stem}`).toBe(1);
      expect(Math.abs(poles[0] - (g.correctAnswer as number))).toBeLessThanOrEqual(g.tolerance!);
      // the worked solution ends with the same rounded value as the key (no double rounding such as 3.6945 → 3.695)
      expect(g.explanation).toContain(`x_0\\approx ${g.correctAnswer}$`);
    }
  });
});

describe('functions-domains.root-of-quotient', () => {
  it('the key matches the sign chart of the printed function at every half-integer; no distractor does', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('functions-domains.root-of-quotient', seed);
      checkSetQuestion(g, probes(g, -12, 12, 0.25));
    }
  });
});

describe('functions-domains.two-variables', () => {
  it('the key condition holds exactly where the printed f(x, y) is defined (grid through every boundary)', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('functions-domains.two-variables', seed);
      const f = texFn(rhs(displayMath(g.stem)[0]));
      const pts: [number, number][] = [];
      for (let x = -4; x <= 4; x += 0.5) for (let y = -30; y <= 60; y += 0.5) pts.push([x, y]);
      const def = ([x, y]: [number, number]) => defined(f({ x, y }));
      const conds = Object.fromEntries(g.options!.map((o) => [o.id, conditions(o.text!)]));
      for (const p of pts) expect(conds[g.correctAnswer as string]({ x: p[0], y: p[1] }), `key at ${p}: ${g.stem}`).toBe(def(p));
      for (const o of g.options!) {
        if (o.id === g.correctAnswer) continue;
        expect(pts.some((p) => conds[o.id]({ x: p[0], y: p[1] }) !== def(p)), `distractor ${o.text} is also correct for ${g.stem}`).toBe(true);
      }
    }
  });
});
