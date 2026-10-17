// Independent checks for the Elasticity templates. The functions are read back from the generated stems (LaTeX →
// mathjs) and every elasticity is recomputed by central differences (not by the symbolic route the templates use);
// percentage changes are compared with the exact change; the rule statements are verified on a library of concrete
// functions. Every distractor must be numerically wrong.
import { describe, expect, it } from 'vitest';
import type { Generated } from '../types';
import { M, numDiff, numDiff2, numPartial } from '../mathx';
import { makeRng } from '../rng';
import { grabTex, texToExpr } from './_econ';
import { ruleParams, ruleStatements, TEMPLATES } from './elasticity';

const byId = (id: string) => TEMPLATES.find((t) => t.id === id)!;
const SEEDS = 300;
const gen = (id: string, seed: number, type: Generated['type'] = 'single-choice') =>
  byId(id).generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });

/** Compile a LaTeX formula (as written by the templates) into a function of a scope. */
function texFn(tex: string): (scope: Record<string, number>) => number {
  const code = M.parse(texToExpr(tex)).compile();
  return (scope) => {
    const v = code.evaluate({ ...scope });
    return typeof v === 'number' ? v : NaN;
  };
}
const strip = (t: string) => t.replace(/\$/g, '').trim();
const optionTexts = (g: Generated) => g.options!.map((o) => ({ id: o.id, tex: strip(o.text!) }));
const close = (a: number, b: number, rel = 1e-5) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

describe('texToExpr reads the templates’ LaTeX', () => {
  it('converts fractions, roots, powers, exponentials and logs', () => {
    const cases: [string, Record<string, number>, number][] = [
      ['-\\dfrac{3}{4}\\cdot\\dfrac{\\sqrt{p}}{40 - \\frac{3}{2}\\sqrt{p}}', { p: 4 }, (-0.75 * 2) / 37],
      ['5x^{4} - 2x^{4}y^{3}', { x: 2, y: 1.5 }, 80 - 2 * 16 * 3.375],
      ['\\sqrt[3]{x^{2}y}', { x: 2, y: 3 }, Math.cbrt(12)],
      ['p\\,e^{-0.5p}', { p: 2 }, 2 * Math.exp(-1)],
      ['12 + 3\\ln\\left(p\\right)', { p: Math.E }, 15],
      ['20K^{0.75}L^{0.8}', { K: 2, L: 3 }, 20 * 2 ** 0.75 * 3 ** 0.8],
      ['xy', { x: 2, y: 5 }, 10],
    ];
    for (const [tex, s, v] of cases) expect(texFn(tex)(s)).toBeCloseTo(v, 10);
  });
});

describe('elasticity.partial-power', () => {
  const read = (g: Generated) => {
    const isQ = g.stem.includes('Q(K,L)=');
    const [a, b] = isQ ? ['K', 'L'] : ['x', 'y'];
    const f = texFn(grabTex(g.stem, isQ ? 'Q(K,L)=' : 'f(x,y)=')!);
    const v = (g.stem.match(/El_\{(\w)\}/) ?? g.stem.match(/with respect to \$(\w)\$/))![1];
    const F = (x: number, y: number) => f({ [a]: x, [b]: y });
    const el = (x: number, y: number) => ((v === a ? x : y) * numPartial(F, x, y, v === a ? 'x' : 'y', 1e-6)) / F(x, y);
    const rng = makeRng(99);
    const pts: { x: number; y: number }[] = [];
    while (pts.length < 4) {
      const p = { x: 0.4 + 2 * rng.next(), y: 0.4 + 2 * rng.next() };
      if (Math.abs(F(p.x, p.y)) > 0.2) pts.push(p);
    }
    return { a, b, el, pts };
  };
  it('the key equals the numerical elasticity at several points; no distractor does', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('elasticity.partial-power', seed);
      const { a, b, el, pts } = read(g);
      for (const o of optionTexts(g)) {
        const of = texFn(o.tex);
        const matches = pts.map((p) => close(of({ [a]: p.x, [b]: p.y }), el(p.x, p.y), 1e-4));
        if (o.id === g.correctAnswer) expect(matches.every(Boolean), `seed ${seed} key ${o.tex}`).toBe(true);
        else expect(matches.every(Boolean), `seed ${seed} distractor ${o.tex} is also correct`).toBe(false);
        // exact values only: a rounded key such as 0.3333 among exact fractions would give it away
        expect(o.tex, `seed ${seed}`).not.toMatch(/\d\.\d{4}/);
      }
    }
  });
  it('numeric answers equal the (constant) numerical elasticity', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('elasticity.partial-power', seed, 'numeric');
      const { el, pts } = read(g);
      for (const p of pts) expect(Math.abs((g.correctAnswer as number) - el(p.x, p.y)), `seed ${seed}`).toBeLessThanOrEqual(g.tolerance! + 1e-6);
      // never a 1-decimal tolerance (0.06 would also accept a neighbouring exponent, e.g. 0.25 for 0.2)
      expect(g.tolerance!, `seed ${seed}`).toBeLessThan(0.01);
    }
  });
});

describe('elasticity.value-at-point', () => {
  /** Demand q(p): read d(p) from the stem, or solve the relation p = ... q ... numerically for q. */
  function demandOf(stem: string): (p: number) => number {
    const d = grabTex(stem, 'd(p)=');
    if (d) {
      const f = texFn(d);
      return (p) => f({ p });
    }
    const rel = texFn(grabTex(stem, 'p=')!);
    const P = (q: number) => rel({ q });
    return (p) => {
      // P is decreasing in q; find the bracket by doubling, treating "outside the domain" as below p
      let lo = 0;
      let hi = 1;
      while (Number.isFinite(P(hi)) && P(hi) > p) {
        lo = hi;
        hi *= 2;
      }
      for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        const v = P(mid);
        if (Number.isFinite(v) && v > p) lo = mid;
        else hi = mid;
      }
      return (lo + hi) / 2;
    };
  }
  const read = (g: Generated) => {
    const p0 = Number(g.stem.match(/from \$p=(\d+(?:\.\d+)?)\$|at \$p=(\d+(?:\.\d+)?)\$/)!.slice(1).find(Boolean));
    const q = demandOf(g.stem);
    const E = (p0 * numDiff(q, p0, 1e-5)) / q(p0);
    return { p0, E };
  };
  it('single-choice: the key matches the numerical elasticity (value or interval), no distractor does', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('elasticity.value-at-point', seed);
      const { E } = read(g);
      expect(E).toBeLessThan(0);
      expect(-E, `seed ${seed}: implausible elasticity`).toBeLessThanOrEqual(4 + 1e-6);
      for (const o of optionTexts(g)) {
        const iv = o.tex.match(/^\((\d+(?:\.\d+)?),\\ (\d+(?:\.\d+)?|\\infty)[\])]$/);
        let ok: boolean;
        if (iv) {
          const lo = Number(iv[1]);
          const hi = iv[2] === '\\infty' ? Infinity : Number(iv[2]);
          ok = -E > lo && -E <= hi;
        } else ok = Math.abs(Number(o.tex) - E) <= 0.0005 + 1e-9;
        expect(ok, `seed ${seed} option ${o.tex} (E = ${E})`).toBe(o.id === g.correctAnswer);
      }
    }
  });
  it('numeric: the answer is the elasticity rounded to 2 decimals', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('elasticity.value-at-point', seed, 'numeric');
      const { E } = read(g);
      expect(Math.abs((g.correctAnswer as number) - E), `seed ${seed}`).toBeLessThanOrEqual(0.005 + 1e-5);
      expect(-E, `seed ${seed}: implausible elasticity`).toBeLessThanOrEqual(4 + 1e-6);
      // an exact half (e.g. −0.625) may be rounded either way: both neighbours must be accepted
      const r = Math.round(E * 1000);
      if (Math.abs(E * 1000 - r) < 1e-6 && Math.abs(r % 10) === 5) {
        expect(g.acceptRange, `seed ${seed}`).toBeDefined();
        expect(g.acceptRange![0]).toBeLessThanOrEqual(E - 0.005 + 1e-9);
        expect(g.acceptRange![1]).toBeGreaterThanOrEqual(E + 0.005 - 1e-9);
      }
    }
  });
});

describe('elasticity.formula', () => {
  it('the key formula equals the numerical elasticity for several prices; no distractor does', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('elasticity.formula', seed);
      const name = g.stem.includes('supply function') ? 's(p)=' : 'd(p)=';
      const f = texFn(grabTex(g.stem, name)!);
      const F = (p: number) => f({ p });
      const ps = [0.3, 0.7, 1.2, 1.9, 3.3, 5.1, 8.2].filter((p) => Number.isFinite(F(p)) && Math.abs(F(p)) > 1e-3);
      expect(ps.length).toBeGreaterThanOrEqual(3);
      // a demand function that rises with the price is only used for status goods, and the stem says so
      if (name === 'd(p)=' && numDiff(F, 2) > 0) expect(g.stem, `seed ${seed}`).toContain('demand rises with the price');
      const el = (p: number) => (p * numDiff(F, p, 1e-6)) / F(p);
      for (const o of optionTexts(g)) {
        const of = texFn(o.tex);
        const matches = ps.map((p) => close(of({ p }), el(p), 1e-4));
        if (o.id === g.correctAnswer) expect(matches.every(Boolean), `seed ${seed} key ${o.tex}`).toBe(true);
        else expect(matches.every(Boolean), `seed ${seed} distractor ${o.tex}`).toBe(false);
      }
    }
  });
});

describe('elasticity.percent-change', () => {
  const read = (g: Generated) => {
    const fm = g.stem.match(/\$(Q|U|Y)\((\w),(\w)\)=/);
    if (fm) {
      const [, , a, b] = fm;
      const f = texFn(grabTex(g.stem, `${fm[1]}(${a},${b})=`)!);
      const v = g.stem.match(/with respect to \$(\w)\$/)![1];
      const m = g.stem.match(/(increases|decreases) by (\d+)%/)!;
      const k = (m[1] === 'increases' ? 1 : -1) * Number(m[2]);
      const base = { [a]: 2.7, [b]: 1.6 };
      const F = (t: number) => f({ ...base, [v]: t });
      const exact = (F(base[v] * (1 + k / 100)) / F(base[v]) - 1) * 100;
      const first = ((base[v] * numDiff(F, base[v])) / F(base[v])) * k;
      return { exact, first };
    }
    const d = texFn(grabTex(g.stem, 'd(p)=')!);
    const p0 = Number(g.stem.match(/current price is \$p=(\d+)\$/)![1]);
    const m = g.stem.match(/(raises|lowers) the price by (\d+)%/)!;
    const k = (m[1] === 'raises' ? 1 : -1) * Number(m[2]);
    const F = (p: number) => d({ p });
    const exact = (F(p0 * (1 + k / 100)) / F(p0) - 1) * 100;
    const first = ((p0 * numDiff(F, p0)) / F(p0)) * k;
    return { exact, first };
  };
  const value = (text: string) => {
    const m = text.match(/^an? (increase|decrease) of approximately (\d+(?:\.\d+)?)%$/)!;
    return (m[1] === 'increase' ? 1 : -1) * Number(m[2]);
  };
  it('the key is the elasticity approximation; it is closer to the exact change than every distractor', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('elasticity.percent-change', seed);
      const { exact, first } = read(g);
      expect(Math.abs(first), `seed ${seed}: implausible percentage change`).toBeLessThan(60);
      const key = value(g.options!.find((o) => o.id === g.correctAnswer)!.text!);
      expect(Math.abs(key - first), `seed ${seed}`).toBeLessThanOrEqual(0.005 + 1e-9);
      for (const o of g.options!) {
        if (o.id === g.correctAnswer) continue;
        const v = value(o.text!);
        expect(Math.abs(v - exact), `seed ${seed} distractor ${o.text} vs exact ${exact}`).toBeGreaterThan(Math.abs(key - exact) + 0.04);
      }
    }
  });
  it('numeric: the answer is the elasticity approximation', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('elasticity.percent-change', seed, 'numeric');
      const { first, exact } = read(g);
      expect(Math.abs((g.correctAnswer as number) - first), `seed ${seed}`).toBeLessThanOrEqual(0.005 + 1e-9);
      expect(Math.abs(first - exact)).toBeLessThan(0.15 * Math.abs(first) + 0.05); // a first-order approximation
    }
  });
});

// ---------- a library of concrete positive functions, for checking rules and sign statements ----------

const LIB: ((x: number) => number)[] = [
  (x) => 2 + x,
  (x) => 5 - 0.3 * x,
  (x) => Math.exp(x / 5),
  (x) => Math.exp(-x / 5),
  (x) => 1 + (x - 3) ** 2,
  (x) => 1 + (x + 3) ** 2,
  (x) => 60 + 3 * x - x * x / 10,
  (x) => 60 - 3 * x - x * x / 10,
  (x) => 5 + Math.log(11 + x),
  (x) => 5 - Math.log(11 + x),
  (x) => 3 + Math.sin(x),
  (x) => 1 / (1 + x * x),
  (x) => x * x + 1,
  (x) => 2 + 1 / (12 + x),
];
const elOf = (f: (x: number) => number, x: number) => (x * numDiff(f, x, 1e-6)) / f(x);
const grid = (neg: boolean) => Array.from({ length: 60 }, (_, i) => (neg ? -1 : 1) * (0.1 + (i * 9.9) / 59));

describe('elasticity.rules (single-choice)', () => {
  it('sign questions: the key property guarantees the sign, the other options do not (checked on a function library)', () => {
    let signSeen = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('elasticity.rules', seed);
      if (!g.stem.includes('guarantees')) continue;
      signSeen++;
      const neg = g.stem.includes('(-\\infty,0)');
      const fSign = /and is positive on that whole domain/.test(g.stem) ? 1 : -1;
      const target = /elasticity \$El_x f\(x\)\$ is positive/.test(g.stem) ? 1 : -1;
      const xs = grid(neg);
      const fs = [1, -1].flatMap((s) => LIB.map((f) => (x: number) => s * f(x))).filter((f) => xs.every((x) => Math.sign(f(x)) === fSign));
      const has = {
        increasing: (f: (x: number) => number) => xs.every((x) => numDiff(f, x) > 0),
        decreasing: (f: (x: number) => number) => xs.every((x) => numDiff(f, x) < 0),
        convex: (f: (x: number) => number) => xs.every((x) => numDiff2(f, x) > 0),
        concave: (f: (x: number) => number) => xs.every((x) => numDiff2(f, x) < 0),
      };
      const guarantees = (prop: keyof typeof has) => {
        const withProp = fs.filter(has[prop]);
        expect(withProp.length, `no ${prop} function in the library`).toBeGreaterThan(0);
        return withProp.every((f) => xs.every((x) => Math.sign(elOf(f, x)) === target));
      };
      const anyGuaranteed = (Object.keys(has) as (keyof typeof has)[]).some(guarantees);
      for (const o of g.options!) {
        const prop = (Object.keys(has) as (keyof typeof has)[]).find((p) => o.text!.includes(p));
        const correct = prop ? guarantees(prop) : !anyGuaranteed;
        expect(correct, `seed ${seed}: ${o.text}`).toBe(o.id === g.correctAnswer);
      }
    }
    expect(signSeen).toBeGreaterThan(20);
  });
  it('transformations g of f: the key matches the numerical elasticity of g for several f, no distractor does', () => {
    const fs = [(x: number) => 2 + x * x, (x: number) => Math.exp(0.3 * x), (x: number) => 5 + Math.sqrt(x), (x: number) => 1 / (1 + x)];
    const xs = [0.5, 1.3, 2.7];
    let seen = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('elasticity.rules', seed);
      if (!g.stem.includes('A second function')) continue;
      seen++;
      const gTex = grabTex(g.stem, 'g(x)=')!.replace(/f\(x\)/g, 'F');
      const G = texFn(gTex);
      for (const o of optionTexts(g)) {
        const rhs = o.tex.replace(/^E_g\(x\)=/, '').replace(/E_f\(x\)/g, 'W');
        const R = texFn(rhs);
        const matches = fs.flatMap((f) =>
          xs.map((x) => {
            const gx = (t: number) => G({ x: t, F: f(t) });
            return close(R({ x, W: elOf(f, x) }), elOf(gx, x), 1e-4);
          }),
        );
        if (o.id === g.correctAnswer) expect(matches.every(Boolean), `seed ${seed} key ${o.tex}`).toBe(true);
        else expect(matches.every(Boolean), `seed ${seed} distractor ${o.tex}`).toBe(false);
      }
    }
    expect(seen).toBeGreaterThan(50);
  });
});

describe('elasticity.rules (multi-select statements)', () => {
  const xs = [0.4, 1.1, 2.5, 4.2];
  const pairs = LIB.slice(0, 6).flatMap((f) => LIB.slice(6, 10).map((g2) => [f, g2] as const));
  const all = (fn: (x: number) => boolean) => xs.every(fn);
  /** Numerical verification of each statement in the bank: true when the claim holds on the whole test set. */
  const verify: Record<string, (p: ReturnType<typeof ruleParams>) => boolean> = {
    'scale-same': ({ c }) => LIB.every((f) => all((x) => close(elOf((t) => c * f(t), x), elOf(f, x), 1e-4))),
    'scale-times': ({ c }) => LIB.every((f) => all((x) => close(elOf((t) => c * f(t), x), c * elOf(f, x), 1e-4))),
    'power-const': ({ A, n }) => all((x) => close(elOf((t) => A * t ** n, x), n, 1e-4)),
    'power-deriv': ({ A, n }) => all((x) => close(elOf((t) => A * t ** n, x), A * n * x ** (n - 1), 1e-4)),
    product: () => pairs.every(([f, g2]) => all((x) => close(elOf((t) => f(t) * g2(t), x), elOf(f, x) + elOf(g2, x), 1e-4))),
    sum: () => pairs.every(([f, g2]) => all((x) => close(elOf((t) => f(t) + g2(t), x), elOf(f, x) + elOf(g2, x), 1e-4))),
    quotient: () => pairs.every(([f, g2]) => all((x) => close(elOf((t) => f(t) / g2(t), x), elOf(f, x) - elOf(g2, x), 1e-4))),
    'quotient-wrong': () => pairs.every(([f, g2]) => all((x) => close(elOf((t) => f(t) / g2(t), x), elOf(f, x) / elOf(g2, x), 1e-4))),
    exp: ({ k }) => all((x) => close(elOf((t) => Math.exp(k * t), x), k * x, 1e-4)),
    'exp-wrong': ({ k }) => all((x) => close(elOf((t) => Math.exp(k * t), x), k, 1e-4)),
    'linear-const': ({ a, b }) => {
      const els = [0.1, 0.3, 0.6].map((s) => elOf((p) => a - b * p, (s * a) / b));
      return els.every((e) => close(e, els[0], 1e-4));
    },
    'sign-increasing': () => {
      const g0 = grid(false);
      const fs = LIB.filter((f) => g0.every((x) => f(x) > 0 && numDiff(f, x) > 0));
      return fs.length > 0 && fs.every((f) => g0.every((x) => elOf(f, x) > 0));
    },
    'sign-convex': () => {
      const g0 = grid(false);
      const fs = LIB.filter((f) => g0.every((x) => f(x) > 0 && numDiff2(f, x) > 0));
      return fs.length > 0 && fs.every((f) => g0.every((x) => elOf(f, x) > 0));
    },
    pct: ({ e }) => {
      const drop = (1 - 1.01 ** -e) * 100; // demand p^{-e} has elasticity −e everywhere
      return Math.abs(drop - e) < 0.05 * e;
    },
    'pct-wrong': ({ e }) => {
      const drop = (1 - 1.01 ** -e) * 100;
      return Math.abs(drop - 1 / e) < 0.05 * e;
    },
    constant: ({ A }) => all((x) => close(elOf(() => A, x), 0, 1e-6)),
  };
  it('every statement in the bank is labelled as the numerical check says', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const p = ruleParams(makeRng(seed));
      for (const s of ruleStatements(p)) {
        expect(verify[s.key], `no verifier for ${s.key}`).toBeDefined();
        expect(verify[s.key](p), `seed ${seed} statement ${s.key}: ${s.text}`).toBe(s.correct);
      }
    }
  });
  it('the key is exactly the set of numerically true statements', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('elasticity.rules', seed, 'multi-select');
      const p = ruleParams(makeRng(seed));
      const bank = ruleStatements(p);
      const truth = g.options!.map((o) => {
        const s = bank.find((b) => b.text === o.text)!;
        expect(s, `seed ${seed}: unknown statement ${o.text}`).toBeDefined();
        return verify[s.key](p);
      });
      const key = g.correctAnswer as string[];
      g.options!.forEach((o, i) => expect(key.includes(o.id), `seed ${seed} ${o.text}`).toBe(truth[i]));
    }
  });
});

describe('elasticity.solve-for', () => {
  /** Elasticity function of the stem's family, as a function of the answer value z (base b, price p or level x). */
  function elasticityOfAnswer(stem: string): { target: number; el: (z: number) => number; lo: number; hi: number } {
    const tm = stem.match(/equal to \$(-?\d+(?:\.\d+)?|-?\\frac\{\d+\}\{\d+\})\$/);
    const target = stem.includes('unit elastic') ? -1 : texFn(tm![1])({});
    if (stem.includes('g(t)=b^{t}')) {
      const t0 = Number(stem.match(/at \$t=(\d+)\$/)![1]);
      return { target, el: (b) => elOf((t) => b ** t, t0), lo: 0.01, hi: 500 };
    }
    if (stem.includes('d(p)=')) {
      const f = texFn(grabTex(stem, 'd(p)=')!);
      return { target, el: (p) => elOf((q) => f({ p: q }), p), lo: 0.001, hi: 2000 };
    }
    const f = texFn(grabTex(stem, 'f(x)=')!);
    return { target, el: (x) => elOf((q) => f({ x: q }), x), lo: 0.001, hi: 500 };
  }
  const val = (t: string) => texFn(strip(t).replace(/^[bpx]=/, ''))({});
  it('single-choice: the elasticity at the key equals the target; at every distractor it does not', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('elasticity.solve-for', seed);
      const { target, el } = elasticityOfAnswer(g.stem);
      for (const o of g.options!) {
        const e = el(val(o.text!));
        const ok = Math.abs(e - target) <= 0.01 * Math.max(1, Math.abs(target));
        expect(ok, `seed ${seed} option ${o.text}: El = ${e}, target ${target}`).toBe(o.id === g.correctAnswer);
      }
    }
  });
  it('numeric: the answer is the root of El(z) = target found by bisection', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('elasticity.solve-for', seed, 'numeric');
      const { target, el, lo, hi } = elasticityOfAnswer(g.stem);
      // scan for the sign change of El(z) − target and bisect
      const h = (z: number) => el(z) - target;
      let a = lo;
      let fa = h(a);
      let root = NaN;
      const n = 20000;
      for (let i = 1; i <= n; i++) {
        const b = lo * (hi / lo) ** (i / n);
        const fb = h(b);
        if (Number.isFinite(fa) && Number.isFinite(fb) && fa * fb <= 0) {
          let [l, r] = [a, b];
          for (let j = 0; j < 100; j++) {
            const m = (l + r) / 2;
            if (h(l) * h(m) <= 0) r = m;
            else l = m;
          }
          root = (l + r) / 2;
          break;
        }
        a = b;
        fa = fb;
      }
      expect(Math.abs((g.correctAnswer as number) - root), `seed ${seed}: ${g.stem}`).toBeLessThanOrEqual((g.tolerance ?? 0) + 1e-4);
    }
  });
});
