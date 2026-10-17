// Independent checks for the "Random variables & binomial" templates. Nothing is taken from the generator's formulas:
// - probability tables are read back from the printed table (a missing "?" is filled in so the total is 1) and turned
//   into a population of 100 units, whose plain average / spread / counts give E(X), SD(X), Var(X) and P(X op k);
//   multi-select statements are decoded with regular expressions and judged against that population;
// - games are replayed by enumerating all 36 dice outcomes (or 8 coin outcomes) with this file's own rules for the
//   printed winning conditions, prizes and stake;
// - sums of independent variables are recomputed by replacing every variable (and every independent copy) by a
//   two-point distribution μ ± σ with the printed moments and enumerating all combinations of the printed formula;
// - exact binomial questions by enumerating all 2^n success/failure sequences; Normal approximations with this
//   file's own Simpson integration of the Normal density (at the Table Z z and at the exact z), plus a sanity check
//   against the exact binomial tail.
import { describe, expect, it } from 'vitest';
import { makeRng } from '../rng';
import type { GenType, Generated } from '../types';
import { TEMPLATES } from './random-variables-binomial';

const SEEDS = 250;
const byId = (id: string) => TEMPLATES.find((t) => t.id === id)!;
const gen = (id: string, seed: number, type: GenType) => byId(id).generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });
const question = (g: Generated) => g.stem.split('\n\n').pop()!;
const half = (text: string) => 0.5 * 10 ** -((/\.(\d+)/.exec(text)?.[1].length) ?? 0) + 1e-9;

/** Would the app accept this typed numeric answer (tolerance around the key, or the accepted range)? */
const accepts = (g: Generated, x: number) =>
  Math.abs(x - (g.correctAnswer as number)) <= g.tolerance! + 1e-12 || (!!g.acceptRange && x >= g.acceptRange[0] - 1e-12 && x <= g.acceptRange[1] + 1e-12);
/** Round half away from zero, as students do by hand. */
const handRound = (x: number, dp: number) => (Math.sign(x) * Math.round(Math.abs(x) * 10 ** dp + 1e-9)) / 10 ** dp;

/** Numeric answer within its tolerance; for single-choice, an option is right exactly when it is the key. */
function checkValue(g: Generated, exact: number, read: (text: string) => number = Number) {
  if (g.type === 'numeric') {
    expect(Math.abs((g.correctAnswer as number) - exact), `${g.correctAnswer} vs ${exact}\n${g.stem}`).toBeLessThanOrEqual(g.tolerance! + 1e-12);
    return;
  }
  for (const o of g.options!) {
    const v = read(o.text!);
    expect(Number.isFinite(v), o.text).toBe(true);
    expect(Math.abs(v - exact) <= half(o.text!), `${o.id} ${o.text} vs ${exact} (key ${g.correctAnswer})\n${g.stem}`).toBe(o.id === g.correctAnswer);
  }
}

// ---------- 1. probability table ----------

function population(g: Generated) {
  const t = g.table!;
  const xs = t.header!.slice(1).map(Number);
  const cells = t.rows[0].slice(1);
  const known = cells.filter((c) => c !== '?').map((c) => Math.round(Number(c) * 100));
  const missing = 100 - known.reduce((a, b) => a + b, 0);
  expect(cells.filter((c) => c === '?').length <= 1).toBe(true);
  if (!cells.includes('?')) expect(missing).toBe(0);
  const pop: number[] = [];
  cells.forEach((c, i) => {
    const cnt = c === '?' ? missing : Math.round(Number(c) * 100);
    expect(cnt).toBeGreaterThan(0);
    for (let k = 0; k < cnt; k++) pop.push(xs[i]);
  });
  expect(pop.length).toBe(100);
  const mean = pop.reduce((a, b) => a + b, 0) / 100;
  const vr = pop.reduce((a, x) => a + (x - mean) ** 2, 0) / 100;
  const P = (op: string, k: number) => pop.filter((x) => (op === '\\ge' ? x >= k : op === '\\le' ? x <= k : op === '>' ? x > k : x < k)).length / 100;
  const counts = xs.map((x) => pop.filter((y) => y === x).length);
  const top = Math.max(...counts);
  const mode = counts.filter((c) => c === top).length === 1 ? xs[counts.indexOf(top)] : NaN;
  const tops = xs.filter((_, i) => counts[i] === top);
  return { mean, vr, sd: Math.sqrt(vr), P, mode, tops, missing: missing / 100, hasMissing: cells.includes('?') };
}

const WORD: Record<string, string> = { '\\ge': 'at least', '\\le': 'at most', '>': 'more than', '<': 'less than' };

describe('random-variables-binomial.distribution-table: a population of 100 built from the printed table', () => {
  for (const type of ['single-choice', 'numeric'] as const) {
    it(type, () => {
      const kinds = new Set<string>();
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('random-variables-binomial.distribution-table', seed, type);
        const d = population(g);
        const q = question(g);
        let exact: number;
        let m: RegExpExecArray | null;
        if (/\$E\(X\)\$/.test(q)) {
          exact = d.mean;
          kinds.add('mean');
        } else if (/\\text\{SD\}\(X\)/.test(q)) {
          exact = d.sd;
          kinds.add('sd');
        } else if ((m = /\$P\(X(\\ge |\\le |>|<)(\d+)\)\$/.exec(q))) {
          const op = m[1].trim();
          expect(q).toContain(`is ${WORD[op]} ${m[2]}`);
          exact = d.P(op, Number(m[2]));
          kinds.add(op);
        } else throw new Error(`unknown question: ${q}`);
        checkValue(g, exact);
      }
      expect(kinds.size).toBe(6);
    });
  }

  it('multi-select: every statement decoded and judged against the population', () => {
    let trues = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('random-variables-binomial.distribution-table', seed, 'multi-select');
      const d = population(g);
      const close = (v: number, exact: number) => {
        const diff = Math.abs(v - exact);
        expect(diff <= 0.005 + 1e-9 || diff >= 0.009, `ambiguous ${v} vs ${exact}`).toBe(true);
        return diff <= 0.005 + 1e-9;
      };
      const truth = g.options!.map((o) => {
        const s = o.text!;
        let m: RegExpExecArray | null;
        if ((m = /^\$E\(X\)=([\d.]+)\$$/.exec(s))) return close(Number(m[1]), d.mean);
        if ((m = /^\$\\text\{SD\}\(X\)=([\d.]+)\$$/.exec(s))) return close(Number(m[1]), d.sd);
        if ((m = /^\$\\text\{Var\}\(X\)=([\d.]+)\$$/.exec(s))) return close(Number(m[1]), d.vr);
        if ((m = /^\$P\(X(\\ge |\\le |>|<)(\d+)\)=([\d.]+)\$$/.exec(s))) return close(Number(m[3]), d.P(m[1].trim(), Number(m[2])));
        if ((m = /^The most likely value of \$X\$ is \$(\d+)\$\.$/.exec(s))) {
          // with a tie for the largest probability, no statement may name one of the tied values (true or false would be debatable)
          if (Number.isNaN(d.mode)) expect(d.tops, s).not.toContain(Number(m[1]));
          return Number(m[1]) === d.mode;
        }
        if ((m = /^The missing probability in the table is ([\d.]+)\.$/.exec(s))) {
          expect(d.hasMissing).toBe(true);
          return close(Number(m[1]), d.missing);
        }
        throw new Error(`unknown statement: ${s}`);
      });
      const key = g.options!.filter((_, i) => truth[i]).map((o) => o.id);
      trues += key.length;
      expect(key, g.options!.map((o) => o.text).join(' | ')).toEqual(g.correctAnswer);
    }
    expect(trues).toBeGreaterThan(SEEDS);
  });
});

// ---------- 2. games ----------

const DICE_RULES: Record<string, (a: number, b: number) => boolean> = {
  'both dice show a six': (a, b) => a === 6 && b === 6,
  'the two dice show the same number': (a, b) => a === b,
  'the sum of the two dice is 7': (a, b) => a + b === 7,
  'the sum of the two dice is at least 10': (a, b) => a + b >= 10,
  'the sum of the two dice is 2 or 12': (a, b) => a + b === 2 || a + b === 12,
  'at least one die shows a six': (a, b) => a === 6 || b === 6,
  'the sum of the two dice is 11': (a, b) => a + b === 11,
  'both dice show an even number': (a, b) => a % 2 === 0 && b % 2 === 0,
};
const COIN_RULES: Record<string, (heads: number) => boolean> = {
  'all three coins show heads': (h) => h === 3,
  'exactly two coins show heads': (h) => h === 2,
  'no coin shows heads': (h) => h === 0,
  'all three coins show the same side': (h) => h === 0 || h === 3,
};

describe('random-variables-binomial.expected-gain: the game replayed over all outcomes', () => {
  for (const type of ['single-choice', 'numeric'] as const) {
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('random-variables-binomial.expected-gain', seed, type);
        const intro = g.stem.split('\n\n')[0];
        const rules = [...intro.matchAll(/[Ii]f ([^;,]+), the player wins €([\d.]+)/g)].map((m) => ({ cond: m[1], prize: Number(m[2]) }));
        expect(rules.length).toBeGreaterThanOrEqual(1);
        const cost = Number(/costs €([\d.]+)/.exec(intro)![1]);
        const outcomes: ((c: string) => boolean)[] = [];
        if (intro.includes('Two fair dice are rolled.')) {
          for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) outcomes.push((c) => DICE_RULES[c](a, b));
        } else {
          expect(intro).toContain('Three fair coins are tossed.');
          for (let m = 0; m < 8; m++) outcomes.push((c) => COIN_RULES[c]((m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1)));
        }
        let total = 0;
        for (const o of outcomes) {
          const won = rules.filter((r) => o(r.cond));
          expect(won.length, 'winning conditions must not overlap').toBeLessThanOrEqual(1);
          total += (won[0]?.prize ?? 0) - cost;
        }
        const exact = total / outcomes.length;
        expect(Math.max(...rules.map((r) => r.prize)), 'the main prize exceeds the stake').toBeGreaterThan(cost);
        if (type === 'numeric') {
          expect(accepts(g, handRound(exact, 2)), `${handRound(exact, 2)} not accepted (key ${g.correctAnswer})`).toBe(true);
          // the key shown to the student is the hand-rounded value ("loses about €2.38" for −2.375, not −2.37)
          expect(g.correctAnswer, `seed ${seed}: exact ${exact}`).toBe(handRound(exact, 2));
        }
        checkValue(g, exact, (text) => {
          const m = /^The player (gains|loses) about €([\d.]+) per game\.$/.exec(text)!;
          return (m[1] === 'gains' ? 1 : -1) * Number(m[2]);
        });
      }
    });
  }
});

// ---------- 3. sums of independent variables ----------

function linearTerms(formula: string) {
  const s = formula.replace(/\s+/g, '');
  const terms: { coef: number; v?: string }[] = [];
  const re = /([+-]?)(\d+(?:\.\d+)?)?([A-Z](?:_\d+)?)?/y;
  let pos = 0;
  while (pos < s.length) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m || m[0] === '' || (!m[2] && !m[3])) throw new Error(`cannot parse ${formula} at ${pos}`);
    pos = re.lastIndex;
    const c = (m[1] === '-' ? -1 : 1) * (m[2] ? Number(m[2]) : 1);
    terms.push(m[3] ? { coef: c, v: m[3] } : { coef: c });
  }
  return terms;
}

describe('random-variables-binomial.sum-of-variables: two-point distributions μ ± σ enumerated over the printed formula', () => {
  for (const type of ['single-choice', 'numeric'] as const) {
    it(type, () => {
      const formulas = new Set<string>();
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('random-variables-binomial.sum-of-variables', seed, type);
        const moments = Object.fromEntries(g.table!.rows.map((r) => [r[0], { mean: Number(r[2]), sd: Number(r[3]) }]));
        const [, , formula] = /\$([A-Z]) = (.+?)\$/.exec(question(g))!;
        const terms = linearTerms(formula);
        const random = terms.filter((t) => t.v);
        const constant = terms.filter((t) => !t.v).reduce((a, t) => a + t.coef, 0);
        if (random.length > 1) expect(g.stem).toMatch(/independent/);
        formulas.add(formula.replace(/[\d.]+/g, '#').replace(/_#/g, ''));
        const vals: number[] = [];
        for (let mask = 0; mask < 2 ** random.length; mask++) {
          let v = constant;
          random.forEach((t, i) => {
            const mo = moments[t.v!.replace(/_\d+$/, '')];
            expect(mo, t.v).toBeDefined();
            v += t.coef * (mo.mean + ((mask >> i) & 1 ? 1 : -1) * mo.sd);
          });
          vals.push(v);
        }
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const sd = Math.sqrt(vals.reduce((a, x) => a + (x - mean) ** 2, 0) / vals.length);
        // sensible numbers: totals, differences, bills and revenues all have a positive mean here
        expect(mean, `seed ${seed}: ${formula}`).toBeGreaterThan(1);
        if (type === 'numeric') {
          const [fm, fs] = g.fields!;
          expect(Math.abs(fm.answer - mean)).toBeLessThanOrEqual(fm.tolerance! + 1e-9);
          expect(Math.abs(fs.answer - sd)).toBeLessThanOrEqual(fs.tolerance! + 1e-9);
          continue;
        }
        for (const o of g.options!) {
          const m = /^mean (-?[\d.]+) .+?, standard deviation ([\d.]+) /.exec(o.text!)!;
          expect(Number(m[2]), `seed ${seed}: a standard deviation of 0 is not a plausible option: ${o.text}`).toBeGreaterThan(0);
          const right = Math.abs(Number(m[1]) - mean) <= half(m[1]) && Math.abs(Number(m[2]) - sd) <= half(m[2]);
          expect(right, `${o.id} ${o.text}: mean ${mean}, sd ${sd}`).toBe(o.id === g.correctAnswer);
        }
      }
      expect(formulas.size).toBeGreaterThanOrEqual(5);
    });
  }
});

// ---------- 4. binomial ----------

/** Standard normal CDF by Simpson's rule on the density (independent of stats.ts). */
function phi(z: number): number {
  const a = -9;
  const n = 4000;
  const h = (z - a) / n;
  const f = (x: number) => Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
  let s = f(a) + f(z);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(a + i * h);
  return (s * h) / 3;
}

const KIND = (word: string, k: number) => (j: number) =>
  word === 'exactly' ? j === k : word === 'at most' ? j <= k : word === 'at least' ? j >= k : word === 'fewer than' ? j < k : j > k;

describe('random-variables-binomial.binomial: enumeration of all sequences / Simpson-integrated Normal model', () => {
  for (const type of ['single-choice', 'numeric'] as const) {
    it(type, () => {
      const seen = new Set<string>();
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('random-variables-binomial.binomial', seed, type);
        const q = question(g);
        const pcts = [...g.stem.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]) / 100);
        expect(pcts.length).toBe(1);
        const [, word, kText] = /\*\*(exactly|at most|at least|fewer than|more than) (\d+)\*\*/.exec(q)!;
        const k = Number(kText);
        const ints = [...g.stem.replace(/\*\*[^*]+\*\*/g, '').replace(/\d+(?:\.\d+)?%/g, '').matchAll(/(?<![\d.])(\d+)(?![\d.])/g)].map((m) => Number(m[1]));
        const n = ints[0];
        for (const x of ints) expect(x).toBe(n);
        const p = q.includes('**not**') ? 1 - pcts[0] : pcts[0];
        const inEvent = KIND(word, k);
        if (g.stem.includes('Normal model')) {
          seen.add(`normal ${word}`);
          const mu = n * p;
          const sigma = Math.sqrt(n * p * (1 - p));
          expect(mu >= 10 && n * (1 - p) >= 10).toBe(true);
          const tail = (z: number) => (word === 'at least' ? 1 - phi(z) : phi(z));
          const z = (k - mu) / sigma;
          // Table Z: z rounded to 2 decimals, probabilities printed with 4 decimals
          const printed = Math.round(phi(Math.round(z * 100) / 100) * 1e4) / 1e4;
          const table = word === 'at least' ? 1 - printed : printed;
          const exactZ = tail(z);
          // the course method rounds σ to 2 decimals before computing z: it must give the same Table Z entry
          const z2dp = (k - mu) / (Math.round(sigma * 100) / 100);
          expect(Math.round(z2dp * 100), `z with σ to 2 decimals: ${z2dp} vs ${z}`).toBe(Math.round(z * 100));
          // sanity: the Normal model is close to the exact binomial tail (iterative pmf, no stats.ts)
          let pmf = (1 - p) ** n;
          let exactBin = 0;
          for (let j = 0; j <= n; j++) {
            if (inEvent(j)) exactBin += pmf;
            pmf *= ((n - j) / (j + 1)) * (p / (1 - p));
          }
          expect(Math.abs(table - exactBin), `normal ${table} vs binomial ${exactBin}`).toBeLessThan(0.09);
          if (type === 'numeric') {
            const ans = g.correctAnswer as number;
            expect(Math.abs(ans - table)).toBeLessThanOrEqual(g.tolerance! + 1e-9);
            expect(exactZ >= g.acceptRange![0] && exactZ <= g.acceptRange![1], `${exactZ} in ${g.acceptRange}`).toBe(true);
          } else {
            for (const o of g.options!) {
              const v = Number(o.text);
              if (o.id === g.correctAnswer) expect(Math.abs(v - table)).toBeLessThanOrEqual(0.0005 + 1e-6);
              else {
                expect(Math.abs(v - table), `${o.text} vs ${table}`).toBeGreaterThan(0.0005);
                expect(Math.abs(v - exactZ), `${o.text} vs ${exactZ}`).toBeGreaterThan(0.0005);
              }
            }
          }
        } else {
          seen.add(`exact ${word}`);
          expect(n).toBeLessThanOrEqual(16);
          let exact = 0;
          const pj = new Array(n + 1).fill(0);
          for (let mask = 0; mask < 2 ** n; mask++) {
            let j = 0;
            let pr = 1;
            for (let b = 0; b < n; b++) {
              const hit = (mask >> b) & 1;
              j += hit;
              pr *= hit ? p : 1 - p;
            }
            pj[j] += pr;
            if (inEvent(j)) exact += pr;
          }
          checkValue(g, exact);
          if (type === 'numeric') {
            // the course method: every term rounded to 3 decimals, over the event or its complement (whichever is shorter)
            const inside = pj.map((_, j) => j).filter(inEvent);
            const outside = pj.map((_, j) => j).filter((j) => !inEvent(j));
            const terms = (js: number[]) => js.reduce((t, j) => t + handRound(pj[j], 3), 0);
            const hand = handRound(inside.length <= outside.length ? terms(inside) : 1 - terms(outside), 3);
            expect(accepts(g, hand), `course method ${hand} not accepted (key ${g.correctAnswer}, range ${g.acceptRange})`).toBe(true);
          }
        }
      }
      expect(seen.size).toBe(7);
    });
  }
});
