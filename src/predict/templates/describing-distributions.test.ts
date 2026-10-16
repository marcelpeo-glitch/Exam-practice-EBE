// Independent checks for the "Describing distributions" templates. Nothing is taken from the generator's internals:
// - figures are decoded from their SVG data URIs (and checked to be well-formed: browsers refuse an <img> SVG with a
//   duplicate attribute), bar heights / box edges / whisker caps are converted back to data values via the printed
//   axis ticks, and the statistics are recomputed here (own SD and quartile code, own 1.5 × IQR rule);
// - summary tables are parsed and the z-score / value / fence is recomputed from the printed numbers;
// - histogram classes of the median and quartiles are found by filling every class with random values (seeded rng)
//   and computing the median / quartiles of that raw data with stats.ts, for several fillings;
// - boxplot statements are decoded with regular expressions and judged against the boxplots read from the figure.
import { describe, expect, it } from 'vitest';
import { makeRng } from '../rng';
import { median, quartiles } from '../stats';
import type { GenType, Generated } from '../types';
import { TEMPLATES } from './describing-distributions';

const SEEDS = 250;
const byId = (id: string) => TEMPLATES.find((t) => t.id === id)!;
const gen = (id: string, seed: number, type: GenType) => byId(id).generate({ rng: makeRng(seed), type, optionCount: seed % 2 ? 5 : 4 });

// ---------- SVG reading ----------

const svgOf = (src: string) => {
  expect(src.startsWith('data:image/svg+xml;utf8,')).toBe(true);
  const svg = decodeURIComponent(src.slice(src.indexOf(',') + 1));
  for (const m of svg.matchAll(/<(\w+)((?:\s+[\w-]+="[^"]*")*)\s*\/?>/g)) {
    const names = [...m[2].matchAll(/([\w-]+)="/g)].map((x) => x[1]);
    expect(new Set(names).size, `duplicate attribute in <${m[1]}${m[2]}>`).toBe(names.length);
  }
  expect((svg.match(/<text\b/g) ?? []).length).toBe((svg.match(/<\/text>/g) ?? []).length);
  return svg;
};
interface El {
  a: Record<string, number>;
  text: string;
}
function els(svg: string, tag: string, cls: string): El[] {
  const re = new RegExp(`<${tag}\\s([^>]*?)(?:/>|>([^<]*)</${tag}>)`, 'g');
  return [...svg.matchAll(re)]
    .map((m) => ({ raw: Object.fromEntries([...m[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((x) => [x[1], x[2]])), text: m[2] ?? '' }))
    .filter((e) => e.raw.class === cls)
    .map((e) => ({ a: Object.fromEntries(Object.entries(e.raw).map(([k, v]) => [k, Number(v)])), text: e.text }));
}
/** value(y) from the printed tick labels (linear axis). */
function axis(svg: string) {
  const t = els(svg, 'text', 'yt').map((e) => ({ y: e.a.y, v: Number(e.text) }));
  expect(t.length).toBeGreaterThanOrEqual(2);
  const [p, q] = [t[0], t[t.length - 1]];
  const per = (q.v - p.v) / (q.y - p.y);
  return { at: (y: number) => p.v + (y - p.y) * per, len: (h: number) => Math.abs(h * per) };
}

/** Panels of a small-multiples figure: name, values (x labels) and counts read from the bar heights. */
function readPanels(src: string) {
  const parts = svgOf(src).split('<g class="panel">').slice(1);
  return parts.map((p) => {
    const ax = axis(p);
    const name = /class="pt"[^>]*>Histogram ([^<]+)</.exec(p)![1];
    const values = els(p, 'text', 'xt').map((e) => Number(e.text));
    const counts = els(p, 'rect', 'bar').map((e) => ax.len(e.a.height));
    for (const c of counts) expect(Math.abs(c - Math.round(c))).toBeLessThan(0.02);
    return { name, values, counts: counts.map(Math.round) };
  });
}

interface ReadBox {
  name: string;
  lo: number;
  q1: number;
  med: number;
  q3: number;
  hi: number;
  out: number[];
}
function readBoxes(src: string): ReadBox[] {
  const svg = svgOf(src);
  const ax = axis(svg);
  return svg
    .split('<g class="bp">')
    .slice(1)
    .map((g) => {
      const caps = els(g, 'line', 'cap').map((e) => ax.at(e.a.y1));
      const box = els(g, 'rect', 'box')[0].a;
      const r = (x: number) => Math.round(x * 100) / 100; // pixel coordinates carry 2 decimals
      return {
        name: /class="gl"[^>]*>([^<]+)</.exec(g)![1],
        lo: r(Math.min(...caps)),
        hi: r(Math.max(...caps)),
        q3: r(ax.at(box.y)),
        q1: r(ax.at(box.y + box.height)),
        med: r(ax.at(els(g, 'line', 'med')[0].a.y1)),
        out: els(g, 'circle', 'out').map((e) => r(ax.at(e.a.cy))),
      };
    });
}

// ---------- own statistics ----------

const data = (values: number[], counts: number[]) => counts.flatMap((c, i) => Array<number>(c).fill(values[i]));
function ownSd(xs: number[]) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}
function med(sorted: number[]) {
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}
/** Five-number summary with the course-book quartiles and whisker ends / outliers from the 1.5 × IQR rule. */
function ownBox(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const h = Math.floor(s.length / 2);
  const q1 = med(s.slice(0, h));
  const q3 = med(s.slice(s.length - h));
  const iqr = q3 - q1;
  const inside = s.filter((x) => x >= q1 - 1.5 * iqr && x <= q3 + 1.5 * iqr);
  return { lo: inside[0], q1, med: med(s), q3, hi: inside[inside.length - 1], out: [...new Set(s.filter((x) => !inside.includes(x)))] };
}
const sameBox = (a: ReturnType<typeof ownBox>, b: ReadBox) =>
  [a.lo - b.lo, a.q1 - b.q1, a.med - b.med, a.q3 - b.q3, a.hi - b.hi].every((d) => Math.abs(d) < 0.01) && a.out.length === b.out.length && a.out.every((o) => b.out.some((p) => Math.abs(o - p) < 0.01));

// ---------- 1. spread & matching ----------

function matchFromFigures(g: Generated): Record<string, number> {
  const panels = readPanels(g.images![0].src);
  const boxes = readBoxes(g.images![1].src);
  expect(panels.length).toBe(3);
  expect(boxes.length).toBe(3);
  const out: Record<string, number> = {};
  for (const p of panels) {
    const b = ownBox(data(p.values, p.counts));
    const hits = boxes.filter((x) => sameBox(b, x));
    expect(hits.length, `histogram ${p.name}`).toBe(1);
    out[p.name] = Number(hits[0].name.replace('Boxplot ', ''));
  }
  return out;
}

describe('describing-distributions.spread-histograms', () => {
  it('single-choice: SDs and the histogram-boxplot match are recomputed from the figures', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('describing-distributions.spread-histograms', seed, 'single-choice');
      if (/boxplot belongs/.test(g.stem)) {
        kinds.add('match');
        const m = matchFromFigures(g);
        const want = ['(a)', '(b)', '(c)'].map((h) => `${h} with boxplot ${m[h]}`).join(', ');
        for (const o of g.options!) expect(o.text === want, `seed ${seed} ${o.text}`).toBe(o.id === g.correctAnswer);
        continue;
      }
      const panels = readPanels(g.images![0].src);
      const sets = panels.map((p) => data(p.values, p.counts));
      expect(new Set(sets.map((s) => s.length)).size, 'same n').toBe(1);
      for (const s of sets) expect(Math.abs(s.reduce((a, b) => a + b, 0) / s.length - 3)).toBeLessThan(1e-9);
      for (const s of sets) expect(Math.min(...s) === 1 && Math.max(...s) === 5, 'same range').toBe(true);
      const sds = panels.map((p, i) => ({ name: p.name, sd: ownSd(sets[i]) }));
      const sorted = [...sds].sort((a, b) => a.sd - b.sd);
      for (let i = 1; i < sorted.length; i++) expect(sorted[i].sd / sorted[i - 1].sd).toBeGreaterThan(1.1);
      if (/^Order/m.test(g.stem)) {
        kinds.add('order');
        const want = sorted.map((s) => s.name).join(' < ');
        for (const o of g.options!) expect(o.text === want, `seed ${seed} ${o.text}`).toBe(o.id === g.correctAnswer);
      } else {
        const largest = /largest standard deviation/.test(g.stem);
        kinds.add(largest ? 'largest' : 'smallest');
        const want = `Data set ${(largest ? sorted[sorted.length - 1] : sorted[0]).name}`;
        for (const o of g.options!) expect(o.text === want, `seed ${seed} ${o.text}`).toBe(o.id === g.correctAnswer);
      }
    }
    expect(kinds.size).toBe(4);
  });
  it('matching: each histogram is paired with the boxplot of its own data', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('describing-distributions.spread-histograms', seed, 'matching');
      const m = matchFromFigures(g);
      const key = g.correctAnswer as Record<string, string>;
      for (const p of g.prompts!) {
        const choice = g.choices!.find((c) => c.id === key[p.id])!.text;
        expect(choice, `seed ${seed} ${p.text}`).toBe(`Boxplot ${m[p.text.replace('Histogram ', '')]}`);
      }
    }
  });
});

// ---------- 2. summary table ----------

function recomputeSummary(g: Generated): number {
  const h = g.table!.header!;
  const row = g.table!.rows[0];
  const col = (name: string) => Number(row[h.indexOf(name)]);
  const [mean, s, q1, q3, mn, mx, md] = [col('Mean'), col('Std. dev.'), col('Q1'), col('Q3'), col('Min'), col('Max'), col('Median')];
  expect(mn <= q1 && q1 <= md && md <= q3 && q3 <= mx).toBe(true);
  expect(Math.abs(col('Variance') - s * s)).toBeLessThan(0.01);
  const fromZ = /z-score of \*\*(-?[\d.]+)\*\*/.exec(g.stem);
  if (fromZ) return mean + Number(fromZ[1]) * s;
  if (/upper fence/.test(g.stem)) return q3 + 1.5 * (q3 - q1);
  if (/lower fence/.test(g.stem)) return q1 - 1.5 * (q3 - q1);
  const x = Number(/\*\*(-?[\d.]+)\*\*/.exec(g.stem)![1]);
  expect(/z-score of this/.test(g.stem)).toBe(true);
  return (x - mean) / s;
}

describe('describing-distributions.summary-table', () => {
  it('numeric: the answer is recomputed from the printed table', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('describing-distributions.summary-table', seed, 'numeric');
      expect(Math.abs((g.correctAnswer as number) - recomputeSummary(g)), `seed ${seed}: ${g.stem}`).toBeLessThanOrEqual(0.006);
    }
  });
  it('single-choice: only the key matches the recomputed value', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('describing-distributions.summary-table', seed, 'single-choice');
      const v = recomputeSummary(g);
      for (const o of g.options!) expect(Math.abs(Number(o.text) - v) <= 0.006, `seed ${seed} ${o.text} vs ${v}`).toBe(o.id === g.correctAnswer);
    }
  });
});

// ---------- 3. histogram: median / quartile class, percentages ----------

function readHistogram(g: Generated) {
  const svg = svgOf(g.images![0].src);
  const ax = axis(svg);
  const edges = els(svg, 'text', 'xt').map((e) => Number(e.text));
  const bars = els(svg, 'rect', 'bar');
  const heights = bars.map((e) => ax.len(e.a.height));
  const n = Number(/data of (\d+) /.exec(g.stem)![1]);
  const pct = /Percentage of/.test(svg);
  const counts = heights.map((h) => (pct ? Math.round((h * n) / 100) : Math.round(h)));
  heights.forEach((h, i) => expect(Math.abs(h - (pct ? (100 * counts[i]) / n : counts[i]))).toBeLessThan(0.06));
  expect(counts.reduce((a, b) => a + b, 0)).toBe(n);
  // value labels sit above the middle of their bar (empty bars have none)
  const vs = els(svg, 'text', 'v');
  const labels = bars.map((b) => {
    const l = vs.find((v) => Math.abs(v.a.x - (b.a.x + b.a.width / 2)) < 0.02);
    return l ? parseFloat(l.text) : 0;
  });
  labels.forEach((l, i) => expect(Math.abs(l - (pct ? (100 * counts[i]) / n : counts[i]))).toBeLessThan(0.051));
  return { edges, counts, n, pct, labels };
}
const classIdx = (edges: number[], x: number) => edges.findIndex((e, i) => i < edges.length - 1 && x >= e && x < edges[i + 1]);

describe('describing-distributions.histogram-center', () => {
  it('single-choice: the keyed class holds the median / quartile of randomly filled raw data', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('describing-distributions.histogram-center', seed, 'single-choice');
      const { edges, counts } = readHistogram(g);
      const which = /the median/.test(g.stem) ? 'median' : /Q_1/.test(g.stem) ? 'q1' : 'q3';
      const found = new Set<number>();
      for (let fill = 0; fill < 4; fill++) {
        const r = makeRng(seed * 31 + fill);
        const xs = counts.flatMap((c, i) => Array.from({ length: c }, () => edges[i] + (edges[i + 1] - edges[i]) * (0.001 + 0.998 * r.next())));
        const v = which === 'median' ? median(xs) : quartiles(xs)[which];
        found.add(classIdx(edges, v));
      }
      expect(found.size, `seed ${seed}: class depends on the filling`).toBe(1);
      const cls = [...found][0];
      for (const o of g.options!) {
        const m = /^from ([\d.]+) to less than ([\d.]+)/.exec(o.text!)!;
        const i = edges.indexOf(Number(m[1]));
        expect(edges[i + 1]).toBe(Number(m[2]));
        expect(i === cls, `seed ${seed} ${o.text}`).toBe(o.id === g.correctAnswer);
      }
    }
  });
  it('numeric: the percentage is recounted from the bars', () => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('describing-distributions.histogram-center', seed, 'numeric');
      const { edges, counts, n, pct, labels } = readHistogram(g);
      const b = Number(/\*\*([\d.]+)\*\*/.exec(g.stem.split('\n').pop()!)![1]);
      const t = edges.indexOf(b);
      expect(t).toBeGreaterThan(0);
      const question = g.stem.split('\n').pop()!;
      const atLeast = /at least|or more/.test(question);
      expect(atLeast).toBe(!/less than|below|shorter than/.test(question));
      const idx = counts.map((_, i) => i).filter((i) => (atLeast ? i >= t : i < t));
      const exact = (100 * idx.reduce((a, i) => a + counts[i], 0)) / n;
      expect(Math.abs((g.correctAnswer as number) - exact), `seed ${seed}`).toBeLessThanOrEqual(0.05 + 1e-9);
      if (pct) {
        const printed = idx.reduce((a, i) => a + labels[i], 0);
        expect(g.acceptRange![0] <= exact && exact <= g.acceptRange![1]).toBe(true);
        expect(g.acceptRange![0] <= printed + 1e-9 && printed - 1e-9 <= g.acceptRange![1]).toBe(true);
      }
    }
  });
});

// ---------- 4. boxplot statements ----------

function judge(text: string, boxes: ReadBox[]): boolean {
  const get = (name: string) => boxes.find((b) => b.name === name)!;
  const top = (f: (b: ReadBox) => number, name: string) => {
    const v = f(get(name));
    return boxes.every((b) => b.name === name || f(b) < v - 1e-9);
  };
  const range = (b: ReadBox) => Math.max(b.hi, ...b.out) - Math.min(b.lo, ...b.out);
  const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
  let m: RegExpExecArray | null;
  if ((m = /^\*\*(.+?)\*\* has the highest median\.$/.exec(text))) return top((b) => b.med, m[1]);
  if ((m = /^\*\*(.+?)\*\* has the largest interquartile range\.$/.exec(text))) return top((b) => b.q3 - b.q1, m[1]);
  if ((m = /^\*\*(.+?)\*\* has the largest range\.$/.exec(text))) return top(range, m[1]);
  if (/has the (highest mean|largest standard deviation|highest mode)\.$/.test(text)) return false; // not shown by a boxplot
  if ((m = /^The interquartile range of \*\*(.+?)\*\* is about ([\d.]+) /.exec(text))) return near(get(m[1]).q3 - get(m[1]).q1, Number(m[2]));
  if ((m = /^About a quarter of the values in \*\*(.+?)\*\* are larger than ([\d.]+) /.exec(text))) return near(get(m[1]).q3, Number(m[2]));
  if ((m = /^Half of the values in \*\*(.+?)\*\* lie between ([\d.]+) and ([\d.]+) /.exec(text))) return near(get(m[1]).q1, Number(m[2])) && near(get(m[1]).q3, Number(m[3]));
  if ((m = /^At least half of the values in \*\*(.+?)\*\* are at least as high as the highest value in \*\*(.+?)\*\*\.$/.exec(text))) {
    const b = get(m[2]);
    return get(m[1]).med >= Math.max(b.hi, ...b.out) - 1e-9;
  }
  throw new Error(`unknown statement: ${text}`);
}

describe('describing-distributions.boxplots', () => {
  const check = (type: GenType) => {
    for (let seed = 1; seed <= SEEDS; seed++) {
      const g = gen('describing-distributions.boxplots', seed, type);
      const boxes = readBoxes(g.images![0].src);
      for (const b of boxes) {
        const iqr = b.q3 - b.q1;
        expect(b.lo <= b.q1 && b.q1 < b.med && b.med < b.q3 && b.q3 <= b.hi).toBe(true);
        expect(b.lo >= b.q1 - 1.5 * iqr - 0.01 && b.hi <= b.q3 + 1.5 * iqr + 0.01, `seed ${seed} whiskers inside the fences ${JSON.stringify(b)}`).toBe(true);
        for (const o of b.out) expect(o > b.q3 + 1.5 * iqr + 0.01 || o < b.q1 - 1.5 * iqr - 0.01, 'outlier beyond a fence').toBe(true);
      }
      const truth = g.options!.filter((o) => judge(o.text!, boxes)).map((o) => o.id);
      if (type === 'single-choice') expect(truth, `seed ${seed}`).toEqual([g.correctAnswer]);
      else expect(truth, `seed ${seed}`).toEqual(g.correctAnswer);
    }
  };
  it('single-choice: only the key is a certain conclusion from the figure', () => check('single-choice'));
  it('multi-select: the key is exactly the set of certain conclusions', () => check('multi-select'));
});
