// Independent checks for the "Hypothesis tests" templates. Nothing is taken from the generator's formulas:
// - the research question is read back from the printed claim ("suspects that … is more than 40%", "differs from …")
//   and must agree with any printed hypotheses; options are decoded (hypotheses, test names, LaTeX expressions,
//   P-value intervals, conclusions) and judged against definitions;
// - z is recomputed from the printed counts as (x − np0)/√(np0(1 − p0)), with an independent Simpson-integrated Normal
//   CDF and Table Z as printed (_normal-check); every option expression is evaluated numerically;
// - t is recomputed from the printed summary or raw data (one-pass sums), with an independent t-distribution
//   (Simpson integration of cos^(ν−1)θ, T = √ν·tanθ) and its bisection inverse; for some seeds the P-value is also
//   estimated by simulating t-statistics of Normal samples under H0 with a seeded rng;
// - confidence-interval statements are judged by building the interval, test statements by the P-value.
import { describe, expect, it } from 'vitest';
import { makeRng } from '../rng';
import { T_TABLE_DF } from '../stats';
import type { GenType, Generated } from '../types';
import { Phi, rnd, tableZ } from './_normal-check';
import { TEMPLATES } from './hypothesis-tests';

const SEEDS = 250;
type Dir = '>' | '<' | '!=';
const gen = (id: string, seed: number, type: GenType) =>
  TEMPLATES.find((t) => t.id === `hypothesis-tests.${id}`)!.generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });
const keyOf = (g: Generated) => g.options!.find((o) => o.id === g.correctAnswer)!;
const others = (g: Generated) => g.options!.filter((o) => o.id !== g.correctAnswer);
const grab = (s: string, re: RegExp) => {
  const m = re.exec(s);
  if (!m) throw new Error(`no match for ${re} in\n${s}`);
  return Number(m[1]);
};
const pctOf = (p: number) => `${rnd(100 * p, 2)}%`;
const WORDS: Record<Dir, string> = { '>': 'more than', '<': 'less than', '!=': 'different from' };

// ---------- independent t-distribution ----------

const totals = new Map<number, number>();
function simpson(f: (x: number) => number, a: number, b: number, m = 4000) {
  const h = (b - a) / m;
  let s = f(a) + f(b);
  for (let i = 1; i < m; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}
/** P(T > t) for Student's t with ν df: T = √ν·tanθ has density ∝ cos^(ν−1)θ on (−π/2, π/2). */
function tUpper(t: number, nu: number): number {
  const f = (th: number) => Math.cos(th) ** (nu - 1);
  if (!totals.has(nu)) totals.set(nu, simpson(f, -Math.PI / 2, Math.PI / 2));
  return simpson(f, Math.atan(t / Math.sqrt(nu)), Math.PI / 2) / totals.get(nu)!;
}
/** The t with P(T > t) = a. */
function tQuant(a: number, nu: number): number {
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (tUpper(m, nu) > a) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}
const tP = (t: number, nu: number, d: Dir) => (d === '>' ? tUpper(t, nu) : d === '<' ? tUpper(-t, nu) : 2 * tUpper(Math.abs(t), nu));
const zP = (z: number, d: Dir, F: (z: number) => number) => (d === '>' ? 1 - F(z) : d === '<' ? F(z) : 2 * F(-Math.abs(z)));

// ---------- reading the stem ----------

/** The research question from the claim sentence: direction, hypothesised value, proportion (%) or mean. */
function claim(stem: string): { dir: Dir; v: number; prop: boolean } {
  let m = /(?:suspects|believes|expects) that .+? is (more than|less than) ([\d.]+)(%| [a-z]+)\./.exec(stem);
  if (m) return { dir: m[1] === 'more than' ? '>' : '<', v: m[3] === '%' ? Number(m[2]) / 100 : Number(m[2]), prop: m[3] === '%' };
  m = /wants to find out whether .+? differs from ([\d.]+)(%| [a-z]+)\./.exec(stem);
  if (!m) throw new Error(`no claim in\n${stem}`);
  return { dir: '!=', v: m[2] === '%' ? Number(m[1]) / 100 : Number(m[1]), prop: m[2] === '%' };
}
/** Printed hypotheses (if any) must match the claim. */
function hypotheses(stem: string, par: string): { dir: Dir; v: number } | null {
  const m = new RegExp(`\\$H_0:${par}=([\\d.]+)\\$ against \\$H_A:${par}(>|<|\\\\ne )([\\d.]+)\\$`).exec(stem);
  if (!m) return null;
  expect(m[1], stem).toBe(m[3]);
  return { dir: m[2] === '>' ? '>' : m[2] === '<' ? '<' : '!=', v: Number(m[1]) };
}
function question(stem: string, prop: boolean) {
  const c = claim(stem);
  expect(c.prop, stem).toBe(prop);
  const h = hypotheses(stem, prop ? 'p' : '\\\\mu');
  if (h) {
    expect(h.dir, stem).toBe(c.dir);
    expect(h.v, stem).toBeCloseTo(c.v, 9);
  }
  return c;
}
function interval(t: string): [number, number] {
  let m = /^\$P<([\d.]+)\$$/.exec(t);
  if (m) return [0, Number(m[1])];
  m = /^\$P>([\d.]+)\$$/.exec(t);
  if (m) return [Number(m[1]), 1];
  m = /^\$([\d.]+)<P<([\d.]+)\$$/.exec(t);
  if (!m) throw new Error(`not an interval: ${t}`);
  return [Number(m[1]), Number(m[2])];
}
const within = (p: number, [a, b]: [number, number]) => p > a && p < b;

/** Evaluates "$z=\dfrac{…}{\sqrt{\dfrac{a\cdot b}{n}}}$" numerically. */
function evalTex(tex: string): number {
  const group = (s: string, i: number): [string, number] => {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === '{') depth++;
      else if (s[j] === '}' && --depth === 0) return [s.slice(i + 1, j), j + 1];
    }
    throw new Error(`unbalanced: ${s}`);
  };
  const conv = (s: string): string => {
    let out = '';
    for (let i = 0; i < s.length; ) {
      if (s.startsWith('\\dfrac', i)) {
        const [a, j] = group(s, i + 6);
        const [b, k] = group(s, j);
        out += `((${conv(a)})/(${conv(b)}))`;
        i = k;
      } else if (s.startsWith('\\sqrt', i)) {
        const [a, j] = group(s, i + 5);
        out += `Math.sqrt(${conv(a)})`;
        i = j;
      } else if (s.startsWith('\\cdot', i)) {
        out += '*';
        i += 5;
      } else out += s[i++];
    }
    return out;
  };
  const body = /^\$z=(.*)\$$/.exec(tex)![1];
  return Function(`return ${conv(body)}`)() as number;
}

// =====================================================================================================================

describe('hypothesis-tests.setup: hypotheses and tests judged from the printed claim', () => {
  it('single-choice', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('setup', seed, 'single-choice');
      const msg = `seed ${seed}: ${g.stem}`;
      const c = claim(g.stem);
      let ok: (t: string) => boolean;
      if (/null and alternative hypotheses/.test(g.stem)) {
        const par = c.prop ? 'p' : '\\mu';
        ok = (t) => {
          const m = /^\$H_0:(\\mu|p|\\bar y|\\hat p)(=|>|<|\\ne )([\d.]+)\$ and \$H_A:(\\mu|p|\\bar y|\\hat p)(=|>|<|\\ne )([\d.]+)\$$/.exec(t);
          expect(m, t).toBeTruthy();
          const op = { '>': '>', '<': '<', '!=': '\\ne ' }[c.dir];
          return m![1] === par && m![4] === par && m![2] === '=' && m![5] === op && Math.abs(Number(m![3]) - c.v) < 1e-9 && Math.abs(Number(m![6]) - c.v) < 1e-9;
        };
      } else {
        ok = (t) => {
          const m = /^A (one|two)-sided (one-proportion \$z\$-test|one-sample \$t\$-test for a mean|one-sample \$z\$-test for a mean|one-proportion \$t\$-test)$/.exec(t);
          expect(m, t).toBeTruthy();
          const want = c.prop ? 'one-proportion $z$-test' : 'one-sample $t$-test for a mean';
          return m![2] === want && (m![1] === 'two') === (c.dir === '!=');
        };
      }
      expect(ok(keyOf(g).text!), msg).toBe(true);
      for (const o of others(g)) expect(ok(o.text!), `${msg}\n${o.text}`).toBe(false);
    }
  });

  it('matching', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('setup', seed, 'matching');
      const key = g.correctAnswer as Record<string, string>;
      for (const p of g.prompts!) {
        const c = claim(p.text);
        const ans = g.choices!.find((x) => x.id === key[p.id])!.text!;
        const op = { '>': '>', '<': '<', '!=': '\\ne ' }[c.dir];
        const want = c.prop ? `One-proportion $z$-test with $H_A:p${op}p_0$` : `One-sample $t$-test with $H_A:\\mu${op}\\mu_0$`;
        expect(ans, `seed ${seed}: ${p.text}`).toBe(want);
      }
    }
  });
});

describe('hypothesis-tests.proportion-z: z from the counts, P from Table Z (as printed) and a Simpson Normal CDF', () => {
  for (const type of ['single-choice', 'numeric'] as GenType[])
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('proportion-z', seed, type);
        const msg = `seed ${seed}: ${g.stem}`;
        const c = question(g.stem, true);
        const n = grab(g.stem, /In a random sample of (\d+) /);
        const x = grab(g.stem, /In a random sample of \d+ [^,]+, (\d+) /);
        expect(n * c.v >= 10 && n * (1 - c.v) >= 10, msg).toBe(true);
        const z = (x - n * c.v) / Math.sqrt(n * c.v * (1 - c.v));
        const Pt = rnd(zP(rnd(z, 2), c.dir, tableZ), 4);
        const Px = zP(z, c.dir, Phi);
        if (type === 'numeric') {
          const [fz, fp] = g.fields!;
          expect(Math.abs(fz.answer - z), msg).toBeLessThanOrEqual(fz.tolerance! + 1e-9);
          expect(fp.answer, msg).toBeCloseTo(Pt, 9);
          expect(Px >= fp.acceptRange![0] && Px <= fp.acceptRange![1], msg).toBe(true);
          continue;
        }
        if (/Which expression/.test(g.stem)) {
          expect(evalTex(keyOf(g).text!), msg).toBeCloseTo(z, 9);
          for (const o of others(g)) expect(Math.abs(evalTex(o.text!) - z), `${msg}\n${o.text}`).toBeGreaterThan(1e-3);
        } else if (/Which interval/.test(g.stem)) {
          expect(within(Pt, interval(keyOf(g).text!)) && within(Px, interval(keyOf(g).text!)), msg).toBe(true);
          for (const o of others(g)) expect(within(Px, interval(o.text!)), `${msg}\n${o.text}`).toBe(false);
        } else {
          const a = grab(g.stem, /\$\\alpha=([\d.]+)\$/);
          expect(Pt < a, msg).toBe(Px < a);
          const reject = Px < a;
          const V = pctOf(c.v);
          const right = (t: string) =>
            !/prove/.test(t) &&
            (reject
              ? t.startsWith('We reject $H_0$: the data give convincing evidence that') && t.endsWith(`is ${WORDS[c.dir]} ${V}.`)
              : t.startsWith('We do not reject $H_0$: the data do not give convincing evidence that') && t.endsWith(`is ${WORDS[c.dir]} ${V}.`));
          expect(right(keyOf(g).text!), `${msg}\n${keyOf(g).text}`).toBe(true);
          for (const o of others(g)) expect(right(o.text!), `${msg}\n${o.text}`).toBe(false);
        }
      }
    });
});

/** n, μ0, direction, ȳ, s and t read back from a mean-test stem (summary statistics or raw data). */
function meanStem(stem: string) {
  const c = question(stem, false);
  const n = grab(stem, /\$n=(\d+)\$/);
  const raw = /are:\n([\d., ]+)/.exec(stem);
  let ybar: number;
  let s: number;
  if (raw) {
    const xs = raw[1].split(',').map(Number);
    expect(xs.length).toBe(n);
    const sum = xs.reduce((a, b) => a + b, 0);
    const sq = xs.reduce((a, b) => a + b * b, 0);
    ybar = sum / n;
    s = Math.sqrt((sq - n * ybar * ybar) / (n - 1));
  } else {
    ybar = grab(stem, /\\bar y=([\d.]+)\$/);
    s = grab(stem, /\$s=([\d.]+)\$/);
  }
  if (n < 30) expect(stem).toContain('approximately Normal');
  return { ...c, n, ybar, s, t: ((ybar - c.v) * Math.sqrt(n)) / s };
}

/** Share of simulated t-statistics (Normal samples, H0 true) at least as extreme as t. */
function simulatedP(t: number, n: number, d: Dir, seed: number, reps = 20000): number {
  const r = makeRng(seed);
  let hits = 0;
  for (let k = 0; k < reps; k++) {
    let sum = 0;
    let sq = 0;
    for (let i = 0; i < n; i++) {
      const y = Math.sqrt(-2 * Math.log(1 - r.next())) * Math.cos(2 * Math.PI * r.next());
      sum += y;
      sq += y * y;
    }
    const m = sum / n;
    const ts = m / Math.sqrt((sq - n * m * m) / (n - 1) / n);
    if (d === '>' ? ts >= t : d === '<' ? ts <= t : Math.abs(ts) >= Math.abs(t)) hits++;
  }
  return hits / reps;
}

describe('hypothesis-tests.mean-t: t from the printed data, P by integrating the t density, simulation for some seeds', () => {
  it('t-distribution check: tUpper reproduces known quantiles', () => {
    expect(tUpper(2.131, 15)).toBeCloseTo(0.025, 4);
    expect(tUpper(1.833, 9)).toBeCloseTo(0.05, 4);
    expect(tQuant(0.005, 60)).toBeCloseTo(2.66, 2);
  });

  it('single-choice', () => {
    let simulated = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('mean-t', seed, 'single-choice');
      const msg = `seed ${seed}: ${g.stem}`;
      const q = meanStem(g.stem);
      const df = q.n - 1;
      expect(T_TABLE_DF, msg).toContain(df);
      const P = tP(q.t, df, q.dir);
      if (simulated < 8) {
        simulated++;
        const sim = simulatedP(q.t, q.n, q.dir, 5000 + seed);
        expect(Math.abs(sim - P), `${msg}\nsimulated ${sim} vs ${P}`).toBeLessThan(4 * Math.sqrt((P * (1 - P)) / 20000) + 0.002);
      }
      if (/value of the test statistic/.test(g.stem)) {
        expect(Math.abs(Number(keyOf(g).text) - q.t), msg).toBeLessThanOrEqual(0.0051);
        for (const o of others(g)) expect(Math.abs(Number(o.text) - q.t), `${msg}\n${o.text}`).toBeGreaterThan(0.03);
      } else if (/Which expression/.test(g.stem)) {
        const tr = rnd(q.t, 2);
        const want = tP(tr, df, q.dir);
        const val = (t: string) => {
          const m = /^\$(2|0\.5)?P\((t|z)(>|<)(-?[\d.]+)\)\$(?: with \$df=(\d+)\$)?$/.exec(t);
          expect(m, t).toBeTruthy();
          const c = Number(m![4]);
          const up = m![2] === 't' ? tUpper(c, Number(m![5])) : 1 - Phi(c);
          return Number(m![1] ?? 1) * (m![3] === '>' ? up : 1 - up);
        };
        expect(val(keyOf(g).text!), msg).toBeCloseTo(want, 6);
        for (const o of others(g)) expect(Math.abs(val(o.text!) - want), `${msg}\n${o.text}`).toBeGreaterThan(1e-5);
      } else {
        expect(/Using Table T, which interval/.test(g.stem), msg).toBe(true);
        expect(within(P, interval(keyOf(g).text!)), `${msg}\nP=${P}`).toBe(true);
        for (const o of others(g)) expect(within(P, interval(o.text!)), `${msg}\n${o.text}`).toBe(false);
      }
    }
  });

  it('numeric', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('mean-t', seed, 'numeric');
      const msg = `seed ${seed}: ${g.stem}`;
      const q = meanStem(g.stem);
      const df = q.n - 1;
      expect(T_TABLE_DF, msg).toContain(df);
      const a = grab(g.stem, /\$\\alpha=([\d.]+)\$/);
      const [ft, fs] = g.fields!;
      expect(Math.abs(ft.answer - q.t), msg).toBeLessThanOrEqual(ft.tolerance! + 1e-9);
      expect(Math.abs(fs.answer - tQuant(q.dir === '!=' ? a / 2 : a, df)), msg).toBeLessThan(0.002);
      const reject = tP(q.t, df, q.dir) < a;
      expect(g.explanation.includes('so we reject $H_0$'), msg).toBe(reject);
    }
  });
});

describe('hypothesis-tests.p-value-ci: P-value meaning, CI duality and statements judged from recomputed P and intervals', () => {
  it('single-choice', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('p-value-ci', seed, 'single-choice');
      const msg = `seed ${seed}: ${g.stem}`;
      if (/interprets this P-value/.test(g.stem)) {
        const c = question(g.stem, true);
        const n = grab(g.stem, /In a random sample of (\d+) /);
        const x = grab(g.stem, /In a random sample of \d+ [^,]+, (\d+) /);
        const z = (x - n * c.v) / Math.sqrt(n * c.v * (1 - c.v));
        const stated = grab(g.stem, /P-value of (\d+\.\d+)/);
        expect(stated, msg).toBeCloseTo(rnd(zP(rnd(z, 2), c.dir, tableZ), 4), 9);
        expect(Math.abs(stated - zP(z, c.dir, Phi)), msg).toBeLessThan(0.002);
        const right = (t: string) =>
          t.startsWith('If ') && t.includes(`is really ${pctOf(c.v)},`) && t.includes(`${pctOf(x / n)} ${c.dir === '>' ? 'or more' : 'or less'}`) && t.endsWith(`with probability ${pctOf(stated)}.`);
        expect(right(keyOf(g).text!), `${msg}\n${keyOf(g).text}`).toBe(true);
        for (const o of others(g)) expect(right(o.text!), `${msg}\n${o.text}`).toBe(false);
        continue;
      }
      const C = grab(g.stem, /a (\d+)% confidence interval/) / 100;
      const a = grab(g.stem, /\$\\alpha=([\d.]+)\$/);
      expect(a, msg).toBeCloseTo(1 - C, 9);
      const n = grab(g.stem, /\$n=(\d+)\$/);
      const L = grab(g.stem, /runs from ([\d.]+) to/);
      const U = grab(g.stem, /runs from [\d.]+ to ([\d.]+)/);
      const notRej = /is \$H_0\$ \*\*not\*\* rejected/.test(g.stem);
      // rebuild ȳ and SE from the interval (exact t quantile) and test each μ0 with the t-test
      const se = (U - L) / 2 / tQuant((1 - C) / 2, n - 1);
      const correct = (t: string) => {
        const mu0 = grab(t, /\\mu_0=([\d.]+)/);
        const P = tP(((L + U) / 2 - mu0) / se, n - 1, '!=');
        expect(Math.abs(P - a), `${msg}\n${t}: P=${P}`).toBeGreaterThan(0.004);
        return notRej ? P > a : P < a;
      };
      expect(correct(keyOf(g).text!), `${msg}\n${keyOf(g).text}`).toBe(true);
      for (const o of others(g)) expect(correct(o.text!), `${msg}\n${o.text}`).toBe(false);
    }
  });

  it('multi-select', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('p-value-ci', seed, 'multi-select');
      const msg = `seed ${seed}: ${g.stem}`;
      const n = grab(g.stem, /\$n=(\d+)\$/);
      const mu0 = grab(g.stem, /\$H_0:\\mu=([\d.]+)\$/);
      const ybar = grab(g.stem, /\\bar y=([\d.]+)\$/);
      const s = grab(g.stem, /\$s=([\d.]+)\$/);
      const t = ((ybar - mu0) * Math.sqrt(n)) / s;
      const P = tP(t, n - 1, '!=');
      expect(grab(g.stem, /reports \$t=(-?[\d.]+)\$/), msg).toBeCloseTo(rnd(t, 2), 9);
      expect(Math.abs(grab(g.stem, /two-sided P-value of (\d+\.\d+)/) - P), msg).toBeLessThan(6e-5);
      const truth = (st: string): boolean => {
        let m = /^At significance level \$\\alpha=([\d.]+)\$, \$H_0\$ is rejected\.$/.exec(st);
        if (m) return P < Number(m[1]);
        m = /^The (\d+)% confidence interval for \$\\mu\$ based on these data contains ([\d.]+)\.$/.exec(st);
        if (m) {
          const me = (tQuant((1 - Number(m[1]) / 100) / 2, n - 1) * s) / Math.sqrt(n);
          expect(Math.abs(Math.abs(ybar - mu0) - me), msg).toBeGreaterThan(0.002 * me);
          return Math.abs(ybar - Number(m[2])) <= me;
        }
        m = /^With the one-sided alternative \$H_A:\\mu(>|<)([\d.]+)\$, the P-value would be ([\d.]+)\.$/.exec(st);
        if (m) return Math.abs(tP(t, n - 1, m[1] as Dir) - Number(m[3])) < 1e-3;
        m = /would occur in about ([\d.]+)% of random samples/.exec(st);
        if (m) return Math.abs(Number(m[1]) / 100 - P) < 1e-3;
        if (/larger random sample, the P-value would be smaller/.test(st)) return tP(t * 2, 4 * n - 1, '!=') < P;
        if (/^The probability that \$H_0\$ is true is/.test(st)) return false;
        if (/^There is a [\d.]+% probability that/.test(st)) return false;
        if (/^If \$H_0\$ is not rejected, this proves/.test(st)) return false;
        if (/equals exactly/.test(st)) return false;
        if (/would make it easier to reject/.test(st)) return false;
        throw new Error(`unknown statement: ${st}`);
      };
      expect(g.correctAnswer, msg).toEqual(g.options!.filter((o) => truth(o.text!)).map((o) => o.id));
    }
  });
});
