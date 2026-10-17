// Independent checks for the "Confidence intervals" templates. All numbers are read back from the printed stem.
// Critical values come from this file's own t-distribution (Simpson integration of the t density, normalised with the
// Gamma-ratio recursion, inverted by bisection) at the Table T row a student uses (df rounded down to a printed row),
// and from the Simpson-integrated Normal CDF of _normal-check (not stats.ts). The t-interval procedure is also
// checked by simulation (coverage of intervals built with the key's t* on seeded Normal samples); the proportion SE
// is recomputed from the 0/1 data; sample sizes are found by brute force (smallest n with ME(n) ≤ ME); interpretation
// statements are judged by a separate classifier from the recomputed interval, critical values and n.
import { describe, expect, it } from 'vitest';
import { makeRng } from '../rng';
import type { GenType, Generated } from '../types';
import { PhiInv, tableZ } from './_normal-check';
import { TEMPLATES } from './confidence-intervals';

const SEEDS = 250;
const gen = (id: string, seed: number, type: GenType) =>
  TEMPLATES.find((t) => t.id === `confidence-intervals.${id}`)!.generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });
const keyText = (g: Generated) => g.options!.find((o) => o.id === g.correctAnswer)!.text!;
const others = (g: Generated) => g.options!.filter((o) => o.id !== g.correctAnswer);
const numAfter = (s: string, re: RegExp) => {
  const m = new RegExp(re.source + '(\\d+(?:\\.\\d+)?)').exec(s);
  if (!m) throw new Error(`no number after ${re} in: ${s}`);
  return Number(m[m.length - 1]);
};
const bounds = (s: string) => {
  const m = /\[(-?[\d.]+), (-?[\d.]+)\]/.exec(s)!;
  return [Number(m[1]), Number(m[2])];
};
const confOf = (s: string) => Number(/(\d+)% confidence/.exec(s)![1]) / 100;
const accepts = (f: { answer: number; tolerance?: number; acceptRange?: [number, number] }, v: number) =>
  Math.abs(v - f.answer) <= (f.tolerance ?? 0) + 1e-9 || (!!f.acceptRange && v >= f.acceptRange[0] - 1e-9 && v <= f.acceptRange[1] + 1e-9);

// ---------- own t-distribution ----------

/** Rows printed in Table T. */
const ROWS = [...Array.from({ length: 30 }, (_, i) => i + 1), 32, 35, 40, 45, 50, 60, 75, 100, 120, 140, 180, 250, 400, 1000, Infinity];
const rowFor = (df: number) => ROWS.filter((r) => r <= df).pop()!;

/** Density constant Γ((ν+1)/2) / (√(νπ) Γ(ν/2)), via r(ν) = Γ((ν+1)/2)/Γ(ν/2), r(1) = 1/√π, r(ν+1) = ν/(2 r(ν)). */
function tConst(df: number) {
  let r = 1 / Math.sqrt(Math.PI);
  for (let v = 1; v < df; v++) r = v / (2 * r);
  return r / Math.sqrt(df * Math.PI);
}
function tCdfSimpson(t: number, df: number) {
  const c = tConst(df);
  const f = (u: number) => c * (1 + (u * u) / df) ** (-(df + 1) / 2);
  const n = 2000;
  const h = t / n;
  let s = f(0) + f(t);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(i * h);
  return 0.5 + (s * h) / 3;
}
const qCache = new Map<string, number>();
/** Two-sided critical value for a confidence level (df = Infinity: Normal). */
function crit(conf: number, df: number): number {
  const key = `${conf}|${df}`;
  if (!qCache.has(key)) {
    const target = 1 - (1 - conf) / 2;
    let q: number;
    if (!Number.isFinite(df)) q = PhiInv(target);
    else {
      let lo = 0;
      let hi = 40;
      for (let i = 0; i < 60; i++) {
        const m = (lo + hi) / 2;
        if (tCdfSimpson(m, df) < target) lo = m;
        else hi = m;
      }
      q = (lo + hi) / 2;
    }
    qCache.set(key, q);
  }
  return qCache.get(key)!;
}

/** z* read from the printed Table Z in reverse: the 2-decimal entry closest to 1 − (1 − C)/2 (both when tied). */
function zFromTableZ(conf: number): number[] {
  const q = 1 - (1 - conf) / 2;
  const cands = Array.from({ length: 400 }, (_, k) => k / 100);
  const d = (z: number) => Math.abs(tableZ(z) - q);
  const best = Math.min(...cands.map(d));
  return cands.filter((z) => d(z) <= best + 1e-9);
}

// =====================================================================================================================

describe('confidence-intervals.t-interval: own t quantile at the Table T row, bounds from the printed numbers, simulated coverage', () => {
  for (const type of ['numeric', 'single-choice'] as GenType[])
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('t-interval', seed, type);
        const msg = `seed ${seed}: ${g.stem}`;
        const n = numAfter(g.stem, /\$n=/);
        const ybar = numAfter(g.stem, /\\bar y=/);
        const s = numAfter(g.stem, /\$s=/);
        const conf = confOf(g.stem);
        expect(n >= 30 || g.stem.includes('roughly symmetric'), msg).toBe(true);
        const se = s / Math.sqrt(n);
        const qRow = crit(conf, rowFor(n - 1));
        const qEx = crit(conf, n - 1);
        if (type === 'numeric') {
          const [ft, flo, fhi] = g.fields!;
          // the key is the printed Table T value: our quantile at the row, to 3 decimals (the printed table has ±0.0013)
          expect(Math.abs(ft.answer - qRow), msg).toBeLessThan(0.0016);
          expect(accepts(ft, Math.round(qEx * 1000) / 1000), `${msg}\nexact t* ${qEx}`).toBe(true);
          expect(Math.abs(flo.answer - (ybar - ft.answer * se)), msg).toBeLessThanOrEqual(0.0051);
          expect(Math.abs(fhi.answer - (ybar + ft.answer * se)), msg).toBeLessThanOrEqual(0.0051);
          expect(accepts(flo, Math.round((ybar - qEx * se) * 100) / 100), msg).toBe(true);
          expect(accepts(fhi, Math.round((ybar + qEx * se) * 100) / 100), msg).toBe(true);
          if (seed <= 6) {
            // the procedure (key t*, s/√n) captures μ in about conf of all samples
            const r = makeRng(5000 + seed);
            const reps = 3000;
            let hit = 0;
            for (let k = 0; k < reps; k++) {
              const xs = Array.from({ length: n }, () => ybar + s * Math.sqrt(-2 * Math.log(1 - r.next())) * Math.cos(2 * Math.PI * r.next()));
              const m = xs.reduce((a, b) => a + b, 0) / n;
              const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
              if (Math.abs(m - ybar) <= (ft.answer * sd) / Math.sqrt(n)) hit++;
            }
            expect(Math.abs(hit / reps - conf), `${msg}\ncoverage ${hit / reps}`).toBeLessThan(0.025);
          }
        } else {
          const [a, b] = bounds(keyText(g));
          const slack = 0.0051 + 0.0016 * se;
          expect(Math.abs(a - (ybar - qRow * se)), msg).toBeLessThan(slack);
          expect(Math.abs(b - (ybar + qRow * se)), msg).toBeLessThan(slack);
          for (const o of others(g)) {
            const [c, d] = bounds(o.text!);
            expect(Math.abs((c + d) / 2 - ybar), msg).toBeLessThan(0.006);
            for (const q of [qRow, qEx]) expect(Math.abs(c - (ybar - q * se)), `${msg}\n${o.text} is also correct`).toBeGreaterThan(0.01);
          }
        }
      }
    });
});

describe('confidence-intervals.proportion: p̂ and SE from the 0/1 data (or the printed SE), z* from the Simpson Normal', () => {
  for (const type of ['single-choice', 'numeric'] as GenType[])
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('proportion', seed, type);
        const msg = `seed ${seed}: ${g.stem}`;
        const conf = confOf(g.stem);
        const asked = /that ([^.?]+)[.?]$/.exec(g.stem.split('\n').pop()!)![1];
        let ph: number;
        let se: number;
        const counted = /Of them, (\d+) ([^.]+)\./.exec(g.stem);
        if (counted) {
          const n = numAfter(g.stem, /\$n=/);
          const x = Number(counted[1]);
          const data = Array.from({ length: n }, (_, i) => (i < x ? 1 : 0)).map((y) => (counted[2] === asked ? y : 1 - y));
          ph = data.reduce((t, y) => t + y, 0) / n;
          se = Math.sqrt(data.reduce((t, y) => t + (y - ph) ** 2, 0) / n / n);
          expect(Math.min(x, n - x), `${msg}: Success/Failure condition`).toBeGreaterThanOrEqual(10);
        } else {
          ph = numAfter(g.stem, /estimates that /) / 100;
          se = numAfter(g.stem, /standard error of this estimate is /) / 100;
        }
        const z = PhiInv(1 - (1 - conf) / 2);
        const [lo, hi] = [ph - z * se, ph + z * se];
        expect(lo > 0 && hi < 1, msg).toBe(true);
        if (type === 'numeric') {
          const [fl, fh] = g.fields!;
          expect(Math.abs(fl.answer - lo), msg).toBeLessThan(0.0007);
          expect(Math.abs(fh.answer - hi), msg).toBeLessThan(0.0007);
          expect(accepts(fl, Math.round(lo * 1000) / 1000) && accepts(fh, Math.round(hi * 1000) / 1000), msg).toBe(true);
          // a student who reads z* from Table Z in reverse (e.g. 2.57 or 2.58 for 99%) is accepted too
          for (const zz of zFromTableZ(conf))
            expect(accepts(fl, Math.round((ph - zz * se) * 1000) / 1000) && accepts(fh, Math.round((ph + zz * se) * 1000) / 1000), `${msg}\nTable Z z*=${zz}`).toBe(true);
        } else {
          const [a, b] = bounds(keyText(g));
          expect(Math.abs(a - lo), msg).toBeLessThan(0.0007);
          expect(Math.abs(b - hi), msg).toBeLessThan(0.0007);
          for (const o of others(g)) {
            const [c, d] = bounds(o.text!);
            expect(Math.max(Math.abs(c - lo), Math.abs(d - hi)), `${msg}\n${o.text} is also correct`).toBeGreaterThan(0.003);
            for (const zz of zFromTableZ(conf)) expect(Math.max(Math.abs(c - (ph - zz * se)), Math.abs(d - (ph + zz * se))), `${msg}\n${o.text} matches Table Z`).toBeGreaterThan(0.003);
            // plausible: not a near-degenerate interval
            expect(d - c, `${msg}\n${o.text} is implausibly narrow`).toBeGreaterThan(0.25 * (hi - lo));
          }
        }
      }
    });
});

describe('confidence-intervals.sample-size: brute force over n with z* from the Simpson Normal (3-decimal table value and exact)', () => {
  const brute = (me: (n: number) => number, target: number) => {
    let n = 1;
    while (me(n) > target * (1 + 1e-12)) n++;
    return n;
  };
  for (const type of ['single-choice', 'numeric'] as GenType[])
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('sample-size', seed, type);
        const msg = `seed ${seed}: ${g.stem}`;
        const conf = confOf(g.stem);
        const zEx = PhiInv(1 - (1 - conf) / 2);
        const zTab = Math.round(zEx * 1000) / 1000;
        let me: (z: number) => (n: number) => number;
        let E: number;
        if (g.stem.includes('\\sigma=')) {
          const sigma = numAfter(g.stem, /\\sigma=/);
          E = numAfter(g.stem, /within \$\\pm/);
          me = (z) => (n) => (z * sigma) / Math.sqrt(n);
        } else {
          E = /at most ([\d.]+)/.test(g.stem) ? numAfter(g.stem, /at most /) : numAfter(g.stem, /no more than /) / 100;
          const p = g.stem.includes('$p=0.5$') ? 0.5 : numAfter(g.stem, /about /) / 100;
          me = (z) => (n) => z * Math.sqrt((p * (1 - p)) / n);
        }
        const nTab = brute(me(zTab), E);
        const nEx = brute(me(zEx), E);
        // z* read from Table Z in reverse (e.g. 2.57 or 2.58 for 99%) is a legitimate route as well
        const nZ = zFromTableZ(conf).map((zz) => brute(me(zz), E));
        const all = [nTab, nEx, ...nZ];
        const accepted = (v: number) => v >= Math.min(...all) - 1 && v <= Math.max(...all);
        if (type === 'numeric') {
          expect(g.correctAnswer, msg).toBe(nTab);
          for (const v of all) expect(accepts({ answer: g.correctAnswer as number, tolerance: g.tolerance, acceptRange: g.acceptRange }, v), `${msg}\nroute gives ${v}`).toBe(true);
          for (const v of [g.acceptRange![0], g.acceptRange![1]]) expect(accepted(v), `${msg}\naccepted ${v}`).toBe(true);
        } else {
          expect(Number(keyText(g)), msg).toBe(nTab);
          const vals = g.options!.map((o) => Number(o.text));
          expect([...vals].sort((a, b) => a - b), msg).toEqual(vals);
          for (const o of others(g)) expect(Math.abs(Number(o.text) - nTab) >= 2 && !accepted(Number(o.text)), `${msg}\n${o.text} is also correct`).toBe(true);
        }
      }
    });
});

describe('confidence-intervals.interpretation: interval recomputed from the data; every statement judged by a separate classifier', () => {
  const FR: Record<string, number> = { half: 1 / 2, 'one third': 1 / 3, 'one quarter': 1 / 4, 'one ninth': 1 / 9, 'one sixteenth': 1 / 16 };
  function judge(g: Generated, seed: number) {
    const msg = `seed ${seed}: ${g.stem}`;
    const isMean = g.stem.includes('\\bar y');
    const n = numAfter(g.stem, /\$n=/);
    const C = confOf(g.stem);
    const [L, U] = bounds(g.stem);
    let critAt: (c: number) => number;
    let x = 0;
    if (isMean) {
      const ybar = numAfter(g.stem, /\\bar y=/);
      const s = numAfter(g.stem, /\$s=/);
      critAt = (c) => crit(c, rowFor(n - 1));
      const se = s / Math.sqrt(n);
      expect(Math.abs(L - (ybar - critAt(C) * se)), msg).toBeLessThan(0.0051 + 0.0016 * se);
      expect(Math.abs(U - (ybar + critAt(C) * se)), msg).toBeLessThan(0.0051 + 0.0016 * se);
    } else {
      x = numAfter(g.stem, /Of them, /);
      const ph = x / n;
      critAt = (c) => crit(c, Infinity);
      const se = Math.sqrt((ph * (1 - ph)) / n);
      expect(Math.abs(L - (ph - critAt(C) * se)), msg).toBeLessThan(0.0006);
      expect(Math.abs(U - (ph + critAt(C) * se)), msg).toBeLessThan(0.0006);
    }
    return (t: string): boolean => {
      let m: RegExpExecArray | null;
      if (/new random sample/.test(t)) return false;
      if (/^We can be \d+% confident that the (mean|proportion) /.test(t)) return true;
      if (/repeated many times, about \d+% of the resulting intervals would contain/.test(t)) return true;
      if (/probability that the sample (mean|proportion) of this study/.test(t)) return false;
      if (/^\d+% of all possible samples/.test(t)) return false;
      if (/in the sample had a /.test(t)) return false;
      if (/^Between [\d.]+% and [\d.]+% of the \d+ .* in the sample/.test(t)) return false;
      if ((m = /^A (\d+)% confidence interval computed from the same data would be (wider|narrower)/.exec(t))) return critAt(Number(m[1]) / 100) > critAt(C) === (m[2] === 'wider');
      if (/^\d+% of /.test(t)) return false;
      if ((m = /^Choosing a lower confidence level.* narrower interval, (but|and) intervals made this way would miss the .* (more|less) often/.exec(t))) return m[2] === 'more';
      if ((m = /random sample (\d+) times as large .* about (.+?) as large/.exec(t))) {
        const k = Number(m[1]);
        const ratio = isMean ? crit(C, rowFor(k * n - 1)) / (critAt(C) * Math.sqrt(k)) : 1 / Math.sqrt(k);
        const nearest = Object.entries(FR).sort((a, b) => Math.abs(a[1] - ratio) - Math.abs(b[1] - ratio))[0][0];
        return nearest === m[2];
      }
      if ((m = /margin of error of this interval is (\d+(?:\.\d+)?)/.exec(t))) return Math.abs(Number(m[1]) - (U - L) / 2) < 1e-6;
      if ((m = /^([\d.]+) is (not )?a plausible value/.exec(t))) return (Number(m[1]) >= L && Number(m[1]) <= U) !== !!m[2];
      if ((m = /t\$-distribution with (\d+) degrees of freedom/.exec(t))) return isMean && Number(m[1]) === n - 1;
      if ((m = /Success\/Failure condition holds: the sample has (\d+) successes and (\d+) failures/.exec(t)))
        return !isMean && Number(m[1]) === x && Number(m[2]) === n - x && Math.min(x, n - x) >= 10;
      if (/only valid if the Success\/Failure condition/.test(t)) return !isMean;
      if (/^Take a larger random sample/.test(t)) return true;
      if (/^Take a smaller random sample/.test(t)) return false;
      if (/^Lower the confidence level.*more often/.test(t)) return true;
      if (/^Lower the confidence level.*less likely/.test(t)) return false;
      if (/^Raise the confidence level/.test(t)) return false;
      throw new Error(`unknown statement: ${t}`);
    };
  }
  for (const type of ['single-choice', 'multi-select'] as GenType[])
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('interpretation', seed, type);
        const truth = judge(g, seed);
        const want = g.options!.filter((o) => truth(o.text!)).map((o) => o.id);
        if (type === 'single-choice') expect(want, `seed ${seed}: ${g.stem}\n${g.options!.map((o) => o.text).join('\n')}`).toEqual([g.correctAnswer]);
        else expect(g.correctAnswer, `seed ${seed}: ${g.stem}\n${g.options!.map((o) => o.text).join('\n')}`).toEqual(want);
      }
    });
});
