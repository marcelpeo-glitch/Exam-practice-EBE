// Independent checks for the "Sampling distributions" templates. All numbers are read back from the printed stem and
// the population and candidate histograms from the drawn SVG bars (pixels mapped to the axis through the tick labels).
// Standard errors are recomputed as √(Var(sum))/n, by exact binomial enumeration of Var(p̂), by brute force over n,
// and (for a few seeds) by simulating sample means with a seeded rng; probabilities with a Simpson-integrated Normal
// CDF and Table Z as printed, with SD(p̂) from binomial enumeration. For the CLT question the sampling distribution of
// ȳ is recomputed by enumerating all 7ⁿ samples (n = 2) or by the CLT Normal approximation (n ≥ 25), and the key must
// be the only histogram close to it. Multi-select statements are judged from the recomputed μ, σ/√n and n.
import { describe, expect, it } from 'vitest';
import { makeRng } from '../rng';
import type { GenType, Generated } from '../types';
import { Phi, after, axisMap, elements, rnd, svgText, tableZ } from './_normal-check';
import { TEMPLATES } from './sampling-distributions';

const SEEDS = 250;
const gen = (id: string, seed: number, type: GenType) =>
  TEMPLATES.find((t) => t.id === `sampling-distributions.${id}`)!.generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });
const keyText = (g: Generated) => g.options!.find((o) => o.id === g.correctAnswer)!.text!;
const others = (g: Generated) => g.options!.filter((o) => o.id !== g.correctAnswer);
const inRange = (g: Generated, v: number) =>
  (g.acceptRange && v >= g.acceptRange[0] - 1e-9 && v <= g.acceptRange[1] + 1e-9) || Math.abs(v - (g.correctAnswer as number)) <= g.tolerance! + 1e-9;

/** Var(p̂) by summing over the binomial distribution (pmf by recursion outwards from the mode, in log space at the mode). */
function varPhat(n: number, p: number): number {
  const k0 = Math.floor(n * p);
  let logc = 0;
  for (let i = 1; i <= k0; i++) logc += Math.log((n - k0 + i) / i);
  const p0 = Math.exp(logc + k0 * Math.log(p) + (n - k0) * Math.log(1 - p));
  let v = (k0 / n - p) ** 2 * p0;
  for (let k = k0, pmf = p0; k < n; k++) {
    pmf *= ((n - k) / (k + 1)) * (p / (1 - p));
    v += ((k + 1) / n - p) ** 2 * pmf;
  }
  for (let k = k0, pmf = p0; k > 0; k--) {
    pmf *= (k / (n - k + 1)) * ((1 - p) / p);
    v += ((k - 1) / n - p) ** 2 * pmf;
  }
  return v;
}

/** Table Z and exact (Simpson) probability of [lo, hi] for N(m, s). */
function probs(lo: number, hi: number, m: number, s: number) {
  const T = (x: number) => (Number.isFinite(x) ? tableZ((x - m) / s) : x > 0 ? 1 : 0);
  const E = (x: number) => (Number.isFinite(x) ? Phi((x - m) / s) : x > 0 ? 1 : 0);
  return { table: rnd(T(hi) - T(lo), 4), exact: E(hi) - E(lo) };
}

function checkProb(g: Generated, table: number, exact: number, msg: string) {
  if (g.type === 'numeric') {
    expect(Math.abs((g.correctAnswer as number) - table), msg).toBeLessThan(1e-6);
    expect(inRange(g, rnd(exact, 4)), msg).toBe(true);
    return;
  }
  expect(Number(keyText(g)), msg).toBeCloseTo(table, 4);
  for (const o of others(g)) {
    if (/cannot be calculated/.test(o.text!)) continue;
    const v = Number(o.text);
    expect(Math.abs(v - exact) > 0.002 && Math.abs(v - table) > 0.002, `${msg}\n${o.text}`).toBe(true);
  }
}

describe('sampling-distributions.standard-error: √(Var of the sum)/n, binomial enumeration, brute force over n, simulation', () => {
  for (const type of ['single-choice', 'numeric'] as GenType[])
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('standard-error', seed, type);
        const msg = `seed ${seed}: ${g.stem}`;
        const ns = [...g.stem.matchAll(/\$n=(\d+)\$/g)].map((m) => Number(m[1]));
        let want: number;
        if (g.stem.includes('\\hat p')) {
          const p = Number(/(\d+(?:\.\d+)?)%/.exec(g.stem)![1]) / 100;
          want = Math.sqrt(varPhat(ns[0], p));
        } else if (g.stem.includes('pilot study')) {
          const se1 = after(g.stem, /standard error of the mean of /)!;
          const sigma = se1 * Math.sqrt(ns[0]);
          if (ns.length === 2) want = Math.sqrt((sigma * sigma) / ns[1]);
          else {
            const target = after(g.stem, /to get a standard error of /)!;
            let n = 1;
            while (sigma / Math.sqrt(n) > target * (1 + 1e-9)) n++;
            want = n;
          }
        } else {
          const s = after(g.stem, /\$s=/)!;
          const n = ns[0];
          want = Math.sqrt(Array.from({ length: n }, () => s * s).reduce((a, b) => a + b, 0)) / n;
          if (seed <= 12) {
            const r = makeRng(1000 + seed);
            const reps = 3000;
            const means: number[] = [];
            for (let k = 0; k < reps; k++) {
              let t = 0;
              for (let i = 0; i < n; i++) t += s * Math.sqrt(-2 * Math.log(1 - r.next())) * Math.cos(2 * Math.PI * r.next());
              means.push(t / n);
            }
            const m = means.reduce((a, b) => a + b, 0) / reps;
            const sim = Math.sqrt(means.reduce((a, b) => a + (b - m) ** 2, 0) / (reps - 1));
            expect(Math.abs(sim / want - 1), `${msg}: simulated SD of the mean ${sim}`).toBeLessThan(0.06);
          }
        }
        if (type === 'numeric') expect(Math.abs((g.correctAnswer as number) - want), msg).toBeLessThanOrEqual(g.tolerance! + 1e-9);
        else {
          expect(Math.abs(Number(keyText(g)) - want), msg).toBeLessThanOrEqual(0.0006 * Math.max(1, want) + 0.5 * 10 ** -(keyText(g).split('.')[1]?.length ?? 0));
          for (const o of others(g)) expect(Math.abs(Number(o.text) / want - 1), `${msg}\n${o.text}`).toBeGreaterThan(0.02);
        }
      }
    });
});

describe('sampling-distributions.mean-probability: N(μ, σ/√n) for ȳ (or N(nμ, √n σ) for a total) from the printed numbers', () => {
  for (const type of ['single-choice', 'numeric'] as GenType[])
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('mean-probability', seed, type);
        const msg = `seed ${seed}: ${g.stem}`;
        const mu = after(g.stem, /\\mu=/)!;
        const sigma = after(g.stem, /\\sigma=/)!;
        const n = after(g.stem, /\$n=/)!;
        const normal = g.stem.includes('The distribution is Normal.');
        expect(normal || n >= 30, msg).toBe(true);
        const total = /total weight of the \d+ [a-z ]+ is more than ([\d.]+)/.exec(g.stem);
        let r: { table: number; exact: number };
        // the same with SD(ȳ) rounded to 4 decimals, as a student writes it down before computing z
        let r4: { table: number; exact: number };
        if (total) r = r4 = probs(Number(total[1]), Infinity, n * mu, Math.sqrt(n * sigma * sigma));
        else {
          const se = Math.sqrt((sigma * sigma) / n);
          const se4 = rnd(se, 4);
          const b = /\\bar y\$ is between ([\d.]+) and ([\d.]+)/.exec(g.stem);
          const m = /\\bar y\$ is (more|less) than ([\d.]+)/.exec(g.stem);
          const at = (sd: number) =>
            b ? probs(Number(b[1]), Number(b[2]), mu, sd) : m![1] === 'more' ? probs(Number(m![2]), Infinity, mu, sd) : probs(-Infinity, Number(m![2]), mu, sd);
          r = at(se);
          r4 = at(se4);
        }
        checkProb(g, r.table, r.exact, msg);
        expect(r4.table, `${msg}\nrounded SD gives another Table Z entry`).toBe(r.table);
        if (type === 'single-choice' && g.options!.some((o) => /cannot be calculated/.test(o.text!))) expect(!normal && n >= 30, msg).toBe(true);
      }
    });
});

describe('sampling-distributions.proportion: SD(p̂) from binomial enumeration, Simpson Φ and Table Z', () => {
  for (const type of ['single-choice', 'numeric'] as GenType[])
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('proportion', seed, type);
        const msg = `seed ${seed}: ${g.stem}`;
        const p = Number(/(\d+(?:\.\d+)?)%/.exec(g.stem)![1]) / 100;
        const n = after(g.stem, /\$n=/)!;
        expect(n * p >= 10 && n * (1 - p) >= 10, msg).toBe(true);
        const sd = Math.sqrt(varPhat(n, p));
        const b = /is between ([\d.]+)% and ([\d.]+)%/.exec(g.stem);
        const m = /is (more|less) than ([\d.]+)%/.exec(g.stem);
        const at = (s: number) =>
          b ? probs(Number(b[1]) / 100, Number(b[2]) / 100, p, s) : m![1] === 'more' ? probs(Number(m![2]) / 100, Infinity, p, s) : probs(-Infinity, Number(m![2]) / 100, p, s);
        const r = at(sd);
        checkProb(g, r.table, r.exact, msg);
        // a student who rounds SD(p̂) to 4 decimals (0.0134) before computing z must read the same Table Z entry
        expect(at(rnd(sd, 4)).table, `${msg}\nrounded SD gives another Table Z entry`).toBe(r.table);
      }
    });
});

/** Bars of every histogram panel in an SVG: x-range in data units (via the panel's tick labels) and relative mass. */
function panels(src: string) {
  const svg = svgText(src);
  return svg
    .split('<g class="panel">')
    .slice(1)
    .map((part) => {
      const title = elements(part, 'text', 'pt')[0].text;
      const toX = axisMap(elements(part, 'text', 'xt').map((e) => ({ x: Number(e.attrs.x), v: Number(e.text) })));
      const raw = elements(part, 'rect', 'bar').map((e) => {
        const x = Number(e.attrs.x);
        return { x0: toX(x), x1: toX(x + Number(e.attrs.width)), h: Number(e.attrs.height) };
      });
      const tot = raw.reduce((a, b) => a + b.h, 0);
      return { title, bars: raw.map((b) => ({ ...b, m: b.h / tot })) };
    });
}

describe('sampling-distributions.clt: sampling distribution of ȳ by enumeration (n = 2) or the CLT (n ≥ 25), read from the SVG', () => {
  it('single-choice', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('clt', seed, 'single-choice');
      const msg = `seed ${seed}: ${g.stem}`;
      const [pop] = panels(g.images![0].src);
      const vals = pop.bars.map((b) => Math.round((b.x0 + b.x1) / 2));
      const pr = pop.bars.map((b) => b.m);
      const mu = vals.reduce((t, v, i) => t + v * pr[i], 0);
      const sigma = Math.sqrt(vals.reduce((t, v, i) => t + (v - mu) ** 2 * pr[i], 0));
      expect(Math.abs(mu - after(g.stem, /\\mu=/)!), msg).toBeLessThan(0.006);
      expect(Math.abs(sigma - after(g.stem, /\\sigma=/)!), msg).toBeLessThan(0.006);
      const n = after(g.stem, /\$n=/)!;
      let ref: (x0: number, x1: number) => number;
      if (n <= 3) {
        const dist = new Map<number, number>();
        const rec = (k: number, sum: number, p: number) => {
          if (k === n) {
            const m = Math.round((sum / n) * 1e6) / 1e6;
            dist.set(m, (dist.get(m) ?? 0) + p);
            return;
          }
          vals.forEach((v, i) => rec(k + 1, sum + v, p * pr[i]));
        };
        rec(0, 0, 1);
        ref = (x0, x1) => [...dist].reduce((t, [m, p]) => t + (m >= x0 - 1e-6 && m < x1 - 1e-6 ? p : 0), 0);
      } else {
        const se = sigma / Math.sqrt(n);
        ref = (x0, x1) => Phi((x1 - mu) / se) - Phi((x0 - mu) / se);
      }
      const cands = panels(g.images![1].src);
      expect(cands.length, msg).toBe(g.options!.length);
      expect(g.images![1].alt, msg).toContain(`(a) to (${'abcde'[cands.length - 1]})`);
      const dist = cands.map((c) => {
        let d = 0;
        let covered = 0;
        for (const b of c.bars) {
          const r = ref(b.x0, b.x1);
          covered += r;
          d += Math.abs(b.m - r);
        }
        return d + Math.max(0, 1 - covered);
      });
      cands.forEach((c, i) => {
        expect(g.options![i].text, msg).toBe(`Histogram ${c.title}`);
        if (g.options![i].id === g.correctAnswer) expect(dist[i], `${msg}\nkey distance`).toBeLessThan(0.12);
        else expect(dist[i], `${msg}\n${c.title} distance`).toBeGreaterThan(0.25);
      });
    }
  });

  it('multi-select', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('clt', seed, 'multi-select');
      const msg = `seed ${seed}: ${g.stem}`;
      const [pop] = panels(g.images![0].src);
      const vals = pop.bars.map((b) => Math.round((b.x0 + b.x1) / 2));
      const mu = vals.reduce((t, v, i) => t + v * pop.bars[i].m, 0);
      const sigma = Math.sqrt(vals.reduce((t, v, i) => t + (v - mu) ** 2 * pop.bars[i].m, 0));
      const n = after(g.stem, /\$n=/)!;
      const truth = (t: string): boolean => {
        let m = /mean of the sampling distribution of \$\\bar y\$ is (\d+(?:\.\d+)?)/.exec(t);
        if (m) return Math.abs(Number(m[1]) - mu) < 0.006;
        m = /standard deviation of the sampling distribution of \$\\bar y\$ is about (\d+(?:\.\d+)?)/.exec(t);
        if (m) return Math.abs(Number(m[1]) - sigma / Math.sqrt(n)) < 0.006;
        m = /samples of size \$n=(\d+)\$, the standard deviation of \$\\bar y\$ would be about (\d+(?:\.\d+)?)/.exec(t);
        if (m) return Math.abs(Number(m[2]) - sigma / Math.sqrt(Number(m[1]))) < 0.006;
        if (/individual values in the population closer to Normal/.test(t)) return false;
        if (/approximately Normal, although/.test(t)) return n >= 25;
        if (/not yet approximately Normal/.test(t)) return n <= 3;
        if (/holds for every sample size/.test(t)) return false;
        if (/just like the population/.test(t)) return false;
        throw new Error(`unknown statement: ${t}`);
      };
      const want = g.options!.filter((o) => truth(o.text!)).map((o) => o.id);
      expect(g.correctAnswer, msg).toEqual(want);
    }
  });
});
