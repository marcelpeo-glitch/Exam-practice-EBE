// Independent checks for the Derivatives templates: the key is recomputed numerically (central differences),
// not with the same symbolic route the template uses.
import { describe, expect, it } from 'vitest';
import { numDiff } from '../mathx';
import { makeRng } from '../rng';
import { TEMPLATES } from './derivatives';

const byId = (id: string) => TEMPLATES.find((t) => t.id === id)!;

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
  it('numeric version has the same key', () => {
    const g = t.generate({ rng: makeRng(7), type: 'numeric', optionCount: 5 });
    const m = g.stem.match(/\\left\((-?\d+)x ([+-]) (\d+)\\right\)e\^\{(-?\d+)x\}/)!;
    const [a, b, c] = [Number(m[1]), Number(m[2] + m[3]), Number(m[4])];
    expect(g.correctAnswer).toBeCloseTo(a + b * c, 9);
  });
});
