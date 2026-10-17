// Independent checks for the "Normal model" templates. μ, σ, the cut-off values and percentages are read back from the
// printed stem, the shaded region from the drawn SVG (polygon edges mapped to the axis through the tick labels).
// Probabilities are recomputed with a Simpson-integrated Normal CDF (not stats.normCdf) and with Table Z as printed;
// cut-offs and parameters by bisection on that CDF (σ, μ, or σ with μ(σ) nested for two percentiles). The key must
// equal the Table Z value (numeric answers must accept both it and the exact value) and no distractor may be correct.
import { describe, expect, it } from 'vitest';
import { makeRng } from '../rng';
import type { GenType, Generated } from '../types';
import { Phi, PhiInv, after, axisMap, elements, firstNumber, rnd, svgText, tableZ, zReverse } from './_normal-check';
import { SCENARIOS, TEMPLATES, type Scn } from './normal-model';

const SEEDS = 250;
const TYPES: GenType[] = ['single-choice', 'numeric'];
const gen = (id: string, seed: number, type: GenType) =>
  TEMPLATES.find((t) => t.id === `normal-model.${id}`)!.generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });

const scnOf = (stem: string): Scn => SCENARIOS.find((s) => stem.startsWith(s.thing))!;
const params = (stem: string) => ({ mu: after(stem, /mean (?:of )?/)!, sd: after(stem, /standard deviation (?:of )?/)! });

/** The event in a phrase: "between a and b", "{more} x" or "{less} x" → [lo, hi]. */
function interval(s: Scn, text: string): [number, number] {
  const b = /between (-?[\d.]+) and (-?[\d.]+)/.exec(text);
  if (b) return [Number(b[1]), Number(b[2])];
  const m = after(text, new RegExp(`${s.more} `));
  if (m !== null) return [m, Infinity];
  return [-Infinity, after(text, new RegExp(`${s.less} `))!];
}

const inRange = (g: { acceptRange?: [number, number]; tolerance?: number; answer?: number; correctAnswer?: unknown }, v: number) => {
  const r = g.acceptRange;
  const key = (g.answer ?? g.correctAnswer) as number;
  return (r && v >= r[0] - 1e-9 && v <= r[1] + 1e-9) || Math.abs(v - key) <= (g.tolerance ?? 0) + 1e-9;
};

const bisect = (f: (x: number) => number, a: number, b: number) => {
  let fa = f(a);
  for (let i = 0; i < 200; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (fa * fm <= 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
};

const others = (g: Generated) => g.options!.filter((o) => o.id !== g.correctAnswer);
const keyText = (g: Generated) => g.options!.find((o) => o.id === g.correctAnswer)!.text!;

describe('normal-model.probability: Table Z and Simpson-integrated probability from the printed numbers', () => {
  for (const type of TYPES)
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('probability', seed, type);
        const s = scnOf(g.stem);
        const { mu, sd } = params(g.stem);
        const [lo, hi] = interval(s, g.stem.split('\n')[1]);
        const F = (x: number) => (Number.isFinite(x) ? tableZ((x - mu) / sd) : x > 0 ? 1 : 0);
        const table = rnd(F(hi) - F(lo), 4);
        const exact = Phi((hi - mu) / sd) - Phi((lo - mu) / sd);
        const N = after(g.stem, /Consider /);
        const msg = `seed ${seed}: ${g.stem}`;
        if (type === 'numeric') {
          if (N) {
            expect(g.correctAnswer, msg).toBe(Math.round(N * table));
            expect(inRange(g, Math.round(N * exact)), msg).toBe(true);
          } else {
            expect(Math.abs((g.correctAnswer as number) - table), msg).toBeLessThan(1e-6);
            expect(inRange(g, rnd(exact, 4)), msg).toBe(true);
          }
        } else if (N) {
          expect(Number(keyText(g)), msg).toBe(Math.round(N * table));
          for (const o of others(g)) expect(Math.abs(Number(o.text) - N * exact), `${msg}\n${o.text}`).toBeGreaterThan(1.5);
        } else {
          expect(Number(keyText(g)), msg).toBeCloseTo(table, 4);
          for (const o of others(g)) {
            expect(Math.abs(Number(o.text) - exact), `${msg}\n${o.text}`).toBeGreaterThan(0.002);
            expect(Math.abs(Number(o.text) - table), `${msg}\n${o.text}`).toBeGreaterThan(0.002);
          }
        }
      }
    });
});

describe('normal-model.cutoff: x with P(X < x) = q by bisection on Φ, and the Table Z (reverse) value', () => {
  for (const type of TYPES)
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('cutoff', seed, type);
        const s = scnOf(g.stem);
        const { mu, sd } = params(g.stem);
        const p = after(g.stem, /the [a-z-]+ /)! / 100;
        const top = g.stem.includes(` ${s.hi} `);
        expect(top || g.stem.includes(` ${s.lo} `)).toBe(true);
        const q = top ? 1 - p : p;
        const exact = bisect((x) => Phi((x - mu) / sd) - q, mu - 10 * sd, mu + 10 * sd);
        const tab = mu + zReverse(q) * sd;
        const msg = `seed ${seed}: ${g.stem}`;
        if (type === 'numeric') {
          expect(Math.abs((g.correctAnswer as number) - exact), msg).toBeLessThanOrEqual(0.5 + 0.002 * sd);
          expect(inRange(g, exact) && inRange(g, tab), msg).toBe(true);
          // what a student types: the Table Z (or exact) value rounded as the instruction asks
          const dp = /whole number/.test(g.instruction!) ? 0 : 1;
          expect(inRange(g, rnd(tab, dp)) && inRange(g, rnd(exact, dp)), `${msg}\n${rnd(tab, dp)} / ${rnd(exact, dp)} not accepted: ${g.acceptRange}`).toBe(true);
        } else {
          const dp = g.options!.some((o) => /\.\d/.test(o.text!)) ? 1 : 0;
          const r = dp ? 0.05 : 0.5;
          expect(Math.abs(firstNumber(keyText(g)) - exact), msg).toBeLessThanOrEqual(r + 0.002 * sd);
          for (const o of others(g)) {
            const v = firstNumber(o.text!);
            expect(v < Math.min(exact, tab) - r || v > Math.max(exact, tab) + r, `${msg}\n${o.text}`).toBe(true);
          }
        }
      }
    });
});

describe('normal-model.parameters: σ, μ or (μ, σ) solved by bisection from the printed percentiles', () => {
  for (const type of TYPES)
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('parameters', seed, type);
        const s = scnOf(g.stem);
        const re = new RegExp(`(\\d+(?:\\.\\d+)?)% of the ${s.items} ${s.vn} (${s.more}|${s.less}) (\\d+(?:\\.\\d+)?)`, 'g');
        const conds = [...g.stem.matchAll(re)].map((m) => ({ q: m[2] === s.more ? 1 - Number(m[1]) / 100 : Number(m[1]) / 100, x: Number(m[3]) }));
        const mu0 = after(g.stem, /with mean /);
        const sd0 = after(g.stem, /with standard deviation /);
        const msg = `seed ${seed}: ${g.stem}`;
        let exact: { m: number; sig: number };
        let tab: { m: number; sig: number };
        if (mu0 !== null || sd0 !== null) {
          expect(conds.length, msg).toBe(1);
          const { q, x } = conds[0];
          if (mu0 !== null) {
            const sig = bisect((v) => Phi((x - mu0) / v) - q, 1e-6, 1e7);
            exact = { m: mu0, sig };
            tab = { m: mu0, sig: (x - mu0) / zReverse(q) };
          } else {
            const m = bisect((v) => Phi((x - v) / sd0!) - q, x - 50 * sd0!, x + 50 * sd0!);
            exact = { m, sig: sd0! };
            tab = { m: x - zReverse(q) * sd0!, sig: sd0! };
          }
        } else {
          expect(conds.length, msg).toBe(2);
          const [c1, c2] = [...conds].sort((u, v) => u.x - v.x);
          const z1 = PhiInv(c1.q);
          const sig = bisect((v) => Phi((c2.x - (c1.x - z1 * v)) / v) - c2.q, 1e-6, 1e7);
          exact = { m: c1.x - z1 * sig, sig };
          const t1 = zReverse(c1.q);
          const ts = (c2.x - c1.x) / (zReverse(c2.q) - t1);
          tab = { m: c1.x - t1 * ts, sig: ts };
        }
        const tolK = 0.005 * exact.sig + 0.006;
        const far = 0.02 * exact.sig;
        const unknown = mu0 !== null ? 'sig' : sd0 !== null ? 'm' : 'both';
        if (type === 'numeric') {
          if (unknown === 'both') {
            const [fm, fs] = g.fields!;
            expect(Math.abs(fm.answer - exact.m) <= tolK && Math.abs(fs.answer - exact.sig) <= tolK, msg).toBe(true);
            expect(inRange(fm, exact.m) && inRange(fm, tab.m) && inRange(fs, exact.sig) && inRange(fs, tab.sig), msg).toBe(true);
          } else {
            const want = exact[unknown];
            expect(Math.abs((g.correctAnswer as number) - want), msg).toBeLessThanOrEqual(tolK);
            expect(inRange(g, want) && inRange(g, tab[unknown]), msg).toBe(true);
          }
        } else if (unknown === 'both') {
          const read = (t: string) => {
            const m = /\\mu=(-?[\d.]+)\$, \$\\sigma=(-?[\d.]+)/.exec(t);
            return m ? { m: Number(m[1]), sig: Number(m[2]) } : null;
          };
          const k = read(keyText(g))!;
          expect(Math.abs(k.m - exact.m) <= tolK && Math.abs(k.sig - exact.sig) <= tolK, msg).toBe(true);
          for (const o of others(g)) {
            const v = read(o.text!);
            if (!v) expect(o.text, msg).toMatch(/cannot be determined/);
            else expect(Math.abs(v.m - exact.m) > far || Math.abs(v.sig - exact.sig) > far, `${msg}\n${o.text}`).toBe(true);
          }
        } else {
          expect(Math.abs(firstNumber(keyText(g)) - exact[unknown]), msg).toBeLessThanOrEqual(tolK);
          for (const o of others(g)) {
            const v = firstNumber(o.text!);
            expect(Math.abs(v - exact[unknown]) > far && Math.abs(v - tab[unknown]) > far, `${msg}\n${o.text}`).toBe(true);
          }
        }
      }
    });
});

/** 68–95–99.7 rule as a CDF at whole z-values. */
const RULE_CDF: Record<string, number> = { '-Infinity': 0, '-3': 0.0015, '-2': 0.025, '-1': 0.16, '0': 0.5, '1': 0.84, '2': 0.975, '3': 0.9985, Infinity: 1 };

describe('normal-model.shaded-area: region read from the SVG polygon, probability by Simpson / Table Z / 68–95–99.7', () => {
  for (const type of TYPES)
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('shaded-area', seed, type);
        const svg = svgText(g.images![0].src);
        const ticks = elements(svg, 'text', 'xt').map((e) => {
          const m = /μ(?: ([−+]) (\d?)σ)?/.exec(e.text)!;
          return { x: Number(e.attrs.x), v: m[1] ? (m[1] === '−' ? -1 : 1) * Number(m[2] || 1) : 0 };
        });
        expect(ticks.map((t) => t.v)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
        const toZ = axisMap(ticks);
        const xs = elements(svg, 'polygon', 'shade')[0].attrs.points.split(' ').map((p) => Number(p.split(',')[0]));
        const edge = (px: number) => {
          const z = toZ(px);
          if (z < -3.5) return -Infinity;
          if (z > 3.5) return Infinity;
          expect(Math.abs(z - Math.round(z))).toBeLessThan(0.02);
          return Math.round(z);
        };
        const a = edge(Math.min(...xs));
        const b = edge(Math.max(...xs));
        const msg = `seed ${seed}: ${g.stem} [${a}, ${b}]`;
        // at μ ± 3σ the curve is practically on the axis: such an edge cannot be told apart from an open tail
        const open = (z: number) => (z <= -3 ? -Infinity : z >= 3 ? Infinity : z);
        if (type === 'numeric') {
          expect([a, b].some((z) => Math.abs(z) === 3), `${msg}: invisible edge in a numeric question`).toBe(false);
          const T = (z: number) => (Number.isFinite(z) ? tableZ(z) : z > 0 ? 1 : 0);
          expect(Math.abs((g.correctAnswer as number) - rnd(T(b) - T(a), 4)), msg).toBeLessThan(1e-6);
          expect(inRange(g, rnd(Phi(b) - Phi(a), 4)) && inRange(g, RULE_CDF[String(b)] - RULE_CDF[String(a)]), msg).toBe(true);
        } else {
          const s = scnOf(g.stem);
          const { mu, sd } = params(g.stem);
          const want = [mu + a * sd, mu + b * sd];
          const same = (t: string) => {
            const [lo, hi] = interval(s, t);
            const eq = (u: number, v: number) => u === v || Math.abs(u - v) < 1e-6;
            return eq(lo, want[0]) && eq(hi, want[1]);
          };
          expect(same(keyText(g)), msg).toBe(true);
          for (const o of others(g)) expect(same(o.text!), `${msg}\n${o.text}`).toBe(false);
          const zOf = (x: number) => (Number.isFinite(x) ? Math.round((x - mu) / sd) : x);
          for (const o of others(g)) {
            const [lo, hi] = interval(s, o.text!);
            expect(open(zOf(lo)) === open(a) && open(zOf(hi)) === open(b), `${msg}\nlooks the same as the key: ${o.text}`).toBe(false);
          }
        }
      }
    });
});
