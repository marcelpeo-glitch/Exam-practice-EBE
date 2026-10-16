// Independent checks for the "Probability" templates. Nothing is taken from the generator's formulas:
// - contingency tables are parsed from the printed table, expanded into one record per counted unit, and every
//   probability is found by counting records (events read from the quoted labels in the printed question);
// - disjoint / independent / complementary are decided with exact integer arithmetic on the counts, and every
//   multi-select statement is decoded with regular expressions and judged against those counts;
// - tree questions are recomputed with natural frequencies (a population of 1,000,000 split by the printed percentages);
// - "at least one / none / all" questions by enumerating all 2^n outcomes of the n independent trials;
// - the addition-rule questions by building a population of 100 with the printed percentages and counting.
import { describe, expect, it } from 'vitest';
import { makeRng } from '../rng';
import type { GenType, Generated } from '../types';
import { TEMPLATES, TREE_SCENARIOS, VENN_SCENARIOS } from './probability';

const SEEDS = 250;
const byId = (id: string) => TEMPLATES.find((t) => t.id === id)!;
const gen = (id: string, seed: number, type: GenType) => byId(id).generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });
const question = (g: Generated) => g.stem.split('\n\n').pop()!;
const percents = (s: string) => [...s.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]) / 100);

/** The printed answer (numeric) or every printed option must be right exactly when it is the key. */
function checkProbability(g: Generated, exact: number) {
  if (g.type === 'numeric') {
    expect(Math.abs((g.correctAnswer as number) - exact), `${g.correctAnswer} vs ${exact}\n${g.stem}`).toBeLessThanOrEqual(g.tolerance! + 1e-12);
    return;
  }
  for (const o of g.options!) {
    const v = Number(o.text);
    expect(Number.isFinite(v), o.text).toBe(true);
    const dp = o.text!.split('.')[1]?.length ?? 0;
    const right = Math.abs(v - exact) <= 0.5 * 10 ** -dp + 1e-9;
    expect(right, `${o.id} ${o.text} vs exact ${exact} (key ${g.correctAnswer})\n${g.stem}`).toBe(o.id === g.correctAnswer);
  }
}

// ---------- contingency tables ----------

interface Rec {
  row: string;
  col: string;
}
function records(g: Generated) {
  const t = g.table!;
  const header = t.header!;
  const colIdx = header.map((h, k) => [h, k] as const).filter(([h, k]) => k > 0 && h !== 'Total');
  const recs: Rec[] = [];
  const rowLabels: string[] = [];
  for (const row of t.rows) {
    if (row[0] === 'Total') continue;
    rowLabels.push(row[0]);
    for (const [col, k] of colIdx) {
      const c = Number(row[k]);
      expect(Number.isInteger(c) && c >= 0).toBe(true);
      for (let x = 0; x < c; x++) recs.push({ row: row[0], col });
    }
  }
  const colLabels = colIdx.map(([h]) => h);
  expect(new Set([...rowLabels, ...colLabels]).size).toBe(rowLabels.length + colLabels.length);
  // printed totals (if any) must agree with the cells
  const totalRow = t.rows.find((r) => r[0] === 'Total');
  if (totalRow) expect(Number(totalRow[totalRow.length - 1])).toBe(recs.length);
  // the number of units in the introduction is the table total
  expect(Number(/(\d+)/.exec(g.stem)![1])).toBe(recs.length);
  const known = new Set([...rowLabels, ...colLabels]);
  const ev = (label: string) => {
    if (!known.has(label)) throw new Error(`label '${label}' is not in the table`);
    return (r: Rec) => r.row === label || r.col === label;
  };
  const count = (f: (r: Rec) => boolean) => recs.filter(f).length;
  return { recs, N: recs.length, ev, count };
}

describe('probability.table-conditional: probabilities by counting the table records', () => {
  for (const type of ['single-choice', 'numeric'] as const) {
    it(type, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('probability.table-conditional', seed, type);
        const { N, ev, count } = records(g);
        const q = question(g);
        const labels = [...q.matchAll(/'([^']+)'/g)].map((m) => m[1]);
        expect(labels.length, q).toBe(2);
        const [e1, e2] = labels.map(ev);
        let exact: number;
        if (/'[^']+' or '[^']+'/.test(q)) exact = count((r) => e1(r) || e2(r)) / N;
        else if (/both '[^']+' and '[^']+'/.test(q)) exact = count((r) => e1(r) && e2(r)) / N;
        else {
          const given = /(?:[Gg]iven|Among)[^']*'([^']+)'/.exec(q)![1];
          const target = labels.find((l) => l !== given)!;
          const [eg, et] = [ev(given), ev(target)];
          exact = count((r) => eg(r) && et(r)) / count(eg);
        }
        checkProbability(g, exact);
      }
    });
  }
});

describe('probability.disjoint-independent: judged with exact integer arithmetic on the counts', () => {
  const setup = (g: Generated) => {
    const { N, ev, count } = records(g);
    const [, a, b] = /events '([^']+)' and '([^']+)'/.exec(question(g))!;
    const both = (x: string, y: string) => {
      const [ex, ey] = [ev(x), ev(y)];
      return count((r) => ex(r) && ey(r));
    };
    const disjoint = (x: string, y: string) => both(x, y) === 0;
    const independent = (x: string, y: string) => both(x, y) * N === count(ev(x)) * count(ev(y));
    return { N, ev, count, a, b, both, disjoint, independent };
  };

  it('single-choice: the key is the only correct description', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('probability.disjoint-independent', seed, 'single-choice');
      const { N, count, ev, a, b, disjoint, independent } = setup(g);
      const [ea, eb] = [ev(a), ev(b)];
      const complementary = disjoint(a, b) && count((r) => ea(r) || eb(r)) === N;
      for (const o of g.options!) {
        let truth: boolean;
        if (o.text!.startsWith('Complementary')) truth = complementary;
        else {
          const m = /^(Disjoint|Not disjoint) (?:and|but) (not independent|independent)$/.exec(o.text!)!;
          expect(m, o.text).not.toBeNull();
          truth = (m[1] === 'Disjoint') === disjoint(a, b) && (m[2] === 'independent') === independent(a, b);
        }
        expect(truth, `${o.id} ${o.text}`).toBe(o.id === g.correctAnswer);
      }
    }
  });

  it('multi-select: every statement decoded and judged; the key is exactly the true ones', () => {
    let trueSeen = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('probability.disjoint-independent', seed, 'multi-select');
      const { N, count, ev, both, disjoint, independent } = setup(g);
      const close = (v: number, exact: number) => {
        const d = Math.abs(v - exact);
        expect(d <= 0.005 + 1e-9 || d >= 0.009, `ambiguous statement value ${v} vs ${exact}`).toBe(true);
        return d <= 0.005 + 1e-9;
      };
      const truths = g.options!.map((o) => {
        const s = o.text!;
        let m: RegExpExecArray | null;
        if ((m = /^'(.+)' and '(.+)' are (not )?disjoint\.$/.exec(s))) return disjoint(m[1], m[2]) === !m[3];
        if ((m = /^'(.+)' and '(.+)' are (not )?independent\.$/.exec(s))) return independent(m[1], m[2]) === !m[3];
        if ((m = /^\$P\(\\text\{(.+?)\} \\mid \\text\{(.+?)\}\)=([\d.]+)\$$/.exec(s))) return close(Number(m[3]), both(m[1], m[2]) / count(ev(m[2])));
        if ((m = /^\$P\(\\text\{(.+?)\}\\text\{ and \}\\text\{(.+?)\}\)=([\d.]+)\$$/.exec(s))) return close(Number(m[3]), both(m[1], m[2]) / N);
        if ((m = /^\$P\(\\text\{(.+?)\}\\text\{ or \}\\text\{(.+?)\}\)=([\d.]+)\$$/.exec(s))) {
          const [e1, e2] = [ev(m[1]), ev(m[2])];
          return close(Number(m[3]), count((r) => e1(r) || e2(r)) / N);
        }
        if ((m = /^\$P\(\\text\{(.+?)\}\)=([\d.]+)\$$/.exec(s))) return close(Number(m[2]), count(ev(m[1])) / N);
        if ((m = /^The proportion of '(.+?)' is (higher|lower|the same) among '(.+?)' .+? (?:than|as) among '(.+?)' /.exec(s))) {
          const lhs = both(m[1], m[3]) * count(ev(m[4]));
          const rhs = both(m[1], m[4]) * count(ev(m[3]));
          return m[2] === 'higher' ? lhs > rhs : m[2] === 'lower' ? lhs < rhs : lhs === rhs;
        }
        throw new Error(`unknown statement: ${s}`);
      });
      const key = g.options!.filter((_, k) => truths[k]).map((o) => o.id);
      trueSeen += key.length;
      expect(key, g.options!.map((o) => o.text).join(' | ')).toEqual(g.correctAnswer);
    }
    expect(trueSeen).toBeGreaterThan(SEEDS);
  });
});

// ---------- tree diagrams ----------

describe('probability.tree-bayes: natural frequencies in a population of 1,000,000', () => {
  for (const type of ['single-choice', 'numeric'] as const) {
    it(type, () => {
      const kinds = new Set<string>();
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('probability.tree-bayes', seed, type);
        const intro = g.stem.split('\n\n')[0];
        const ps = percents(intro);
        expect(ps.length, intro).toBe(3);
        const pText = [...intro.matchAll(/(\d+(?:\.\d+)?%)/g)].map((m) => m[1]);
        const sc = TREE_SCENARIOS.find((s) => s.intro(pText[0], pText[1], pText[2]) === intro)!;
        expect(sc, intro).toBeDefined();
        const N = 1_000_000;
        const nA = Math.round(N * ps[0]);
        const nAB = Math.round(nA * ps[1]);
        const nAcB = Math.round((N - nA) * ps[2]);
        const nB = nAB + nAcB;
        const q = question(g);
        let exact: number;
        if (q.includes(`randomly selected ${sc.unit} ${sc.notB}. `)) {
          exact = (nA - nAB) / (N - nB);
          kinds.add('bayesNot');
        } else if (q.includes(`randomly selected ${sc.unit} ${sc.B}. `)) {
          exact = nAB / nB;
          kinds.add('bayes');
        } else {
          expect(q).toContain(`randomly selected ${sc.unit} ${sc.B}?`);
          exact = nB / N;
          kinds.add('total');
        }
        if (q.includes('. What')) expect(q).toContain(`this ${sc.unit} ${sc.A}?`);
        checkProbability(g, exact);
      }
      expect(kinds.size).toBe(3);
    });
  }
});

// ---------- complement rule and addition rule ----------

describe('probability.rules: enumeration of independent trials and counting a population of 100', () => {
  for (const type of ['single-choice', 'numeric'] as const) {
    it(type, () => {
      const kinds = new Set<string>();
      for (let seed = 1; seed <= SEEDS; seed++) {
        const g = gen('probability.rules', seed, type);
        const intro = g.stem.split('\n\n')[0];
        const q = question(g);
        const ps = percents(intro);
        let exact: number;
        if (ps.length === 1) {
          const p = ps[0];
          const ints = [...g.stem.replace(/\d+(?:\.\d+)?%/g, '').matchAll(/(?<![\d.])(\d+)(?![\d.])/g)].map((m) => Number(m[1]));
          expect(ints.length).toBeGreaterThanOrEqual(2);
          const n = ints[0];
          for (const x of ints) expect(x).toBe(n);
          const quant = /\*\*(at least one|none|all)\*\*/.exec(q)![1];
          let s = 0;
          for (let mask = 0; mask < 2 ** n; mask++) {
            let k = 0;
            let pr = 1;
            for (let b = 0; b < n; b++) {
              const hit = (mask >> b) & 1;
              k += hit;
              pr *= hit ? p : 1 - p;
            }
            if (quant === 'at least one' ? k >= 1 : quant === 'none' ? k === 0 : k === n) s += pr;
          }
          exact = s;
          kinds.add(quant);
        } else {
          expect(ps.length).toBe(3);
          const pText = [...intro.matchAll(/(\d+%)/g)].map((m) => m[1]);
          const sc = VENN_SCENARIOS.find((s) => s.intro(pText[0], pText[1], pText[2]) === intro)!;
          expect(sc, intro).toBeDefined();
          const [a, b, ab] = ps.map((x) => Math.round(x * 100));
          const pop: { A: boolean; B: boolean }[] = [];
          for (let k = 0; k < 100; k++) pop.push({ A: k < a, B: k < ab || (k >= a && k < a + b - ab) });
          expect(pop.filter((x) => x.A).length).toBe(a);
          expect(pop.filter((x) => x.B).length).toBe(b);
          expect(pop.filter((x) => x.A && x.B).length).toBe(ab);
          const frac = (f: (x: { A: boolean; B: boolean }) => boolean, given: (x: { A: boolean; B: boolean }) => boolean = () => true) =>
            pop.filter((x) => given(x) && f(x)).length / pop.filter(given).length;
          if (q.includes('**or**')) {
            expect(q).toContain(`${sc.A} **or** ${sc.B}`);
            exact = frac((x) => x.A || x.B);
            kinds.add('or');
          } else if (q.includes('**neither**')) {
            expect(q).toContain(`does not ${sc.baseA} and does not ${sc.baseB}`);
            exact = frac((x) => !x.A && !x.B);
            kinds.add('neither');
          } else if (q.includes(' but does **not** ')) {
            expect(q).toContain(`${sc.A} but does **not** ${sc.baseB}`);
            exact = frac((x) => x.A && !x.B);
            kinds.add('onlyA');
          } else if (q.includes('does **not**')) {
            expect(q.startsWith(`A randomly chosen ${sc.unit} ${sc.A}. `), q).toBe(true);
            expect(q).toContain(`does **not** ${sc.baseB}?`);
            exact = frac((x) => !x.B, (x) => x.A);
            kinds.add('notB|A');
          } else {
            expect(q.startsWith(`A randomly chosen ${sc.unit} ${sc.B}. `), q).toBe(true);
            expect(q).toContain(`also ${sc.A}?`);
            exact = frac((x) => x.A, (x) => x.B);
            kinds.add('A|B');
          }
        }
        checkProbability(g, exact);
      }
      expect(kinds.size).toBeGreaterThanOrEqual(7);
    });
  }
});
