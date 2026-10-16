// Independent checks for the "Errors & power" templates. Nothing is taken from the generator's formulas:
// - error-identification questions: every option is decoded back into (decision, reality) from the scenario's
//   phrases, classified with the definitions (Type I = reject a true H0, Type II = keep a false H0, power = reject a
//   false H0), and must be right exactly when it is the key; "which error is possible" re-decides from the printed
//   P-value and α;
// - power statements / I-II-III / α–n combinations: the numbers are read back from the printed stem and options and
//   the power is recomputed with a Simpson-integrated Normal CDF and a bisection inverse (_normal-check), for the
//   combinations at several values of σ;
// - computed power: cut-off and power recomputed from the printed numbers (Table Z as printed, z* rounded from the
//   exact quantile), checked against a Monte Carlo simulation of samples with a seeded rng, and no distractor may be
//   within reach of the exact value.
import { describe, expect, it } from 'vitest';
import { makeRng } from '../rng';
import type { GenType, Generated } from '../types';
import { Phi, PhiInv, rnd, tableZ } from './_normal-check';
import { ERROR_SCENARIOS, TEMPLATES } from './errors-power';

const SEEDS = 250;
const gen = (id: string, seed: number, type: GenType) => TEMPLATES.find((t) => t.id === `errors-power.${id}`)!.generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });
const num = (s: string, re: RegExp) => {
  const m = re.exec(s);
  if (!m) throw new Error(`no match for ${re} in\n${s}`);
  return Number(m[1]);
};

// ---------- 1. identify-error ----------

type Kind = 'I' | 'II' | 'power' | 'ok';
const classify = (reject: boolean, h0True: boolean): Kind => (reject ? (h0True ? 'I' : 'power') : h0True ? 'ok' : 'II');

describe('errors-power.identify-error: options decoded and classified with the definitions', () => {
  it('single-choice', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('identify-error', seed, 'single-choice');
      const s = ERROR_SCENARIOS.find((x) => g.stem.startsWith(x.intro))!;
      expect(s, g.stem).toBeTruthy();
      const decide = (claim: string) => (claim === s.yes ? true : claim === s.no ? false : null);
      const truthShort = (t: string) => (t === s.noShort ? true : t === s.yesShort ? false : null);
      const truthLong = (t: string) => (t === s.no ? true : t === s.yes ? false : null);
      let correct: (text: string) => boolean;
      const possible = /Which error could have been made/.test(g.stem);
      if (possible) {
        const a = num(g.stem, /\$\\alpha=([\d.]+)\$/);
        const p = num(g.stem, /P-value of ([\d.]+)/);
        expect(Math.abs(p - a)).toBeGreaterThan(1e-9);
        const rejected = p < a;
        expect(g.stem).toContain(rejected ? s.actYes.slice(4) : s.actNo.slice(4));
        correct = (t) => {
          const m = /^A Type (I|II) error: concluding that (.+), when in fact (.+)\.$/.exec(t);
          if (!m) return false;
          const d = decide(m[2]);
          const h = truthShort(m[3]);
          expect(d !== null && h !== null, t).toBe(true);
          return classify(d!, h!) === m[1] && d === rejected;
        };
      } else {
        const m = /(?:describes a Type (I|II) error|consequence of a Type (I|II) error|(power) of the test)/.exec(g.stem)!;
        const target = (m[1] ?? m[2] ?? m[3]) as Kind;
        const conseq = !!m[2];
        correct = (t) => {
          if (conseq) {
            const c = /^(.+); in reality, (.+)\.$/.exec(t);
            if (!c) return false;
            const d = c[1] === s.actYes ? true : c[1] === s.actNo ? false : null;
            const h = truthLong(c[2]);
            expect(d !== null && h !== null, t).toBe(true);
            return classify(d!, h!) === target;
          }
          const c = /^Concluding that (.+), when in fact (.+)\.$/.exec(t);
          if (!c) return false;
          const d = decide(c[1]);
          const h = truthShort(c[2]);
          expect(d !== null && h !== null, t).toBe(true);
          return classify(d!, h!) === target;
        };
      }
      const right = g.options!.filter((o) => correct(o.text!)).map((o) => o.id);
      expect(right, `seed ${seed}\n${g.stem}\n${g.options!.map((o) => o.text).join('\n')}`).toEqual([g.correctAnswer]);
      expect(g.explanation).toContain('Where the other options come from');
    }
  });
});

// ---------- power by an independent route ----------

interface Setup {
  mu0: number;
  up: boolean;
  a: number;
  n: number;
  s: number;
  m: number;
  two: boolean;
}
const zCache = new Map<number, number>();
const zq = (q: number) => {
  if (!zCache.has(q)) zCache.set(q, PhiInv(q));
  return zCache.get(q)!;
};
/** P(reject H0 | true mean mu) of the z-test, via the rejection region for ȳ. */
function rejectProb(x: Setup, mu: number): number {
  const se = x.s / Math.sqrt(x.n);
  const above = (c: number) => 1 - Phi((c - mu) / se);
  const below = (c: number) => Phi((c - mu) / se);
  if (x.two) {
    const z = zq(1 - x.a / 2);
    return above(x.mu0 + z * se) + below(x.mu0 - z * se);
  }
  const z = zq(1 - x.a);
  return x.up ? above(x.mu0 + z * se) : below(x.mu0 - z * se);
}
const powerOf = (x: Setup) => rejectProb(x, x.m);

function readSetup(stem: string): Setup {
  const line = stem.split('\n')[0];
  return {
    mu0: num(line, /H_0:\\mu=([\d.]+)\$/),
    up: /H_A:\\mu>/.test(line),
    a: num(line, /\$\\alpha=([\d.]+)\$/),
    n: num(line, /\$n=(\d+)\$/),
    s: num(line, /\$\\sigma=([\d.]+)\$/),
    m: num(line, /in reality \$\\mu=([\d.]+)\$/),
    two: false,
  };
}
/** The setup after the single change described in a statement. */
function applyChange(x: Setup, text: string): Setup {
  if (/\\neq/.test(text)) return { ...x, two: true };
  const m = /\$(n|\\alpha|\\mu|\\sigma)=([\d.]+)\$/.exec(text);
  if (!m) throw new Error(`unknown change: ${text}`);
  const v = Number(m[2]);
  const key = ({ n: 'n', '\\alpha': 'a', '\\mu': 'm', '\\sigma': 's' } as const)[m[1] as 'n'];
  expect(v).not.toBe(x[key]);
  return { ...x, [key]: v };
}

describe('errors-power.power-changes: changes judged by recomputing power from the printed numbers', () => {
  it('multi-select and single-choice statements', () => {
    for (const type of ['multi-select', 'single-choice'] as const) {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('power-changes', seed, type);
        if (!/Which (ONE )?of the following changes would/.test(g.stem)) continue;
        const x = readSetup(g.stem);
        const p0 = powerOf(x);
        expect(p0).toBeGreaterThan(0.25);
        expect(p0).toBeLessThan(0.9);
        const ask = /would (increase|decrease) the (power|probability of a Type II error|probability of a Type I error)/.exec(g.stem)!;
        const metric = (y: Setup) => (ask[2] === 'power' ? powerOf(y) : ask[2].includes('Type II') ? 1 - powerOf(y) : rejectProb(y, y.mu0));
        const sign = ask[1] === 'increase' ? 1 : -1;
        const truth = g.options!.map((o) => {
          const d = sign * (metric(applyChange(x, o.text!)) - metric(x));
          expect(Math.abs(d) < 1e-7 || Math.abs(d) > 0.005, `${o.text}: change ${d} too small to judge`).toBe(true);
          return d > 1e-7;
        });
        const right = g.options!.filter((_, i) => truth[i]).map((o) => o.id);
        if (type === 'multi-select') expect(right, g.stem).toEqual(g.correctAnswer);
        else expect(right, g.stem).toEqual([g.correctAnswer]);
      }
    }
  });

  it('single-choice I/II/III and α–n combinations', () => {
    let roman = 0;
    let combos = 0;
    for (let seed = 1; seed <= 2 * SEEDS; seed++) {
      const g = gen('power-changes', seed, 'single-choice');
      const keyText = g.options!.find((o) => o.id === g.correctAnswer)!.text!;
      if (/One thing is changed/.test(g.stem)) {
        roman++;
        const x = readSetup(g.stem);
        const y = applyChange(x, /One thing is changed: (.+)/.exec(g.stem)![1]);
        const before = [rejectProb(x, x.mu0), 1 - powerOf(x), powerOf(x)];
        const after = [rejectProb(y, y.mu0), 1 - powerOf(y), powerOf(y)];
        const inc = ['I', 'II', 'III'].filter((_, i) => after[i] - before[i] > 1e-7);
        const expected = inc.length === 0 ? 'None of them' : inc.length === 1 ? `${inc[0]} only` : inc.length === 2 ? `${inc[0]} and ${inc[1]}` : 'I, II and III';
        expect(keyText, g.stem).toBe(expected);
        expect(new Set(g.options!.map((o) => o.text)).size).toBe(g.options!.length);
      } else if (/Which choice of significance level and sample size/.test(g.stem)) {
        combos++;
        const mu0 = num(g.stem, /H_0:\\mu=([\d.]+)\$/);
        const m = num(g.stem, /in reality \$\\mu=([\d.]+)\$/);
        const up = /H_A:\\mu>/.test(g.stem);
        expect(up ? m > mu0 : m < mu0).toBe(true);
        const wantMax = /greatest power|smallest probability of a Type II/.test(g.stem);
        const combosIn = g.options!
          .map((o) => ({ id: o.id, c: /\$\\alpha=([\d.]+)\$ and \$n=(\d+)\$/.exec(o.text!) }))
          .filter((o) => o.c)
          .map((o) => ({ id: o.id, a: Number(o.c![1]), n: Number(o.c![2]) }));
        expect(combosIn.map((c) => c.id)).toContain(g.correctAnswer);
        const nMax = Math.max(...combosIn.map((c) => c.n));
        for (const s of [0.5, 1.5, 3].map((d) => (Math.abs(m - mu0) * Math.sqrt(nMax)) / d)) {
          const pw = combosIn.map((c) => ({ id: c.id, p: powerOf({ mu0, up, a: c.a, n: c.n, s, m, two: false }) }));
          const best = pw.reduce((b, c) => ((wantMax ? c.p > b.p : c.p < b.p) ? c : b));
          expect(best.id, `σ=${s}\n${g.stem}`).toBe(g.correctAnswer);
        }
      } else continue;
    }
    expect(roman).toBeGreaterThan(30);
    expect(combos).toBeGreaterThan(30);
  });
});

// ---------- 3. compute-power ----------

function normalDraw(rng: ReturnType<typeof makeRng>) {
  const u = 1 - rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

describe('errors-power.compute-power: recomputed from the printed numbers, Table Z and a simulation', () => {
  for (const type of ['numeric', 'single-choice'] as const) {
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('compute-power', seed, type);
        const x = readSetup(g.stem.replace('\n', ' '));
        const se = x.s / Math.sqrt(x.n);
        const zt = rnd(PhiInv(1 - x.a), 3); // the ∞ row of Table T
        expect([1.282, 1.645, 2.326]).toContain(zt);
        const cut = x.up ? x.mu0 + zt * se : x.mu0 - zt * se;
        const zb = rnd((cut - x.m) / se, 2);
        const table = x.up ? rnd(1 - tableZ(zb), 4) : tableZ(zb);
        const exact = powerOf(x);
        const askBeta = /probability of a Type II error/.test(g.stem);
        const want = (p: number) => (askBeta ? 1 - p : p);
        expect(exact).toBeGreaterThan(0.29);
        expect(exact).toBeLessThan(0.96);
        if (seed <= 25) {
          // simulate samples of n observations from N(m, σ) and count rejections with the printed cut-off rule
          const r = makeRng(1000 + seed);
          const R = 3000;
          let hits = 0;
          for (let i = 0; i < R; i++) {
            let sum = 0;
            for (let j = 0; j < x.n; j++) sum += x.m + x.s * normalDraw(r);
            const ybar = sum / x.n;
            if (x.up ? ybar > cut : ybar < cut) hits++;
          }
          expect(Math.abs(hits / R - exact), `simulated ${hits / R} vs ${exact}`).toBeLessThan(4 * Math.sqrt((exact * (1 - exact)) / R) + 0.005);
        }
        if (type === 'numeric') {
          const [fc, fp] = g.fields!;
          const inField = (f: NonNullable<Generated['fields']>[number], v: number) =>
            Math.abs(v - f.answer) <= f.tolerance! + 1e-9 || (!!f.acceptRange && v >= f.acceptRange[0] - 1e-9 && v <= f.acceptRange[1] + 1e-9);
          expect(inField(fc, cut), `cut ${cut} vs ${JSON.stringify(fc)}`).toBe(true);
          expect(inField(fc, x.up ? x.mu0 + PhiInv(1 - x.a) * se : x.mu0 - PhiInv(1 - x.a) * se)).toBe(true);
          expect(Math.abs(fp.answer - want(table)), `${fp.answer} vs table ${want(table)}`).toBeLessThan(1e-9);
          expect(inField(fp, want(exact)), `exact ${want(exact)} vs ${JSON.stringify(fp)}`).toBe(true);
          // the range may include the route via the cut-off rounded to 2 decimals, but no wrong method
          expect(fp.acceptRange![1] - fp.acceptRange![0]).toBeLessThan(0.02);
          expect(inField(fp, 1 - want(exact))).toBe(false);
          expect(inField(fp, want(powerOf({ ...x, a: x.a / 2 })))).toBe(false); // two-sided z* (area α/2 in the tail)
          expect(inField(fp, want(powerOf({ ...x, s: x.s * Math.sqrt(x.n) })))).toBe(false); // σ instead of σ/√n
        } else {
          for (const o of g.options!) {
            const v = Number(o.text);
            const close = Math.abs(v - want(exact)) <= 0.003;
            expect(close, `${o.id} ${o.text} vs exact ${want(exact)} (key ${g.correctAnswer})\n${g.stem}`).toBe(o.id === g.correctAnswer);
            if (o.id === g.correctAnswer) expect(Math.abs(v - want(table))).toBeLessThan(1e-9);
            else expect(Math.abs(v - want(exact))).toBeGreaterThan(0.005);
          }
        }
      }
    });
  }
});
